# Guild mission and combat redesign

## Goal

Turn Adventurer Guild commissions into three understandable mission experiences built around archery accuracy, equipment choices, food/water planning, readable monster tactics, and recoverable progress.

## Mission modes

Every danger tier offers one commission of each mode per day.

### Standard exploration

- Progress by moving through a partially hidden route, not by numbered waves.
- Sequence: guild start, movement, random supply/event choices, optional or forced encounters, final objective.
- Ordinary encounters may be fought or avoided by paying an event-specific food/water cost.
- Ambushes and the final objective are mandatory.
- Encounter combat returns to the map.
- Combat UI names the encounter or objective and never shows wave numbering.

### Continuous assault

- Defeat X consecutive waves without returning to a map.
- Display wave X/Y.
- HP, statuses, and supplies carry continuously across waves.
- This is the compatibility mode for legacy multi-wave commissions.

### Defense

- No numbered waves.
- Time advances once per completed player shooting phase, never by wall-clock seconds.
- Enemies spawn into an off-screen approach queue and move into sight.
- At most eight enemies are visible and targetable; excess enemies wait at the sight boundary.
- Player/member HP and gate HP are separate objectives.
- Enemies have explicit player/gate/support/breakthrough target policies.
- When the timer ends, spawning stops; all remaining visible and approaching enemies must then be defeated or repelled.
- Gate destruction or loss of every defender causes failure.

## Supplies

- Players select food and water independently before departure.
- Equipment and supplies share carry capacity.
- Movement, battle rounds, and events all modify supplies.
- VIT reduces movement and combat consumption and increases carry capacity.
- Clearing an encounter and final victory still consume that combat round's supplies.
- Unused carried supplies return to guild storage after victory, safe withdrawal, or normal settlement.
- Temporary leave preserves carried supplies inside the saved run rather than returning them early.
- Events primarily consume or replenish food/water; generic stat buffs are secondary.

Initial balance target:

- selectable food/water: 1–10 each, limited by stock and capacity;
- normal movement: 0.25 food and 0.25 water before VIT savings;
- three-arrow combat round: 1 food and 1 water before VIT savings;
- six-arrow combat round: 2 food and 2 water before VIT savings.

These values require simulation before shipping.

## Equipment

- Equipment can be changed directly from the departure screen.
- Five slots remain: bow, arrow, armor, quiver, supply pouch.
- Each slot has a distinct responsibility.
- Each archetype has one primary stat identity and one fixed play-changing trait.
- Higher grades use a visible slot power budget.
- Weight is a real trade-off against supplies.
- Affixes are filtered by compatibility and can never roll as no-op modifiers.
- Negative stats are not multiplied into harsher penalties by enhancement.
- The UI shows item art, grade, enhancement, key stats, trait, weight, and swap deltas.
- Enhancement and salvage remain secondary warehouse actions.
- Existing item IDs, grades, enhancement levels, and ownership must survive migration.

## Monster combat

- The battlefield uses a fixed tactical grid rather than free percentage-based monster positioning.
- The initial grid is three lanes by six visible depth cells.
- Player/member characters and the gate remain anchored below the grid; they do not use free movement turns.
- Cats remain support actors near the player and do not occupy monster grid cells.
- Distance, movement speed, attack range, charge, retreat, pull, knockback, and area effects are expressed in cells.
- The grid must support up to eight visible monsters without visual overlap.
- Individual monsters receive one of six foundational combat roles: pursuer, heavy, ranged, caster, support, or charger.
- Family controls thematic effects and presentation, not a single shared behavior for all family members.
- Monsters define movement speed, attack range, basic attack, target policy, skill, and cooldown.
- Existing expansion-catalog signature/common skill data is reused through a guild adapter.

### Skill protocol

- Strong skills are announced before resolution.
- The player receives one shooting phase to counter.
- UI announces skill, target, full consequence, counter, and progress.
- Success cancels or applies the documented weakened result.
- Failure applies the announced full result.

Exactly four counter templates:

1. one arrow reaches a minimum score;
2. accumulated score reaches a threshold;
3. defeat the caster;
4. hit an exact requested ring.

Exact-ring counters use raw target-face scores and generate only achievable requirements for the selected face. Field targets show raw ring and converted combat value.

### Status effects

- Every buff/debuff shows source, stat, magnitude, duration, and expiration.
- Each target/stat holds at most one positive and one negative modifier.
- Effects do not stack.
- Same effect refreshes; stronger same-sign effect replaces; weaker same-sign effect is ignored.
- Duration counts complete actions in which the effect participates; application does not immediately decrement it.
- Combat logs record apply, refresh, replace, ignore, and remove events with before/after effective values.

### Information UI

- Battlefield shows compact skill-preparation badges beside relevant monsters.
- A fixed tactical-information button opens details for all living monsters.
- Details include distance, speed, range, basic attack, statuses, intent, target, result, counter, and progress.
- Clicking a monster entry returns to battle with that monster targeted.
- Opening information never advances combat or loses unsubmitted shots.

## Villager assistance

- Defense missions may trigger one-shot villager events.
- Flow: enter, act, report results, exit.
- Villagers never remain as units or targets.
- Initial actions: hunter volley, gate guard, scout report, trap team, supply runner.
- Missions are balanced to be winnable without random assistance.
- Six rounds or fewer: at most one event.
- Seven to ten: at least one, at most two.
- Eleven or more: at least one, at most three.
- Events are separated by at least two rounds, do not duplicate in one defense, and do not provide final-round supplies.
- Event presentation freezes all combat progression.
- Animation completes before a persistent result summary appears.
- Solo resumes by explicit confirmation; team play resumes by host confirmation from shared state.

## Persistence and compatibility

- Saved runs include mission mode and mode-specific state.
- Unknown/legacy mode defaults to continuous assault.
- Exploration saves journey, encounter battle, supplies, and route seed.
- Defense saves clock, objective HP, visible enemies, approach queue, spawn schedule, assistance history, statuses, and supplies.
- Temporary leave discards only unsubmitted arrow input.
- Existing equipment receives a deterministic v2 compatibility mapping; no item is silently deleted.

## Acceptance criteria

- Each danger tier deterministically exposes one commission per mode.
- Mode-specific labels and transitions never leak wave language into exploration or defense.
- Supply consumption occurs on every applicable movement and combat action, including clearing actions.
- Players can choose a valid load and recover unused supplies correctly.
- Equipment comparisons explain combat and carry deltas before swapping.
- Monster speed/range/intent/status are both calculated and visibly represented.
- All four counter templates work on every target-face format.
- Defense supports eight visible enemies plus an off-screen queue without losing entities.
- Villager event gates cannot advance spawns, cooldowns, statuses, or supplies underneath the overlay.
- Solo and team saved runs resume deterministically.
- Guild tests, full relevant tests, and production build pass.

## Out of scope for the first release

- Free player movement as in a full tactical RPG.
- Permanent villager injury or death.
- Real-time countdown combat.
- More than eight visible enemies.
- More than four counter grammars.
- Destructive removal of legacy equipment.
