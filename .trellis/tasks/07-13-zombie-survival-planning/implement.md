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
2. Add fast (2-4m/round, head×2, chest×6), armored (1-2m/round, chest×6, charge attack at 0m), and ranged (auto-interfere once/round, 1 chest arrow kill, high-risk+ only) archetypes through declarative rule tables.
3. All 5 weapon/arrow types: threshold-reduction, knockback, penetration, explosive (3m AoE), silent. Normal arrows unlimited, special arrows 3-5 limit each.
4. 5-tier armor system (T1–T5) with enhancement slots. Accessory system with base-level-gated slot count (start 1), 3 uses per expedition.
5. Backpack weight system: 20kg initial capacity, item weights assigned.
6. Rescue arrows: 50% trigger rate, text+animation presentation.
7. Add multiplayer supply sharing and non-linear encounter scaling.

## Phase 3 — exploration and extraction

1. Add isolated flat large-map persistence with safety, normal, danger, high-risk, and restricted zones. Encounter rates (per node): normal 20%, danger 40%, high-risk 60%, restricted 80%.
2. Each zone owns an encounter profile for ordinary/special/elite/BOSS eligibility, queue size/distance, events, and resources.
3. Add a data-driven random-event system with all 6 categories: supplies, intelligence/misinformation, environmental interference, NPC rescue, wandering hordes, and changing extraction conditions. Each with multiple variants. Event modifiers may affect stochastic success rates, supplies, intelligence, zombie distance, queue admission, and extraction conditions without faking hit coordinates.
4. Add 5 extraction types: random point (item-triggered), guaranteed endpoint, rapid extraction (30% supplies loss), special extraction (condition-based), NPC rescue (quest reward).
5. Add searchable locations (including shops, hospitals, and fuel stations), resource events, backpack capacity (20kg base), node-based food/water consumption plus extra consumption per battle.
6. Implement extraction reward claiming atomically and failure/partial-extraction outcomes.
7. Individual extraction: supplies stay with team, equally divided.

## Phase 4 — base and bridges

1. Add all 9 base buildings with 10-level progression (aligned with cat village: same 9 materials, mix-and-match upgrade):
   - Growing Room, Water Purification Station, Expedition Supply Team
   - Medical Room, Equipment Workbench, Armor Repair Station
   - Radio Tower, Scout Station, Rescue Team
2. Building functions improve preparation (food, water, medical, gear, intel, recovery) without causing invulnerability.
3. Add reviewed `crossWorldEffectId` catalogue and a unit-tested allowlisted dungeon adapter. Cross-world effects deferred to Phase 4 decision.

## Phase 5 — content

1. Add elite/BOSS archetypes (first BOSS = Giant Zombie King, multi-phase: armored→enraged→weakened). Random events, richer maps, story chapters.
2. Add fully-infected support role: Mark Target interference ability (shoot zombie → marks → teammates deal increased damage/effects), curable with experimental serum.
3. Add a read-only central display route that subscribes to the persisted round event log and plays the shared battle sequence after the host resolves a round.
4. BOSS common interface: visible weak points, multi-phase behavior, special attacks, cleared flag, exclusive rewards.

## Verification gates

- Pure resolver tests: all body regions, archetype overrides, knockback, zero-distance attack, armour, infection countdown, item effects, and timer-band selection.
- State-machine tests: all legal transitions plus rejection of any command in the wrong phase or from a non-host.
- Firestore emulator/rules tests: only members access a room; only host executes host commands; members submit only their own arrows.
- Manual range checklist: emergency pause, enter/leave shooting line, stop prompt, late score entry, reconnection, and no automatic next round.
- Regression suite: dungeon target scoring, dungeon room lifecycle, party battle, world-boss attack, inventory, and village gathering.

## Rollout and rollback

Ship behind a disabled feature flag and a new navigation item. Use new collections only; rollback means disabling the flag and freezing new room creation, without any migration or deletion of existing dungeon data.
