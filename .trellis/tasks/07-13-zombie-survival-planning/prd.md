# PRD — Zombie Survival Mode Planning

## Goal

Plan (without implementing) an independent, physical-archery zombie survival mode: an electronic cooperative tabletop game whose real-world shooting is its primary interaction and judgement mechanism. It must use real zombie target sheets and SVG coordinate hit detection, while preserving all existing dungeon, scoring, inventory, village, and player functions. The controlling design philosophy is recorded in `core-design.md`.

`integrated-plan.md` is the reconciled source of truth for product scope and phase placement. It incorporates the original proposal and the later confirmed rules; Phase 1 is deliberately restricted to the core battle prototype.

## Confirmed repository facts

- Existing dungeon combat uses `dungeonRooms`, member `hp`/`maxHP`/`atk`/`def`, score labels, and `processDungeonRound`; it is not suitable as the survival combat engine.
- `TargetFaceOverlay` and `src/lib/targetFace.js` already preserve normalized hit coordinates (`nx`, `ny`), but their geometry is concentric scoring rings rather than anatomy.
- Dungeon, party, and expedition rooms use Firestore subscriptions and persisted `hostId`. Existing rules allow every signed-in user to read/write those collections, so a new competitive/survival room cannot inherit that security boundary.
- Dungeon has reusable product concepts only: host authority, join/reconnect flows, 3/6 arrow run settings, node maps, non-combat confirm/resolve, reward claims, coins, material inventory, and village resources.
- Verified dungeon hooks: per-round resolution, existing ATK/DEF/damage multipliers, standard combat buffs, chest/trap/event nodes, and X-critical contracts. There is no verified accuracy, dodge, infection, trap resistance, undead modifier, stealth, or generic first-hit hook.

## Requirements

- Create a dedicated zombie-mode domain: rooms, survivor state, equipment, supply, map/extraction, base, and cross-world adapter must not use dungeon combat calculations.
- MVP battle uses four fixed target slots A–D, a custom zombie SVG hit map (head, neck, arms, chest, abdomen, pelvis, M), normal zombies, up to three arrows per player, virtual distance, knockback/slow, and host-gated safety phases.
- Shooting timers run only in `SHOOTING`; score input, animations, arrow retrieval, and safety pauses must not consume time.
- Standard shooting windows are distance-banded: 10m+ = 120s, 7–9m = 60s, 4–6m = 45s, and 3m = 30s. A 0m rescue event has a 15s rescue-arrow window. Every formal shooting window starts with a host-initiated 5s safety countdown and audible shoot / stop cues; the stop cue relies on archer self-discipline, with late/unshot arrows recorded as `M`, rather than blocking score entry.
- Every zombie independently stores target slot, distance, movement/attack behaviour, body-part state, and status. Directly targetable zombies never exceed configured physical target slots.
- Survivor outcomes use protection, infection and extraction, never HP/ATK/DEF. Infection progresses across map nodes slowly enough for meaningful decisions; medicines can delay or fully cure it, while three consecutive zombie attacks force full infection.
- Zombies communicate body-part destruction and resulting behaviour (stop, knockback, limb failure, movement reduction), never a conventional numerical HP bar. Equipment may reduce the number of non-head hits required, but must never automate shooting or supersede real accuracy.
- New archers must contribute meaningfully through close targets, generous torso hit regions, and ordinary three-arrow kills. Skilled archers earn their advantage through real accuracy, not character ATK or level.
- Multiplayer is cooperative; party size must improve safety without linear enemy scaling. The complete-infection state remains extensible rather than becoming direct PvP.
- Complete infection preserves team membership as a remaining-consciousness support role, never direct PvP or an idle elimination. Its attacks apply half-strength body effects (for example, two head hits or six upper-torso hits on an ordinary zombie) and it has a separate score-based zombie-interference action.
- A room supports up to five main archers plus three remote sniper-support archers. Support archers contribute auxiliary attacks and rescue arrows, consume supplies, cannot be attacked, and receive the same equal-share rewards as the rest of the team; their harder virtual hit distance is the tradeoff, while preserving a meaningful new-player accompaniment role.
- Exploration must support choice-driven nodes, supplies, at least two extraction paths, and risk-versus-loot decisions in later phases.
- Large-map exploration must offer a rapid-extraction option from non-combat large-map states; successful use loses 30% of the current expedition's carried supplies, preserving a meaningful risk-versus-time tradeoff. It cannot interrupt shooting, scoring, resolution, or zombie attacks. Individual withdrawal is available only in a safe zone and loses 15% of that player's carried supplies.
- Cross-world rewards are opaque IDs in zombie data. A dungeon-side allowlisted adapter may translate only verified existing hooks/parameters; unsupported effects become existing rewards/research materials.

## Explicit exclusions

- No code implementation, Firestore migration, rules deployment, art production, or balancing in this task.
- No dungeon combat reuse, score-button substitute, leg hit zones, or timer outside the shooting phase.
- No auto-hit, auto-attack, auto-kill, auto-headshot, RPG-style stat escalation, or infected-player PvP. New features must pass the `core-design.md` question: do they make players want to shoot more?
- No assumption that prospective dungeon stats or hooks exist.

## Acceptance criteria for this planning task

- [x] Evidence-backed current-state analysis distinguishes reusable from isolated modules.
- [x] Design describes independent data boundaries, state machine, command flow, SVG coordinate transform, and cross-world compatibility boundary.
- [x] Implementation plan is phased and starts with a constrained safety-first prototype.
- [x] Product owner resolved the MVP source-of-truth policy for physical hits.
- [x] Product owner defined the ordinary-zombie body-part baseline, start-distance range, host-confirmed round loop, large-map direction, and 5+3 venue roles.
- [x] Original proposal, core-design philosophy, and later confirmed decisions are reconciled into a phased source of truth.
- [x] **A區：殭屍類型與戰鬥（6 題）** — 重裝殭屍（6箭/1-2m/破甲衝撞）、疾行殭屍（2-4m/頭2次）、遠程殭屍（自動干擾/高危區以上/1箭脆皮）、救援箭（50%觸發）、BOSS（完整欄位+巨型殭屍王）
- [x] **B區：防具、裝備與物品（4 題）** — 五級防具制+強化插槽、5種武器箭具、配件隨基地成長、20kg初始背包
- [x] **C區：地圖、事件、撤離與經濟（5 題）** — 各區遭遇率（20/40/60/80%）、5種撤離類型、6類隨機事件、個別撤離物資歸隊伍均分、共用地下城經濟
- [x] **D區：長期內容與跨世界（3 題）** — 基地10級制+9材料+9建築全上、完全感染=弱點標記+血清可治癒、跨世界Phase4決定
- [ ] Product owner reviews the planning artifacts before any implementation task is started.

## Confirmed round-control policy

- Each archer enters their own arrow target slot and SVG coordinate.
- The host alone starts the shooting countdown.
- The host alone marks shooting complete; this immediately pauses/stops the countdown and moves the room to score input.
- The host alone submits scores for resolution. Resolution begins only from this explicit command, never automatically at the shooting deadline.
- Normal score submission waits until every active archer has completed input, matching current multiplayer battle behaviour. The host may force-pass only incomplete archers to recover from a disconnect or stuck client; their recorded arrows remain intact and only missing arrows are treated as lost/no-effect for that round.
- `M` is an SVG click region surrounding the zombie silhouette, not a conventional score button and not a coordinate-required hit. The target sheet photograph supplied by the product owner is the source reference for a fixed black-and-white SVG anatomy map.
- Every zombie is assigned and visibly announces an ordered survivor attack list when it spawns, including the current first target. At 0m it attacks the current target, then moves to the next living survivor if it remains alive; it continues until killed or no survivor remains. The order remains stable unless a later explicit rule/event changes it.
- Turn consequence order is fixed: resolve player arrows, then move surviving zombies, then resolve attacks from zombies that reached 0m (including armour and infection), then optionally trigger a one-arrow friendly-rescue event. A 0m zombie does not erase the preceding player shooting phase.
- Every imminent 0m attack opens a required 15-second rescue window. Every main archer and remote sniper may contribute one physical arrow against the threatening zombie, resolved through the normal hit map and body-part rules; a successful rescue prevents that attack, otherwise normal armour and infection resolution follows. It is not a guaranteed headshot or an automatic success.
- The system must later support a central display station. After all active archers complete input and the host submits the round, this display plays the single persisted battle-result/event sequence for the group. It is display-only: it has no arrow input, host authority, or independent result calculation.
