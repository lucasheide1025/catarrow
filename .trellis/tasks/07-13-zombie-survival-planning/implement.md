# Proposed Implementation Plan — Not Started

## Phase 0 — design review and foundations

1. Approve target-result ownership and MVP lifecycle decisions.
2. Add independent domain types, schema versioning, zombie room Firestore rules, and configuration validation.
3. Add pure unit tests for anatomy hit tests, distance transform, encounter resolver, infection, and phase transitions.
4. Do not change existing dungeon components other than adding a clearly isolated navigation entry when MVP begins.

## Phase 1 — safety-first core battle prototype

1. Four A–D fixed slots, one approved zombie SVG template, normal zombie archetype, three-arrow cap.
2. Implement host setup, shooting deadline, score input, host resolution, emergency pause, and manual next-round start.
3. Implement the approved ordinary-zombie baseline: head instant kill; neck 50% kill then guaranteed on second neck hit; three upper-torso hits; arm attack-chance reduction plus 1m knockback; lower-body slow plus knockback without lethal accumulation. Add M, 3m-to-20m+ encounter distance, 10m visible-target allocation, visual/hit scaling, and event playback.
4. Test solo and two-player reconnection; test every phase boundary and timer stop condition.

## Phase 2 — survival and multiplayer depth

1. Add equipment durability, infection state machine, suppression/serum items, supplies, and 4–8 target slots.
2. Add fast, armored, and ranged archetypes through declarative rule tables.
3. Add multiplayer supply sharing and non-linear encounter scaling.

## Phase 3 — exploration and extraction

1. Add isolated flat large-map persistence with safety, normal, danger, high-risk, and restricted zones. Each zone owns an encounter profile for ordinary/special/elite/BOSS eligibility, queue size/distance, events, and resources. Add a data-driven random-event system with multiple variants per category: supplies, intelligence/misinformation, environmental interference, NPC rescue, wandering hordes, and changing extraction conditions. Its modifiers may affect stochastic success rates, supplies, intelligence, zombie distance, queue admission, and extraction conditions without faking hit coordinates. Add searchable locations (including shops, hospitals, and fuel stations), resource events, backpack capacity, node-based food/water consumption plus extra consumption per battle, random extraction points, a guaranteed extraction endpoint, a 30%-carried-supplies-penalty rapid-extraction option available from non-combat large-map states, and a return-to-origin action that can still roll wandering-zombie encounters.
2. Implement extraction reward claiming atomically and failure/partial-extraction outcomes.

## Phase 4 — base and bridges

1. Add base construction/resource loops that improve preparation rather than create invulnerability. Initial buildings: growing room for food, water-purification station for drinking water, and an asynchronous expedition-supply team that returns partial materials similarly to the existing cat expedition concept.
2. Add reviewed `crossWorldEffectId` catalogue and a unit-tested allowlisted dungeon adapter.

## Phase 5 — content

1. Add elite/BOSS archetypes, random events, richer maps, story chapters, and extensible fully-infected support roles.
2. Add a read-only central display route that subscribes to the persisted round event log and plays the shared battle sequence after the host resolves a round.

## Verification gates

- Pure resolver tests: all body regions, archetype overrides, knockback, zero-distance attack, armour, infection countdown, item effects, and timer-band selection.
- State-machine tests: all legal transitions plus rejection of any command in the wrong phase or from a non-host.
- Firestore emulator/rules tests: only members access a room; only host executes host commands; members submit only their own arrows.
- Manual range checklist: emergency pause, enter/leave shooting line, stop prompt, late score entry, reconnection, and no automatic next round.
- Regression suite: dungeon target scoring, dungeon room lifecycle, party battle, world-boss attack, inventory, and village gathering.

## Rollout and rollback

Ship behind a disabled feature flag and a new navigation item. Use new collections only; rollback means disabling the flag and freezing new room creation, without any migration or deletion of existing dungeon data.
