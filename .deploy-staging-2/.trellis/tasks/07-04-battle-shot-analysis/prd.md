# 戰鬥射箭分析

## Goal

Turn automatically recorded battle arrows into detailed practice analysis
after the shared target contract is complete.

## Requirements

- Depends on `07-04-shared-target-face`.
- Present archery performance and combat outcome as two views of one session.
- Add a persistent personal bow-type and physical-distance picker to battle
  modes that currently lack this context.
- Support source filters for solo, party, dungeon, world boss, duel, and
  autonomous practice.
- Treat raw arrow score as practice data and never combat damage.
- Include incomplete/defeated sessions when arrows were actually shot.

## Acceptance Criteria

- [ ] The shared-target task is completed and its record contract is used.
- [ ] Battle sessions show score, true per-arrow average including misses,
  distribution, stability, end progression, and landing analysis when present.
- [ ] Solo, party, dungeon, world-boss, and duel saves snapshot the player's
  selected bow type and physical distance.
- [ ] Battle details show encounter, party, role, MVP, and rewards when the
  source record supplies them.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
