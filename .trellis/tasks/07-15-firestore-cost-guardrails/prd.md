# Design site-wide Firestore cost guardrails

## Goal

Prevent a code defect, migration, duplicated listener, retry loop, or fan-out query from producing unbounded Firestore cost now that the project uses a paid plan.

## Confirmed Facts

- A paid Firebase plan removes the free-tier stop but does not provide an automatic spend hard cap; billing budgets primarily alert and do not stop usage.
- The July 2026 incident was caused by normal-page lifecycle code invoking whole-database migrations. Browser session guards were not global locks.
- The repository previously identified approximately 13 always-mounted listeners per member/admin session and more than 70 `onSnapshot` definitions across the codebase.
- Historical hotspots include per-round writes/reads, unbounded practice/certification queries, duplicated member/cat listeners, new-device ends fan-out, 30-second duel heartbeats, and all-member admin fetches.
- Direct client Firestore architecture means security rules can authorize document shapes but cannot enforce a global daily read/write budget.
- Reliable automatic global throttling requires a server-controlled feature gate and telemetry/monitoring source; adding a Firestore counter to every operation would itself increase writes and can become another hotspot.
- The project already has `sysConfig` documents and app-wide maintenance/tier configuration listeners that can support centrally controlled kill switches.
- Existing discussion and audit artifacts are in `backups/2026-07-14_firestore-optimization/OPERATION_LOG.md` and the archived `07-09-db-cost-and-deadcode-cleanup` cost survey.

## Proposed Defense Layers

1. **Design-time budgets**: every query/listener/bulk operation declares scope, maximum documents, trigger frequency, and expected read/write multiplication.
2. **CI/static checks**: flag unbounded `getDocs`/`onSnapshot`, migrations imported by UI, timers that write, and per-record database calls in loops.
3. **Operational migration framework**: explicit admin action, dry-run, global lease, stable version, cursor, fixed batch, progress, resume, and audit record.
4. **Runtime feature gates**: remotely disable migrations, background sync, bulk admin operations, nonessential live listeners, and high-cost analytics independently.
5. **Monitoring/alerts**: Cloud Billing and Firestore usage alerts at escalating thresholds, with collection/operation dashboards and a response runbook.
6. **Emergency mode**: preserve authentication, check-in, booking, billing, and core member access while disabling nonessential game analytics/history/background writes.

## Initial Acceptance Criteria

- [ ] No normal route lifecycle can invoke an all-member migration or bulk rewrite.
- [ ] Every collection query has an explicit maximum or documented small bounded collection exemption.
- [ ] Every retained live listener has an owner, lifetime, query bound, and real-time justification.
- [ ] High-frequency writes use aggregation/idempotency or a documented necessity.
- [ ] Admin bulk tools provide dry-run estimates and enforce per-run limits.
- [ ] A remote cost-emergency configuration can disable nonessential Firestore features without redeploying.
- [ ] Billing/usage alert thresholds, owners, response steps, and rollback switches are documented.
- [ ] CI fails on newly introduced forbidden patterns unless a reviewed exemption is recorded.
- [ ] At 80% of the configured monthly ceiling, high-risk writes are automatically blocked without blocking core operations.
- [ ] Automatic signals can raise but never lower protection severity; an administrator can manually recover after verifying usage is stable.

## Product Decisions

- Use conservative staged degradation: 50% notify; **80% begins automatic protection** by disabling migrations/backfills/bulk tools; 90% disables nonessential background sync, full-history transfer, and game-analysis writes; 95% enters cost emergency mode and preserves only core operations.
- Use NT$300 as the initial monthly soft ceiling: NT$150 notification, **NT$240 protection start**, NT$270 nonessential sync/analysis shutdown, and NT$285 emergency mode. Reassess after observing one month of normal baseline usage.
- Send billing/usage alerts to `broudes@gmail.com` and show a persistent red cost-status banner in the admin app with the current threshold and disabled capabilities.
- Escalation is automatic and monotonic; recovery or lowering the protection level requires an administrator action.
- Emergency mode keeps login/logout, member identity/basic profile, check-in/class-end/coach review, booking query/create/cancel, checkout/accounting, admin cost status/unlock, and local scoring with delayed upload.
- Emergency mode suspends cloud game progress, shooting-performance sync/full-history transfer, market/village goals/leaderboards, nonessential notifications/background sync/reward statistics, and all migrations/backfills/bulk reset/grant tools.

## Out of Scope During Planning

- Automatically deleting user data.
- Replacing Firestore or rewriting the whole application backend.
- Adding per-operation telemetry writes before proving their net cost and failure behavior.
