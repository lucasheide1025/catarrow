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

## Combat consumables

- `src/lib/itemData.js::POTIONS` is the consumable catalog source of truth. Mode availability, action cost, duration, recipes, output quantity, future feature flags, and art metadata belong to catalog entries rather than component ID-prefix checks.
- Potion inventory uses `catalogVersion`; legacy ID migration must be pure and idempotent. Merge old counts once and preserve unknown keys.
- Batch crafting validates and commits member resources, coins, migrated inventory, and output quantity in one Firestore transaction. UI maximum calculations are previews only and must be revalidated server-side.
- Future consumables may be crafted and stored, but mode resolvers reject consumption until their dependent combat feature is enabled.
- Normal combat throws never target world bosses. World boss consumes carry and raid categories only, and raid state remains local to one sortie.

## Monster artwork

- Monster cards and the monster dex render `/monsters/{monsterId}.webp` through the shared raster image component. The component owns contained sizing, accessible alt text, missing-asset fallback, and optional variant glow.
- `MonsterSVG` remains a compatibility surface for experimental or legacy battle tooling only; new collection and card interfaces must use the transparent WebP artwork.
- Collectible card art is separate from battle and dex art. Normal cards load opaque 4:3 scenes from `/cards/monsters/{monsterId}.webp`; world-boss cards load `/cards/worldboss/{bossKey}.webp`.
- Dedicated card scenes use `object-fit: cover` with a centered upper focal point. Missing card scenes fall back to the existing battle, world-boss, or cat portrait asset before using an emoji.
- The canonical card-art inventory contains 36 normal monsters and every key in `WORLD_BOSSES` (currently 24). Do not rely on stale comments or a manually assumed world-boss count.
