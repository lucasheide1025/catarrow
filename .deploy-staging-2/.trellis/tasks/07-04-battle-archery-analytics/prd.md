# 戰鬥射箭紀錄與分析

## Goal

Every arrow entered during a game mode also becomes trustworthy practice data,
without changing the pace of combat.

## Requirements

- Use one target-face and scoring contract across practice and battle modes.
- Preserve raw archery scores separately from combat damage and modifiers.
- Persist landing coordinates whenever target-face input is used.
- After target correctness is verified, add unified practice analysis to solo,
  party, dungeon, world-boss, and duel battle history.
- Preserve existing records and game rules during incremental rollout.

## Acceptance Criteria

- [ ] The shared target-face child task is completed before battle analytics.
- [ ] Every supported battle mode can emit practice-compatible arrow records.
- [ ] Battle history can show both archery performance and game outcome.
- [ ] Old records continue to render without migration.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
