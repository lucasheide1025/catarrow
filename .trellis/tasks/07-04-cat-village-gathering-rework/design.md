# Design

## UI information architecture

`CatVillage` retains a single active primary section:

- `village`
- `tasks` with `council` / `expedition`
- `workshop` with `forge` / `potioncraft`
- `trade` with `gacha` / `cardmarket`

Legacy `initialTab` values map to the new primary and secondary section so existing navigation remains compatible. The primary navigation is sticky, four columns, touch sized, and uses explicit active state. Secondary navigation is rendered only when a group has multiple tools.

The village page order is:

1. responsive panorama and level;
2. secretary and collection status card;
3. village goal;
4. compact resource summary with disclosure for all tiers;
5. two-column building grid;
6. level explanation.

## Gathering contract

Add a pure module `src/lib/gatheringContracts.js`.

`buildGatheringContract({ buildingId, tier, distance, targetFmt, seed })` returns:

```js
{
  version: 1,
  id,
  buildingId,
  race,
  tier,
  distance,
  targetFmt,
  checkpoints: [
    { index, title, action, progressRequired, fatigueRate, rewardMultiplier }
  ]
}
```

The object contains primitives, arrays, and plain objects only, so it can later be written to Firestore unchanged.

Solo Council flow:

1. choose building in Council Hall;
2. choose one tier, distance, and target;
3. press Start Contract;
4. consume one daily attempt once;
5. resolve scoring rounds against checkpoint progress;
6. after checkpoint 1/2, bank rewards or continue;
7. checkpoint 3 or fatigue exhaustion enters result.

Existing combat math remains temporarily reused internally to reduce balance risk, but UI terminology exposes progress/fatigue rather than monster HP/damage. Rewards key off selected tier and cleared checkpoint multiplier, not every tier below the player's power.

## Daily limit

Move `recordCouncilSession()` out of `CouncilHall.handleEnter`. `CouncilBattle` receives `onStart`, calls it once from the Start Contract action, and only enters input after the write succeeds. Returning from setup performs no compensating local count change.

## Future co-op boundary

A later `councilRooms` document will persist:

- contract descriptor;
- host and members;
- status and checkpoint index;
- shared progress and fatigue;
- per-member round submissions and readiness;
- result and per-member claims.

The room will consume each member's daily attempt at first round start, support reconnect, and use the same contract builder and reward calculator. No co-op UI is exposed in this stage.

## Compatibility

- Existing `completeCouncilSession()` accepts additional optional fields and keeps legacy calls working.
- Existing `initialTab` identifiers continue to route to equivalent grouped destinations.
- Existing village and inventory document shapes are unchanged.
