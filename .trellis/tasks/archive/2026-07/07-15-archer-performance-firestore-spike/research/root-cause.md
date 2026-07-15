# Firestore spike root-cause audit

## High-confidence root cause

`src/components/admin/AdminMembers.jsx` mount effects automatically call both `migrateAllLegacyMonsterLogs()` and `migrateAllLegacyPracticeLogs()`. Browser `sessionStorage` is the only guard. It is tab-scoped, device-scoped, versioned, and set only after an entirely successful run.

## Read multiplication

For approximately 100 members:

```text
practice source queries: 100 * 120 = 12,000
practice per-record session checks: 12,000
monster source queries: 100 * 50 = 5,000
monster per-record session checks: 5,000
subtotal: 34,000
game-performance and sync-manifest checks: ~3,000+
total: ~37,000 reads
```

This matches the reported read spike.

## Write multiplication

New practice import writes `session + E ends + arrowEvent + sync (+ gamePerformance)`, normally `E+3` or `E+4`. With six ends, 60 members * 120 records * 9 writes = 64,800.

New monster import writes `session + E ends + gamePerformance + arrowEvent + sync`, normally `E+4`. About 1,700 record-write units at ten writes each produces 17,000.

Existing v3 reclassification can also write session + arrow event + sync (+ missing game) for each changed record. The July 14 guard-key change forced another scan.

## Secondary risks

- Changed-session and changed-game queries have no result limit.
- Coach first-view bootstrap reads all three-month summaries for one member without a count limit.
- Explicit new-device transfer reads three-month sessions/games, then fans out over every session's ends.
- These are secondary and user-triggered; they do not match the sudden all-database write spike as closely as AdminMembers auto migration.

## Recommended response

1. Immediately remove mount-triggered migrations.
2. Deploy the stop before running any more migrations.
3. Design an explicit administrative migration with a Firestore global marker/lease, cursor, fixed batch size, dry-run count, progress, resume, and failure reporting.
4. Compare collection-level growth ratios to confirm attribution: practice roughly `session:ends:game:arrow:sync = 1:E:(0|1):1:1`; monster `1:E:1:1:1`.
