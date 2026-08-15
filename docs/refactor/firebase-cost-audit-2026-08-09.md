# Firebase Cost Audit — 2026-08-09

## Scope and method

This is a static audit of production `src/` and `functions/` only. Tests, docs, backups, generated output, and build artifacts are excluded. The inventory searched direct calls to `onSnapshot`, `getDoc`, `getDocs`, `setDoc`, `updateDoc`, `addDoc`, `runTransaction`, and `writeBatch`, then traced listener wrappers into mounted React surfaces.

Raw direct-call counts are 83 listeners, 179 single-document reads, 96 query reads, 83 `setDoc`, 322 `updateDoc`, 45 `addDoc`, 114 transactions, and 12 batches. These are source call sites, not billed-operation estimates: a transaction can retry, a query bills returned documents (and sometimes index-entry reads), and a listener bills its initial result plus subsequent document changes/reconnects. No claim below treats a batch as reducing Firestore write billing; batches improve atomicity and network round trips, not per-document write charges.

The classifications follow the task design:

- **R0 — required real-time:** shared combat/room state and security/access state whose correctness or promised UX requires immediate updates.
- **R1 — page-scoped real-time:** useful live data, but only while its owning surface is visible.
- **R2 — bounded one-off:** history, preview, catalog, or administrative data that can load once and explicitly refresh after mutation.
- **R3 — client/cache first:** append-only history, locally driven counters/timers, or rarely changing configuration suitable for local/HTTP/TTL caching.

## Listener inventory and classification

Every direct `onSnapshot` occurrence is represented below. A row with several line numbers represents independent listener call sites with the same lifecycle and recommendation.

| Class | Evidence and Firestore target | Current lifecycle / query shape | Risk and recommended strategy |
|---|---|---|---|
| R0 | `src/hooks/useAuth.js:140` — `members/{memberId}` | Auth-session member profile document | Keep. This is the authoritative profile snapshot reused throughout the app. Child surfaces should consume `profile`, not re-read the member document. |
| R0 | `src/hooks/useCostControl.js:39` — `sysConfig/costControl` | One provider-owned document listener | Keep exactly one provider listener. The existing spec explicitly forbids feature-level duplicates. |
| R0 | `src/pages/GuestApp.jsx:167` — `members/{guestId}` | Guest-session profile document | Keep; guest identity/progress must follow the authoritative document. |
| R0 | `src/pages/MemberApp.jsx:384-385`, `src/lib/db.js:5443,5458` — `systemConfig/maintenance`, `systemConfig/tierPermissions` | App-session access/security configuration | Keep the MemberApp-owned instances. `AdminMembers` and `AdminTierPermissions` duplicates below should receive shared state or be page-scoped only if editing needs a dedicated source. |
| R0 | `src/lib/db.js:1824` — `checkins/{memberId_today}` | Wrapper used at app and feature levels | Keep one owner per signed-in shell. Duplicate consumers are the problem, not the real-time contract. |
| R0 | `src/lib/worldBossDb.js:43,124,159` — status/current, event status, active event document | Global low-churn status plus active battle/event documents | Keep status/current at app level; keep event documents only inside World Boss surfaces. The split status document is an already-completed optimization. |
| R0 | `src/lib/dungeonDb.js:69`, `src/components/dungeon/DungeonExpedition.jsx:156`, `src/components/dungeon/TeamExpeditionBattle.jsx:299`, `src/lib/expeditionTeamDb.js:188`, `src/lib/partyDb.js:190`, `src/lib/duelDb.js:128`, `src/lib/gatheringPartyDb.js:90`, `src/lib/villageBoardTeamDb.js:159`, `src/guild/db/guildTeamDb.js:267`, `src/zombie/db/zombieDb.js:285`, `src/lib/raidMatchDb.js:256`, `src/lib/raidTeamDb.js:232` — room documents | Mounted multiplayer/coordination room | Keep while the room is mounted and always unsubscribe on exit. These are correctness-critical shared state. Verify the two direct dungeon-room listeners are not simultaneously mounted for the same room. |
| R0 | `src/guild/db/guildDb.js:65` — `guildProfiles/{memberId}` | Guild feature profile | Keep only while the guild surface is mounted; do not promote it to the app shell. |
| R1 | `src/pages/MemberApp.jsx:249,329,375,379,403` through wrappers — latest dungeon broadcast, active guild quests, notifications (limit 20), app version, World Boss status | Mostly app-session listeners; `liveExtras` gates two | World Boss status and notifications are justified global UX. App version is one tiny document. Active quests and dungeon broadcasts should be measured and preferably mounted only when their alert experience is enabled; they are not player-state authorities. |
| R1 | `src/pages/AdminApp.jsx:175-176,417` — pending review/invite queries (limit 100), pending external competitions | Admin shell, regardless of selected admin page | These listeners feed global badges/review entry points, so page-scoping them without a replacement changes UX. Prefer tiny server-maintained counters if global badges are mandatory; otherwise mount on review pages. |
| R1 | `src/pages/AdminApp.jsx:414-431` through wrappers — pending certification results/tasks, all messages (limit 150), pending checkins, monthly requests, guild submissions | Admin shell | Same shell-wide fan-out, but the data drives global badges and the repeated pending-check-in alert. Keep the required signals globally; a future small counter/queue can allow full lists to become page-owned. Several queries are unbounded (pending cert results/tasks, checkins, monthly requests, guild submissions). |
| R1 | `src/pages/AdminApp.jsx:249,255,299,328-334,445,450,465` through wrappers | Archer-mode member listeners plus admin global signals | Preserve archer-mode real-time behavior, but share profile-derived/member-scoped data and avoid duplicating child listeners. |
| R1 | `src/components/admin/AdminGuestReviews.jsx:52,57,62` — guest reviews, subjects, entire `guestReviewConfig` collection | Page-mounted | Page scope is correct. Add limits/status filters where absent; config should be a known singleton document rather than a collection listener if schema permits. |
| R1 | `src/components/member/MemberAchievements.jsx:19,23` — member achievement applications / related query | Page-mounted | Page scope is correct; add explicit bounds if history can grow indefinitely. |
| R1 | `src/lib/db.js:744` — entire `members` collection, filtered client-side to guest/kid accounts | Admin Kid Mode page through `subscribeKidAccounts` | Page scope is correct, but the query is the highest-amplification listener in this audit. Replace with a positive `accountType in ["guest", "kid"]` query after verifying the page lifecycle and rules; unlike the official-member list, this positive selection does not need missing-field compatibility. |
| R1 | `src/lib/catDb.js:19` — `members/{id}/cats` | Parent Cat Village and some cat pages; also app shell | Keep one listener owner and pass its map. The Cat Village contract already requires exactly one parent listener. |
| R1 | `src/components/member/CatVillageBoardTeam.jsx:267` — host member document | Team-board page | Keep during the room, but narrow host dice into room state or a small dedicated document in a future schema change; a whole member document is billed once per change even when only dice is needed. Protected team WIP: no schema change in this pass. |
| R1 | `src/lib/campSessionsDb.js:29` and `src/lib/storyDb.js:22` — entire collections | Admin Kid Mode / Story Manager pages | Page scope is correct; unbounded collection listeners should gain a defensible active/status filter or limit if collections grow. |
| R1 | `src/lib/duelDb.js:567`, `src/lib/dungeonDb.js:1098`, `src/lib/expeditionTeamDb.js:627`, `src/lib/partyDb.js:1114`, `src/lib/villageBoardTeamDb.js:281`, `src/guild/db/guildTeamDb.js:278`, `src/lib/raidTeamDb.js:240` — open/waiting room queries | Lobby-mounted | Keep live while the lobby is visible. Add limits to waiting-room queries lacking them; `guildTeamDb` already limits to 30. |
| R1 | `src/lib/worldBossDb.js:84,149` — current/latest World Boss queries | World Boss/admin surfaces | Keep page-scoped. Ensure a shell status listener and a page latest-event listener are not both used to render the same status. |
| R1 | `src/lib/villageGoalDb.js:79,87` — active/latest village goals | Village/admin/home/banner consumers | Multi-user goal changes justify live data only while the corresponding surface is mounted. `MemberHome` and `VillageGoalBanner` may overlap; share one parent result when both render. |
| R1 | `src/lib/db.js:1097,1297` — results by competition | Member/admin competition detail | These two wrappers have the same query shape. Consolidate the API and keep one page-owned listener; unbounded within a competition. |
| R1 | `src/lib/db.js:1289,1301,1682,1840,2034,2048,2341,2401,3889` — disputed/pending/admin workflow collections | Admin workflows, some also mounted in AdminApp shell | Real-time is useful while reviewing. Page-scope full lists, bound them, and use counters for shell badges if needed. `certifications` scans the whole collection then inspects nested fields client-side (`:1682`), making it the riskiest listener in this group. |
| R1 | `src/lib/db.js:1578,1582` — notifications, preferred query and fallback, both limit 20 | App shell; fallback swaps listener after index failure | Keep bounded. The fallback is compatibility, not a simultaneous duplicate, and must not be removed without confirming the composite index. |
| R1 | `src/lib/db.js:1975,2135,2195,2510,3952,4140` — promotion config, bounty templates/rewards, monster event config, app version, equipment catalog | Mixed admin pages and member surfaces | Admin editing surfaces can stay live while mounted. Read-only member catalogs/config are R2/R3 candidates unless immediate remote changes are product-critical. App version is intentionally a tiny global document. |
| R1 | `src/lib/db.js:2449,2647,3248,3269,3280,3692` — member dex grants, materials, craft/chest/potion stats, card collection | App shell and feature pages | Keep at most one listener per document/member. Current app-shell ownership exists for most dex/card data; child listeners are frequently duplicated. Materials/potions should be page-scoped unless a shell badge truly consumes them. |
| R1 | `src/lib/db.js:3787,3901,3933,5013` — monthly logs (limit 50), own requests (limit 5), billing by year, active card market | Page-mounted | Scope is correct. Card market and billing can be large despite filters; add a limit/pagination strategy. Market remains live only while Trade is mounted, as required by the Cat Village spec. |
| R1 | `src/lib/db.js:3890,3933` and `src/lib/villageGoalDb.js:79/87` duplicates through multiple pages | Separate pages can mount the same query | Prefer a page-parent hook/provider when sibling widgets coexist; do not introduce an app-global listener merely to deduplicate rare mutually exclusive pages. |
| R2 | `src/lib/db.js:828,1053,1218,1253,1276,1280,2656` — practice/badge/learn/external-comp/message/monster histories | Mostly bounded history listeners; `badgeLogs` unbounded | Static history should default to bounded `getDocs` plus explicit refresh after local writes. Practice history can retain a small live head only where another device may append during the view. `MonsterBattle` already moved its preview to one-off; `MemberPractice` still opens both practice and monster listeners. |
| R2 | `src/lib/db.js:1062` with fallback at `:1067` — pending badge logs | Member home | Preferred query is correctly filtered. Consider one-off load plus refresh after badge mutation if cross-device immediacy is not required; retain fallback until legacy/status coverage and index behavior are verified. |
| R3 | No Firestore listener in `subscribeLocalTodayArrows` (`src/pages/MemberApp.jsx:293-300`) | LocalStorage/custom/storage events | Keep. This is the desired client-first daily-arrow pattern and must not be replaced with Firestore `onSnapshot`. |

## Duplicate reads and same-screen fan-out

### 1. Member shell duplicates member-scoped documents

`MemberApp` opens eight member-scoped listeners at `src/pages/MemberApp.jsx:443-463` and passes them through `sharedPlayerData` at `:232-238`. Several child surfaces already suppress their fallback subscription when shared data is supplied (`MemberDex.jsx:105-111`, `MonsterBattle.jsx:400,428-433`, `CardCollectionModern.jsx:24-32`, `DungeonLobby.jsx:86-105`, `DungeonExpedition.jsx:313-330`, `DungeonBattleRoom.jsx:526-529`, and `WorldBossAttack.jsx:266-275`). Remaining unconditional subscriptions include:

- card collection: `BattleScreen.jsx:431` and `PartyBattleRoom.jsx:309` (plus any call path that fails to pass the existing optional `cardCollection`/`sharedData` props);
- cats: `CatVillage.jsx:2304`, `CatCollection.jsx:727`, `CatStoryBook.jsx:239`, `GuildTestApp.jsx:173`;
- check-in: shell `MemberApp.jsx:271`, plus `DailyQuest.jsx:106`, `MemberPractice.jsx:2271`, `PartyQuestRoom.jsx:52`, and the reusable `useCheckinActive.js:9`;
- materials: `CoinShop.jsx:82`, `MemberMaterials.jsx:102`, `RPGEquipPanel.jsx:542`, `MemberProfile.jsx:130`;
- potions: `CatVillage.jsx:2310`, `MemberMaterials.jsx:114`, `MonsterBattle.jsx:401`, `DungeonBattleRoom.jsx:517`, `PartyBattleRoom.jsx:463`, `WorldBossAttack.jsx:433`.

The clearest low-risk wins are the remaining unconditional card/cat/check-in consumers because a parent source already exists. Several card routes are already wired correctly, so implementation must trace actual render props rather than deleting every fallback subscription found by text search. Passing shell data removes duplicate initial reads and duplicate change reads without changing schemas or real-time semantics. Materials/potions need a lifecycle decision: either page-scope one owner or promote them deliberately; do not add more app-shell listeners merely to deduplicate pages that cannot coexist.

### 2. Admin shell duplicates page data

`AdminApp.jsx:414-431` keeps full pending queues alive across the entire admin session. The corresponding page components contain standalone fallback subscriptions, but the currently mounted paths pass the shell data and suppress the same-query fallback in `AdminDailyQuest.jsx:37,56-59`, `AdminMonthlyCard.jsx:70,88-94`, `AdminGuildQuests.jsx:53,71-80`, and `AdminMessages.jsx:8-27`; these are not simultaneous duplicates. The remaining cost candidate is payload ownership: the shell needs global badge data and the check-in alert lifecycle at `AdminApp.jsx:435-441`, so simply moving all listeners to pages would change UX. A future server-maintained counter/small queue could preserve those global signals while page-scoping full records, but that is a schema-backed change rather than a no-risk deduplication.

### 3. Duplicate direct member reads after profile snapshot

`useAuth` already holds a live `members/{id}` snapshot (`src/hooks/useAuth.js:140`). Page actions still fetch the same member document in `MemberCertExam.jsx:62`, `AdminDailyQuest.jsx:126`, and multiple domain helpers. Some helpers must re-read inside a transaction for atomic correctness; those reads must remain. Plain render/load reads should accept the profile snapshot. `db.js:updateLastLogin` already demonstrates the correct pattern by accepting the caller's `prevLastLoginAt` and suppressing writes for 30 minutes (`src/lib/db.js:730-739`).

## Unbounded and high-amplification queries

Ranked by likely billing mechanism, not guessed dollar savings:

1. **Whole `members` collection listener for kid accounts** — `src/lib/db.js:743-752` downloads every member and filters guest/kid client-side. Every changed member can trigger a billed listener read. A server query on `accountType in [guest,kid]` is appropriate because only new guest/kid documents need match; the legacy-official missing-field constraint does not apply to this positive selection.
2. **Whole `certifications` collection listener** — `src/lib/db.js:1681-1694` scans every certification to discover nested pending tasks. This bills the initial whole collection and changes to any certification. A normalized pending-task collection/server-maintained queue would be ideal; a bounded one-off scan on page entry is the low-risk interim.
3. **Admin shell pending queues** — `src/pages/AdminApp.jsx:414-431` holds multiple query listeners open even when their pages are hidden. Billing comes from repeated initial result reads on reconnect plus every matching document change.
4. **Open-room queries without limits** — `duelDb.js:567`, `expeditionTeamDb.js:627`, `partyDb.js:1114`, and `villageBoardTeamDb.js:281` can grow or retain stale waiting rooms. Add `limit` only after confirming ordering/selection semantics; server lifecycle cleanup is complementary.
5. **Unbounded active/config collections** — `storyDb.js:22`, `campSessionsDb.js:29`, `db.js:1053,1097,1297,1682,2034,2048,2135,2341,2401,4140,5013`, and goal queries in `villageGoalDb.js:79,87`. Some are naturally small today, but the code has no enforced bound. Document cardinality or add paging/limits.
6. **One-off unbounded reads** — examples include `duelDb.js:400` (all duel stats), `campSessionsDb.js:24`, `storyDb.js:13`, and `db.js:673,1074,3942`. `getMembers` is protected by a 30-second TTL/inflight cache; callers forcing `fresh:true` (`HomeLeaderboardBlock.jsx:72`) bypass it and should justify that choice.

Queries deliberately limited or index-aware must be preserved: notifications limit 20 with compatibility fallback (`db.js:1576-1586`), practice logs default limit 300 (`:827-831`), learn/external/message histories (`:1216-1218`, `:1252-1253`, `:1275-1280`), monthly histories (`:3783-3791`, `:3898-3901`), and guild open rooms limit 30 (`src/guild/db/guildTeamDb.js:253,278`).

## Write-path audit

### Preserve atomic writes

The 114 client/server transactions and 12 batches are mostly economy, capacity, claim, multiplayer, or idempotency boundaries. Do not replace them with debounced independent writes. In particular preserve booking capacity transactions (`src/lib/bookingDb.js:133,224,309,426,604`), shop settlement/claims (`src/lib/villageShopDb.js:26,78,252,409`), multiplayer room transitions, marketplace transfers, and backend lifecycle transactions. Transaction retries can multiply reads, but removing the transaction would trade cost for corruption.

### Safe merge/debounce candidates

- **Already completed — arrow progress:** `addRoundArrows` uses durable local aggregation and idempotent transaction markers per `.trellis/spec/frontend/firestore-cost-optimization.md`. Keep thresholds and flush boundaries; do not restore per-round direct writes.
- **Already completed — shop timers:** runtime timers remain local and settle in batches/transactions. `GuestShop.jsx:136,139` writes only action-boundary patches, while `villageShopDb` handles authoritative operations. Never persist the rush countdown every second.
- **Presence/last-login:** `db.js:730-739` already suppresses `lastLoginAt` writes within 30 minutes. Preserve it.
- **Read-modify-write stats:** `db.js:updateCraftStats` reads then rewrites a stats document (`src/lib/db.js:3708-3720`). Where fields are independent numeric counters, replace with atomic dot-path `increment` patches after verifying every branch and legacy shape; this removes the pre-read and lost-update window. Do not apply blindly to arrays/maps assembled from current state.
- **Sequential per-document loops:** ranking and message-read paths issue repeated `updateDoc` calls (`db.js:1151-1154`, `:1270-1272`). A batch improves atomicity/network latency but does **not** reduce billed writes. Only denormalized aggregate state or changing the product contract can reduce write count.
- **UI preference/default-plan writes:** `AdminDailyQuest.jsx:186` and similar interaction-driven patches can use save-if-changed or short debounce when rapid controls can emit multiple writes. Never debounce settlement, inventory, rewards, access control, or room state.

## Completed optimizations that must not be repeated or reverted

- `getMembers` 30-second TTL plus shared in-flight request (`src/lib/db.js:659-678`). Every member writer must continue to invalidate it.
- `isGuestOrKidMember` five-minute successful-read cache with fail-closed errors (`src/lib/db.js:637-656`). Do not cache failed lookups as guest for five minutes.
- `updateLastLogin` uses the already-loaded profile and a 30-minute write threshold (`src/lib/db.js:730-739`).
- bounded practice/history listeners and append-only local-first history paging (`src/lib/db.js:827-900`).
- pending badge server filtering with a compatibility fallback (`src/lib/db.js:1056-1070`).
- notifications bounded to 20 with an index-failure fallback (`src/lib/db.js:1576-1586`).
- World Boss shell listens to a small status document rather than the high-churn boss HP document (`src/pages/MemberApp.jsx:398-440`).
- Monster Battle recent history changed from live 100 to bounded one-off 30 plus explicit refresh, and DungeonDex reuses the profile snapshot (documented in the Firestore cost spec).
- arrow operations use local durable aggregation, stable operation IDs, and transactions; batching here reduces operation frequency, while `writeBatch` by itself would not reduce billed writes.
- Cat Village parent listener ownership, one-off student market config, conditional market/goal listeners, local passive timers, and transactional offline shop settlement are protected contracts in `.trellis/spec/frontend/cat-village-gathering.md`.
- automatic all-member migrations have no normal mount/login call sites. Do not reconnect them without the documented lease/cursor/batch operational contract.

## Completed low-risk query pushdown: kid accounts

`subscribeKidAccounts` now subscribes to `members` with `where("accountType", "in", ["guest", "kid"])` instead of opening a listener on the entire collection and filtering in JavaScript. The callback still receives the same `{ id, ...data }` records sorted by descending `lastLoginAt`, and the Firestore unsubscribe/error propagation contract is unchanged.

The billing improvement comes from listener result membership: the initial snapshot reads only matching guest/kid documents, and later unrelated official-member changes no longer enter this listener. Matching document additions, updates, removals, reconnect behavior, and minimum-query billing still follow normal Firestore listener billing; this is not a claim of zero reads.

Compatibility is intentionally positive-only. Official member documents that predate `accountType` remain excluded, while guest/kid creation rules require an explicit `accountType`. Both production callers are Admin surfaces. `firestore.rules` permits Admin list reads on `members`; the non-Admin rule additionally evaluates active guest/kid profile constraints, so this optimization does not broaden permissions. The query uses only one `accountType` filter, and `firestore.indexes.json` has no field override disabling that field's automatic single-field index. No composite index, rules change, schema migration, or deployment is required.

## Ranked low-risk implementation shortlist

1. **Remove the remaining unconditional child subscriptions for shell-owned card, cat, and check-in data.** Preserve the existing optional fallbacks for standalone/guest/admin render paths, and pass `sharedPlayerData`/`todayCheckin` only through verified MemberApp routes. Dex sharing and several card routes are already implemented. Billing mechanism: avoids duplicate initial document/collection reads and duplicate reads on each change without losing real-time behavior.
2. **Completed: query kid accounts positively by `accountType` instead of listening to all members.** Billing mechanism: initial and changed reads are restricted to guest/kid matches. Rules and the existing automatic single-field index configuration are compatible; no deployment artifact changed.
3. **Convert the pending certification whole-collection listener to a bounded one-off page load with explicit refresh after approve/reject.** Billing mechanism: removes continuous reads for unrelated certification changes. Preserve the admin-shell badge/alert contract or move this item behind a small normalized queue; page-scoping alone is not safe while the shell consumes it.
4. **Add conservative limits to waiting-room queries and active card market, with UI messaging/pagination where truncation matters.** Billing mechanism: caps initial/reconnect result reads. Do not add composite-index-dependent ordering without an explicit deployment plan.
5. **Replace safe numeric stats read-modify-write operations with atomic increments.** Billing mechanism: removes one document read per mutation, not the write. Start only with fields whose update is commutative and independent.
6. **Change static catalog/config member views to bounded one-off reads.** Equipment/story/promotion/bounty configuration can refresh after admin save or on re-entry. Billing mechanism: avoids change/reconnect reads during long sessions.

Excluded from the low-risk shortlist: replacing the AdminApp full pending queues with counters/small queues could be valuable, but the current queues power global badges and a repeated check-in alert, and same-query child fallbacks are already suppressed. Treat that as a schema-backed follow-up, not a client-only deduplication.

## Unknowns and required measurement

- Firestore console usage/export is not available in this static audit, so actual documents returned, reconnect frequency, cache-hit source, index-entry reads, and per-route session duration are unknown. Rank should be revisited with production usage metrics.
- It is not statically certain which MemberApp child routes remain mounted but hidden versus conditionally unmounted. Browser instrumentation should record active listener count per route transition before implementation.
- Cardinalities and retention policies for `certifications`, rooms, card market, story chapters, camp sessions, messages, badge logs, and guild queues are unknown. Limits must reflect product requirements, not arbitrary truncation.
- Firestore persistent local cache behavior and multi-tab ownership configuration need runtime confirmation. Offline cache can improve UX but does not make an unbounded listener free; reconnect billing depends on SDK persistence/reconnect conditions.
- Some query improvements would require composite indexes. Preserve current client-side sorting/fallbacks until index deployment is explicitly verified; the existing specs document prior production failures from missing manual index steps.
- `functions/` transactions are backend authority and trigger/callable lifecycles, not persistent listeners. Their cost depends on invocation rate and transaction retries; function logs/metrics are required before optimizing them.
- PROTECTED WIP includes Cat Village Shop/Board/Team/EventScene and shooting/game-performance compatibility paths. Recommendations here intentionally avoid schema changes or removal of fallback/migration readers in those areas.
