# Design

## Audio

Keep the existing Web Audio oscillator so no asset download is introduced.
Raise the peak gain to a safe sub-clipping level and lengthen both tone duration
and sequence spacing. Signal count and frequency remain controlled by existing
call sites.

## Recovery storage

Use a versioned `localStorage` record keyed by member ID. The parent practice
component owns the lifecycle of this record because it spans both scoring and
the unsaved result screen.

The scoring child reports serializable snapshots only when meaningful state
changes. The snapshot includes:

- form and phase
- completed/current scores and target positions
- current round, stage, shoot-off and match state
- round timing
- absolute `deadlineMs` and `startedAtMs`

The 200 ms countdown display is not persisted. On restore, remaining time is
derived from the saved absolute deadline. This avoids excessive storage writes
and prevents users from receiving a fresh timer after leaving.

If a restored shooting deadline is already expired, the existing
`finishRound(true)` path settles the end. A preparation deadline that elapsed
while away transitions into shooting using the elapsed preparation boundary;
if the resulting shooting deadline also elapsed, it settles immediately.

Storage reads are guarded by schema version and member identity. Malformed or
incompatible snapshots are discarded.

Because the member app changes pages through React state rather than browser
navigation, the practice root captures clicks outside the active practice
screen and requests confirmation. Confirming navigation keeps the snapshot;
cancelling stops the parent navigation click.

## Compatibility

Remove new `arrowEntries` collection and writes. Do not alter historical logs
or readers so old records remain harmless.
