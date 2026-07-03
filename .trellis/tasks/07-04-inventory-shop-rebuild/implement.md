# Implementation Plan

## Phase A — Inventory structure

- [ ] Add explicit inventory category routing state in member/admin apps.
- [ ] Replace the mixed inventory hub with loot, consumable, material, fragment, and special-item entries.
- [ ] Make `MemberMaterials` accept an initial category.
- [ ] Remove potion crafting and stale pre-battle copy from the backpack.
- [ ] Render owned consumables as two-column cards and link to the Cat Village workshop.
- [ ] Default material inventory to owned items while preserving upgrade actions.

## Phase B — Shop catalog and rotation

- [ ] Create a centralized approved product catalog.
- [ ] Implement deterministic Taipei daily and weekly keys/selections.
- [ ] Add daily, weekly, supply, appearance, and recycle shop sections.
- [ ] Display owned quantity, destination, limit, and price.

## Phase C — Purchase safety

- [ ] Add product-ID-based atomic purchase transaction.
- [ ] Store per-player daily/weekly counters.
- [ ] Cover chest, material, potion, gacha coin, dungeon scroll, and cosmetic grants.
- [ ] Keep forbidden items outside the catalog.
- [ ] Add Firestore rules for additive purchase data if required.

## Phase D — Quality and documentation

- [ ] Check mobile scrolling, touch targets, focus states, empty states, and reduced motion.
- [ ] Run `git diff --check`.
- [ ] Run `npm.cmd run build`.
- [ ] Update inventory/shop frontend spec and feature documentation.

## Risk Checks

- Buying cannot deduct coins without granting the item.
- Repeated clicks cannot exceed the period limit.
- Rotation is identical for all users in Asia/Taipei.
- Existing inventory contents remain readable.
- Coin chests are never sold for coins.
