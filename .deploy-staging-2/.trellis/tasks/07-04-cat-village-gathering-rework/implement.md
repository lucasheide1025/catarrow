# Implementation Plan

## Stage 1 — Shared model and correctness

- [x] Add serializable gathering contract builder and tests.
- [x] Make Council Hall use one canonical power-based tier list for preview and entry.
- [x] Delay daily attempt recording until the contract actually starts.
- [x] Save full shooting context and checkpoint summary.

## Stage 2 — Gathering experience

- [x] Add explicit tier selection before setup.
- [x] Replace tier gauntlet state with three checkpoint state.
- [x] Add bank-or-continue intermission.
- [x] Update progress, fatigue, logs, copy, and result reporting.
- [x] Update reward calculation for checkpoint multiplier without breaking legacy records.

## Stage 3 — Cat Village UI

- [x] Group six destinations into four primary sections with secondary navigation.
- [x] Make panorama responsive.
- [x] Create a combined village status/collection card.
- [x] Add compact/all resource disclosure.
- [x] Change building grid and typography for mobile readability.
- [x] Remove nested page-level scroll owners and add accessible focus/touch behavior.

## Stage 4 — Validation and co-op preparation

- [x] Verify 360 px and desktop layout from code/build output.
- [x] Run contract tests and existing test suite.
- [x] Run production build and diff checks.
- [x] Document the future team room contract in the frontend spec.
