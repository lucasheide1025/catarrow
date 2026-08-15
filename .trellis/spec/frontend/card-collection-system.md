# Card Collection System

## Image Visibility Contract

- Every catalog monster has a stable card image at `/cards/monsters/<artKey>.webp`.
- Owned and unowned cards use the same finite fallback chain:
  1. card scene art;
  2. transparent battle art;
  3. legacy monster art;
  4. deterministic SVG placeholder after all image requests fail.
- Unowned cards must still show the real card composition with grayscale and darkening. Do not replace available art with a generic family icon or an unrecognizable silhouette.
- Ownership gates information, not character recognizability. Unowned cards keep the unknown name and must not expose stars, chosen stats, talents, skill values, or story details.
- Images remain `loading="lazy"` and `decoding="async"`. The family × tier drill-down limits the primary unowned preview group to six cards.

## Asset Contracts

- Card art is 3:4 scene art without card frames, labels, stats, stars, or other UI text.
- React owns the frame, badges, name, rarity, stars, stats, talents, and lock state.
- Battle art uses the stable monster ID under `/monsters-battle/<monsterId>.webp` and must be a transparent WebP with transparent corners.
- Asset replacements must preserve stable monster/card IDs and path keys; visual updates must not migrate collection or gameplay data.

## Tests

- `src/components/member/cards/cardCatalog.test.js` locks the finite fallback chain for both owned and unowned views.
- `src/components/member/cards/components.smoke.test.js` verifies that the shared card components still compile.
- New asset batches should run focused card tests, metadata/alpha validation, and a production build before review.

## World-Boss Card Effect Contract

- The world-boss collection is a stable, explicit 24-card allowlist. Do not derive cards from every entry in `WORLD_BOSSES`; non-card or newly added boss definitions must not silently create collectible cards.
- Version 2 world-boss cards are passive-only. They do not add the legacy flat `HP` / `ATK` / `DEF +25`, do not use `chosenStat`, and do not receive the legacy stat-based 3% passive.
- Existing ownership and equipped references keep their stable card keys. Current card definitions own effect metadata and display text; stale persisted `stat`, `chosenStat`, `effectText`, or version-1 metadata must not override version 2 behavior.
- Card copy, pre-battle summaries, combat chips, and authoritative battle math must be projections of the same structured effect definition. Components must not parse effect text to calculate a modifier.
- Shared version-2 effect resolution owns caps, duplicate-key removal, canonical enemy-family mapping, and active/inactive scope details. Battle modes must not implement private copies of these rules.
- Party, dungeon/expedition, and raid rooms persist the card-effect version and stable equipped-card snapshot needed by their authoritative resolver. Existing active version-1 rooms retain their stored legacy snapshot until that battle ends; reconnect must never change formulas mid-room.
- YUMI burn is source-owned and serialized: one layer per source member, refresh without stacking for that source, independent layers across members, snapshot ATK, and one authoritative tick per round sequence. Client animation never writes damage.
- Raid healing retains per-healer attribution so each support contribution uses that healer's own card modifier and the combat log can explain the final split.
