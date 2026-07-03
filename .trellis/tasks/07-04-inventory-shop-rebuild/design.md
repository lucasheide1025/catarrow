# Technical Design

## Boundaries

- `shopData.js` owns the product catalog, sale eligibility, prices, deterministic daily/weekly rotation, and display metadata.
- `db.js` owns purchase validation, atomic coin deduction, item delivery, and per-period purchase counters.
- `MemberInventoryHub` only routes to real inventory categories.
- `MemberMaterials` remains the inventory operation surface for chests, materials, fragments, and consumables; potion crafting is removed from it.
- `CoinShop` renders catalog projections and never constructs grant payloads itself.

## Inventory Data Flow

```text
materialInventory / chestInventory / fragmentInventory / potionInventory
  → existing subscriptions
  → MemberMaterials category projection
  → owned-only item cards
  → existing open / upgrade / craft operations
```

No inventory migration is required. Existing collections remain sources of truth.

## Shop Data Flow

```text
shopData catalog + Asia/Taipei period key
  → deterministic global daily/weekly selection
  → optional sysConfig override
  → CoinShop product cards
  → atomic db purchase
  → member coins + destination inventory + purchase counter
```

Product IDs, prices, grant payloads, pool membership, limits, and destination labels are validated against the server-side imported catalog. The UI passes only a product ID.

## Rotation

- Daily key uses the Asia/Taipei calendar date.
- Weekly key uses an ISO-style Monday week boundary in Asia/Taipei.
- A seeded deterministic shuffle produces the same selection for every player.
- Optional config can replace selected product IDs for a date/week, but IDs must remain in the approved catalog.
- Daily and weekly purchase counters are stored by period and product ID.

## Transaction Safety

- Purchases use a Firestore transaction.
- The transaction reads the member and destination inventory documents first.
- It verifies coins, limit, period, and product catalog membership.
- It writes coin deduction, purchase counter, and item grant together.
- Unsupported item kinds fail before any write.

## Compatibility

- Existing inventory documents remain valid.
- Existing equipped brands are treated as already unlocked.
- Existing free brand switching is preserved until the permanent unlock collection is populated; the shop must not charge for an item the player can already use.
- Old potion inventory IDs remain visible when a matching current catalog entry exists.

## Rollback

- The new catalog and UI can be reverted without data migration.
- Purchase counters and cosmetic unlock fields are additive.
- Transactional purchase code does not replace unrelated coin operations.
