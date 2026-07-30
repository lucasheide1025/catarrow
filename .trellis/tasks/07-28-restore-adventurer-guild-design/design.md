# Expedition map and battle handoff

## Boundary

The single-player expedition owns two coordinated states:

- `journey`: current map node and whether the player is on the map, resolving an event, or entering battle.
- `battle`: combat HP, supplies, shot statistics, current wave, and monsters.

The map domain decides route movement. The combat domain resolves combat rounds and can pause at a cleared wave instead of eagerly loading the next wave.

## Flow

1. Departing from loadout creates a journey at the guild start node.
2. Advancing moves one node at a time.
3. Entering a landmark node resolves and displays one travel event.
4. Advancing onto a combat node opens only that node's wave.
5. Clearing a non-final wave returns control to the same combat node on the map.
6. The next advance reaches the next landmark; its event prepares the following wave.
7. Clearing the final wave enters the existing settlement flow.

## Persistence

The local run payload stores `stage`, `journey`, and `battle`. Legacy map saves without a journey restart at the guild node. Legacy battle saves continue to resume directly in battle.

## Compatibility

`processRound` keeps its current eager multi-wave behavior by default for team combat and existing callers. Single-player map combat opts into pausing between waves.

## Supply loadout draft

Current constraints:

- Base capacity is 20 kg plus `0.2 kg` per VIT.
- One unit of food or water weighs 1 kg.
- Base VIT is 10, so an unequipped player starts with 22 kg capacity.
- Equipment commonly consumes roughly 5–12 kg before supplies.
- The current loadout always takes 6 food and 6 water.

Recommended first balance pass:

- Let the player select food and water independently in whole units.
- Initial selectable range: 1–10 of each, further limited by warehouse stock and carry capacity.
- Normal movement: `0.25 food + 0.25 water`, reduced by VIT.
- Three-arrow combat round: `1 food + 1 water`, reduced by VIT.
- Six-arrow combat round: `2 food + 2 water`, reduced by VIT.
- Events use asymmetric food/water changes so the optimal load is not always an equal split.
- Show an estimated requirement range rather than an exact answer because encounters and events are random.
- Block departure when total carry weight exceeds capacity.
- Return unused carried supplies to guild storage when the expedition ends or is abandoned safely.

## Adventurer Guild monster-skill protocol

### Data contract

Each guild monster snapshot carries:

- `combatRole`
- `moveSpeed`
- `attackRange`
- `basicAttack`
- `skillId`
- `skillName`
- `skillCategory`
- `cooldown`
- `intent`
- `counter`

`intent` records the announced action, target, resolve timing, and effect preview. `counter` uses exactly one of the four approved templates: minimum single-arrow score, accumulated score, defeat caster, or exact ring.

### Round order

1. Show all existing monster intents.
2. Player selects targets and records arrows.
3. Resolve arrow damage and retarget overflow arrows.
4. Evaluate counter progress against the actual resolved targets and raw ring values.
5. Resolve cat assists.
6. Resolve announced monster skills:
   - countered: cancel or apply the documented weakened result;
   - not countered: apply the full result.
7. Monsters without a resolving skill move according to speed.
8. Monsters in attack range perform their visible basic attack.
9. Eligible monsters announce their next skill intent.
10. Consume combat supplies and begin the next player phase.

### Skill categories

Skills are data-driven compositions from a small effect vocabulary:

- `assault`: damage, multi-hit, armor penetration, ranged strike.
- `movement`: charge, retreat, pull, swap position.
- `control`: temporary ATK/AGI/DEF reduction or target restriction.
- `defense`: self shield, guard ally, damage reduction.
- `support`: heal, shield ally, increase ally speed/range.
- `supply`: steal, spoil, or pressure food/water; used sparingly because supplies are the expedition economy.

### Telegraph rules

- No strong skill resolves on the same phase it is first announced.
- UI always shows skill name, target, full consequence, counter condition, and progress.
- Basic attacks are not counter challenges, but attack range and next reachable attack are visible.
- Counter failure never silently changes to a different effect.
- Exact-ring requirements are derived from the active target-face format.

### Multi-monster intent UI

The battlefield must remain readable with up to four monsters.

Collapsed battlefield presentation:

- Show a compact skill-intent badge beside a monster that is preparing a skill.
- The badge contains an icon, urgency state, and resolve timing such as `技能準備・下回合`.
- Use a stronger pulse/color only when the skill will resolve after the current shooting phase.
- Counter progress may use a short form such as `14/20` or `指定 7`.
- Monsters with no intent show no empty skill container.

Expanded tactical panel:

- A persistent `戰況` / `技能情報` button opens a drawer or sheet.
- List all living monsters, sorted by resolution urgency and then battlefield distance.
- Each entry shows movement speed, attack range, current distance, basic attack, announced skill, target, full consequence, counter template, progress, and success/failure outcomes.
- Selecting an entry highlights and targets that monster on the battlefield.
- Opening the panel does not advance combat or consume supplies.
- Closing it returns to the same unsubmitted shooting state.

### Buff and debuff feedback

Applying an effect is a four-stage presentation contract:

1. **Skill resolution**: show the caster, skill name, target, and whether the counter succeeded.
2. **Immediate delta**: animate a concise stat change near the affected unit, such as `ATK -10%` or `DEF +20%`.
3. **Persistent status**: render a compact status chip beside the affected player or monster for the full duration.
4. **Expiration**: announce removal and remove the chip only when the effect no longer participates in calculations.

Status chips contain:

- effect icon and short label;
- signed magnitude;
- remaining rounds;
- positive/negative color and accessibility-safe symbol;
- tap/click detail with source skill, exact calculation rule, stack behavior, and expiration timing.

The player status strip sits near HP and supplies. Monster status chips sit below the monster HP bar and are also duplicated in the tactical panel.

Combat calculations and UI read the same normalized active-effect records:

```js
{
  id,
  sourceMonsterId,
  sourceSkillId,
  targetId,
  stat,
  mode: "percent" | "flat",
  value,
  remainingRounds,
  stackRule: "refresh" | "stack" | "replace",
}
```

The combat log records `effectApplied`, `effectRefreshed`, `effectRemoved`, and the effective before/after stat values so animation, replay, and debugging do not infer effects from prose.

Status indexing is by `targetId + stat + sign`. There is no stack count. Applying a new record to an occupied key follows `refresh`, `replace stronger`, or `ignore weaker`, and emits the corresponding combat-log event.

### Boss rules

- Boss skills use the same four counter grammars.
- HP thresholds may change movement, range, cooldown, or effect strength.
- Phase changes are announced before the next skill, not applied as hidden immediate attacks.
- A boss may combine effect building blocks, but each intent exposes one primary counter condition.

## Defense mission

Defense is a continuous round timeline, not a wave list.

- Off-screen enemies spawn according to a schedule and approach using their own movement speed.
- Sight range controls when identity, intent, and targetability are revealed.
- At most eight enemies occupy visible battlefield slots.
- Excess enemies remain in the approach queue at the sight boundary until a visible slot opens.
- A completed player shooting phase advances the defense clock by one round.
- New spawns, movement, skill resolution, basic attacks, supply use, and assistance events all use this round clock.
- State tracks player/member HP separately from objective HP.
- Monster target policy is data, not inferred only from nearest distance.
- Timer completion closes the spawn schedule but does not immediately win; the cleanup phase ends only when no hostile visible or approach-queue entity remains.

### Villager-assistance events

Villagers appear as temporary event allies and do not consume player or cat party slots.
Every assistance uses an `enter -> act -> report result -> exit` presentation. No villager remains targetable or visible after the action. Persistent consequences such as a trap slow or one-hit gate shield are effect records owned by the defense state, not persistent villager entities.

Initial assistance vocabulary:

- `hunterVolley`: villagers damage one or more visible enemies, prioritizing urgent skill casters.
- `gateGuard`: block or push back the nearest enemies and absorb one objective hit.
- `scoutReport`: reveal off-screen identities, distance, and arrival estimates.
- `trapTeam`: slow enemies crossing into sight range.
- `supplyRunner`: replenish food or water during a long defense.

Assistance is shown as a named event with a short entrance animation and explicit combat-log results. It must not be required for a baseline-balanced mission victory; randomness may help, but should not decide whether an otherwise correct loadout can succeed.

### Assistance presentation gate

Villager assistance is a blocking combat presentation phase:

1. pause round progression and input;
2. show event title and villager entrance;
3. animate each assistance result in sequence;
4. animate villager exit;
5. keep a readable result summary on screen;
6. resume only through the event completion gate.

Timers control animation sequencing only. They must not dismiss the readable summary before the player has had a chance to understand it. No enemy movement, spawn, skill cooldown, status duration, or supply consumption advances while the assistance presentation is open.

Solo resumes through an explicit `繼續防守` action. Team defense stores the event gate in the shared room state and resumes only when the host confirms; individual clients cannot advance the defense clock independently.
