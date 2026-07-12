# Cat Village and Gathering Contracts

## Information architecture

- Cat Village exposes four primary mobile destinations: Village, Tasks, Workshop, and Trade.
- Workshop owns Forge and Potion Crafting. Trade owns Gacha and Card Market. The Council Hall owns gathering contracts and expeditions.
- Keep one page-level vertical scroll owner. Cat Village tools must not introduce full-page nested `overflow-y-auto` containers.
- The village panorama is responsive and must never require horizontal page scrolling.
- On compact screens, building cards use two columns with readable production and upgrade text. Three columns are allowed only at wider breakpoints.

## Gathering contract boundary

- `src/lib/gatheringContracts.js::buildGatheringContract()` is the canonical solo/team contract builder.
- Contracts contain only Firestore-safe primitives, arrays, and plain objects.
- A contract selects one difficulty and contains exactly three checkpoints.
- Difficulty preview and play must use the same power-derived tier list. Do not preview building-level tiers and then replace them after entering.
- Checkpoint reward multipliers are `1`, `1.35`, and `1.8`.
- Players may bank after checkpoint one or two. A banked result is a successful partial contract, not a failure.

## Daily attempts and records

- Opening a building or contract setup never consumes an attempt.
- Consume the attempt once, when the player confirms Start Contract before the first scoring round.
- Do not simulate a refund by changing client state; Firestore remains the source of truth.
- Practice logs include source, building, race, selected tier, target format, distance, raw score labels, arrow count, contract ID, and checkpoints cleared.

## Rewards

- Contract rewards use the selected tier's matching material, family chest, and coin chest.
- Reward preview and granted quantities must use the same checkpoint multiplier.
- Keep legacy `completeCouncilSession()` behavior for records without `contractVersion`.

## Cat equipment forging

- Cat equipment persists the local grade plus level as `{ grade, plusLevel }`, but player-facing forge surfaces show the cumulative enhancement from `+0` through `+50` together with the grade name.
- The cumulative value is `gradeIndex * 10 + plusLevel`; mythic `+0` is the normal `+50` cap. Legacy data above that cap keeps its stats but cannot forge further.
- Ten-level bands use matching village resource tiers: T1 through `+10`, T2 through `+20`, continuing through T5 at `+50`.
- Grade promotion consumes the matching tier of both the slot's primary resource and cat fur. Never hard-code high-grade promotions to `fur_t1`.
- Forge UI derives costs and cap state from `calcForgeCost()` rather than reproducing tier rules in components.

## Potion crafting

- Potion crafting keeps the carry, throw, and raid tabs, then groups recipes by their combat purpose inside each tab.
- Recipe cards use two columns on compact screens and may expand to three columns at wider breakpoints.
- Every card directly exposes the item art, name, rarity, effect, owned quantity, recipe requirements, gold cost, output quantity, and craft action without requiring a detail view.
- Material rows show required and owned quantities in a compact layout. Craft actions keep a minimum 44px touch target and remain anchored at the bottom of each card.
- Items that depend on unfinished combat systems remain craftable only when intended and must be visibly labeled as preview items whose use is not yet available.

## Raster artwork

- Gathering encounters use the canonical transparent `/council/obs/{siteId}_{tier}.webp` target art in both current and legacy flows; emoji may be fallback content only.
- Cat expedition mission definitions own their image paths. Slots and mission selectors render those images with contained, stable dimensions rather than reconstructing paths or using emoji as primary art.
- Foreground game illustrations are alpha WebP with transparent corners, no baked card frame, no text, and no cast shadow. Keep generated source images out of `public/` after the final WebP has been validated.
- Dynamic SVG that communicates live topology or progress is functional visualization and is not replaced by decorative raster art.

## Co-op preparation

- Future team rooms persist the complete contract descriptor, never regenerate it independently on each client.
- Team room state uses roles `gatherer`, `support`, and `guard`.
- Persist shared checkpoint, progress, fatigue, round, member submissions, result, and per-member claims.
- Each member consumes their own daily attempt when the first team round starts.
- Do not expose a co-op entry until room creation, reconnect, host authority, and atomic claim behavior are complete.
