# Implementation plan

## Phase 0 — Lock contracts and fixtures

- [x] Add mode, mission envelope, equipment v2, monster action, effect, and defense queue schemas.
- [ ] Capture representative legacy profiles, equipment, solo runs, and team rooms as fixtures.
- [x] Add deterministic seeded-test helpers.
- [x] Add compatibility tests proving unknown mode resumes as assault.
- Validation: schema/unit tests only.
- Rollback: no runtime callers changed.

## Phase 1 — Repair and expose supplies

- [x] Move combat supply consumption before every terminal/clear return.
- [x] Add movement consumption with VIT savings.
- [x] Add selectable food/water load to solo and team preparation.
- [x] Enforce stock and shared carry capacity.
- [x] Return unused supplies exactly once at settlement/safe withdrawal.
- [x] Preserve carried supplies during temporary leave.
- [x] Add estimate-range UI and supply transaction tests.
- Validation: supply, combat, settlement, resume, team tests; production build.
- Rollback: feature-switch selectable load off and retain fixed 6/6.

## Phase 2 — Equipment v2 domain

- [x] Define slot identities, grade budgets, weight classes, and trait vocabulary.
- [x] Rebalance existing archetype IDs into v2 definitions.
- [x] Filter affixes by compatible tags and eliminate no-op rolls.
- [x] Prevent enhancement from amplifying negative penalties.
- [x] Implement deterministic/idempotent legacy migration.
- [x] Add snapshot comparisons across every archetype/grade/plus combination.
- Validation: catalog invariants, migration idempotence, combat/carry simulation.
- Rollback: versioned resolver can switch existing items back to v1.

## Phase 3 — Loadout and equipment comparison UI

- [x] Replace text rows with five visual slot cards.
- [x] Add same-slot comparison drawer and direct swap.
- [x] Show stat, trait, weight, capacity, and selectable-supply deltas.
- [x] Keep enhance/salvage in warehouse.
- [ ] Add empty states, keyboard/touch accessibility, and mobile layout checks.
- Validation: component logic tests, build, manual mobile QA.
- Rollback: keep old loadout behind UI switch.

## Phase 4 — Shared monster action engine

- [x] Introduce the fixed lane/depth battlefield grid and deterministic occupancy rules.
- [x] Keep player/gate/cat support anchors outside monster occupancy and verify they never block pathing.
- [x] Preserve catalog role/signature/common-skill metadata in guild monsters.
- [x] Add speed, range, target policy, cooldown, and intent.
- [x] Implement the shared turn order.
- [x] Implement all four counter templates across target faces.
- [x] Implement non-stacking signed status slots and action-based duration.
- [x] Emit structured skill/effect/movement/attack logs.
- [x] Adapt existing expansion skills through a small effect vocabulary.
- Validation: pure engine matrix, every target face, multi-target retargeting, solo/team parity.
- Rollback: monsters without v2 action data use legacy move-one/melee behavior.

## Phase 5 — Tactical combat UI

- [x] Add compact per-monster intent/status badges.
- [x] Add tactical drawer sorted by urgency and distance.
- [x] Add skill resolution, stat delta, persistent chip, and expiration presentations.
- [x] Ensure panel opening preserves shots and does not advance state.
- [x] Replace wave labels with mode-aware encounter/objective labels.
- Validation: event timeline tests, reduced-motion behavior, four/eight-enemy mobile QA.
- Rollback: structured logs remain valid with simplified presentation.

## Phase 6 — Standard exploration

- [x] Generate seeded fog-of-war routes ending in a final objective.
- [x] Add movement cost and food/water-centered random choices.
- [x] Add avoidable encounter costs, ambushes, mandatory final target.
- [x] Return from encounter combat to the correct node.
- [x] Persist route seed, reveal state, journey position, encounter, and supplies.
- Validation: route property tests, resume at every phase, no wave wording.
- Rollback: affected contracts can dispatch to assault.

## Phase 7 — Continuous assault

- [x] Move legacy wave behavior behind the explicit assault mode.
- [x] Preserve direct wave transitions and wave X/Y UI.
- [x] Use shared v2 combat, skills, statuses, and supplies.
- Validation: differential legacy fixtures plus new shared-engine tests.
- Rollback: legacy assault engine remains switchable during rollout.

## Phase 8 — Defense engine

- [x] Add seeded spawn schedule, defense clock, gate HP, and target policies.
- [x] Add off-screen approach movement, sight reveal, eight-visible cap, and boundary queue.
- [x] Add timer-close and cleanup phases.
- [ ] Add save/reconnect fixtures at queue, full-field, event-gate, and cleanup states.
- [x] Add objective and off-screen UI.
- Validation: property tests proving no lost/duplicated enemy; performance test with long queues.
- Rollback: defense contracts hidden without affecting other modes.

## Phase 9 — Villager assistance

- [x] Add frequency/cooldown/uniqueness scheduler.
- [x] Implement five one-shot assistance effects.
- [x] Add blocking enter/act/result/exit event gate.
- [x] Add explicit solo continue and shared host continue.
- [x] Prove clocks, effects, spawns, and supplies freeze under the gate.
- Validation: deterministic schedule and team synchronization tests.
- Rollback: assistance scheduler off; defense remains playable.

## Phase 10 — Daily distribution and integration

- [x] Assign exactly one exploration, assault, and defense commission per danger tier.
- [x] Add mode badges, descriptions, risks, and mode-specific previews.
- [x] Run economy/combat simulations by danger, loadout, accuracy, VIT, and arrow count.
- [x] Tune values without changing the approved rule contracts.
- [ ] Run all guild tests, relevant full-project tests, lint/build, and manual solo/team resume QA.
- [x] Update Adventurer Guild specs with final calibrated values.

## Review gates

- Do not begin Phase 2 until supply transactions are correct.
- Do not build mission modes before the shared monster engine has deterministic tests.
- Do not enable team modes before solo save/resume and event timelines are stable.
- Do not remove legacy fallbacks until migration and reconnect fixtures pass.
