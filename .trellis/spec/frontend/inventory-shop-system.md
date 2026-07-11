# Inventory and Coin Shop

## Inventory boundaries

- The backpack contains owned items only: loot containers, consumables, monster materials, badge fragments, and special items.
- Shop, equipment, cats, stories, cards, and village production are separate features and must not be presented as backpack categories.
- Potion crafting belongs to the Cat Village potion workshop. The backpack only displays potion inventory and current in-battle usage copy.
- Backpack material lists default to owned entries; collection completion belongs to a dex surface.
- General material chests grant materials only. Potion rewards come from the dedicated potion chest, and chest descriptions must match this boundary.

## Shop catalog

- `src/lib/shopData.js` is the single source of truth for approved coin-shop products, prices, limits, destinations, and rotation pools.
- Never accept an arbitrary grant payload from a shop component. The database layer resolves a submitted product ID through the approved catalog.
- Arrowdew, achievements, certifications, first-clear collectibles, physical rewards, and direct stat/grade upgrades are forbidden shop products.
- Daily selection and weekly treasure selection use Asia/Taipei period keys and deterministic global rotation.

## Purchase consistency

- Coin deduction, item delivery, and per-period purchase count must run in one Firestore transaction.
- Check the member balance and purchase limit inside the transaction.
- Basic equipment purchases must use the same atomic deduction rule.
- Existing equipped brands count as unlocked. Switching or unequipping must persist that legacy brand before it leaves the active slot.
- Material recycling accepts T1–T3 only, uses an atomic inventory/coin transaction, and is capped at 20 items per Taipei calendar day.
- UI disables repeated purchase attempts while a transaction is pending, but correctness must not depend on the disabled button.

## Interface

- Owned items and shop products use compact two-column cards on mobile.
- Cards expose quantity or remaining limit, purpose, destination, and price without requiring another dialog.
- Empty categories require a clear empty state.
- Use 44px minimum action targets, visible focus styles, explicit transition properties, and semantic buttons.
