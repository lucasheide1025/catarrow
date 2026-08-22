# Technical Design

## Boundary and source of truth

- `src/lib/targetFace.js` remains the only source for target metadata, legal labels, geometry and landing records.
- `src/worldboss/domain/raidFaces.js` and `raidRange.js` remain the only source for selectable Free Hunt faces, distances, face caps and environment multipliers.
- Replace the current bow-aware Free Hunt draft with a versioned shooting-environment contract derived only from distance and target format.
- The preparation UI owns editable draft settings. A confirmed draft is not combat authority until the solo start or team host-start operation freezes it into a battle snapshot.

## Shooting environment contract

Each participant receives a versioned snapshot containing distance, target format, input mode, derived damage multiplier, face cap, confirmation and lock state.

- Allowed input modes are `target` and `score`.
- First-use defaults are 10m, `half_17`, and `score`.
- Remembered values prefill drafts only. Every sortie starts unconfirmed.
- Before start, modifying a confirmed draft atomically resets `confirmed` to false.
- Team start validates every active member as confirmed and freezes all snapshots in the same authoritative transition.
- Reconnect reads the frozen snapshot. It never rebuilds from profile or local storage.
- Legacy rooms without a snapshot normalize to the first-use defaults without becoming automatically confirmed in a waiting room.

## UI flow

- Solo and team preparation use one shared environment editor and summary.
- Team roster exposes only confirmation state and the names of unconfirmed members. Detailed environment values remain private to their owner.
- Combat renders exactly one input surface from the locked `inputMode`: `target` uses `TargetFaceInput`; `score` uses buttons from `getTargetScoreLabels(targetFmt)`.
- Target input preserves real landing coordinates and face index. Button input never fabricates coordinates.
- Both input paths normalize to the same arrow label contract. The own-player HUD shows distance, target label and damage multiplier.
- Triple-face target input enforces two arrows per face. Score-button mode needs explicit face assignment so the same cap remains enforceable without coordinates.

## Authority and combat

- Client validation provides immediate feedback but is not authoritative.
- Single-monster party and multi-monster v2 server paths validate the locked snapshot, legal labels, arrow count and triple-face cap.
- The environment multiplier is applied once to each participant's outgoing arrow damage, in the same formula position as World Boss `rangeMult`.
- Reward, XP and attempt consumption remain unchanged.
- Multi-monster browser and Functions runtimes must derive from the same generated combat source to preserve parity.

## Compatibility and rollback

- Existing room fields (`huntDistanceM`, `huntTargetFmt`, `targetFormat`, input-mode fallbacks) remain readable during migration.
- New writes use the versioned member snapshot; do not add another independent multiplier table.
- Rollback can stop writing v1 snapshots while legacy normalization keeps old rooms playable.
- Function deployment must be coordinated with the frontend because a new client talking to an old callable would accept UI state without enforcing it.

## Verification

- Pure environment normalization and legal-label tests for every face/distance.
- Snapshot state-machine tests: prefill, confirm, edit/unconfirm, host gate, lock and reconnect.
- Target/button equivalence tests and triple-face cap tests.
- Solo/party and single/multi adapter contract tests.
- Browser/Functions combat-runtime parity tests.
- Mobile visual checks at 360×640 and 390×844 for both input modes.

