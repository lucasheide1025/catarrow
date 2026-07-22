# Guest Mode UI and Entry-Level Gameplay Design

## 1. Experience architecture

Both entry paths share one mobile gameplay shell with four persistent destinations:

1. Home
2. Adventure
3. Inventory
4. My Equipment

Home is task-oriented. It contains one primary Continue Adventure action, power/equipment progress, recent loot, and one contextual next action. It does not duplicate all adventure destinations.

Adventure contains five destinations:

- Solo battle
- Party battle
- Dungeon
- Official shared world boss
- Monster handbook

Practice, full performance reporting, guest gacha, and the mixed-purpose guest shop are removed as standalone destinations.

## 2. Entry lifecycles

### Website-booking guest

- Route: existing `?guest=1` flow.
- Reuse prefilled and bound booking identity.
- Persist the existing guest profile and private progression.
- Show Member Center and account/progress preservation status.
- Conversion to official preserves coins, inventories, T1 cards, equipment/upgrades, handbook, and personal battle history.

### QR guest

- Route: existing Member Management > Guest QR generated `?kid=<sessionId>` URL.
- Keep internal `kid` identifiers initially for compatibility; show `現場訪客模式` in player-facing UI.
- Require only an archer nickname.
- Sign in anonymously and create an auth-owned temporary profile linked to the QR session, with authoritative creation/expiration metadata.
- Permit full temporary T1 economy for two hours.
- Reuse the live two-hour deletion mechanism only after verifying its implementation and cascade behavior.
- Do not show binding or Member Center. At expiration, offer rescan and website booking without promising data transfer.

## 3. Content boundary

Create one guest content policy consumed at both UI and authoritative selection/reward boundaries.

- Allowed families: ghost, mountain, insect, workplace, exam, temple.
- Allowed tier: T1 only.
- Solo, party, dungeon, handbook, card drops, and reward envelopes use this policy.
- UI caps are secondary; monster selection and server reward validation must reject non-T1 guest content.
- Official world boss is the sole monster-pool exception.

Party guest rooms must not inherit an official higher-tier monster. Guest-created/joinable rooms need an enforced T1 policy. Guest dungeon generation must clamp to T1 at entry, generated map, battle-room creation, and reward validation.

## 4. Reward and progression loop

The core loop is:

`Adventure -> coins/materials/chests/T1 cards -> open/inspect -> buy or upgrade equipment -> Adventure`

- All gameplay modes may award real guest assets.
- Harder/multiplayer modes change quantity or probability, not tier.
- Guest card functionality includes collection, duplicate star-up, and HP/ATK/DEF equipment bonuses.
- Marketplace, exchange, gifting, guilds, and official rankings remain unavailable.
- Equipment starts with one free practice bow and 500 coins.
- Other common-quality slot items are purchased individually from a simple shop embedded in My Equipment.
- Remove gacha currency and coin multipliers from the guest shop catalog.
- No artificial equipment upgrade cap. T1 material availability naturally blocks higher breakthroughs; explain missing T2+ materials as formal-member progression.

## 5. Shared world boss

- Guests attack the same official event and reduce shared HP.
- Enforce one attempt per guest per event in a transaction/callable boundary.
- Guest damage does not enter official ranking.
- Guests cannot claim the global kill prize.
- A bounded T1-economy participation reward is granted once.
- QR expiration cleanup must not corrupt shared event totals; shared event entries should retain only non-sensitive aggregate attribution needed by the event.

## 6. Help and expiration UX

- First successful entry: skippable three-step guide, once per profile/session.
- Persistent top-bar help action reopens full instructions.
- QR top bar shows remaining time, changes warning style at ten minutes, and shows one non-blocking notice at two minutes.
- Expiration prevents new battle/purchase/upgrade actions.
- An active battle may finish its current round, then transitions to the expiration screen.

## 7. Security and deletion

- Temporary and persistent guest documents must be owner-readable/writable, not readable or broadly writable by every authenticated account.
- Sensitive reward writes use trusted callables or narrowly validated Rules transitions.
- QR deletion must cover the member profile plus owned inventory, chest, card, reward-claim, battle-resume, and room-participation data.
- Confirm whether live cleanup is Firestore TTL, a scheduler, or another service before implementation. Add expiration metadata compatible with that mechanism.

## 8. Compatibility and rollout

- Preserve existing `?guest=1`, `?kid=<sessionId>`, camp session administration, and QR generation.
- Keep internal `kid` storage identifiers during this feature to avoid a data migration.
- Implement behind small policy/helpers and reuse existing battle components.
- Roll back by restoring the old GuestApp navigation and entry resolver; do not delete existing persistent guest data during rollout.
