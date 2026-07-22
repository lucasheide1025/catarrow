# Guest Mode UI and Entry-Level Gameplay Implementation Plan

## Phase 0: Verify external lifecycle

- [ ] Inspect the deployed Firebase project for the existing two-hour QR deletion mechanism.
- [ ] Record the TTL/scheduler field, timing semantics, and collections actually deleted.
- [ ] Add a tested cascade plan for every QR-owned asset collection before changing QR profile creation.

## Phase 1: Identity and policy foundations

- [ ] Extract explicit website-booking and QR entry resolvers.
- [ ] Make QR entry nickname-only while retaining anonymous Auth ownership and session linkage.
- [ ] Add authoritative `createdAt`/`expiresAt` state compatible with live cleanup.
- [ ] Add a central guest content policy for six families, T1, and the world-boss exception.
- [ ] Tighten Firestore guest/member ownership rules and add Emulator tests.

## Phase 2: Mobile shell and onboarding

- [ ] Refactor GuestApp into four persistent navigation destinations.
- [ ] Build task-oriented Home and Adventure hub.
- [ ] Add first-entry guide and persistent help sheet.
- [ ] Add entry-specific top bar, Member Center messaging, QR countdown, warnings, and expiration screen.
- [ ] Remove standalone Practice, Performance, Shop, and Gacha destinations.

## Phase 3: Inventory and equipment loop

- [ ] Build Inventory hub for chests, materials, card collection, and monster handbook links.
- [ ] Embed a simple individual common-equipment shop inside My Equipment.
- [ ] Seed one practice bow and 500 coins idempotently.
- [ ] Preserve existing equipment purchase/upgrade contracts while restricting the guest catalog.
- [ ] Add T2+ material guidance and keep card star/equip functionality.

## Phase 4: Adventure enforcement

- [ ] Enforce T1 in solo monster selection and trusted reward claims.
- [ ] Enforce T1 in guest party room creation/join/reward paths.
- [ ] Change guest dungeon cap from T2 to T1 at every generation/battle/reward boundary.
- [ ] Filter handbook and card sources to six-family T1 content.
- [ ] Integrate official shared world boss with server-enforced one-attempt rule, ranking exclusion, no global prize, and one guest participation reward.

## Phase 5: Cleanup and conversion

- [ ] Verify two-hour cleanup deletes/expunges all QR-owned private assets and resumable state.
- [ ] Ensure shared world-boss aggregates survive safely without retaining temporary private inventory.
- [ ] Verify website-booking conversion preserves all confirmed private assets and history.

## Validation

- [ ] Unit tests for entry-mode policy, T1 filtering, countdown/expiry state, and contextual home actions.
- [ ] Firestore Emulator tests for owner isolation, expired-profile rejection, reward boundaries, and QR cleanup helpers.
- [ ] Callable tests for solo/dungeon/world-boss T1 and one-attempt invariants.
- [ ] Component tests for four-tab navigation, onboarding, inventory/equipment loop, and entry-specific messaging.
- [ ] Mobile visual checks at 360, 390, and 430 px widths.
- [ ] End-to-end flows for website booking guest, new QR guest, active QR expiry, solo loot, party, dungeon, world boss, chest/card/equipment progression, and official conversion.
- [ ] Full frontend, Functions, Firestore Rules, and production build.

## Rollback points

- Entry resolver changes remain separable from UI navigation changes.
- T1 policy changes remain separable by mode.
- Do not deploy new QR schema until live cleanup verification passes.
- Do not delete or migrate legacy guest/kid documents as part of this feature.
