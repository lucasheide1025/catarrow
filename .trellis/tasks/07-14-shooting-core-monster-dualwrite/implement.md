# Implementation plan

1. Add pure schema/normalization/metrics helpers with score-input and target-plot support.
2. Add idempotent Firestore finalization service and fixed-ID arrow-count event.
3. Capture ordinary MonsterBattle score/position and game result snapshots, then dual-write on win or loss.
4. Run focused static checks and production build; inspect diff for legacy-flow isolation.

## Rollback

Remove only the MonsterBattle call if a production issue occurs. New collections are additive and old battle records remain authoritative during the dual-write phase.
