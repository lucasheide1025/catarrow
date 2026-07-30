# Adventurer Guild Expedition Flow

## Single-player journey contract

The expedition map is an active state machine, not a route preview.

Exploration uses:

`guild start -> movement -> landmark/event -> optional or mandatory encounter -> map -> final objective`

- Map movement advances exactly one generated node at a time.
- Landmark effects are resolved when the player enters the landmark node.
- A non-final encounter clear must return control to the map.
- The next wave must not be loaded inside the same combat round in map mode.
- Avoided encounters consume food/water and must be excluded from defeated-monster rewards.
- Ambushes and the final objective cannot be avoided.
- Exploration UI must not use wave labels.

## Mission modes

Every danger tier exposes exactly one `exploration`, one `assault`, and one `defense` commission.

- Missing or unknown saved modes normalize to `assault`.
- Assault keeps direct wave-to-wave transitions and wave X/Y labels.
- Defense advances by committed shooting rounds, not wall-clock time.
- Defense saves gate HP, clock, visible monsters, approach queue, assistance history, supplies, and event gate.

## Tactical combat

- New solo runs use a three-lane, six-depth grid.
- At most eight monsters are visible; excess defense enemies remain in the approach queue.
- Monster records preserve combat role, speed, range, target policy, cooldown, signature name, common skills, and counter summary.
- Strong skills announce one shooting phase before resolution.
- Supported counters are minimum single score, accumulated score, defeating the caster, and exact raw ring.
- Exact-ring counters must resolve the required raw ring from each submitted shot's target-face format. Never announce a ring outside that format's visible score range.
- Target-face format is selected during solo loadout or the team waiting room, persisted in battle state, and locked for the entire expedition. Combat must ignore target-format values supplied by individual shots.
- One positive and one negative effect may exist per target/stat. Same effects refresh, stronger effects replace, weaker effects are ignored.
- Opening monster information never advances combat or clears submitted shots.
- Player-facing combat roles, target policies, attributes, effects, and durations must use Traditional Chinese labels rather than exposing internal enum keys.

## Supplies and coin sinks

- Food and water are independently selectable from 1 to 10.
- Movement costs 0.25 of each before VIT; three-arrow combat costs 1; six-arrow combat costs 2.
- Clearing and final rounds still consume supplies.
- Unused supplies return exactly once at settlement or safe withdrawal; temporary leave preserves them in the run.
- Farm/water-station output is a subsidy only: level 1 produces 2 per week and level 20 produces 30.
- Shop bundles remain 6 units for 120 main coins so ordinary play continues to buy supplies.
- Manual enhancement and dismantling consume main coins; online coin and guild-profile mutations must be one Firestore transaction.
- Equipment inventory uses responsive cards. Every enhancement action exposes shard, guild-coin, and main-coin requirements without relying on hover text; unequipped cards compare the real post-swap six-stat result and weight against the current same-slot loadout.

## Domain boundary

- `expeditionGridEvents.js` owns route nodes and journey position.
- `expeditionFlow.js` owns HP, supplies, monsters, shots, and combat results.
- `processRound(..., { pauseBetweenWaves: true })` is the single-player map seam.
- Explicit assault mode retains eager wave behavior.

## Persistence

An unfinished single-player run must persist all three values together:

- `version` and normalized `mode`
- `stage`: `map` or `battle`
- `journey`: current node and journey phase
- `battle`: HP, supplies, shot statistics, wave, and monsters

Saving only battle state loses the map position. Saving only map state loses combat attrition and event effects.

Villager assistance is a blocking event gate. Solo resumes by explicit confirmation; team resumes only after the host commits confirmation. No clocks, spawns, cooldowns, effects, or supplies may advance while the gate exists.

Every assistance gate must preserve and present its concrete result: affected target names, before/after HP, actual damage or healing, defeat/push state, and a total summary where relevant. A generic “assistance completed” message is not sufficient.

In defense mode, the gate and extending wall are battlefield objects positioned directly in front of the player line. The top status strip shows only defense time and approaching-enemy information; it must not substitute for the physical gate.
