# Improve cat expedition reward claim experience

## Goal

Turn cat expedition collection from a short-lived text notification into a satisfying, readable reward-claim moment.

## Confirmed facts

- A completed expedition currently shows a `🎁 領取寶藏` button inside its slot card.
- Clicking immediately calculates random rewards, persists them through `collectExpedition()`, clears the expedition slot, and shows one text block for only four seconds.
- The reward payload already contains tiered village materials plus possible cat XP, bond, arrowdew, and gacha tokens.
- `fmtRewardKey()` already maps persisted reward keys to player-facing labels.
- There are up to three expedition slots, so the presentation must clearly identify the returning cat and mission.
- The persistence boundary is correct: rewards must only be presented as claimed after `collectExpedition()` succeeds.

## Requirements

- Keep the existing atomic claim behavior and prevent double collection.
- Replace the transient text-only success message with a persistent reward presentation.
- Use a full-screen treasure result presentation rather than a compact modal.
- Present a short chest-opening moment, then reveal reward cards in sequence.
- Show the returning cat, mission tier/name, and every awarded item with icon, name, tier where applicable, and quantity.
- Distinguish special rewards such as cat XP, bond, arrowdew, and gacha tokens from ordinary materials.
- Provide an explicit close/continue action so the player controls how long results remain visible.
- Respect reduced-motion preferences and keep the layout usable on mobile.
- Preserve the existing error notification path when persistence fails.

## Acceptance criteria

- A successful claim opens a readable result presentation that remains until dismissed.
- The presentation is built from the exact reward object successfully persisted, not a second reward roll.
- All reward types have stable display metadata and no raw internal keys leak into the UI.
- Rapid repeated clicks cannot claim the same expedition twice.
- Closing the result returns to the expedition slots with the claimed slot empty.
- Relevant tests and production build pass.

## Out of scope

- Changing expedition durations, reward odds, quantities, or caps.
- Adding a new chest inventory item.
- Changing Firestore reward persistence.

## Open questions

None.
