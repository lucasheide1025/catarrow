# Execution plan

## Immediate work: dungeon loot

1. Trace ordinary chest generation, boss rewards, treasure room reveal, and team claim paths.
2. Replace local random ordinary-chest generation with one persisted host-generated loot object.
3. Apply T4 cap to ordinary chest materials.
4. Create a persisted king-vault reward payload using the existing dungeon tier.
5. Add transactional King Seal grants and verify solo/team claims.
6. Build and test ordinary chest, boss vault, reconnect, and duplicate-claim flows.

## Deferred work

After the reward foundation is deployed, implement new equipment runes, socketing, visual explanations/animations, and explicit old-rune migration/removal.

## Blocking follow-up before more rune UI work

Dungeon combat and non-combat room presentation must be unified with the party battle flow first. See `docs/second_brain/2026-07-14-dungeon-unification-handoff.md` for the required lifecycle, exact known regressions, and validation scenarios. Do not add new rune UI while dungeon still contains duplicate legacy scoring/render branches.
