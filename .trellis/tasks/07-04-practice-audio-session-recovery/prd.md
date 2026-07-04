# 改善賽事提示音與中斷恢復

## Goal

Improve the professional practice simulator's range signals and make an
unfinished scoring session recoverable after navigation or reload.

## Requirements

- Increase the synthesized range-signal volume and make each beep clearly
  longer on mobile devices.
- Keep the existing signal counts and meanings unchanged.
- Stop collecting and writing per-arrow score-entry timestamps
  (`arrowEntries`) for new practice records.
- Preserve compatibility with historical records that already contain
  `arrowEntries`; no migration or deletion is required.
- Persist an unfinished scoring or result session per signed-in member.
- Restore the exact practice configuration, completed ends, current end,
  target positions, match state, timing state, and result state when the
  member returns to the practice page.
- Timed sessions must retain their absolute deadline. Time spent away counts
  toward the limit; an expired shooting end is settled as timed out on return.
- Clear the recovery snapshot after saving, explicitly cancelling, or starting
  a replacement session.
- Warn on both browser unload and internal app navigation while an unfinished
  scoring or result session exists.

## Acceptance Criteria

- [ ] Each range beep is substantially louder than the previous 0.28 peak and
  lasts substantially longer than the previous 0.25 seconds.
- [ ] Two- and three-signal sequences remain audibly distinct.
- [ ] New saved practice logs do not include `arrowEntries`.
- [ ] Existing logs containing `arrowEntries` still load without errors.
- [ ] Navigating away or reloading during setup-independent scoring and then
  returning restores the same end, entered scores, positions, and match state.
- [ ] Navigating away during preparation or shooting does not reset the clock.
- [ ] Returning after a shooting deadline records missing arrows as timed-out
  misses and advances or completes the session according to existing rules.
- [ ] A completed-but-unsaved result is restored until saved, retried, or
  explicitly discarded.
- [ ] Internal navigation asks for confirmation without deleting the recovery
  snapshot when the member chooses to leave.
- [ ] Cancelling and saving remove stale recovery data.
- [ ] Project lint/build checks pass.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
