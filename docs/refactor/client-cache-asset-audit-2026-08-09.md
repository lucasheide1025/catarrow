# Client-first and Asset Audit — 2026-08-09

## Scope and method

This static audit covers production source references/imports and files under `public/`. It excludes tests, docs, backups, generated/build output, and makes no deletions. Dynamic paths mean absence from a literal-text search is only a candidate signal, never proof that an asset is unused.

The `public/` tree currently contains 2,279 files totaling 559,375,381 bytes (about 533.5 MiB): 2,191 WebP files (446,494,196 bytes), 36 PNG files (66,392,792 bytes), 14 JPG files (43,073,496 bytes), and 26 MP3 files (3,340,989 bytes). Largest top-level families are `images/` 148,188,111 bytes, `ui/` 86,394,154, `cards/` 84,488,404, `assets/` 72,255,912, `cats/` 66,660,046, and `monsters-battle/` 41,218,280.

These bytes affect repository/deployment size, but public assets are not all downloaded on first page load. Browser transfer occurs when markup/CSS/preload requests a URL. Bundle and network claims therefore require a production build plus browser network trace.

## Classification

| Class | Meaning | Examples and evidence | Recommendation |
|---|---|---|---|
| A — canonical static/client | Versioned game catalogs, item/monster definitions, stable manifests and public art | `src/data/monsterExpansionCatalog.json` (245,801 bytes), wrapped by `src/lib/monsterExpansionCatalog.js:1`; shop art manifest `src/lib/shopArt.js`; card path contract in `src/components/member/cards/cardCatalog.js:81` | Keep client/static. These do not belong in Firestore. Preserve stable IDs and manifest paths. |
| B — archive/delete candidate | Exact duplicate physical files or apparent source/reference archive with no production literal reference | 72 SHA-256 duplicate groups / 148 files; 34,291,286 duplicate bytes beyond one copy per hash. `public/images/archery/real/這個是我原始分類的你參考有沒有需要/` has 148 files / 70.98 MiB and many hashes identical to curated category folders. | Do not delete from this audit. Prove route/CMS/dynamic-manifest reachability, choose canonical copies, back up with manifest, then remove only in repository-hygiene phase. |
| C — consolidate | Multiple physical paths intentionally or accidentally hold identical bytes | `public/assets/shop/interior-base-v1.webp` and `interior-stock-low.webp` are byte-identical (133,910 bytes); `public/cats/portraits_v2/daming.webp` and `_t_daming.webp` are identical (51,042); `niuniu.webp` and `_t_niuniu.webp` are identical (46,238). | Prefer manifest aliases to one canonical file only after confirming semantic variants do not need independent future replacement. Shop and cat WIP are protected, so defer changes. |
| D — compatibility keep | Finite fallback chains and legacy asset IDs required for older persisted data | card chain `/cards/monsters` → `/monsters-battle` → `/monsters` → SVG in `cardCatalog.js:81` and `CardArt.jsx:74-99`; monster/battle fallbacks in `MonsterSVG.jsx:1093,1122`; world boss fallback in `WorldBossSVG.jsx:344-353` | Keep finite chains. Remove a compatibility path only after coverage proves all persisted IDs resolve at an earlier stage. |
| E — protected WIP | Cat Village Shop/Board/Team/EventScene, current V12 shop art, shooting/game-performance migration/fallback assets | `ShopSimulatorV3.jsx`, `shopArt.js`, `CatVillageBoard*.jsx`, `EventScene.jsx`, dungeon/team/world-boss assets | No deletion, renaming, recompression, or path migration during this audit. |

## Exact duplicate inventory

Hashing every public file found 72 duplicate groups containing 148 files. Keeping one physical file from each group would theoretically remove 34,291,286 bytes, but that is an upper bound, not an approved saving: path stability, CMS values, dynamic construction, and intentional semantic aliases still matter.

The dominant pattern is the 70.98 MiB original-classification directory under `public/images/archery/real/`. Examples verified byte-identical across that directory and curated folders include:

- `01_新手教學與首頁主視覺/AAA00001-2.webp` and the archive's `新生/AAA00001-2.webp`;
- `02_團康活動與朋友體驗/AAA00002-2.webp` and the archive's `團康/AAA00002-2.webp`;
- `06_弓種展示/AAA00069_.webp`, `11_活動紀錄相簿候選/AAA00069.webp`, and two archive copies;
- many matching files in the children, equipment, cats, student-system, and external-competition groups.

No production source literal contains the directory phrase `這個是我原始分類的你參考有沒有需要`. That makes it a strong B candidate, not a safe-delete finding: website CMS content can store public URLs in Firestore and cannot be discovered by source grep.

The three non-website duplicate groups are the protected shop semantic variant and two `_t_` cat portraits listed in the classification table. The `_t_` prefix may indicate temporary/source intent, but dynamic portrait construction must be checked before removal.

## Asset reference and fallback behavior

### Good finite fallbacks

The card system implements the documented finite three-request chain and a deterministic SVG terminal fallback. `CardArt.jsx:83-99` also supplies `loading="lazy"` and `decoding="async"`. `GuildArt.jsx:22` explicitly chooses paths by ID shape so expansion monsters do not first issue a known 404. These are the desired patterns.

`CatVillageBoard.jsx:79`, dungeon selection/team components, `PartyBattleRoom.jsx:129`, and `DungeonBattleRoom.jsx:222` also use bounded source arrays or a one-step fallback. Keep fallback state finite and reset it when the logical asset ID changes.

### Repeated 404/probing risks

- `MonsterSVG.jsx:1093,1122`, `WorldBossSVG.jsx:344`, `PartyBattleRoom.jsx:129`, `DungeonBattleRoom.jsx:222`, and `DungeonTeamLobby.jsx:43` advance through candidate URLs after `onError`. This is safe only when candidates are finite. A missing first-choice asset produces one avoidable HTTP failure on every uncached visit.
- Many components simply hide failed images (`WorldBossAttack.jsx:183,1775,1815,1849`; numerous `CatVillage.jsx` sites; raid HUD/cards; `EventScene.jsx:46`). This avoids loops but can silently erase meaningful visuals and provides no central telemetry.
- `RaidPlayerCard.jsx:96` mutates `src` to `/cats/archers/baobao.webp` on every error. If the fallback itself is missing and the handler remains attached, the browser can re-enter `onError`. Guard with a failed flag or clear the handler before replacement.
- `ShopSimulatorV3.jsx:40-55,247` preloads every URL in the shop manifests via `new Image()` and resolves both load/error. The component is conditionally mounted only for `CatVillage.jsx:2471-2473`'s shop tab, so it does not transfer shop art before that tab opens; however, opening the tab downloads the entire interior/goods/customer/manager family rather than only the chosen scene and visible actors. This is protected Shop WIP. Measure the tab waterfall before later changing preload scope.

There are 127 literal `<img>` occurrences in production JSX/HTML and only nine explicit `loading="lazy"` occurrences found by static search. This ratio is a review signal, not a demand to mark every image lazy: above-the-fold/LCP imagery should remain eager, and images inside a lazy-loaded route are already deferred until the route chunk renders. Long grids and off-screen collections are the priority.

### Centralization opportunities

Card art and shop art already have central resolvers/manifests. Similar repeated monster/cat/dungeon source arrays should use small shared resolvers so path order, terminal fallback, lazy/async attributes, and missing-ID behavior are testable once. Do not create a universal resolver that erases domain-specific stable-ID contracts.

## Route and bundle boundaries

`MemberApp.jsx:48-91`, `AdminApp.jsx:25-90`, and `GuestApp.jsx:19-27` already lazy-load most feature pages. This is an important completed optimization. The member/admin files also preload route groups on user intent at `MemberApp.jsx:100-127` and `AdminApp.jsx:95-146`, matching the bundle-boundary spec.

Risks requiring measured build/network evidence:

- `monsterExpansionCatalog.json` is 245,801 source bytes and is statically imported by many modules: guild shop/expedition, equipment, cards, profile, gathering, handbook, item data, dungeon rewards and loot. If any of those modules remains in an entry chunk, the whole catalog follows. The game requires one canonical catalog, so do not split or duplicate its data casually; measure the production manifest and consider route-owned adapters or a fetchable versioned JSON only if first-load evidence shows it in the entry chunk.
- `db.js` is 259,870 bytes and is imported broadly. Dynamic imports at `MemberApp.jsx:1250`, battle actions, and several domain functions help only where no static path also reaches `db.js`. The bundle spec requires checking the final static import, not counting dynamic-import syntax.
- The largest feature components (`BattleScreen.jsx` 160,728 bytes, `ShopSimulatorV3.jsx` 153,945, `DungeonBattleRoom.jsx` 132,733, `PartyBattleRoom.jsx` 130,961, `CatVillage.jsx` 130,736) are behind lazy route boundaries in the shells. Preserve those boundaries.
- `MemberApp`/`AdminApp` intent preloads whole route groups. Hover/focus preloading is appropriate on desktop, but touch navigation and automatic focus must not cause all groups to preload. Verify with a mobile network trace.

Public URLs do not enter JS bundles, but CSS backgrounds and `new Image()` can request them before visible content. No claim that an asset is loaded “too early” is final without an initial-route network waterfall.

## Client and cache-first data

### Existing mechanisms to preserve

- Firestore uses `persistentLocalCache` with `persistentSingleTabManager` in `src/lib/firebase.js:18-20`.
- Append-only shooting/game-performance/practice paths explicitly use `getDocsFromCache` (`src/lib/db.js:464,556,574,892`) before bounded server fetches.
- `src/lib/localCache.js` provides namespaced TTL cache entries, safe parse/failure handling, and an explicit warning not to cache balances, room state, or check-ins.
- Module-level caches already cover distinct lifecycles: guest/kid account-type results (`src/lib/db.js:637-656`), the 30-second members list plus shared in-flight request (`:659-678`), excavation state with explicit invalidation (`src/lib/dungeonExcavation.js:75-84`), and one-flight dungeon asset preload (`src/lib/dungeonAssetCache.js:6-17`). Preserve their TTL/invalidation/one-flight contracts; a module cache is not authority and must not be added to mutable balances, rooms, or claims.
- Ten-minute local caches are already used for certification records/config/results and equipment specialization (`MemberApp.jsx:515`, `MemberProfile.jsx:123-128`, `MemberHome.jsx:154-171`).
- `HomeLeaderboardBlock.jsx:87` uses an intentionally non-expiring snapshot with explicit refresh. This is safe only because the UI communicates/refers to manual refresh; do not reuse infinite TTL for authority data.
- Durable local arrow queues and shop runtime timers are protected client-first systems documented in the Firestore and Cat Village specs.

The code contains about 218 direct `localStorage`/`sessionStorage` access occurrences. They cover preferences, dismissed/seen effects, recovery, identity-scoped progress, and durable pending operations. Volume alone is not a defect. Every gameplay/reward/recovery key must include member identity, and event state must include event/room identity, per the guest/kid-mode contract.

### Data suitable for static/client/cache-first treatment

- monster, item, loot, recipe, card, album, equipment-cost, gathering-contract, and shop-art definitions: keep as versioned source/static data, never Firestore;
- story/equipment/catalog/config reads that only change via an admin save: bounded one-off/TTL cache with explicit refresh after save, unless live editing is a stated feature;
- append-only history pages: IndexedDB cache first, bounded live head or explicit refresh, paged server fallback;
- stable website/gallery assets: public HTTP caching with versioned filenames or cache-busting manifest values rather than Firestore blobs;
- image existence: a build-time manifest is preferable to runtime 404 discovery for known finite catalogs.

### Data that must not become stale client authority

Balances, inventory, claims/rewards, access locks, current check-in, multiplayer rooms, active market ownership, booking capacity, and authoritative shop settlement remain live/transactional Firestore data. Local copies may be optimistic display or durable retry queues, never final authority.

## Unreferenced-candidate methodology and results

A safe unused-asset analysis must combine:

1. literal URLs/imports in source and CSS;
2. manifest entries and template-string families;
3. known ID catalogs expanded into concrete paths;
4. Firestore CMS/config URLs;
5. runtime network traces across member, admin, guest, booking, game, and protected WIP routes;
6. service worker/build manifest references if present.

Literal grep alone strongly flags the 70.98 MiB original-classification folder because its directory name has no production source reference and curated duplicates exist. It cannot certify individual unreferenced files in `cards/`, `monsters-battle/`, `items/`, `cats/`, `ui/`, `council/`, `assets/dungeon/`, or shop assets because those paths are predominantly template-generated from stable IDs.

The three root JPG files (`cat_village_map_bg_1784808743302.jpg`, `board_tile_bg_1784808764601.jpg`, `board_monster_icon_1784808753539.jpg`) are also candidates for reachability review, but their names suggest active/prototype Cat Village Board work and therefore fall under PROTECTED WIP.

## Ranked low-risk implementation shortlist

1. **Create a generated asset-existence report, without deleting anything.** Expand canonical catalogs/manifests to paths and verify file existence; list extra files separately. The report identifies known 404-first fallbacks and enables later resolver/asset fixes; generating it alone does not change runtime requests.
2. **Add finite-fallback guards to direct `src` mutation.** Start with `RaidPlayerCard.jsx:96`; ensure the fallback cannot recursively error. No data/schema change.
3. **Add `loading="lazy"` and `decoding="async"` to off-screen collection/grid images.** Exclude LCP/above-fold art and validate layout dimensions to prevent shifts. Card art already models the right contract.
4. **Centralize repeated domain-specific asset source lists outside protected WIP.** Monster, cat portrait, and dungeon resolvers should return a finite list plus terminal placeholder. Preserve existing stable path order and tests; defer Cat Village Board/Team/EventScene and active dungeon/team flow migrations until their protected status is lifted.
5. **Measure initial member/admin/guest bundles and network waterfalls.** Confirm whether `monsterExpansionCatalog.json` or large domain modules enter entry chunks, and whether intent preloads fire on touch. Only then change imports.
6. **Inventory Firestore CMS URLs before repository cleanup.** Export/read website CMS and configuration values to prove the original-classification directory and root JPGs are not externally referenced.
7. **Prepare a manifest-backed duplicate cleanup proposal.** For the 72 hash groups, record canonical path, aliases, all code/CMS consumers, checksum, rollback copy, and protected status. Execute later under repository hygiene, not Step 2.
8. **Extend TTL/one-off cache use for rare admin-controlled catalogs.** Reuse `cachedFetch` only for small, non-authoritative data and invalidate/refresh after admin writes.

## Protected WIP and no-touch boundaries

- Cat Village Shop V12 assets and `shopArt.js`, even where two variants are currently identical;
- Cat Village Board/Team/EventScene assets and root board JPG candidates;
- shooting sessions, game performances, local durable queues, cache-first replay/migration compatibility;
- card stable IDs and its three-stage finite fallback chain;
- legacy monster/cat paths that can still be derived from persisted IDs;
- world boss/dungeon/team assets used by active shared-room flows.

## Explicit uncertainty and required validation

- No production build/asset manifest or browser network trace was run in this read-only research step, so initial bundle membership and actual early image requests remain unknown.
- No Firestore CMS/config export was inspected. Public URL strings can live outside the repository.
- Hash equality proves byte duplication, not interchangeability. Semantically distinct aliases can intentionally share today's bytes.
- HTTP cache headers depend on hosting configuration and deployment output; source layout alone cannot establish cache lifetime.
- `persistentSingleTabManager` means multi-tab cache ownership/fallback behavior should be tested in real browsers. It does not guarantee zero billed reads on reconnect.
- Static `<img>` counts do not include CSS backgrounds, SVG `<image>`, `new Image()`, dynamically generated markup, or URLs inside Firestore data.
- Any deletion or rename requires the Step 0 backup/manifest protocol and a full route/import/build check. This audit authorizes none.
