# Dungeon unification handoff — 2026-07-14

## User-required outcome

Dungeon combat must use the exact same presentation and round lifecycle as the new party battle UI. Do not maintain a separate legacy dungeon scoring or animation path.

Required sequence:

```text
round event (show effect and wait 2–3s)
-> score input
-> submit (close scoring drawer/target immediately)
-> show each member's submitted/waiting state
-> host five-second countdown or immediate resolve
-> rear support/heal animation
-> each front member attack, one at a time, deducting only that attack's damage
-> all cats attack with individual cat cards/skills
-> monster counterattack with per-player damage/knockdown animation
-> next round, or death presentation then result
```

Never show final monster HP/death while the preceding attacks are still being animated. Persisted combat resolution needs a `monsterHPBefore` snapshot and the UI must animate from it.

## Known unresolved bugs

## Completed in this session (2026-07-14)

1. Removed the legacy dungeon scoring `BattleScreen` branch; active/resolving dungeon combat now uses only the shared party-mode path.
2. Fixed reconnect/remount resolution timing. The shared UI now replays persisted mini-rounds from `monsterHPBefore` before showing win/loss.
3. Removed rest room's client-local random resolution animation. `roomResolution` is now the single source for the shared five-second result display.
4. Verified the current changes with `npm.cmd run build` (production build succeeds).
5. **Trap room host-owned (bug #6)**: Host now persists `trapTypeId` and `trapParams` to Firestore on init; all clients read the same type and fixed effect values (HP -20%, ATK ×0.8, DEF ×0.8). Local `Math.random()` per-member effects removed. `roomResolution` guard prevents duplicate roll on reconnect. Animation extraction handles non-host and reconnect correctly.
6. **Event room result phase (bug #7)**: `confirmDungeonEvent` now stores `roomResolution` + keeps `status="event"` instead of immediately transitioning to `floor_transition`. DungeonEvent shows a 3-second result overlay with progress bar, then host manually clicks "繼續探索" to call `resolveNonCombatRoom`.

Completed files:
- `src/components/dungeon/DungeonTrap.jsx` — host-persisted trap type, fixed params, unified animation effect
- `src/lib/dungeonDb.js` — `confirmDungeonEvent` no longer immediately transitions
- `src/components/dungeon/DungeonEvent.jsx` — 3s result phase with progress bar + host continue button

## Remaining validation / implementation

- Manually verify immediate score-drawer closure in solo and team dungeon runs.
- Manually verify rest persistence and its one five-second display in solo and team runs.
- Manually verify trap room host-rule display and no duplicate effect in solo and team runs.
- Manually verify event room 3-second result phase and host-only continue.

1. [Completed; manual verification pending] The legacy scoring branch was removed. Verify score submission closes the shared scoring drawer immediately in solo and team runs.
2. [Completed; manual verification pending] Persisted `partyResolution` now replays from `monsterHPBefore` before its win/loss display.
3. Dungeon battle had level display always falling back to Lv.1. `buildExpeditionMemberData` was patched to add `level: archerLevel`; verify it is carried into every solo/team member creation path.
4. Dungeon battle was falling back to SVG. `DungeonBattleRoom` was patched to pass `renderMonster` using `DungeonMonsterImg`; verify all dungeon battle entry and victory renders now use formal WebP assets.
5. [Completed; manual verification pending] Rest room:
   - Client-local random branch removed.
   - Verify the host persists actual HP once and every client displays that result for five seconds before map transition.
6. [Completed; manual verification pending] Trap room:
   - Host persists `trapTypeId`/`trapParams` once; all clients read same type.
   - Effect values use fixed params (HP -20%, ATK ×0.8, DEF ×0.8) instead of per-member random.
   - `roomResolution` guard prevents duplicate roll on reconnect.
   - Unified animation effect for host/non-host/reconnect.
   - Verify solo and team runs: identical rule display, no duplicate HP deduction.
7. [Completed; manual verification pending] Event room:
   - `confirmDungeonEvent` stores `roomResolution` + keeps `status="event"` (no immediate transition).
   - 3-second result overlay with progress bar for all clients.
   - Host manually clicks "繼續探索" to call `resolveNonCombatRoom`.
   - Verify solo and team runs: result displays for 3s, host-only continue button.

## Dungeon reward work already added (must build/review)

- `src/lib/dungeonChestLoot.js`: ordinary chest generator with T4/fierce material ceiling.
- `DungeonChest`: host stores a single `chestLoot`; clients read it rather than each rolling random loot.
- `DungeonTreasureRoom`/`kingVaultRewards`: king vault presents King Seals and tier-matched materials.
- `expeditionTeamDb.claimTeamExpeditionResult`: includes king-vault materials and seals in claim transaction.
- `RPGEquipPanel`: shows King Seal requirement at +4 breakthrough.

Warning: do not claim normal chest/king-vault work is complete without retesting solo and team claim flows. The worktree contains many unrelated battle UI changes; do not indiscriminately commit or delete them.

## Safe cleanup inventory

Unreferenced one-off repair scripts under `scripts/` (`fix_*`, `remove_*`, `clean_party_battle.py`, etc.) may be deleted only after the current battle UI is confirmed. Do not delete `public/art/`, `PlayerAvatar.jsx`, `EquipmentIcon.jsx`, `.trellis/tasks/`, or second-brain notes.

## Validation checklist

1. `npm run build`
2. Solo dungeon: submit -> drawer closes -> own attack -> cat -> counter -> next round.
3. Team dungeon: two clients submit; both see countdown and exact same sequence.
4. Kill on first attack: remaining animations stop correctly, then one death/result sequence only.
5. Rest: exact healed HP shown, one animation only, map after five seconds.
6. Trap: host's rule displayed identically to all clients; no duplicate effect after reconnect.
