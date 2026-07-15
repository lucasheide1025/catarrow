# Firestore Cost Guardrails Design

## Boundary

The app keeps its direct-client Firestore architecture. Cost control is a small control plane layered over existing database functions and application shells; it does not add a metering write to every operation.

## Control Document

Use `sysConfig/costControl` as the single remote policy document. It contains:

- `level`: `normal | warning | protect | restricted | emergency`
- `monthlyCeilingTwd`: initially `300`
- `observedPercent` and `observedAt`: display/audit information, not client authority
- `reason`, `source`, `raisedAt`, `raisedBy`
- `manualRecoveryRequired`: always true after automatic escalation
- `revision`: monotonic integer used to reject stale events

Only trusted server automation and administrators may update this document. Students may read the effective public policy but cannot lower or bypass it.

## Thresholds and Capabilities

| Level | Monthly usage | Action |
|---|---:|---|
| warning | 50% / NT$150 | Email and persistent admin warning |
| protect | 80% / NT$240 | Disable migrations, backfills, bulk reset/grant, and other high-risk admin writes |
| restricted | 90% / NT$270 | Also disable nonessential background sync, full-history transfer, game-analysis writes, and nonessential live subscriptions |
| emergency | 95% / NT$285 | Keep only the approved core whitelist; scoring stays local and uploads later |

Core services remain available in every level: authentication/profile identity, check-in and class completion, coach review, booking, checkout/accounting, admin cost inspection/recovery, and local scoring.

## Signal Flow

1. Cloud Monitoring watches Firestore document read/write operation rates for sudden spikes and sends an incident signal.
2. Cloud Billing budget Pub/Sub sends monthly percentage notifications.
3. A trusted handler validates the signal and computes the required level.
4. The handler updates `sysConfig/costControl` only when the new level is higher than the current level and the event revision/time is newer.
5. App shells subscribe to the one control document and expose capabilities through a shared cost-control provider.
6. Database wrappers and high-risk UI entry points enforce the capability policy; hiding a button alone is insufficient.
7. Admins receive email at `broudes@gmail.com` and see a persistent red banner.

Billing events may be delayed, duplicated, and out of order, so they are not used for automatic recovery. Rate alerts provide faster spike protection; budget alerts provide spend-based escalation.

## Enforcement Shape

- Centralize policy evaluation in a pure module such as `costControl.js`.
- Add named capability checks such as `bulkAdminWrites`, `backgroundSync`, `gameCloudProgress`, `shootingHistorySync`, and `coreOperations`.
- Guard actual database mutation/subscription functions as well as their UI controls.
- Queue delayed scoring uploads locally with idempotency keys and resume only after an administrator lowers the level.
- Security rules restrict writes to the control document. Rules are not treated as a global usage counter.

## Rollout and Recovery

1. Ship the control document, provider, admin banner, and read-only simulation first.
2. Add guards to known high-risk paths and verify each level using emulator/tests.
3. Enable automatic escalation only after simulation logs show the correct capability changes.
4. Recovery is manual: inspect Firestore metrics, stop the root cause, deploy/fix if needed, then lower one level at a time.
5. Never automatically disable project billing; that would take down core services and creates service/resource risk.

## Failure Behavior

- Missing/unreadable config defaults to the last locally cached level; high-risk admin tools fail conservatively.
- Stale or duplicate automation events are ignored.
- A failed notification does not prevent the control level from rising.
- Core operations must not depend on optional game or analytics listeners.
