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

## Scenario: durable arrow aggregation and idempotent retry

### 1. Scope / Trigger

`addRoundArrows` is called after scored rounds across battle and practice modes. Direct writes per round are forbidden on this hot path: update the member-scoped local counter immediately, then aggregate official-account progress into durable operations.

### 2. Signatures

```js
addRoundArrows(memberId, count) -> Promise<void>
flushPendingArrowOperations(memberId?) -> Promise<{ synced, pending }>
subscribeTodayArrowCount(memberId, callback) -> unsubscribe
initializeTodayArrowCount(memberId) -> Promise<number>
```

Firestore marker: `arrowRoundOperations/{operationId}` contains immutable ownership, count, device/sequence identity, and creation metadata. No collection query or composite index is required.

### 3. Contracts

- Local daily keys include both `memberId` and an `Asia/Taipei` `YYYY-MM-DD` date.
- An official member's pending operation has a stable device ID plus monotonically increasing sequence; retry never creates a new operation ID.
- Flush occurs at 12 pending arrows, 10 seconds, session finalization, profile initialization, class end, and page hide.
- One transaction checks the marker, then updates lifetime arrows, excavation fields, any cached active arrow goal, and creates the marker. If the marker exists, the operation is already complete.
- Remove a local operation only after transaction success. Re-read local storage during cleanup so an operation queued while a flush was in flight is not overwritten.
- Guest/kid lookup is cached briefly; lookup failure is fail-closed and must not enqueue an official write.

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| Invalid member/count | No local or server mutation |
| Guest/kid member | Local daily display only |
| Account-type lookup fails | Keep display update; do not enqueue official progress |
| Marker already exists | Treat as successful retry; do not increment again |
| Transaction/network failure | Keep the durable local operation for retry |
| Concurrent flush calls | Share one member flight |
| New operation arrives during flush | Preserve it when completed entries are removed |
| Malformed local-storage payload | Recover as an empty queue without crashing the app |

### 5. Good/Base/Bad Cases

- **Good**: Twenty three-arrow rounds normally produce about five 12-arrow operations instead of twenty member/goal write cycles.
- **Base**: Firestore commits and the browser closes before local cleanup; the same operation retries, sees its marker, and is removed without a second increment.
- **Bad**: Generate a new ID for every retry, or save the queue only in memory; this respectively duplicates progress or loses arrows after a crash.

### 6. Tests Required

- Build: `npm run build`.
- Verify member/date key isolation and Taiwan midnight boundaries.
- Verify same-tab custom events and cross-tab storage events unsubscribe cleanly.
- Verify 12-arrow and 10-second thresholds plus all explicit flush points.
- Verify marker replay leaves lifetime, excavation, and goal values unchanged.
- Verify failed, other-member, and concurrently appended operations remain queued.
- Verify Firestore rules allow marker `get`/owned `create` but reject list, update, and delete. Use the rules emulator when the project adds one; until then perform static review and deploy rules before client rollout.

### 7. Wrong vs Correct

#### Wrong

```js
await updateDoc(memberRef, { totalArrowsAllTime: increment(count) });
localStorage.removeItem(pendingKey); // a crash between these steps can replay the increment
```

#### Correct

```js
await runTransaction(db, async tx => {
  const marker = await tx.get(operationRef);
  if (marker.exists()) return;
  tx.update(memberRef, aggregatedPatch);
  tx.set(operationRef, immutableOperationMarker);
});
removeOnlyTheCompletedLocalOperation(operationId);
```

---

## Scenario: controlled legacy-data migrations

### 1. Scope / Trigger

Any migration that scans multiple members or expands one source record into several Firestore documents is an operational job, not a page-mount side effect. The July 2026 automatic performance migrations produced tens of thousands of reads/writes when admin sessions reopened.

### 2. Signatures

```js
migrateAllLegacyPracticeLogs() // operational function; never call from normal UI lifecycle
migrateAllLegacyMonsterLogs()  // operational function; never call from normal UI lifecycle
```

A future UI/tool must expose explicit dry-run and bounded execution contracts before reconnecting these exports.

### 3. Contracts

- Never start an all-member migration from `useEffect`, route mount, login, or ordinary page navigation.
- Never use `sessionStorage`/`localStorage` as the global completion marker for a shared database migration.
- A controlled migration requires an explicit operator action, Firestore global marker/lease, stable version, cursor, fixed batch limit, progress counters, resumability, and failure details.
- Changing a browser guard key must never be used to force a whole-database rerun.
- Keep automatic UI call sites at zero until the complete operational contract exists.

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| Admin opens/reopens Members | Zero migration reads or writes |
| Another tab/device/admin opens Members | Zero migration reads or writes |
| Previous batch failed | Resume only from persisted server cursor after explicit action |
| Lease is active | Reject a second runner |
| Dry-run requested | Report counts and estimated document operations; perform no writes |
| Batch reaches limit | Persist cursor/progress and stop cleanly |

### 5. Good/Base/Bad Cases

- **Good**: An operator previews 500 pending records, starts a 50-record batch under a global lease, and resumes from the saved cursor.
- **Base**: `AdminMembers` imports no all-member migration functions; the exports remain dormant for a future tool.
- **Bad**: A mount effect guarded by `sessionStorage` scans every member. New tabs/devices rerun it, and one failed member prevents the completion flag forever.

### 6. Tests Required

- Repository search: all-member migration exports have no normal UI call sites.
- Mount/remount Admin Members and assert no migration function invocation.
- For a future tool, test lease exclusion, dry-run zero writes, batch limit, cursor resume, version completion, and partial failure reporting.
- Run `npm run build` after removing or adding migration entry points.

### 7. Wrong vs Correct

#### Wrong

```js
useEffect(() => {
  if (!sessionStorage.getItem("migration-v3")) migrateAllLegacyPracticeLogs();
}, []);
```

#### Correct

```js
// Normal pages have no migration effect. A separate admin operation must
// acquire a Firestore lease and execute an explicit bounded batch.
```

---

## Convention: `limit()` over server-side `where` filtering when it would require a new composite index

**What**: `subscribePracticeLogs(memberId, callback, maxCount=300)` gained a `limit(maxCount)` cap. `WorldBossLobby.jsx`/`PartyLobby.jsx` pass `maxCount=60` and still filter by `source` client-side.

**Why**: The "correct" fix would be `where("memberId","==",id) + where("source","==","worldboss") + orderBy("date","desc")`, but that requires a new Firestore composite index, which — like `firestore.rules` — cannot be deployed via CLI in this project (needs manual Firebase Console action). A missed manual step means the feature breaks in production with `FirebaseError: The query requires an index`. Adding `limit()` to the existing (already-indexed) query shape needs zero new index and still bounds the worst-case read size. When a "more correct" fix requires a new manual Console step and a "good enough" fix doesn't, prefer the one that doesn't, unless the read savings clearly justify the deployment risk.

**Related**: [[guest-kid-mode]] gotcha section — same manual-Console-step risk class as `firestore.rules` changes.
