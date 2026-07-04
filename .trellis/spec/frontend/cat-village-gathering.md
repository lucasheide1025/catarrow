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

## Co-op preparation

- Future team rooms persist the complete contract descriptor, never regenerate it independently on each client.
- Team room state uses roles `gatherer`, `support`, and `guard`.
- Persist shared checkpoint, progress, fatigue, round, member submissions, result, and per-member claims.
- Each member consumes their own daily attempt when the first team round starts.
- Do not expose a co-op entry until room creation, reconnect, host authority, and atomic claim behavior are complete.
