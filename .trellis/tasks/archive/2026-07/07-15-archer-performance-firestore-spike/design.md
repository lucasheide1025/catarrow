# Emergency Mitigation Design

## Change boundary

Remove the `AdminMembers` imports and mount effects that invoke `migrateAllLegacyMonsterLogs` and `migrateAllLegacyPracticeLogs`. Remove their `sessionStorage` guard keys with those effects.

Keep the migration functions exported in `db.js` for forensic compatibility and a future explicit administration tool. Do not call them from any normal page lifecycle.

## Verification

- Repository search must show no automatic UI call sites for either all-member migration.
- `AdminMembers` member loading and UI remain unchanged.
- Production build must pass.
- No migration or cleanup runs during verification.

## Rollout

Deploy this client stop as soon as practical. Existing migrated records remain untouched. A future tool requires a Firestore global lease/marker, dry-run, cursor, fixed batch size, progress, resume, and explicit operator action.
