# Current-HEAD audit evidence (2026-07-22)

Scope: read-only validation of `HEAD` (`4a49590`). No product code, assets, deployment configuration, or final report was changed. Sizes below are local working-tree measurements; deployment timing needs a measured Vercel/Firebase run before claiming a precise saving.

## Executive findings

### P0 — Firestore authorization is substantially broader than ownership

The most important issue is not highlighted in the Gemini/Antigravity reports. Many collections grant every authenticated account unrestricted read/write access, without checking document ownership or allowed fields. Examples include `monsterSessions`/`monsterLogs` (`firestore.rules:230-237`), `shootingSessions` and nested ends (`240-244`), `gamePerformances` (`246-247`), `memberPerformanceSync` (`271-272`), `monsterDex`/`craftStats` (`274-278`), duel/party rooms and stats (`282-294`), certifications (`312-313`), multiple inventories (`375-393`), dungeon/zombie rooms (`419-438`), world-boss and first-clear data (`443-462`), guild progress (`486-487`), council/village/card-market data (`497-511`), and booking slot counters (`581-582`). `guestSessions` allows public read/write and `guestNotifications` public create (`335-342`). Logged-in users can also list all member documents (`40`) and update competitions/results/checkins with broad predicates (`74`, `82`, `213`).

Impact: a normal or anonymous client that obtains authentication may modify other users' game/progress/state documents, falsify shared state, or enumerate member data. This is a data-integrity/privacy boundary, not a code-style issue.

Safe follow-up: create a dedicated rules-hardening task. Inventory each client write, define owner/member/participant and immutable-field contracts, add Emulator rules tests, deploy rules before relying on corresponding client changes. Do not tighten all rules in one untested edit: current clients may depend on broad writes.

### P1 — repository history/checkout is inflated by tracked deployment snapshots

`git -c core.quotePath=false ls-files '.deploy-*'` finds **3,252 tracked paths** under `.deploy-*`, totaling **705,822,080 bytes (~673.12 MiB)** in the current checkout. (An earlier count of 2,755/~393.6 MiB was invalid because PowerShell could not resolve Git's quoted non-ASCII path output.) Local Git reports a **734.33 MiB packed repository** (`git count-objects -vH`). Current directories measure approximately `.deploy-staging-2` 727,263,119 bytes (~693.57 MiB) and `.deploy-static-home` 348,577,795 bytes (~332.43 MiB); these working-directory totals include content beyond the tracked-file total and must not be added to the Git-index figure. `.vercelignore:24-26` excludes these directories from Vercel upload, so the old report's implication that they necessarily enter the uploaded output is outdated; however, because 3,252 paths are already tracked, ignore rules do not remove them from Git clone/fetch/checkout history. This can materially lengthen Vercel source acquisition and local operations.

Safe follow-up: in a separately approved cleanup task, first classify whether `.deploy-static-home` is an intentional production artifact, preserve/tag any required snapshot externally, then remove tracked snapshots from the current tree. History rewriting is a separate destructive decision and is not required for a first improvement. Measure Vercel `Cloning/Restoring cache/Installing/Building/Uploading` phases before and after.

### P1 — root dependency installation includes tooling/server packages outside the SPA build

Vercel runs `npm ci --prefer-offline --no-audit --no-fund` then CRA build (`vercel.json:2-4`). Root `package.json:6-10,37` installs `@google/genai`, `firebase-admin`, and `sharp`. Repository search shows `@google/genai` is used by `scripts/generateVillageImages.js:8`, `firebase-admin` by `scripts/backup-firestore.js:5`, while `.vercelignore` excludes `scripts/`. Functions already have their own `functions/package.json`. Local `node_modules` is ~1.88 GiB, although this is not itself uploaded.

Inference: these root packages add install/native-binary work to every Vercel build without serving the browser application. Confirm using Vercel install timing and `npm explain`; then move operational scripts to a separately locked tooling package or otherwise isolate their dependencies. Merely moving packages to root `devDependencies` will not help if Vercel installs dev dependencies for the build.

### P1 — public/build payload is intrinsically large

Current `public/` is **480,396,020 bytes (~458 MiB)** and local `build/` is **499,787,558 bytes (~477 MiB)**. `.vercelignore` excludes the local build and Vercel rebuilds it, so stale `build/` does not explain upload directly. The rebuilt output still copies the large public asset corpus, making build output/upload/cache handling a credible dominant cost. Obtain top-asset and Vercel phase measurements before deleting or recompressing anything; asset references may be data-driven rather than visible as static imports.

## Gemini/Antigravity claim validation

### Confirmed or substantially confirmed

- Monolith sizes remain current: `src/lib/db.js` 252,983 bytes/5,372 physical lines; `src/pages/AdminApp.jsx` 77,854/1,238; `src/components/admin/AdminBooking.jsx` 66,202/1,211; `src/pages/MemberApp.jsx` 66,950/1,110; `src/pages/PublicBookingApp.jsx` 50,221/782. Splitting `db.js` by domain is warranted, but must preserve an interim compatibility facade because imports are widespread.
- Static-data/visual modules remain large: `MonsterSVG.jsx` 62,277 bytes; `achievementDex.js` 73,511; `dungeonCollectibles.js` 41,563. Moving JS to JSON alone does **not** reduce bundle size if synchronously imported; lazy loading or public fetch boundaries must be designed and measured.
- `updateBooking` is already fixed: `src/lib/bookingDb.js:387` starts the transaction function and its update writes `startTime`, `slotKey`, and `slotKeys` around `463-471`. Treat the report item as completed, not pending.
- Several named components have no detected import call site (`AdminAchievements`, `AdminAdventurerGuild`, `DungeonPathSelect`, `CouncilBattle`, `GatheringBattle`, `HonorTicker`, `CatAnimationToggle`); searches find only definitions/comments. They are removal **candidates**, not proven-safe deletions: check string registries, documentation intent, tests, Git history, and product owner confirmation first.
- Date helpers are duplicated (`bookingSchedule.js:76`, `accessControl.js:53`, `dungeonExcavation.js:53`, `db.js:1668`, plus component-local ISO UTC dates). Consolidation must explicitly choose Taiwan-local versus UTC semantics; blindly sharing one helper can change behavior around midnight.

### False positives, weak claims, or outdated items

- Subscription leak claims are outdated for the inspected current call sites. `AdminApp.jsx:376-395` stores and cleans seven subscriptions, including `onSnapshot` and `subscribePendingMonthlyRequests`; `AdminApp.jsx:1029-1042` cleans `subscribeResults`. No `subscribeResults` call exists in current `AdminReviewCenter.jsx`, and no `onSnapshot` call exists in current `AdminWorldBoss.jsx`.
- `constants.js` versus `archeryGrade.js` is stale: `src/lib/archeryGrade.js` does not currently exist. Certification helpers remain in `constants.js` and are actively imported.
- Test files are not disposable merely because there is no same-named production module. CRA discovers `*.test.js`; `battleScreenAutoStart.test.js` may test behavior/contracts rather than a matching file. Keep unless tests and intent prove obsolescence.
- `.vercelignore` now explicitly excludes scripts, docs, Trellis, build, deploy staging, archives, and backups (`.vercelignore:1-30`). The earlier claim that it lacked these exclusions is outdated.
- Firebase web `apiKey` in `src/lib/firebase.js:6-11` is client configuration, not an administrator secret. Security must be enforced by Auth/App Check/Rules. No tracked service-account filename was found in the focused tracked-file check; a complete secret scanner should still run in a dedicated security task without printing secret values.
- Public and `src/assets` duplication cannot be declared from directory names. Hash files and trace runtime/data-driven references before proposing any removal.

## Architecture and organization sequence

1. **Rules boundary first (P0):** ownership/participant helpers, collection-by-collection emulator tests, staged deployment.
2. **Measure deployment (P1):** record Vercel phase timings, dependency install output, build output file distribution, and Firebase deploy phase. Current evidence identifies candidates but cannot attribute exact minutes.
3. **Repository/dependency cleanup (P1):** tracked snapshots and root-only tooling dependencies, each in reversible commits; no history rewrite by default.
4. **`db.js` strangler split (P1/P2):** inventory exports/importers; extract one domain at a time (booking/billing/member are candidates), re-export temporarily from `db.js`, add contract tests, then migrate imports. Do not combine with behavior/security changes.
5. **Page/component split (P2):** extract render-only sections/hooks from `AdminApp`, `MemberApp`, `AdminBooking`, and booking steps while retaining public props and lazy route boundaries.
6. **Removal task (P2):** produce a hash/reference/generated-asset manifest; quarantine or archive candidates before deletion; validate build/tests and targeted user flows.

## Read-only validation performed

- Read task PRD/design/implementation and all six `implement.jsonl` references.
- Inspected `HEAD`, dirty state, recent commits, reports, package/lock ownership, Vercel/Firebase config, Firestore rules, current large-file sizes, imports, subscription cleanup, and tracked deployment artifacts.
- Did not run `npm test` or `npm run build`: they can write caches/build output and are unnecessary to validate this report-only artifact. No install, deploy, push, move, or deletion was performed.
