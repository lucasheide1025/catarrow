# Implementation Plan

## Phase A — Inventory structure

- [x] Add explicit inventory category routing state in member/admin apps.
- [x] Replace the mixed inventory hub with loot, consumable, material, fragment, and special-item entries.
- [x] Make `MemberMaterials` accept an initial category.
- [x] Remove potion crafting and stale pre-battle copy from the backpack.
- [x] Render owned consumables as two-column cards and link to the Cat Village workshop.
- [x] Default material inventory to owned items while preserving upgrade actions.

## Phase B — Shop catalog and rotation

- [x] Create a centralized approved product catalog.
- [x] Implement deterministic Taipei daily and weekly keys/selections.
- [x] Add daily, weekly, supply, appearance, and recycle shop sections.
- [x] Display destination, limit, and price.

## Phase C — Purchase safety

- [x] Add product-ID-based atomic purchase transaction.
- [x] Store per-player daily/weekly counters.
- [x] Cover chest, material, gacha coin, dungeon scroll, and cosmetic grants.
- [ ] Keep forbidden items outside the catalog.
- [ ] Add Firestore rules for additive purchase data if required.

## Phase D — Quality and documentation

- [ ] Check mobile scrolling, touch targets, focus states, empty states, and reduced motion.
- [x] Run `git diff --check`.
- [x] Run `npm.cmd run build`.
- [ ] Update inventory/shop frontend spec and feature documentation.

## Risk Checks

- Buying cannot deduct coins without granting the item.
- Repeated clicks cannot exceed the period limit.
- Rotation is identical for all users in Asia/Taipei.
- Existing inventory contents remain readable.
- Coin chests are never sold for coins.
