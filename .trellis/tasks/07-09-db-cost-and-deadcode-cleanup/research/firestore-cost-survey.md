# Research: Firestore read/write cost survey

- **Query**: Part A — survey `src/lib/*.js` (db.js + `*Db.js`) and components with direct `onSnapshot`/`getDocs`/`collection(db,...)` for Firestore cost hotspots
- **Scope**: internal (whole `src/` tree, prioritized by hotness)
- **Date**: 2026-07-09

## Findings — ranked by estimated impact (frequency × payload)

### Tier 1 — fires on every single arrow round, every battle mode, every member

1. **`src/lib/db.js:285-300` `addRoundArrows(memberId, count)`** — called after *every* round submission in `MonsterBattle.jsx:565`, `DuelRoom.jsx:247`, `PartyBattleRoom.jsx:181`, `DungeonBattleRoom.jsx:214`, `CouncilBattle.jsx:413`, `MemberCertExam.jsx:240`, `WorldBossAttack.jsx:715`. This is the single hottest code path in the app — it fires on every scoring round in every game mode for every member.
   - It does 2 separate `updateDoc` writes to the **same** `members/{id}` doc (one here for `totalArrowsAllTime`, one inside `addExcavationByArrows` below) that could be merged into a single write.
   - It also chains a full `getDoc(members/{id})` read via `addExcavationByArrows` (see #2) on every call — i.e. every round costs 1 read + 2 writes to the member doc, multiplied across the entire member base.
   - **Why expensive**: highest possible call frequency in the codebase; small win (merging writes) has an outsized aggregate effect.

2. **`src/lib/dungeonExcavation.js:197-230` `addExcavationByArrows(memberId, arrowCount)`** — invoked from inside `addRoundArrows` (db.js:297-298) via dynamic import, i.e. on every arrow round everywhere. Does `getDoc(doc(db,"members",memberId))` to read the *entire* member document just to inspect `dungeonExcavation.progress`/`lastActiveDate`, then writes back with `updateDoc`/`setDoc`.
   - **Why expensive**: full-document read of `members/{id}` (a large, frequently-read/written doc) on every round, purely to check two small subfields. Could be avoided with a cached/passed-in excavation snapshot (the codebase already has this "clientData, no getDoc" pattern established for `upgradeEquipSlot`/`submitMonthlyCardRequest` per quick-ref) or by having the caller pass current progress instead of re-reading.

3. **`src/lib/dungeonExcavation.js:167-191` `addExcavationByCheckin(memberId)`** — same full `getDoc(members/{id})` + write pattern as #2, but only fires once/day per member on checkin (`db.js:1043,1061`), so much lower frequency. Same fix opportunity (avoid the extra read) applies but lower priority than #2.

### Tier 2 — fires on every open of a very high-traffic page (MonsterBattle / battle history)

4. **`src/components/member/MonsterBattle.jsx:363`** `subscribeMonsterLogs(profile.id, v => setHistory(v), 100)` — a **real-time** subscription of up to 100 monster-battle-log docs, mounted for the entire lifetime of the MonsterBattle component (the core gameplay page, opened extremely frequently). It's only used to render a 30-item preview slice (`MonsterBattle.jsx:1301-1302`, `history.slice(0,30)`).
   - The same component *also* does a one-off `getMonsterLogs(profile.id, 20)` fetch (`MonsterBattle.jsx:1124`) when the user explicitly opens the "history" phase, which overwrites the same `history` state — i.e. there are two different, redundant fetch mechanisms feeding the same state.
   - **Why expensive**: 100-doc real-time listener re-established on every MonsterBattle mount (i.e., every battle session for every member) when a one-time bounded fetch (like the existing `getMonsterLogs(20)` call) would suffice for the preview widget — real-time updates aren't needed for a "recent history" preview.
   - **Fix direction**: replace the `subscribeMonsterLogs(...,100)` mount-time subscription with a smaller one-time `getMonsterLogs(profile.id, 20-30)` fetch; keep the existing one-off fetch as the sole "history" phase data source.

### Tier 3 — always-mounted top-level subscriptions (run for every member session / every admin session)

5. **`src/pages/AdminApp.jsx:399-419`** — one `useEffect([])` fires 7 concurrent collection-level subscriptions the instant AdminApp mounts (every coach session, kept alive for the whole session): `subscribePendingCertResults`, `subscribeAllMessages`, an inline `onSnapshot(query(externalComps, where status==pending_review))`, `subscribePendingCertTasks`, `subscribePendingCheckins`, `subscribePendingMonthlyRequests`, `subscribeGuildSubmissions`. Individually most are `where`-scoped and small, but see #6 for the one unscoped collection in this block. Admin-only so fan-out is small (few coaches), but the listeners are permanently open for the entire session.

6. **`src/lib/db.js:926-949` `subscribePendingCertTasks(callback)`** — `onSnapshot(collection(db, "certifications"))` with **no `where`/`limit`** — subscribes to the *entire* `certifications` collection (one doc per member) just to scan each doc's nested `blue/gold.task1/task2.reviewStatus` fields client-side for `"pending"`. Mounted for every AdminApp session (see #5).
   - **Why expensive**: full collection read (O(member count)) on every admin session open, and it re-reads on any write to *any* member's certification doc, not just pending-review ones. Should be replaced by a `where`-based query if a denormalized "hasPendingCertTask" flag/field were added, or narrowed via a collection-group/status field.

7. **`src/pages/MemberApp.jsx` / `AdminApp.jsx`** top-level `useEffect` block (MemberApp.jsx:275-339+, AdminApp.jsx:205-285) mounts **7 separate single-doc `onSnapshot` listeners per member** (`subscribeCertification`, `subscribeDexGrants`, `subscribeMonsterDex`, `subscribeCraftStats`, `subscribeChestStats`, `subscribePotionDex`, `subscribeCardCollection`) plus `subscribeNotifications`, `subscribeMyCheckin`, `subscribeTodayPracticeLogs`, `subscribeActiveGuildQuests`, `subscribeAppVersion`, `subscribeLatestBroadcast`, `subscribeActiveWorldBoss` — i.e. **~13 concurrent onSnapshot listeners open per member, for the entire session, on both Admin and Member apps**. Each individual listener is well-scoped (single doc or narrow `where`), so this is architecturally reasonable, but it's worth flagging as the aggregate connection-count baseline (13 listeners × every concurrent member) when reasoning about total quota usage — a candidate for later consolidation into fewer aggregate docs if read volume becomes a real problem, but **not** a "quick fix" item like #1-4.

### Tier 4 — unbounded queries on moderately-trafficked pages

8. **`src/lib/db.js:224-234` `subscribePracticeLogs(memberId, callback)`** — `onSnapshot(query(practiceLogs, where memberId==, orderBy date desc))` with **no `limit()`** — subscribes to a member's *entire lifetime* practice-log history. Used in 3 places:
   - `src/components/worldboss/WorldBossLobby.jsx:202` — only to `.filter(l => l.source==="worldboss")` for a small "my world-boss logs" list. Should use `where("source","==","worldboss")` + a `limit()` instead of pulling all history client-side.
   - `src/components/party/PartyLobby.jsx:37` — same pattern, filters by `source==="party"` client-side. Same fix.
   - `src/components/member/MemberPractice.jsx:2309` — legitimate use (this page's purpose is to show full practice history), but still unbounded; consider adding a `limit()` as a defensive cap.
   - **Why expensive**: WorldBossLobby and PartyLobby are commonly-visited lobby pages; every visit re-reads a member's *entire* practice history just to extract a small filtered subset that a `where` clause could produce directly.

9. **`src/lib/dungeonDb.js:1246-1251` `subscribeAllDungeonBroadcasts(callback)`** — `onSnapshot(query(dungeonBroadcasts, orderBy createdAt desc))` with **no `limit()`**. Grep found **zero call sites** anywhere in `src/` other than its own definition — appears to be dead code today (see dead-code-survey.md), but flagged here too since if it's ever wired up it would be an unbounded-history hotspot; add `limit()` before reviving it.

### Tier 5 — write-amplification / heartbeat patterns (lower priority, bounded by design)

10. **`src/components/duel/DuelRoom.jsx:318-323` and `DuelLobby.jsx:108-113`** — `setInterval(() => updateDuelHeartbeat(roomId, myId), 30000)` — a Firestore write every 30s per player while in a duel room/lobby. Bounded (only while actively in a duel), but worth noting as a steady per-active-user write cost; low priority given duels are a minority of session time.

### Redundant subscription to data already available elsewhere

11. **`src/lib/dungeonDb.js:1309-1313` `subscribeCollectibles(memberId, cb)`** — opens its own `onSnapshot(doc(db,"members",memberId))` purely to read the `dungeonCollectibles` field. But `useAuth.js:87` (`src/hooks/useAuth.js`) **already** subscribes to the same `members/{id}` document (via a `memberQuery` onSnapshot) and stores the full doc in `profile` — so `profile.dungeonCollectibties` is already live in memory. `subscribeCollectibles` is only called from `src/components/dungeon/DungeonDex.jsx:26`, opening a second, fully redundant listener on the same document whenever DungeonDex is open.
    - **Fix direction**: read `profile.dungeonCollectibles` directly instead of subscribing again.

## Caveats / Not Found

- Did not exhaustively check every one of the ~250+ exported functions in `db.js` for query-shape issues; focused on functions reachable from always-mounted app shells (`AdminApp.jsx`/`MemberApp.jsx`) and the hottest gameplay loop (arrow-round submission), per the prioritization instruction.
- No true N+1 `getDoc`-in-a-loop pattern was found anywhere in `src/lib/*.js` (checked via regex for `for`/`.map`/`Promise.all` wrapping `getDoc`) — the one `Promise.all([getDoc, getDoc])` at `db.js:3815` is a fixed 2-item batch (listing + buyer), not a loop, and is fine.
- `subscribeEquipItems` (db.js:3242, full unscoped collection) and `subscribeAllGuildQuests` (db.js:1357, full unscoped collection) were checked but are low priority: equip-items catalog and guild-quest-history are both admin/shop pages, not always-mounted, and likely small/slow-growing collections — listed here only for completeness, not included in the ranked list above.
- Recently-fixed hotspot (commits `a823743`/`024bbca`/`dd33662`, `subscribeNotifications` limit(50)) was confirmed already applied at `db.js:802` and excluded from this list.
