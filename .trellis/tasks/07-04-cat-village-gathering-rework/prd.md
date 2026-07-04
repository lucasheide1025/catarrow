# 貓貓村介面與採集委託重製

## Goal

Make Cat Village readable and usable on mobile, replace the repetitive tier-gauntlet gathering flow with short risk/reward contracts, and establish contracts that a later co-op room can share without duplicating game rules.

## Requirements

- Group the six top-level village destinations into four readable primary areas:
  Village, Tasks, Workshop, and Trade.
- Keep Gacha, Council, Forge, Potion Crafting, and Card Market reachable through a secondary choice inside their primary area.
- Use one vertical scroll owner. Remove the fixed-width horizontal panorama and nested page-level vertical scroll areas.
- Present secretary cat, collection readiness, countdown, core resources, village goal, and buildings in a clear mobile reading order.
- Use at least two building columns on compact screens with readable names, production, and upgrade state.
- Replace Council gathering's automatic all-tier gauntlet with a player-selected single difficulty.
- A gathering contract contains three checkpoints. After each completed checkpoint, the player can safely finish or continue for a higher reward multiplier.
- Use work progress, quality, and fatigue language instead of monster damage and killing language.
- Difficulty availability must use the same calculation in preview and actual play.
- Distance and target face remain player-selectable and are included in the saved practice context.
- Daily attempt consumption occurs only when the player starts the first scoring round, never when opening or leaving setup.
- Existing member progression, cat companion effects, practice logging, chest inventory, and rewards remain compatible.
- Define a reusable serializable contract descriptor suitable for later 2–4 player rooms.
- Do not expose an unfinished co-op gathering button.

## Acceptance Criteria

- [x] The Cat Village primary navigation has four readable destinations on a 360 px viewport.
- [x] The panorama fits the viewport without horizontal page scrolling.
- [x] Village status and collection action appear before the detailed resource inventory.
- [x] Buildings use a readable two-column compact layout and preserve all upgrade actions.
- [x] Gathering preview and entered difficulty are identical.
- [x] Opening setup and returning does not consume a daily attempt.
- [x] The player selects one available difficulty and sees expected checkpoints and reward multiplier.
- [x] A run has up to three checkpoints with a bank-or-continue decision after checkpoints one and two.
- [x] Results accurately report checkpoints cleared, selected difficulty, reward multiplier, arrows, target, and distance.
- [x] A pure contract builder can produce the same serializable descriptor for solo and future team use.
- [x] Existing build and test suites pass.

## Constraints

- Preserve existing user data and current Firestore collections unless a migration is explicitly required.
- Reward claiming must remain server-backed and idempotent enough to prevent duplicate client completion.
- Team gathering implementation follows this shared contract work; only the compatible contract boundary is part of the first implementation stage.
