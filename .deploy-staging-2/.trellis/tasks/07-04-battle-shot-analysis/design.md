# Design

## One session, two reports

Battle practice records remain ordinary practice logs with a `source` and
combat metadata. The archery report reads only raw arrows, target context, and
landing coordinates. Damage, buffs, critical hits, and monster defence never
enter archery calculations.

## Personal shooting context

Add a versioned member-scoped browser profile containing:

- bow type
- physical shooting distance

Target format remains owned by the current battle/room rule. A compact shared
picker appears before scoring in solo, party, dungeon, world-boss, and duel
modes. Values persist and are reused, so normal play needs only confirmation.

Automatic practice saves snapshot the current personal profile. Old records
with missing bow/distance remain readable and display "未記錄".

## Shared analysis

Create pure normalization/stat helpers and a reusable
`ArcheryPerformanceReport` component. It accepts heterogeneous legacy rounds
but emits one report:

- true average using every arrow, with misses as zero
- total, hit rate, X/10/miss counts
- high-score rate relative to target maximum
- standard deviation/stability
- first-half versus second-half change
- per-round progression
- landing group centre and spread when coordinates exist

The history page adds dungeon and duel filters and uses the same report for all
battle sources. Combat identity/result remains visible beside the archery
report.

## Compatibility

No record migration is required. Normalizers accept numeric arrows, labels,
and `{label, score}` objects. Unknown labels become misses only when they
represent an actual arrow slot; malformed non-arrow data is ignored.
