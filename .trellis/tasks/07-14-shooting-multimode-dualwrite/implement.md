# Implementation plan

1. Trace personal raw-arrow ownership in DungeonBattleRoom and add the adapter.
2. Repeat for PartyBattleRoom, WorldBossAttack and DuelRoom without reading
   other members' arrows into a personal session.
3. Validate fixed IDs, abort behavior and existing result writes; production build.
