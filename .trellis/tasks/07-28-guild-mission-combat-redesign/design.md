# Technical design

## Module boundaries

- `guildContracts`: deterministic daily mode assignment and player-facing metadata.
- `guildMission`: common mission envelope, persistence version, settlement, and mode dispatch.
- `guildJourney`: exploration route generation and node/event transitions.
- `guildCombat`: shared arrow, cat, monster action, intent, counter, status, and supply resolution.
- `guildAssault`: consecutive-wave state machine.
- `guildDefense`: clock, objective, spawn schedule, sight, queue, and villager gates.
- `guildEquipmentV2`: slot budgets, traits, compatible affixes, migration, and comparison.
- UI components consume domain events; they do not infer outcomes from prose.

## Mission envelope

```js
{
  version: 3,
  mode: "exploration" | "assault" | "defense",
  contract,
  combat,
  supplies,
  modeState,
  status,
  log,
}
```

Mode state is a tagged union. Invalid transitions return an unchanged state plus an explicit error.

## Shared combat turn

1. Read existing intents.
2. Resolve submitted arrows and overflow retargeting.
3. Update four-template counter progress using resolved target and raw score.
4. Resolve cats and assistance owned by the current phase.
5. Resolve announced skills.
6. Resolve movement.
7. Resolve in-range basic attacks.
8. Tick applicable status actions.
9. Announce new intents.
10. Consume supplies.
11. Return domain events and the next state.

Mode handlers decide whether the result returns to a map, advances a wave, advances a defense clock, or settles.

## Tactical battlefield grid

Recommended initial board:

- three lanes;
- six visible depth rows;
- player/gate anchor below row zero;
- off-screen approach positions continue beyond the visible rows;
- up to eight monsters occupy distinct visible cells.
- player/member and gate positions are fixed anchors outside the monster occupancy grid;
- cats animate from support anchors and never block cells.

Monster position is `{ lane, depth }`. Manhattan-style forward depth determines ordinary range; lane distance matters for adjacent, line, cone, and area effects.

Movement rules:

- normal movement reduces depth by `moveSpeed`;
- occupied cells block movement unless a skill explicitly swaps, leaps, or pushes;
- deterministic tie-breaking selects alternate lane or stops at the nearest legal cell;
- knockback increases depth;
- reaching the player/gate boundary triggers target-policy behavior.

Range rules:

- melee range is zero/adjacent boundary;
- ranged attacks use cell range;
- UI highlights reachable cells and intended targets;
- skill areas are explicit shapes such as single, adjacent, lane, cone, or radius.

Presentation maps cells to stable CSS grid positions. Animation moves entities between cells, while the domain state changes only through discrete cell transitions.

The grid is tactical context, not a player-movement subgame. Player input remains target selection plus real arrow-score entry.

## Effect model

Active effects are normalized records keyed by target, stat, and sign. Calculations derive effective stats from base stats plus active records. UI and replay use emitted events containing source and before/after values.

## Equipment v2

Preserve archetype IDs while replacing arbitrary raw tables with:

```js
{
  slot,
  role,
  weightClass,
  primary,
  secondary,
  traitId,
  allowedAffixTags,
}
```

Resolve stats through a versioned budget table. Migration is deterministic and idempotent. Existing affixes map to compatible v2 effects; invalid legacy combinations retain a visible `legacy` compatibility effect until explicitly converted, never disappear silently.

## Defense queues

- `approaching`: all off-screen enemies with distance and arrival ordering.
- `visible`: up to eight targetable enemies.
- Movement is resolved for both collections.
- Crossing sight range moves an enemy to visible only when capacity exists.
- When full, the enemy clamps at the boundary and retains ordering.
- Spawn schedule is generated from a seed and saved, so reconnect does not reroll.

## Team synchronization

The host commits canonical domain transitions. Clients submit arrows and render the shared event timeline. Blocking event gates and tactical information do not mutate the clock. Resume state includes the current gate and animation event index.

## Rollout

Use versioned feature switches per mode:

1. new supply settlement;
2. equipment v2;
3. shared monster actions;
4. exploration;
5. assault migration;
6. defense;
7. team versions.

Legacy assault remains available as fallback until new-mode save/reconnect tests are green.
