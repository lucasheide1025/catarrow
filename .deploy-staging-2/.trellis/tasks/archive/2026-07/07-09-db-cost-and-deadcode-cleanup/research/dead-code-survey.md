# Research: Dead code survey

- **Query**: Part B — find files never imported, exported functions never called, and self-documented "superseded but not deleted" artifacts
- **Scope**: internal (whole `src/` tree)
- **Date**: 2026-07-09

## Findings

### High confidence — zero references anywhere (safe to delete)

1. **`src/lib/db.js:1778` `export async function debugGetAllGuildSubs()`** — grep across all of `src/` finds only its own definition line, zero call sites, zero imports. Name itself signals a leftover debug helper.
   - **Confidence**: high.

2. **`src/lib/db.js:620` `export async function getApprovedResults()`** — grep finds only its own definition, zero call sites anywhere.
   - **Confidence**: high.

3. **`src/lib/db.js:2992` `export function subscribeAllMonthlyRequests(callback)`** — grep finds only its own definition, zero call sites. Note there are *other*, actually-used sibling functions with similar names that must not be confused with this one: `subscribePendingMonthlyRequests` (used in AdminApp.jsx) and `subscribeMyMonthlyRequests` (used elsewhere) are both live — only `subscribeAllMonthlyRequests` itself is dead.
   - **Confidence**: high.

4. **`src/lib/dungeonDb.js:113-126` `export async function updateDungeonMemberStats(roomId, memberId, hp, maxHP, atk, def, catName, archerStyle, catAtk)`** — grep finds only its own definition, zero call sites. This is also **self-documented as dead** in `docs/second_brain/quick-ref.md` line 396: *"`updateDungeonMemberStats()` 仍是死代碼（不用管，走的是別條路徑）"* — the actual data flow for dungeon room member stats goes through `buildExpeditionMemberData` → `create*ExpeditionRoom/BattleRoom` instead.
   - **Confidence**: high.

5. **`src/lib/dungeonDb.js:1246-1251` `export function subscribeAllDungeonBroadcasts(callback)`** — grep finds only its own definition, zero call sites (no "首殺歷史紀錄頁面" page currently wires it up despite the comment above it describing that intended use). Also unbounded (`orderBy` with no `limit`) — see firestore-cost-survey.md item 9 for the cost angle if it's ever revived.
   - **Confidence**: high.

### Confirmed NOT dead (checked, false-positive risk ruled out)

These were investigated because their names/comments looked suspicious but turned out to have live call sites — listed here so the next pass doesn't re-flag them:

- `getAvailableTiers` (`src/lib/councilMonsters.js:36`) — comment says "保留給舊呼叫，逐步淘汰" (kept for legacy callers, being phased out), but it is still actively called as a fallback path in `src/components/member/CouncilHall.jsx:228` (`powerTiers.length > 0 ? powerTiers : getAvailableTiers(bldLevel)`). Do not delete without also removing that fallback branch.
- The old guest-session functions referenced in the `db.js:2028-2031` comment (`createGuestSession`/`getGuestSession`/`deleteGuestSession`/`generateGuestToken`) — the comment says they were "已整個淘汰" (already fully superseded). Verified these function bodies **no longer exist in the codebase at all** (grep finds zero definitions, only the comment mentioning their old names) — this cleanup was already completed, nothing left to delete here. Same for `GuestRoute`/`GuestBattle.jsx` (also already deleted, per `App.jsx:14` and `GuestApp.jsx:2` comments, and confirmed via grep — zero remaining references besides comments).

## Caveats / Not Found

- Did not exhaustively check every one of the ~250+ exported functions in `db.js`, nor every file under `src/lib/*.js` — spot-checked ~35 functions whose names suggested one-off/debug/migration/reset utilities (the category most likely to rot), plus everything flagged by the "淘汰/deprecated/不再使用/已棄用" comment grep. A full symbol-by-symbol audit of `db.js` would need a longer pass; recommend running the same grep-per-export technique across the remaining unchecked exports if further cleanup is desired later.
- Did not check for unused *files* (zero-import `.jsx`/`.js` files) beyond the ones implied by the comment grep (`GuestBattle.jsx`, `GuestRoute`) — both already confirmed deleted. A separate glob-and-grep pass per file basename across `src/` would be needed to rule out other orphaned component files; not done here due to time budget, but no other candidates surfaced organically while reading `AdminApp.jsx`/`MemberApp.jsx` import lists (all lazy-imported components there resolved to files that exist and are wired into the nav).
- No other "淘汰/deprecated/不再使用/已棄用/廢棄" comments pointed at live dead code — the other hits from that grep (`dungeonCollectibles.js`, `runeData.js`, `storyData.js`, `MonsterBattle.jsx:754`) were either in-game flavor text (item descriptions mentioning "廢棄辦公室" = "abandoned office" as a place name) or comments describing normal design decisions, not dead-code markers.
