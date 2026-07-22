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
- QR mode is administered from Member Management > Guest QR. The implementation is `AdminKidMode.jsx`, which generates `?kid=<sessionId>` URLs despite the newer user-facing Guest QR label.
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
- MUST keep solo battle, party battle, dungeon, and handbook content capped to the six monster families' T1 monsters.
- MUST allow both persistent and QR guests to enter the official shared world-boss event as the sole exception to the T1 monster-pool restriction.
- MUST enforce one guest world-boss attempt per event at a server-verifiable boundary, not only by disabling a client button.
- MUST count guest damage against the shared official world-boss health while excluding guest damage from the official leaderboard and guest accounts from the global kill prize.
- MUST grant a separate guest participation reward from the permitted T1 guest economy after the single world-boss attempt.
- MUST allow all five adventure modes to grant real guest coins, chests, and T1 cards.
- MUST express harder or multiplayer-mode value through higher quantities or drop probabilities, never through T2+ guest rewards.
- MUST reorganize the authenticated guest home around this loop instead of presenting every current guest feature at equal priority.
- MUST preserve guest coins, chests and contents, T1 cards, equipment and upgrade levels, handbook progress, and personal battle records when converting to an official member.
- MUST exclude guests from the official marketplace, guilds, leaderboards, and competitive records; conversion does not retroactively publish guest-period competitive or social activity.
- MUST use four persistent mobile navigation destinations: Home, Adventure, Inventory, and My Equipment.
- MUST provide a simple guest equipment shop so coins can be converted into base equipment before upgrading.
- MUST place the equipment shop inside My Equipment rather than adding a fifth bottom-navigation destination.
- MUST remove unrelated GuestShop products such as gacha currency and coin multipliers from the redesigned guest loop.
- MUST grant one free basic practice bow and 500 starting coins.
- MUST sell all other guest equipment one item at a time at common quality; higher quality is earned through upgrading, not direct purchase.
- MUST not add an artificial guest equipment-upgrade cap. The six-family T1 drop pool is the progression boundary, and missing T2+ materials naturally stop higher breakthroughs.
- MUST explain unavailable higher-tier materials as a formal-member progression opportunity rather than as a generic error.
- MUST let guests collect, inspect, star-up, and equip cards from the six-family T1 pool, including permitted T1 cards in world-boss card slots.
- MUST keep card marketplace, player exchange, gifting, and official collection rankings unavailable to guests.
- MUST keep monster handbook under Adventure and card collection under Inventory.
- MUST provide guest-mode usage instructions without adding another persistent bottom-navigation destination.
- MUST remove standalone Practice and Performance destinations from guest home and bottom navigation.
- MUST continue collecting battle-derived personal statistics needed for the guest summary, while reserving full practice analytics and performance reports for official members.
- MUST show a skippable three-step guide automatically on the first successful guest entry only.
- MUST provide a persistent top-bar help action that reopens the complete guest-mode guide.
- MUST explain the core loop, four navigation destinations, T1 boundary, member-only features, and conversion-preserved progress.
- MUST implement two distinct guest-entry lifecycles rather than one shared persistence policy.
- MUST keep website-booking guests bound to their pre-registered identity and persisted profile without requiring redundant entry data.
- MUST let QR entrants enter only an archer nickname and play without contact information or durable account recovery.
- MUST preserve the existing two-hour automatic deletion contract for QR guest data.
- MUST let QR guests use the full permitted T1 economy during the two-hour window, including materials, chests, cards, coins, equipment, and equipment upgrades.
- MUST not impose an additional inventory or upgrade cap merely because the QR profile is temporary.
- MUST delete or expire all QR-owned economy documents together when the two-hour profile expires.
- MUST reuse the existing Member Management > Guest QR session-management and QR-generation flow.
- MUST apply conversion-preservation promises only to the website-booking guest path, not to disposable QR sessions.
- MUST show Member Center and bound-account/progress-preservation messaging only for website-booking guests.
- MUST not interrupt QR gameplay with registration prompts or show account-binding controls.
- MUST limit QR conversion messaging to guest help and the expiration screen, linking to website booking without promising current-session data transfer.
- MUST show QR session time remaining in the top bar, warn visually at ten minutes, and issue one non-blocking notice at two minutes.
- MUST prevent starting new battles, purchases, or upgrades after expiration while allowing the currently active battle round to finish before showing the expiration screen.
- MUST offer valid-QR rescan and website-booking actions on the expiration screen.

## Acceptance criteria

- [ ] Current guest experience and permission boundaries are documented from repository evidence.
- [ ] Proposed guest navigation and screen hierarchy are agreed.
- [ ] Exact allowed, preview-only, and locked features are agreed.
- [ ] Guest data lifetime and registration migration behavior are agreed.
- [ ] Complex-task `design.md` and `implement.md` are ready before implementation approval.
- [ ] Mobile guest shell exposes exactly four persistent destinations: Home, Adventure, Inventory, and My Equipment.
- [ ] Adventure exposes solo, party, dungeon, official shared world boss, and monster handbook.
- [ ] Solo, party, dungeon, handbook, drops, and card collection are restricted to all six families' T1 content at authoritative boundaries.
- [ ] Website-booking guests retain progress; QR guests enter with nickname only and all owned data expires after two hours.
- [ ] QR guests can earn and spend coins/materials/chests/cards and buy/upgrade equipment during the active window.
- [ ] World-boss guest participation is once per event, affects shared HP, stays out of official ranking/global prize, and grants a guest reward.
- [ ] Guest help, countdown, expiration, and conversion messaging follow the confirmed entry-specific behavior.

## Out of scope during planning

- Production deployment.
- Code implementation before explicit approval.
- Image-asset replacement or removal.

## Open questions

- Verify the live two-hour QR cleanup implementation and its cascade coverage before changing the temporary profile schema.

## Product decisions

- `Start Adventure` leads to solo battle, party battle, dungeon, world boss, and monster handbook.
- All five guest adventure surfaces use only the six monster families' T1 monsters.
- The primary guest gameplay loop grants real coin, chest, and card drops, followed by equipment upgrades and repeat battles.
- Solo, party, dungeon, and world-boss reward tuning may differ in quantity and probability, but every guest reward remains within the T1 content boundary.
- Guest world-boss damage contributes to the official shared boss health. Each guest may attack the event only once.
- Guest world-boss damage is excluded from official ranking and global kill-prize eligibility; the guest instead receives a bounded personal participation reward.
- Official-account conversion preserves private assets and personal progression, while social/economic/competitive participation begins only after conversion.
- The mobile bottom navigation contains Home, Adventure, Inventory, and My Equipment.
- The existing `GuestShop` already sells a ten-slot starter pack plus world-boss potions, gacha currency, and coin boosts. Its transaction/profile wiring can be reused, but its catalog and placement must be simplified for the new equipment loop.
- Guest starting state is one basic practice bow plus 500 coins. Other slots are filled gradually through individual purchases.
- Guest equipment progression is naturally capped by T1 material availability, not by disabling the upgrade action.
- T1 cards participate in the guest power loop through duplicate-based star upgrades and HP/ATK/DEF equipment bonuses.
- Guest help uses a first-entry three-step guide plus a persistent top-bar help entry; it is not a fifth bottom-navigation tab.
- Guest home may show a compact battle summary, but practice and full performance analysis are not guest destinations.
- Website booking entry maps to the persistent `guest` lifecycle and should reuse prefilled/bound registration data.
- Website-booking and QR guests share the same four-tab T1 gameplay shell, but receive different identity, persistence, and conversion messaging.
- QR entry currently maps to `?kid=<sessionId>` and must become nickname-only. Its T1 play data may exist during the established two-hour window and is then automatically deleted.
- QR guests receive and spend real temporary T1 assets during the two-hour session. Data ephemerality, rather than reduced reward functionality, is the boundary.
- Repository search did not locate the two-hour cleanup implementation; it may be an external Firebase TTL or deployed scheduler. Implementation planning must verify the live mechanism before changing QR data shape.
