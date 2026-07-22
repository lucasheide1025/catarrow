# Guest Mode UI and Entry-Level Gameplay

## Goal

Redesign guest mode so a new visitor can understand the product quickly and play a meaningful lowest-tier experience before registering.

## Initial intent

- Rework the guest-mode information architecture and UI.
- Open only the lowest-tier subset of suitable game features.
- Preserve meaningful reasons to register without making guest mode feel like a static demo.
- Keep account, economy, multiplayer, and persistence boundaries safe.

## Confirmed facts

- This is a redesign of an existing guest mode, not a new guest-mode feature.
- `GuestApp` currently exposes practice, performance, solo monster battle, T1-T2 dungeon, equipment, world boss, guest shop, gacha, party battle, profile, and share-card paths.
- The current experience is broad enough that the main problem is unclear hierarchy and excessive surface area, rather than a lack of playable features.
- The repository already has a dedicated `GuestApp` and guest/kid access-control conventions.
- Heavy guest battle screens have route-level lazy-loading boundaries.
- Product scope, persistence policy, progression cap, and conversion experience still require evidence review and product decisions.

## Requirements

- MUST inventory current guest navigation, playable features, data sources, writes, and access-control checks before proposing the redesign.
- MUST distinguish anonymous-auth guests from official members and kid accounts.
- MUST define the exact lowest-tier playable loop and what progress, if any, survives registration.
- MUST prevent guests from affecting shared economy, rankings, teams, or other members unless explicitly approved.
- MUST design for mobile-first use.
- MUST make the guest core loop: fight monsters from the six families' T1 pools, receive coins/chests/cards, open or inspect rewards, upgrade equipment, and fight again.
- MUST provide direct access to `My Equipment` as part of that loop rather than treating equipment as an advanced preview.
- MUST allow real card drops from the permitted six-family T1 monster pool.
- MUST make `Start Adventure` open an adventure hub with five destinations: solo battle, party battle, dungeon, world boss, and monster handbook.
- MUST keep all guest combat and handbook content capped to the six monster families' T1 monsters, including modes that normally surface higher-tier enemies.
- MUST allow all five adventure modes to grant real guest coins, chests, and T1 cards.
- MUST express harder or multiplayer-mode value through higher quantities or drop probabilities, never through T2+ guest rewards.
- MUST reorganize the authenticated guest home around this loop instead of presenting every current guest feature at equal priority.
- MUST preserve guest coins, chests and contents, T1 cards, equipment and upgrade levels, handbook progress, and personal battle records when converting to an official member.
- MUST exclude guests from the official marketplace, guilds, leaderboards, and competitive records; conversion does not retroactively publish guest-period competitive or social activity.
- MUST use four persistent mobile navigation destinations: Home, Adventure, Inventory, and My Equipment.
- MUST keep monster handbook under Adventure and card collection under Inventory.
- MUST provide guest-mode usage instructions without adding another persistent bottom-navigation destination.
- MUST show a skippable three-step guide automatically on the first successful guest entry only.
- MUST provide a persistent top-bar help action that reopens the complete guest-mode guide.
- MUST explain the core loop, four navigation destinations, T1 boundary, member-only features, and conversion-preserved progress.
- MUST implement two distinct guest-entry lifecycles rather than one shared persistence policy.
- MUST keep website-booking guests bound to their pre-registered identity and persisted profile without requiring redundant entry data.
- MUST let QR entrants enter only an archer nickname and play without contact information or durable account recovery.
- MUST apply conversion-preservation promises only to the website-booking guest path, not to disposable QR sessions.

## Acceptance criteria

- [ ] Current guest experience and permission boundaries are documented from repository evidence.
- [ ] Proposed guest navigation and screen hierarchy are agreed.
- [ ] Exact allowed, preview-only, and locked features are agreed.
- [ ] Guest data lifetime and registration migration behavior are agreed.
- [ ] Complex-task `design.md` and `implement.md` are ready before implementation approval.

## Out of scope during planning

- Production deployment.
- Code implementation before explicit approval.
- Image-asset replacement or removal.

## Open questions

- What is the primary product purpose of the redesigned guest mode: a focused conversion trial, a limited long-term free mode, or both?
- Which guest progression and rewards survive conversion to an official member?
- How many fights or how much progression may a guest complete before encountering a registration gate?

## Product decisions

- `Start Adventure` leads to solo battle, party battle, dungeon, world boss, and monster handbook.
- All five guest adventure surfaces use only the six monster families' T1 monsters.
- The primary guest gameplay loop grants real coin, chest, and card drops, followed by equipment upgrades and repeat battles.
- Solo, party, dungeon, and world-boss reward tuning may differ in quantity and probability, but every guest reward remains within the T1 content boundary.
- Official-account conversion preserves private assets and personal progression, while social/economic/competitive participation begins only after conversion.
- The mobile bottom navigation contains Home, Adventure, Inventory, and My Equipment.
- Guest help uses a first-entry three-step guide plus a persistent top-bar help entry; it is not a fifth bottom-navigation tab.
- Website booking entry maps to the persistent `guest` lifecycle and should reuse prefilled/bound registration data.
- QR entry currently maps to `?kid=<sessionId>` but must become a nickname-only disposable play session; the current contact requirement and durable `members` record behavior do not match the desired product contract.
