# Deployment asset inventory and context optimization

## Goal

Inventory tracked deployment snapshots and public assets, then reduce avoidable Vercel and Firebase deployment context without changing asset content.

## Requirements

- Report tracked `.deploy-*` paths, bytes, duplicate blobs, and public image metadata.
- Classify references and provenance as confirmed, candidate, or unknown without treating unknown as unused.
- Exclude historical build snapshots, local staging, reports, backend-only files, and development tooling from the Vercel CLI deployment context.
- Exclude tests and local-only output from the Firebase Functions upload while retaining all runtime source and data.
- Keep changes reversible and document measured, repository-verifiable effects.

## Acceptance Criteria

- [x] A deterministic machine-readable asset inventory and evidence report exist.
- [x] Vercel ignores tracked `.deploy-*` snapshots and unrelated local/development/backend paths.
- [x] Firebase Functions has explicit upload exclusions for tests, dependencies, logs, and coverage output.
- [x] Production build and relevant Functions tests pass after configuration changes.
- [x] No public asset or image is deleted, moved, compressed, re-encoded, or replaced.

## Out of Scope

- Deleting tracked snapshots or rewriting Git history.
- Changing, removing, moving, compressing, or re-encoding assets.
- Changing package manifests or lockfiles.
- Deploying, committing, or pushing.
