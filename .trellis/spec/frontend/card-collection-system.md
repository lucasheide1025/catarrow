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
