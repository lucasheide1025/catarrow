# 統一靶面與落點保存

## Goal

Replace divergent practice and battle target implementations with one accurate
target geometry and landing-coordinate contract.

## Requirements

- Define target geometry and scoring in one pure shared module.
- Keep legacy format IDs readable while supporting:
  - 122 cm ten-ring target
  - 80 cm six-ring target
  - 40 cm ten-ring target
  - 40 cm vertical triple target
  - field target with scores 1-6
- Apply World Archery ring proportions. Outdoor 122/80 cm inner-ten radius is
  5% of the full target radius.
- Distinguish recurve and compound indoor ten rings when bow context exists.
- Render a vertical triple face vertically, with one face selected per arrow
  sequence.
- Return and retain `label`, raw score, normalized `nx`/`ny`, face index,
  round, and arrow index for target input.
- Button input remains positionless.
- Use the shared target implementation in autonomous practice, solo monster,
  party, dungeon, world-boss, and duel modes.
- Dungeon target mode must no longer be hard-disabled.
- Preserve raw field scores 1-6; combat conversion remains a separate value.
- Persist collected coordinates with each mode's automatically saved practice
  record, without altering combat damage payloads.
- Existing records and stored target IDs remain readable.

## Acceptance Criteria

- [ ] Practice and battle import the same target definitions and score resolver.
- [ ] Full targets do not award X for the entire 10 ring.
- [ ] Cropped six-/five-ring faces display and score their correct outer zone.
- [ ] Vertical triple faces are actually vertical and retain face indices.
- [ ] A target tap returns normalized coordinates and the raw archery score.
- [ ] Undo removes the matching score and coordinate.
- [ ] Solo, party, dungeon, world-boss, and duel target input retain positions
  through round completion.
- [ ] Practice records created by target-input battles include
  `arrowPositions`; button-input records do not invent coordinates.
- [ ] Existing battle score and damage behavior is unchanged.
- [ ] Production build succeeds.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
