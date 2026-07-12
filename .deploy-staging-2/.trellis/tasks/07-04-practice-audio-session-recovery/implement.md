# Implementation Plan

1. Add versioned recovery storage helpers and raise/lengthen range signals.
2. Remove per-arrow timestamp state, timeout entries, completion payloads, and
   database writes.
3. Add scoring-state initialization and snapshot reporting.
4. Restore scoring/result phases in the parent and clear snapshots on terminal
   actions.
5. Reconcile restored absolute deadlines, including elapsed preparation and
   shooting windows.
6. Update the practice simulator specification.
7. Run targeted lint and production build checks.
