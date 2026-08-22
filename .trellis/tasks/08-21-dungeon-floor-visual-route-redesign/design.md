# Technical Design

## Architecture

- `DungeonFloorIntro` is a shared presentation component for solo and team entry. It derives visuals from family and floor, while persisted `introSeenFloors` controls full vs reconnect transition.
- Seven panorama WebP assets live under `public/ui/dungeon/floor-panorama/`; existing battle backgrounds are fallback sources.
- Third-floor schema v2 stores `routeVersion: 2`, stable `seed`, `decisions`, `activeDecision`, `marks`, and a resolved room queue. Legacy `branches/A|B|C` snapshots remain on the legacy renderer.
- Four route archetypes (`hunt`, `supply`, `curse`, `explore`) contain visible risk/reward descriptors and deterministic room/effect recipes. Each of three checkpoints draws two distinct choices from the locked seed.
- Solo writes v2 route state into `activeExpedition.mapState`; team host writes it into `expeditionMapState`. Non-host clients are render-only.

## Presentation

- Floor 1: gate reveal and slow parallax push.
- Floor 2: downward camera motion, warning sweep and enemy shadows.
- Floor 3: boss silhouette, orbiting route marks and first choice reveal.
- Full animation occurs once per run/floor. Reconnect uses a short 0.8s transition. Reduced motion preserves event order with near-zero transforms.

## Compatibility and safety

- Read `routeVersion`; absent means legacy A/B/C flow.
- Stable IDs make reconnect and repeated host callbacks idempotent.
- Route choice never directly grants account rewards. It changes the locked encounter/reward modifiers consumed by existing authoritative settlement.
- Images use `object-fit: cover`, portrait-safe focal points, preload hints, and fallback on error.

## Verification

- Pure deterministic route tests and legacy snapshot tests.
- Component contract tests for solo/team shared intro, host authority and reduced motion.
- Production build and mobile viewport visual verification.
