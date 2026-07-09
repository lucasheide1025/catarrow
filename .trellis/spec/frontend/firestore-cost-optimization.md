# Firestore Read/Write Cost Optimization

> Session-level in-memory caching for the hottest write path (arrow-round scoring), plus bounded/one-off reads replacing unbounded live listeners. See task `07-09-db-cost-and-deadcode-cleanup` for the full research and rationale.

---

## Scenario: `addRoundArrows` / `computeExcavationPatch` merged write + session cache

### 1. Scope / Trigger

Cross-layer contract change: `addExcavationByArrows` (write-and-return-void) was replaced by `computeExcavationPatch` (compute-and-return-patch, caller writes). This is the highest-traffic code path in the app — it fires on every scored arrow round in every game mode (MonsterBattle/DuelRoom/PartyBattleRoom/DungeonBattleRoom/CouncilBattle/MemberCertExam/WorldBossAttack). Code-spec depth required.

### 2. Signatures

`src/lib/dungeonExcavation.js`
```js
// Internal cache (module-level, not exported)
readExcavationCached(memberId) -> Promise<ExcavationState | null>   // getDoc on cache miss/stale, else returns cached object
computeExcavationPatch(memberId, arrowCount) -> Promise<{ patch: object } | null>   // pure compute, does NOT write

// ExcavationState shape: { progress, lastActiveDate, dailyArrowsUsed, pendingReveal?, savedDungeons?, ..., ts }
```

`src/lib/db.js`
```js
addRoundArrows(memberId, count) -> Promise<void>   // signature unchanged; now issues ONE updateDoc instead of two
subscribePracticeLogs(memberId, callback, maxCount = 300) -> unsubscribe   // maxCount param added, backward compatible
```

### 3. Contracts

`computeExcavationPatch` return value merges directly into the single `updateDoc` call in `addRoundArrows`:
```js
// addRoundArrows body
const patch = { totalArrowsAllTime: increment(count) };
const excav = await computeExcavationPatch(memberId, count);   // null if doc missing or progress already capped at 100
if (excav) Object.assign(patch, excav.patch);
await updateDoc(doc(db, C.members, memberId), patch);           // single write, was two
```
`patch` fields use Firestore dot-paths (`"dungeonExcavation.progress"`, etc.), NOT a nested object replacement — this preserves untouched sibling subfields (`pendingReveal`, `savedDungeons`, `scrolls`, `autoDigNextAt`) exactly like the old `{...current, ...}` spread did, without needing to read them.

**Cache invariant**: `_excavCache` (Map<memberId, ExcavationState & {ts}>) is the single source of truth for `computeExcavationPatch`'s reads within a session. Every OTHER function in `dungeonExcavation.js` that writes to a member's `dungeonExcavation` field MUST call `_excavCache.delete(memberId)` immediately after its write succeeds. As of this change, 13 other functions in the file do this (`resetAutoDigTimer`, `claimAutoDig`, `initDailyExcavation`, `addExcavationByCheckin`, `revealExcavation`, `upgradeExcavationDifficulty`, `downgradeExcavationDifficulty`, `completeExcavation`, `abandonExcavation`, `saveExcavation`, `removeSavedDungeon`, `grantDungeonScroll`, `useDungeonScroll`, `adminSetSavedDungeon`). **Any new function added to this file that writes `dungeonExcavation` must also invalidate the cache, or it will silently be overwritten by the next stale-cached `computeExcavationPatch` call.**

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| `computeExcavationPatch` called, `dungeonExcavation.progress >= 100` | Returns `null` immediately (same cap behavior as before) — `addRoundArrows` still writes `totalArrowsAllTime` alone |
| Member doc doesn't exist | `readExcavationCached` returns `null` → `computeExcavationPatch` returns `null` → same as above |
| Cache entry present and fresh (`Date.now() - ts < 5min`) | No `getDoc`; compute directly off cached state |
| Cache entry stale/absent | One `getDoc`, populate cache, then compute |
| Any other function in the file writes `dungeonExcavation` | Must `_excavCache.delete(memberId)` right after, or subsequent arrow-round writes will stomp it with stale data |

### 5. Good/Base/Bad Cases

- **Good**: A member fires 12 arrows across 2 rounds in one MonsterBattle session — 1 real `getDoc` (first arrow), 12 real `updateDoc` calls (one per arrow, each a single merged write instead of two).
- **Base**: Member checks in (`addExcavationByCheckin`) mid-session, then immediately fires an arrow — the checkin's write invalidates `_excavCache`, so the next arrow's `computeExcavationPatch` does a fresh `getDoc` instead of using pre-checkin cached state.
- **Bad**: Adding a new `dungeonExcavation`-writing function without a `_excavCache.delete(memberId)` call — its write will look like it succeeded (Firestore confirms it) but the next arrow fired within the cache TTL will overwrite it with pre-write cached values, silently reverting the change.

### 6. Tests Required

- Manual: play a full MonsterBattle round, compare `totalArrowsAllTime` and `dungeonExcavation.progress`/`dailyArrowsUsed` before/after against the same values you'd get from the pre-change two-write version (values must match exactly).
- Manual: play a DungeonBattleRoom round, same check.
- Manual/code trace: day-rollover branch (`lastActiveDate !== today`) — verify `progress` gets capped at 100 and `dailyArrowsUsed` resets to just `arrowCount`, matching the old `setDoc(...,{merge:true})` branch.
- Build: `CI=true npx react-scripts build` after any change to this file.

### 7. Wrong vs Correct

#### Wrong
```js
// Adding a new function that writes dungeonExcavation without invalidating the cache
export async function grantBonusExcavation(memberId, amount) {
  await updateDoc(doc(db, "members", memberId), {
    "dungeonExcavation.progress": increment(amount),
  });
  // missing: _excavCache.delete(memberId)
  // -> next addRoundArrows call reads stale cached progress, computes from the OLD value,
  //    and overwrites this bonus with a smaller number
}
```

#### Correct
```js
export async function grantBonusExcavation(memberId, amount) {
  await updateDoc(doc(db, "members", memberId), {
    "dungeonExcavation.progress": increment(amount),
  });
  _excavCache.delete(memberId);
}
```

---

## Convention: one-off fetch instead of live listener for "recent history" previews

**What**: `MonsterBattle.jsx`'s battle-history preview widget switched from a permanently-open `subscribeMonsterLogs(profile.id, cb, 100)` listener to a one-off `getMonsterLogs(profile.id, 30)` fetch on mount, with an explicit `refreshHistory()` call chained after both the win-path and lose-path `saveMonsterLog(...)` calls.

**Why**: A live 100-doc listener held open for the entire lifetime of the single most-visited gameplay page has no real-time requirement — the data only needs to be fresh at two moments (page open, battle just ended), not continuously. Any UI that renders "recent N records" as a static preview (not a shared multi-user live view) should default to a one-off bounded fetch, refreshed explicitly at the moments the underlying data could have changed, rather than an `onSnapshot`.

**Related**: [[project_state]] — same principle applied to `DungeonDex.jsx` (removed a redundant `subscribeCollectibles` listener in favor of reading `profile.dungeonCollectibles`, already live via `useAuth.js`'s own top-level member-doc subscription — don't open a second listener on data you already have).

## Convention: `limit()` over server-side `where` filtering when it would require a new composite index

**What**: `subscribePracticeLogs(memberId, callback, maxCount=300)` gained a `limit(maxCount)` cap. `WorldBossLobby.jsx`/`PartyLobby.jsx` pass `maxCount=60` and still filter by `source` client-side.

**Why**: The "correct" fix would be `where("memberId","==",id) + where("source","==","worldboss") + orderBy("date","desc")`, but that requires a new Firestore composite index, which — like `firestore.rules` — cannot be deployed via CLI in this project (needs manual Firebase Console action). A missed manual step means the feature breaks in production with `FirebaseError: The query requires an index`. Adding `limit()` to the existing (already-indexed) query shape needs zero new index and still bounds the worst-case read size. When a "more correct" fix requires a new manual Console step and a "good enough" fix doesn't, prefer the one that doesn't, unless the read savings clearly justify the deployment risk.

**Related**: [[guest-kid-mode]] gotcha section — same manual-Console-step risk class as `firestore.rules` changes.
