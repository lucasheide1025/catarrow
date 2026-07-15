# Diagnose Archer Performance Firestore spike

## Goal

Identify and stop the code path responsible for the reported daily Firestore spike: approximately 37,000 reads, 65,000 writes in one reported tier, and 17,000 writes in another.

## Confirmed Facts

- The normal `MemberPerformance` mount reads cached summaries locally and normally performs one network read of `memberPerformanceSync/{memberId}`.
- `AdminMembers` automatically starts both all-member legacy practice and monster migrations whenever a new browser-tab session mounts the page.
- Its completion guards are `sessionStorage` keys, so every new tab, browser restart, device, or administrator can run the full scan again. Any migration failure prevents the key from being set.
- The July 14 practice reclassification changed the guard to a v3 key, intentionally forcing another all-member scan.
- Practice migration reads up to 120 logs per member and transaction-reads the target session for every log. Monster migration reads up to 50 logs per member and also transaction-reads every target session.
- With roughly 100 members, the all-member source queries plus per-record existence checks produce approximately 34,000 baseline reads; game/sync checks plausibly bring this to the reported 37,000.
- A newly imported practice record writes one session, each end document, one arrow event, one sync manifest, and sometimes one game performance. At six ends this is approximately 9-10 writes per record; 7,200 records produce approximately 64,800 writes.
- A newly imported monster record writes one session, each end, one game performance, one arrow event, and one sync manifest. Roughly 1,700 writes-at-ten-per-record yields 17,000.
- Fixed session IDs make completed migration records idempotent, but reclassification differences, missing game documents, new sessionStorage versions, multiple tabs, and failures still cause repeated scans and corrective writes.

## Requirements

- Stop automatic all-member migrations from running on `AdminMembers` mount.
- Legacy migrations must never be guarded only by browser session state.
- Any future migration entry point must be explicit, bounded, observable, and globally coordinated.
- Normal MemberPerformance loading must remain local-first and must not automatically download ends for every session.
- Secondary unbounded change/coach-bootstrap queries must be reviewed and bounded separately after the emergency stop.

## Acceptance Criteria

- [ ] Opening Admin Members causes zero legacy migration reads or writes.
- [ ] Reopening tabs/devices cannot start a whole-database performance migration.
- [ ] Existing member list behavior is unchanged.
- [ ] A future migration plan specifies a Firestore global marker/lease, dry-run counts, cursor, batch limit, progress, and resume behavior.
- [ ] Build passes after any mitigation.

## Product Decision

- Apply the emergency stop immediately: remove both mount-triggered all-member migrations now and design the replacement migration tool as a separate task.

## Out of Scope for Emergency Mitigation

- Deleting already migrated performance records.
- Re-running any migration automatically.
- Guessing billing attribution without collection-level usage metrics.
