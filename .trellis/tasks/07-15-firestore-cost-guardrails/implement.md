# Firestore Cost Guardrails Implementation Plan

## Ordered Work

1. Define the cost-control schema, threshold constants, capability matrix, monotonic transition rules, and unit tests.
2. Add Firestore rules for administrator/trusted-server writes and authenticated reads of the control policy.
3. Add one app-level policy subscription, cached fallback, and shared provider/hook for member and admin shells.
4. Add the persistent admin cost banner, current level/reason display, and explicit manual recovery control with confirmation and audit metadata.
5. Inventory and guard all high-risk operations: migrations/backfills, all-member bulk tools, full-history performance sync, background/game analytics writes, cloud game progress, and nonessential listeners.
6. Preserve the approved core whitelist and add an idempotent local queue for scoring uploads paused by restricted/emergency mode.
7. Add a trusted automation endpoint/function that consumes rate and billing signals and only raises severity.
8. Configure Firestore operation-rate alerts and billing thresholds at 50/80/90/95%; route email to `broudes@gmail.com`.
9. Add static/CI checks for UI-mounted migrations, unbounded reads/listeners, timer writes, and database calls inside record loops, with explicit reviewed exemptions.
10. Write an incident runbook covering alert triage, kill-switch verification, root-cause isolation, manual staged recovery, and one-month ceiling review.

## Validation

- Unit-test every threshold boundary, capability result, stale/duplicate signal, and forbidden downward automatic transition.
- Test each level in the Firebase emulator and verify rules prevent student modification.
- Confirm core flows work at emergency level and suspended flows issue no Firestore reads/writes.
- Confirm scoring remains usable offline and resumes exactly once after manual recovery.
- Run the repository build and existing test/lint commands.
- Perform a dry-run rate spike and budget-event replay before enabling production automation.

## Risk and Rollback Points

- Roll out enforcement by capability group so a false positive can be isolated.
- Keep a documented admin-only manual override, but never a student/client bypass.
- If automation misbehaves, disable the signal handler while retaining manual `sysConfig/costControl` enforcement.
- Do not lower protection until metrics stabilize and the triggering defect is identified.
