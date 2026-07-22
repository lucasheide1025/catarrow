# Batch C: Gemini retirement, GPT boundary, dependency and deployment validation

Date: 2026-07-22

## Gemini retirement evidence

`rg --no-ignore` found one executable `@google/genai` caller: `scripts/generateVillageImages.js`. `scripts/listModels.js` used `GEMINI_API_KEY` and the Gemini models endpoint but did not import the package. Neither script was referenced by `package.json`, CRA source, Firebase Functions, Vercel configuration, Git hooks, or a build lifecycle.

The two Gemini-only scripts and the root direct `@google/genai` dependency were removed. `npm uninstall` removed two installed packages and updated the lockfile. Existing generated images, including `public/village/**`, were not removed, moved, or rewritten. `scripts/audit-static-assets.mjs` retains the deleted generator filename only as historical filename-contract provenance; that reference is not an executable caller.

## Manual GPT boundary

`docs/image-generation-workflow.md` defines GPT generation as an explicitly approved interactive authoring operation. Codex's built-in image generator is not represented as a browser, Firebase Function, Node script, CI, or build-time API. `scripts/validate-gpt-image-staging.mjs` is read-only: it verifies provider/execution declarations, staging containment, file existence, byte size, and SHA-256 without calling an image provider or deployment service.

## Production audit reachability

After Gemini dependency removal, `npm audit --omit=dev` reports 93 packages: 4 low, 36 moderate, 53 high, 0 critical. The prior report recorded 94. This count is not equivalent to 93 browser-exploitable paths because `react-scripts` is declared under `dependencies` and causes CRA's build, development-server, Jest, ESLint, Webpack, Workbox, SVGO, and minification graph to be included by `--omit=dev`.

| Surface | Evidence | Reachability assessment | Action |
|---|---|---|---|
| Firebase Web SDK | `src/**` imports Auth, Firestore, Functions and App modules; installed `firebase@10.14.1` | Browser runtime reachable, but several audit paths are Node/compat transports and npm reports no direct fix for the top-level package | Do not force-upgrade. Plan an independently tested Firebase major upgrade with Auth/Firestore smoke tests. |
| CRA toolchain | `react-scripts@5.0.1` owns Jest/Webpack/dev-server/SVGO/minifier chains | Build/test/dev reachable; not shipped as callable server code in the static CRA output | Resolve through a dedicated CRA migration/build-tool task, not transitive overrides or `audit fix --force`. |
| Root `firebase-admin` | Only `scripts/backup-firestore.js` imports it; Functions owns an independent dependency | Maintenance-only in the root and excluded from Vercel source by `.vercelignore`, although root `npm ci` still installs it | Candidate for a separate tooling workspace; do not move it in this batch because backup runbook/credentials need explicit validation. |
| Functions dependency graph | Independent `functions/package.json` and runtime | Production server reachable only when Functions deploy; not changed in this batch | Track and test separately against Functions tests/emulators. |
| Removed Gemini SDK | No remaining executable caller or installed top-level package | Not reachable | Complete. |

`npm outdated --json` could not write npm's user cache due sandbox/OS `EPERM`. Installed direct versions were still verified locally: `firebase@10.14.1`, `firebase-admin@13.10.0`, and `react-scripts@5.0.1`. No speculative or breaking upgrade was applied. No `npm audit fix` command was run.

## Deployment-context validation

- Vercel build inputs remain `src/`, `public/`, root package manifests, and `vercel.json`; `.vercelignore` excludes `scripts/`, `docs/`, `.trellis/`, `.staging/`, `functions/`, local caches, build output, and `.deploy-*` snapshots.
- The retired Gemini scripts were already excluded from Vercel upload. Removing the direct dependency reduces root installation work; exact install-time savings require a clean Vercel deployment measurement.
- Firebase Functions `ignore` excludes `node_modules`, test files/directories, coverage, Firebase local state, and debug logs while leaving runtime JavaScript and data available.
- Git ignore independently excludes `.staging/image-generation/` and `build/`. This protects generated review output even outside Vercel.
- Local CRA production build is the safe build-context check for this batch. No Vercel or Firebase deploy command is executed.
- `.vercelignore` cannot reduce Git-provider clone cost from the 3,252 tracked `.deploy-*` snapshot paths. Snapshot cleanup remains a separately authorized task.

## Metrics requiring a separately confirmed production deployment

1. Vercel `Cloning`, cache restoration, `Installing`, `Building`, and output upload durations for at least three comparable deployments.
2. Root install package/download bytes and cache hit rate before/after Gemini removal.
3. Git-provider checkout bytes/time; this cannot improve materially until tracked snapshots leave the current tree.
4. Build output upload bytes/files and CDN processing time for the approximately 500 MB CRA artifact.
5. Firebase Functions package, upload, remote build, and rollout times; Rules deployment must remain a separate target.

This batch does not claim a minute or percentage improvement without those production measurements.
