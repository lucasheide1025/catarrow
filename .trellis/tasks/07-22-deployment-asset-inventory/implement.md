# Implementation

1. Preserve and verify the asset/snapshot inventory baseline.
2. Expand `.vercelignore` for non-CRA deployment inputs, without excluding `src/`, `public/`, or package manifests.
3. Add explicit Firebase Functions upload ignores for dependencies, tests, logs, and coverage output.
4. Measure the repository/filesystem bytes covered by the new exclusions and document the limitation for Git-provider cloning.
5. Run Functions tests, CRA production build, deterministic inventory comparison, `git diff --check`, and an asset-path status check.
