# Deployment and public asset inventory

Audit date: 2026-07-22

This is an evidence report only. No deployment snapshot or public asset was deleted, moved, recompressed, or replaced. The machine-readable inventory is `asset-inventory.json`; it can be regenerated with:

```powershell
node scripts/audit-static-assets.mjs --output .trellis/tasks/07-22-deployment-asset-inventory/research/asset-inventory.json
```

## Classification rules

- **Confirmed** means a literal repository path/URL, generator output contract, Git index entry, hash, or package manifest proves the claim.
- **Candidate** means the filename or basename matches but dynamic construction prevents proof.
- **Unknown** means this scan found no evidence. It does **not** mean unused or safe to delete.

The reference scan covers text files in `src/`, `scripts/`, `functions/`, selected deployment configuration, and `public/index.html`. Runtime Firestore values, remote configuration, CSS assembled at runtime, and paths derived from IDs can evade a literal scan. For example, `cardCatalog.js`, `GachaMachine.jsx`, and `CatVillage.jsx` construct image paths dynamically, so many real assets correctly remain candidate/unknown.

## Confirmed baseline

| Inventory | Files | Bytes | MiB |
|---|---:|---:|---:|
| tracked `.deploy-*` snapshots | 3,252 | 705,822,080 | 673.12 |
| `.deploy-staging-2` | 2,262 | 357,244,398 | 340.69 |
| `.deploy-static-home` | 990 | 348,577,682 | 332.43 |
| images under `public/` | 1,631 | 480,020,315 | 457.78 |

The snapshot numbers come from `git ls-files -- .deploy-*`, not a filesystem glob. They therefore represent files that enlarge repository checkout/history even though `.vercelignore` excludes the directories from deployment upload. The 3,252 snapshot entries resolve to only 1,892 unique Git blobs; 1,360 entries repeat an existing blob. There are 792 blob hashes shared across both snapshot roots (1,733 entries total). This confirms strong overlap, but is not authorization to remove either snapshot.

## Public image composition

| Format | Files | Bytes | MiB |
|---|---:|---:|---:|
| WebP | 1,612 | 427,812,804 | 407.99 |
| JPEG | 11 | 40,930,264 | 39.03 |
| PNG | 8 | 11,277,247 | 10.76 |

Largest directory groups:

| Directory | Files | Bytes | MiB |
|---|---:|---:|---:|
| `public/images/archery` | 222 | 142,380,497 | 135.78 |
| `public/cards/monsters` | 252 | 81,217,144 | 77.45 |
| `public/cats/cat-cards` | 200 | 63,242,598 | 60.31 |
| `public/monsters-battle` | 252 | 49,353,232 | 47.07 |
| `public/ui/village` | 117 | 35,840,946 | 34.18 |
| `public/ui/battle-bg` | 42 | 29,539,318 | 28.17 |
| `public/council/obs` | 36 | 18,336,416 | 17.49 |
| `public/ui` (direct children) | 42 | 12,487,062 | 11.91 |

Three archery JPEGs are confirmed 9,504 x 6,336 pixels and individually 10.55-11.85 MiB. They are the clearest reversible optimization candidates, but their actual display requirements must be established before generating derivatives. Several panorama and council backgrounds exceed 2,048 pixels; unlike exact duplicates, their high resolution may be intentional.

## Hash duplicates

The SHA-256 scan found 69 exact duplicate groups containing 142 files. Keeping one file per hash would have a theoretical ceiling of 34,060,096 bytes (32.48 MiB) saved. This is only a ceiling: path compatibility and call-site migration may require aliases or keeping copies.

The concentration is in `public/images/archery/real/`, especially a directory whose name begins `Converter_148_files_660.9MB_to.imagesTool.com_...`. Top groups contain the same bytes under two to four paths. Full hashes and path members are in `asset-inventory.json`.

Recommended classification: **confirmed duplicate bytes, candidate cleanup**. Do not delete until every path has been checked against runtime data and access logs, then migrate references and retain a rollback manifest.

## Reference evidence

| Status | Files | Bytes | Meaning |
|---|---:|---:|---|
| confirmed | 61 | 17,735,329 | literal URL/path found in the scanned corpus |
| candidate | 58 | 5,618,354 | basename-only evidence |
| unknown | 1,512 | 456,666,632 | no static literal evidence; not proof of disuse |

Dynamic path construction is confirmed for major groups:

- `src/components/member/cards/cardCatalog.js` constructs `/cards/monsters/${artKey}.webp` and `/monsters-battle/${monsterId}.webp`.
- `src/components/member/GachaMachine.jsx` constructs `/cats/cat-cards/${card.id}.webp`.
- `src/components/member/CatVillage.jsx` constructs village panorama, building, resource, and card paths.

Consequently, a future dead-asset task must expand registries/data IDs and exercise routes; it must not delete the 1,512 unknown files based on this report.

## Generation provenance and tooling

### Confirmed

- `scripts/gen-dungeon-tiles.py`, `scripts/gen-zombie-images.py`, and `scripts/gen-zombie-map-tiles.py` call local ComfyUI and use Python `rembg` plus Pillow for transparent WebP output.
- `scripts/process-tile.py` performs the same rembg/Pillow post-processing for an existing source image.
- `scripts/remove-bg.mjs` imports Sharp. Sharp is a root `devDependency`.
- `scripts/generateVillageImages.js` imports `@google/genai`, reads `GEMINI_API_KEY`, and requests `gemini-3.1-flash-image`. `@google/genai` is a root production dependency.
- `scripts/listModels.js` reads `GEMINI_API_KEY` and calls the Gemini models endpoint using built-in `fetch`.
- `scripts/backup-firestore.js` uses `firebase-admin`; it is a root production dependency even though Functions has its own independent `firebase-admin` dependency.
- Root build scripts are only CRA start/build/test plus prepare. No image generation script is a build lifecycle command. `.vercelignore` excludes `scripts/`, but `npm ci` still installs root manifest dependencies before build.

### Candidate / unknown

- Files matching `public/village/<id>/stage-[1-3].png` conform to the Gemini generator's filename contract, but image files contain no provenance manifest, so origin remains **candidate**, not confirmed.
- Current ComfyUI scripts prove intended output locations, not that every existing file in those directories was produced by the current script/version.
- No checked-in Python requirements or lockfile was found for `rembg` and Pillow. Their versions and reproducibility are **unknown** and currently depend on the local Python environment.

## Reversible follow-up batches

1. **Tracked snapshot quarantine (highest deployment-source priority).** Tag the current commit, export a path/size/blob manifest, remove the two roots from the current Git tree in a dedicated commit, and measure fresh clone plus Vercel `Cloning` time. Roll back by reverting that commit. Do not rewrite history in this batch.
2. **Dynamic reference manifest.** Expand card, cat, monster, village, and archery registries into a complete expected-path list; compare it with production request logs if available. Reclassify unknowns only with runtime evidence.
3. **Exact duplicate alias pilot.** Start with one small archery duplicate group. Select a canonical path, update every proven producer/consumer, retain a JSON redirect/rollback map, run relevant UI smoke tests, and measure build bytes. Do not bulk-delete all 69 groups.
4. **Oversized archery derivative pilot.** Generate new staged derivatives for the three 9,504 x 6,336 JPEGs without overwriting originals. Validate required zoom/display quality, browser support, and byte savings; promote only after approval.
5. **Root tooling isolation.** In a separate manifest-changing task, move Gemini removal and local image tools out of production dependencies. Before/after measurement must include clean `npm ci`, lockfile size/diff, CRA build, scripts that remain supported, and Vercel install phase. `firebase-admin` backup tooling needs its own explicit home or runbook.
6. **Provenance manifest.** For future ComfyUI/GPT assets record output path, SHA-256, workflow/model hashes, prompt version, dimensions, alpha status, approval state, and source image. This avoids filename-based provenance guesses.

## Validation and limitations

- Every public image was read and SHA-256 hashed; Sharp metadata extraction succeeded sufficiently to classify all inventory formats.
- Exact duplicate detection is byte-identity, not perceptual similarity. Visually identical re-encodes are not grouped.
- Snapshot duplicate evidence uses Git blob identity, which is exact content identity.
- Static reference detection intentionally favors false negatives over unsafe false confidence.
- This report makes no claim that Vercel clone/install/build time will improve by a specific number of seconds; that requires before/after deployment phase telemetry.

## Implemented deployment-context optimization

Following explicit authorization to optimize deployment without touching assets, the deployment boundaries were tightened:

- `.vercelignore` now explicitly excludes Firebase-only source/configuration, historical deployment snapshots, alternate site exports, backups, local staging/cache/output, repository reports/specifications, agent configuration, maintenance scripts, and dependency directories. It retains the CRA runtime inputs: `src/`, `public/`, root package manifests, and `vercel.json`.
- `firebase.json` now explicitly excludes Functions dependencies, tests, debug logs, test coverage, and Firebase local state from the Functions upload. Runtime JavaScript and `functions/data/` remain included.

Current local filesystem paths covered by the newly explicit Vercel root exclusions total 87,755 files and 3,376,901,541 bytes (3,220.46 MiB). This is a conservative context ceiling, not a promised transfer saving: it includes local/untracked files and `node_modules`, which deployment tooling may already exclude implicitly. The Firebase test exclusion covers six files and 27,943 bytes in the current tree.

Validation after the configuration change:

- CRA production build: passed in 29.89 seconds; output was 499,787,558 bytes. The configuration-only change is not expected to alter output bytes.
- Functions tests: 56 passed, 0 failed.
- Asset inventory: deterministic match after removing the generated timestamp.
- `git status --short public`: empty; no public asset changed.
- `git diff --check`: passed.

Important limitation: `.vercelignore` can reduce CLI upload and build-context scanning, but it cannot make a Git-provider clone omit the 3,252 tracked `.deploy-*` files. Improving the Vercel `Cloning` phase still requires removing those snapshots from the current Git tree in a separately authorized, reversible commit; no snapshot was removed here.
