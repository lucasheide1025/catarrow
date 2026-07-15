# Shared score and body-part combat design

## Scope

This design applies to the solo monster battle, party battle, World Boss,
dungeon solo, and dungeon party. Duel and council encounters remain out of
scope because they use separate competitive rules.

## Canonical arrow hit

All in-scope callers resolve each arrow through one shared helper. The helper
receives the scored label/value, attacker ATK, defender DEF, current unlocked
parts, and mode-provided bonus multipliers. It returns a serializable hit
record containing the score multiplier, resolved body part, damage, critical
flag, and updated unlock state.

The score multiplier is determined from the scored label, not from a rendered
target coordinate:

| label | multiplier | note |
| --- | ---: | --- |
| X | 2.0 | critical |
| 10 | 1.2 | guaranteed hit |
| 9 | 1.0 | baseline |
| 8..1 | 0.9..0.2 | decrease by 0.1 per ring |
| M | 0 | sole zero-damage outcome |

Existing target-format score mapping remains responsible for converting a
target hit into its canonical label/value. It must preserve whether the
original label is X so the X multiplier cannot be confused with a numeric 10.

## Outgoing body-part resolution

Every score above M resolves a part. No score-based miss roll is performed.
The established progression remains:

- X: head/neck, with an eligible unlocked chest permitting heart/lung.
- 10: head, neck, chest, and groin, with eligible unlocked internal parts.
- 8–9: chest, neck, belly, arm, and groin, with a smaller eligible internal
  part chance.
- 5–7: belly, arm, and chest.
- 1–4: arm and belly.

Chest unlocks heart and lung; belly unlocks kidney; groin unlocks the
vulnerable target. Part selection is the only outgoing random element.

Damage is calculated once from the mode's existing ATK/DEF base calculation,
then multiplied by score multiplier, body-part multiplier, and applicable
equipment/potion/team/World-Boss bonuses. Random damage variance is removed.
Because score rings already carry the primary accuracy reward, outgoing body
parts use the restrained range x1.00 (arm) through x1.50 (heart), rather than
the former x1.00 through x3.00 range.

Base monster HP is tier-scaled before its existing weak/normal/strong/boss
variant is applied: common x0.95, rare x1.00, elite x1.05, fierce x1.10, boss
x1.00, and mythic x1.10. This targets a comparable-tier player averaging 6–8
rings at normal body parts to finish within roughly three rounds, while X and
internal-part results remain meaningfully faster.

## Player counterattack resolution

The monster counter uses the six-arrow round average, treating M as zero.
The average selects a bounded player hit pool. Player targets use separate
safe multipliers rather than the monster body-part multipliers:

| average score | player hit pool | maximum multiplier |
| --- | --- | ---: |
| 9–10 / includes X | arm, belly | 1.00 |
| 7–8 | arm, belly, chest | 1.08 |
| 5–6 | belly, chest, neck | 1.15 |
| 3–4 | chest, neck, rare vulnerable target | 1.22 |
| 0–2 / multiple M | chest, neck, rare vulnerable target | 1.30 |

The counter pipeline first applies the mode's normal counter calculation,
then the selected player multiplier, then existing shields and reductions.
The final HP loss is capped at 25% of the player's maximum HP. Counter event
payloads include the selected player part and final damage so the UI can show
the same information it applies to state.

## Integration and compatibility

- `src/lib/damage.js` becomes the single source for score multipliers,
  outgoing hit resolution, and player counter resolution.
- `BattleEngine`, party round processing, dungeon round processing, and World
  Boss call those helpers; no mode reimplements score/body-part math.
- Existing buffs remain inputs to the shared result, not parallel damage
  formulas. Cat damage is not scored by player rings.
- Legacy/unreachable copies are not changed unless still invoked by an active
  route; changing them would create unnecessary divergence in this dirty
  workspace.

## Validation

Unit tests cover multiplier ordering, M damage, unlock progression, bounded
counter multipliers, and the 25% HP cap. Build validation confirms affected
React call sites still compile.
