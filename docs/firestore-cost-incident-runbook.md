# Firestore Cost Incident Runbook

## Policy

The initial monthly soft ceiling is NT$300. Protection is staged and never disables project billing:

| Usage | Level | Response |
|---:|---|---|
| 50% / NT$150 | `warning` | Email `broudes@gmail.com` and show the admin banner |
| 80% / NT$240 | `protect` | Block migrations, backfills, bulk grants, resets, and deletion |
| 90% / NT$270 | `restricted` | Also pause nonessential sync, history transfer, analysis writes, and listeners |
| 95% / NT$285 | `emergency` | Keep only approved core operations and local scoring |

Automatic signals may only raise the level. Lowering it is a deliberate admin action after the cause is fixed.

## External one-time setup

1. Create Cloud Billing budget thresholds at 50%, 80%, 90%, and 95%.
2. Route email to `broudes@gmail.com` and budget notifications to Pub/Sub.
3. Alert on Firestore `document/read_ops_count` and `document/write_ops_count`, using a measured normal baseline.
4. Connect signals to a trusted Cloud Run/Functions handler. It must ignore duplicate/stale events and only write a higher level with a higher `revision`.
5. Simulate signals before enabling writes. Never put admin credentials in the browser bundle.

## Incident response

1. Confirm the banner and `level`, `observedPercent`, `reason`, `source`, and `revision` in `sysConfig/costControl`.
2. Identify the operation start time, collection, route, release, and user role from Firestore metrics.
3. Stop the triggering path with a capability gate or rollback. Never delete user data or disable billing as the first response.
4. Verify login, check-in/review, booking, accounting, and local scoring.
5. Keep protection raised until metrics stabilize and the root cause is known.
6. Recover manually from the admin banner; after severe incidents, lower one level at a time.
7. Record the multiplication factor and add a regression test or static check.

## Review checklist

Every query/listener/bulk operation documents its maximum documents, trigger frequency, listener lifetime and cleanup, writes per source record, retry/idempotency behavior, and capability gate. Bulk jobs also require a dry-run estimate and fixed limit.

Never invoke an all-member migration from route mount, login, navigation, timers, or `useEffect`. A controlled migration requires explicit action, dry-run, server lease, version, cursor, fixed batch, progress, and resumability.
