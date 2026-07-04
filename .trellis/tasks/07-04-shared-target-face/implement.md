# Implementation Plan

1. Add canonical target format data and pure tap-to-score helpers.
2. Refactor the shared battle overlay into single/triple variants that emit
   full landing records.
3. Replace autonomous-practice target definitions and renderer with the shared
   implementation.
4. Adapt solo monster, party, world-boss, duel, and dungeon input/undo flows to
   retain landing records without changing damage inputs.
5. Include battle landing records in automatic practice saves.
6. Add a shared landing-analysis renderer or preserve data for the dependent
   analytics task; do not build the full battle report in this child.
7. Run pure scoring checks, search for duplicate target math, and build.
