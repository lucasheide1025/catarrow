# Implementation plan

1. Add pure shared combat helpers in `src/lib/damage.js` for canonical score
   multipliers, outgoing body-part resolution, and bounded player
   counterattack resolution. Add focused tests for deterministic rules.
2. Update `BattleEngine` / solo monster battle to use the shared outgoing and
   incoming results and pass body-part data through events.
3. Update active party and dungeon round processing to consume the same
   resolver and persist/display the returned part data.
4. Replace the World Boss direct calculation with the shared resolver while
   preserving its event bonuses and animation sequence.
5. Update the shared battle UI only where needed to display returned body-part
   data without precomputing a conflicting preview damage value.
6. Run targeted tests and `npm.cmd run build`; inspect changed call sites for
   all five in-scope modes and verify no legacy-only file was used as the
   active integration point.

## Rollback point

The shared helper is pure. If a mode integration breaks, revert only that
mode's adapter while retaining the tested helper and leave other battle modes
on their existing behavior until its adapter is corrected.
