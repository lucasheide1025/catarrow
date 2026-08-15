# Repository Hygiene Audit — 2026-08-09

## Scope and safety state

This audit inspects root, `scripts/`, `public/`, `src/`, and `docs/` for one-off repair scripts, previews, zero-byte artifacts, backups/reports, old components, and orphan candidates. It does not delete, move, restore, stage, or edit production files.

The worktree was already highly dirty before this research. Many candidates are currently recorded by Git as deleted. Those deletions are user/pre-existing work: this audit does not claim them, restore them, or authorize staging them. The detailed manifest is [repository-hygiene-deletion-candidates-2026-08-09.csv](./repository-hygiene-deletion-candidates-2026-08-09.csv).

The rollback baseline exists at `backups/codebase-modernization/20260809-193824/` and contains readable status/diff/untracked manifests, checksums, copied WIP files, and `PROTECTED.txt`. The protected list includes Shop V12, shop assets, Cat Village Board/Team/EventScene and board assets, shooting/performance compatibility, `db.js`, DailyQuest, World Boss lifecycle/code, and related files. The current backup directory must never be grouped with obsolete July source-copy backups.

## Classification summary

### A — Safe Delete

High-confidence A items are already deleted in the dirty worktree:

- 16 tracked root repair scripts (`add_onpotionused.py` and `fix_*.py`);
- tracked command-redirection artifacts `findstr`, `npx`, and `firebase` (all three are zero-byte in `HEAD`; the current checkout also has a tracked zero-byte `.tmp-dev.out` and a tracked 19-byte `.tmp-dev.err`);
- three tracked July backup trees that duplicate historical source already available from Git;
- 17 deleted production modules/components for which a fresh production-source search found zero static imports, dynamic imports, JSX component uses, or direct calls.

The deleted production set is recorded in the CSV. Its grep result is necessary but not sufficient: route registries and computed names can evade search. Accepting those deletions still requires a scoped `git diff`, production build, relevant tests, and manual route smoke test. Rollback for tracked files is `git show HEAD:<path>` or the baseline patch; do not use a destructive checkout/reset in this dirty worktree.

Several of those runtime-unreferenced files are still described as active or architectural in Second Brain material. `BattleEngine.js`, for example, is correctly marked orphaned in `quick-ref.md:544` but still appears as an event generator in `features.md:134` and `game-systems.md:134,227`. That documentation inconsistency does not create a runtime dependency, but it means the 17-file set is not a documentation-clean first deletion batch; update or explicitly preserve the historical references when the deletion is accepted.

### B — Archive/Delete Candidate

The largest maintainability candidate is the tracked `scripts/` repair layer: dozens of `fix_*`, `remove_*`, `apply_*`, phase, restructure, and integration scripts. `package.json` exposes only `start`, `build`, `test`, `test:firestore-rules`, and `prepare`; no package script invokes these repair scripts. No `.github` or `.husky` directory exists, while the active hook path is `.githooks`. The July dungeon handoff explicitly describes old `fix_*`/`remove_*` scripts as one-off repair scripts removable only after battle UI confirmation. They should be backed up and removed in thematic batches, not by filename glob.

Four root `tmp-*.html` previews are present and now ignored by `.gitignore:46`. They total roughly 4.0 MiB and have no production/package/CI references. They remain B rather than A because they can be human design-review artifacts.

Deployment staging and source archives are local/reproducible candidates, but the worktree already contains extensive tracked deletions under `.deploy-staging-2` and `.deploy-static-home`. Do not mix those pre-existing deletions into a modernization commit until their ownership is confirmed. `.deploy-staging-source.zip` alone is about 334 MiB and ignored.

The original website-photo classification directory remains B: 148 files / 70.98 MiB, many exact duplicates, no source literal reference, but Firestore CMS URLs have not been inspected. The two `_preview.png` dungeon assets are also B pending dynamic-path/CMS confirmation.

### C — Refactor/Consolidate

The three root audit reports are tracked and superseded in part, but the 2026-08-09 second-brain audit cites them as source material. Move/consolidate them under an archive/history section only after preserving backlinks and unique findings. Deleting cited reports now would break the documentation trail.

Large active modules, duplicate data-authority surfaces, and old/new renderers belong to later modernization/refactor steps, not hygiene deletion. A filename such as `old`, `legacy`, `fallback`, or `junk` is never sufficient evidence.

### D — Compatibility Keep

- `test-booking-concurrency.js` must stay. `.trellis/spec/frontend/booking-system.md:63`, `docs/second_brain/quick-ref.md:1419`, and the changelog say its multi-hour concurrency case has never successfully run against Firestore. The older audit's blanket deletion recommendation is therefore unsafe.
- `備份到D槽.ps1:42` actively invokes `scripts/backup-firestore.js`; the `.bat`, PowerShell, backup and restore chain is operational tooling, not junk.
- repeatable image/catalog generation scripts (`gen-*`, `build-*`, `image_pipeline/**`, monster handbook generation) should be documented by input/output and retained unless their artifacts and regeneration contract are superseded.
- `public/assets/guild/junk_old_map_scrap.webp` is D until the guild asset ID space proves it unreachable. Persisted IDs and dynamic path construction defeat filename-based deletion.

### E — WIP Protect

All paths in the baseline `PROTECTED.txt` are E. This includes the apparently orphaned untracked `src/components/member/ShopSimulator.jsx`: although no production import is found, it was captured as pre-existing untracked shop work and can serve as an active design/reference source. Its rollback copy is in the baseline. `scripts/gen-event-scenes.py` and untracked board event art are also explicitly linked to the Board/EventScene WIP in the second-brain handoff.

## Dependency checks performed

For candidates, the audit checked:

- `git ls-files`, `git status --short`, and dirty deletion state;
- production static imports, dynamic imports, JSX names, direct calls, and URL literals;
- `package.json` scripts;
- presence/absence of CI/hook directories and `.githooks` configuration;
- documentation, Trellis task/spec, handoff, quick-ref, changelog, and runbook mentions;
- migration/compatibility requirements and dynamic asset-path caveats;
- the current backup manifest and protected list.

Notably, root preview files are ignored; backup JSON/service-account files are ignored; the booking concurrency script is tracked and documented; backup-firestore is invoked by the D-drive script; and deleted source candidates have zero currently visible production references by the tested patterns.

## Old components and deleted worktree state

The current dirty deletions include battle engines, admin/member legacy screens, a path selector, old gathering/council screens, and zombie adapters. These may be legitimate safe-dead-code work, but they are not newly executed Step 3 actions. The later Step 4 gate should:

1. inspect each deletion diff against the baseline;
2. search exports and all route/page registries;
3. check tests that imported internals even if production did not;
4. build with the deletion set only;
5. smoke affected member/admin/guest routes;
6. stage only explicit paths after user approval.

## Orphan asset boundary

The asset audit found 72 exact duplicate groups, but only the original website-photo reference directory and explicit preview files belong in the hygiene candidate manifest. Catalog-driven directories (`cards`, monsters, cats, items, board, dungeon, guild, shop) require an ID-to-file expansion plus Firestore CMS/config URL check. A raw “not found by grep” list would produce false positives.

`src/assets/dungeon/event-hall.webp` was reported as unimported by the prior full-repo audit, but it must be rechecked against CSS/dynamic and protected dungeon flow before deletion. It is not promoted to A here. Root Cat Village/Board JPGs and all event assets remain E.

## Low-risk execution order

1. Preserve/verify the already-dirty A deletions without adding new deletions; run scoped build/tests first.
2. Separate the zero-byte tracked artifacts and root repair scripts into a minimal deletion commit if user ownership is confirmed.
3. Handle obsolete July backup trees separately from the current rollback baseline.
4. Archive/remove `scripts/` one-off repairs in battle/domain batches, each with hashes, backup, focused tests, and build.
5. Remove local ignored previews/logs only after confirming no active visual review/debugging session needs them.
6. Inspect Firestore CMS URLs before any public gallery cleanup.
7. Consolidate historical reports with redirects/backlinks instead of silently deleting cited documents.
8. Leave all D/E paths untouched until their explicit validation or WIP freeze gate is satisfied.

### First-batch verdict

Only the tracked zero-byte artifacts `findstr`, `npx`, and `firebase` are independently source-clean and content-free enough to form a technically safe first deletion batch. They are already deleted in the dirty worktree, so even that batch still requires the user's ownership confirmation and per-path manifest records before staging. The root repair scripts are strong next candidates after ownership plus build/tests. The 17 production modules, July backups, and any local logs/previews should not join the first batch: they respectively require route/documentation validation, retention confirmation, or active-session confirmation.

### Step 4 confirmed component cleanup

A fresh whole-`src` identifier/JSX search confirmed that the legacy `GuestHome` in `src/pages/GuestApp.jsx` and `HubBack`, `AdminMemberHub`, `AdminEventsHub`, and `AdminItemsHub` in `src/pages/AdminApp.jsx` had definitions but no callers. The current guest home route renders `GuestHomeV2`. `HubCard` was reachable only from the three dead Admin hubs and was removed with them. Complete pre-cleanup copies and per-file SHA-256 records are stored in the authoritative `20260809-193824` baseline. The production build passed after removal. `PartyBattleRoom` remains active through lazy imports and JSX renders in Guest, Member, and Admin shells; it is a keep, not a dead-code candidate. Protected `ShopSimulatorV3` definitions were not changed.

## Required deletion record

Before every actual deletion, append a row to the authoritative timestamp backup manifest with:

```text
original_path,backup_path,action,reason,sha256,timestamp
```

For tracked files, Git is a rollback source but the task still requires a manifest entry. For untracked/local files, copy the exact file to a timestamp backup first unless it is a zero-byte reproducible log. For a directory, record every file rather than one ambiguous directory row.

## Explicit uncertainty

- CI may run outside repository-local `.github`; no external pipeline configuration was available.
- Firestore CMS/config values and deployed URLs were not inspected.
- Dynamic `import()` and template URLs were searched, but arbitrary computed registry keys can still hide dependencies.
- The person/process that created the existing dirty deletions is unknown; no ownership is inferred.
- Build/test success reported in prior turns is useful but is not a substitute for a deletion-only validation set.
- Ignored backup archives may be the user's only local copy of historical data; deletion needs explicit retention confirmation.
