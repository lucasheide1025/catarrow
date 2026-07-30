# Restore adventurer guild design

## Goal

Restore the last verified adventurer-guild experience after an uncommitted AGY rewrite removed core task-list, persistence, progression, and recovery flows.

## Confirmed facts

- Commit `34cc58f` is the last verified guild implementation and is documented as passing 169 guild tests, 784 full-project tests, and production build.
- The working tree rewrites four committed guild files, with 410 inserted and 546 removed lines.
- `GuildTestApp.jsx` lost the canonical `rollDailyContracts`, `contractsStateFor`, and `todayKey` flow and replaced it with three locally randomized placeholder contracts.
- It also lost the authenticated `useAuth`/`loadGuildProfile` flow, debounced persistence, real cat subscription, reward granting, daily completion state, promotion trials, single-player recovery, open-team discovery, and reconnectable-team recovery.
- New AGY work adds an `ExpeditionMapView` stage and changes battle/loadout/team UI, but that work is not part of the last verified design.
- The recent missing-export repair only made the rewrite compile; it did not restore these removed contracts.

## Requirements

- Restore the original daily commission list, deterministic daily contracts, completion state, detail sheet, acceptance, loadout, battle, and settlement flow.
- Restore authenticated/offline profile loading, debounced saving, real cat subscription, atomic reward granting, and explicit failure messages.
- Restore promotion trials, rank progression presentation, supply handling, single-player recovery, team-room discovery, and reconnect behavior.
- Preserve the guild module's isolation from main-game combat stats.
- Do not silently delete AGY experiments; record or isolate any intentionally deferred new files/ideas.
- Keep the three corrected import contracts from the compilation fix.
- After the verified design is restored and green, integrate `ExpeditionMapView` as a separate loadout-to-battle stage without removing any restored contract, persistence, reward, or recovery behavior.

## Acceptance criteria

- The original commission list is visible and stable across reloads on the same day.
- Completed commissions remain marked and cannot be unintentionally rerolled.
- Commission detail, acceptance, loadout, battle, settlement, and reward persistence work end to end.
- Logged-in, coach-archer, guest/offline, solo recovery, and team recovery states do not blank-screen.
- Guild tests and production build pass.
- The later map integration preserves the restored commission list and resumes into the correct map/battle state.
- A scoped diff confirms no unrelated main-game files were changed.

## Out of scope

- Redesigning the verified guild economy or progression.
- Deploying Firestore rules.
- Shipping other unverified AGY experiments beyond `ExpeditionMapView`.

## Open questions

### Expedition progression modes

The guild needs two distinct commission progress models rather than presenting every encounter as a numbered wave.

1. **Standard exploration**
   - Progress is location based, not wave based.
   - The player moves from the guild start through randomly generated event nodes.
   - Some events become random combat encounters.
   - The route ends at the commission's final expedition target.
   - Combat UI must not display “wave X/Y”; it should identify the current encounter or objective instead.
   - Follow the dungeon-style encounter choice model:
     - Ordinary encounters may be fought or avoided by accepting a cost.
     - Ambushes and the final expedition target are mandatory combat.
   - Exploration choices are centered on the guild's supply economy:
     - Costs primarily consume food and/or water.
     - Positive events primarily replenish food and/or water.
     - Generic dungeon-style stat buffs are not the default reward.
   - Combat rounds continue to consume food and water. Clearing an encounter must not bypass that round's supply cost.
   - Normal map movement consumes a small fixed amount of food and water; events may then add or remove supplies.
   - Players choose how much food and water to carry before departure.
   - Supply quantity participates in the carry-weight trade-off so overpacking is not always optimal.
2. **Continuous assault**
   - The commission explicitly requires defeating X consecutive waves.
   - Wave numbering and direct transition into the next wave are intentional in this mode.
3. **Defense**
   - There are no numbered waves.
   - Enemies enter an off-screen approach queue over time and move toward the visible battlefield.
   - Entering sight range makes an enemy visible and targetable.
   - New enemies continue approaching without requiring the visible battlefield to be cleared.
   - At most eight enemies may be simultaneously visible on the battlefield; additional enemies remain off-screen until space and sight conditions allow entry.
   - Success is based on defending for a duration or protecting an objective, not clearing a fixed wave count.
   - Defense uses two health objectives:
     - player HP represents the active defender;
     - gate/objective HP represents the defended location.
   - Enemies have explicit target priorities such as player hunter, siege attacker, ranged selector, support, or breakthrough attacker.
   - Defense fails if the gate reaches zero or no player remains able to defend.
   - After the defense timer ends, spawning stops and the remaining visible and approaching enemies must be defeated or repelled before victory.
   - The interaction model should reuse proven concepts from the existing zombie mode where appropriate.
   - Time advances by completed player shooting phases, not wall-clock seconds.
   - Defense missions may trigger villager-assistance events that temporarily help fight or support the defense.
   - Villagers are one-shot event actors: they enter, perform the assistance, and leave immediately rather than remaining as battlefield units.
   - Villager events must provide sufficient time for both the complete animation and player reading; combat cannot advance underneath the presentation.
   - After animation, solo defense waits for the player's explicit continue action.
   - Team defense waits for the host to continue after the shared presentation; all clients remain on the same frozen combat state.
   - Assistance frequency:
     - up to one event in missions of six rounds or fewer;
     - one guaranteed and up to two in missions of seven to ten rounds;
     - one guaranteed and up to three in missions of eleven rounds or more;
     - at least two rounds between assistance events;
     - no duplicate event in one defense and no final-round supply assistance.

Open product decisions:

- How much route information is visible before entering a node.
- The exact selectable load range, per-move cost, per-combat-round cost, and carry-weight pressure.

## Confirmed supply-consumption defect

- The combat domain still contains per-round food/water consumption.
- `processRound` returns early on final victory and on map-mode `waveCleared` before reaching the supply-consumption block.
- Therefore any encounter cleared in one round consumes no supplies; with the new map handoff, every cleared encounter skips that round's cost.

## Loadout usability

Confirmed problems in the current departure screen:

- Equipped items are rendered as plain text rows with no item art, stat summary, grade emphasis, or enhancement level.
- Players cannot change equipment from the departure screen; they must leave for the stash and mentally compare items.
- Aggregate six-dimensional stats are separated from the equipment that produces them.
- Equipment, cats, arrow count, supplies, and carry weight all receive equal visual weight despite serving different decisions.
- No preview explains how an equipment swap changes combat stats, carry weight, or remaining supply capacity.

Required redesign outcomes:

- Make equipped slots visually scannable and expose item identity, grade/enhancement, key stats, and weight.
- Allow equipment changes directly from the departure screen through a same-slot comparison drawer.
- Keep the loadout's primary decision centered on the relationship between equipment weight and selectable supplies.
- Show before/after deltas for equipment changes rather than requiring mental comparison.
- Separate primary departure decisions from secondary management actions such as enhancement and salvage.

## Equipment parameter audit

Confirmed issues:

- The catalog contains roughly 39 archetypes with arbitrary mixtures of all six stats, so slot identities overlap heavily.
- Random affixes are not filtered by item compatibility. Percentage affixes can roll on items that lack the affected base stat and therefore provide no value.
- Grade multiplies every base stat from `1.0x` to `4.0x`, while weight rises only 5% per tier; higher-grade versions largely dominate lower grades without a meaningful weight decision.
- Flat affixes do not scale with grade, while enhancement later multiplies them; their relative value changes unpredictably across item and enhancement levels.
- Enhancement multiplies negative stats too, making some penalties worse as an item is upgraded.
- Grade, archetype, affixes, enhancement, negative stats, and weight all modify one flat six-stat total with no player-facing power budget or role summary.

Required parameter redesign outcomes:

- Give each equipment slot a distinct gameplay responsibility.
- Ensure every rolled affix has an effect on the item receiving it.
- Use a visible, testable power budget per grade and slot.
- Make weight a deliberate trade-off rather than a mostly static surcharge.
- Preserve existing saved item identifiers through an explicit migration or compatibility layer.
- Keep six stats as aggregate character attributes, while each equipment archetype gains one clear fixed trait that can change play style.

## Monster combat variety

The guild combat model must support more than identical melee enemies walking one distance unit per round.

Required dimensions:

- Different movement speeds.
- Different attack ranges.
- Distinct skills or attack patterns.
- Player-facing cues that make those differences understandable and actionable.
- Compatibility with the existing multi-target battlefield, target selection, cat assists, and arrow retargeting.
- Assign combat roles per individual monster. Family controls thematic effects and visual language, not one shared movement/range profile for the whole family.

Confirmed reusable data:

- All 252 expansion monsters already have a unique signature skill, one or more common skill IDs, a signature description, and a counterplay description.
- Shared solo, party, and dungeon ability engines already parse and schedule much of this data.
- The guild adapter receives those fields, but `rollExpedition` drops role and skill metadata when constructing guild monsters.
- Guild combat currently hardcodes movement to one distance unit and attacks only at distance zero.

Recommended readability contract:

- Movement speed and attack range are always visible on the monster.
- A skill that changes the next action is telegraphed before it resolves.
- Counterplay text is concise and available without leaving battle.
- Strong skills should create a target-priority decision, not resolve as an unannounced random punishment.
- Multi-monster battles use two information levels:
  - Compact intent indicators beside each monster on the battlefield.
  - A player-opened tactical panel containing complete skill and counter details for all monsters.
- Every applied buff or debuff must be visibly attributable and inspectable:
  - identify the source skill and affected unit;
  - show the changed stat, magnitude, and duration;
  - keep an active status indicator visible until expiration;
  - announce expiration or removal.
- Status effects do not stack:
  - each stat may hold at most one positive modifier and one negative modifier;
  - reapplying the same effect refreshes duration;
  - a stronger same-sign effect replaces a weaker one;
  - a weaker same-sign effect does not overwrite a stronger one;
  - positive and negative modifiers may coexist and are shown separately.
- Effect duration counts actual affected actions:
  - applying an effect does not immediately decrement its duration;
  - a player modifier decrements after a player shooting phase in which it participated;
  - a monster modifier decrements after the relevant monster action or player attack phase in which it participated;
  - an effect marked for two rounds therefore influences two complete applicable actions.
- Monster skills follow a telegraph-and-counter cycle:
  - Announce the intended skill, target, and effect before resolution.
  - Give the player one shooting phase to respond.
  - A successful counter cancels or weakens the skill.
  - Failure allows the skill to resolve at full strength.
  - Counter conditions use a small reusable template set:
    - Reach at least a required score with one arrow.
    - Accumulate a required score during the shooting phase.
    - Defeat the caster before resolution.
    - Hit an exact requested ring value, such as exactly 7 points.
  - Exact-ring counters are target-format aware:
    - Validate against the shot's raw ring value.
    - Select only ring values available on the player's current target face.
    - Field-target requirements display both the raw field ring and its converted combat value.
    - A non-matching shot still deals normal damage; it only fails the counter.
  - The four counter templates are the complete initial template set. Individual monsters vary parameters and consequences, not basic rule grammar.
