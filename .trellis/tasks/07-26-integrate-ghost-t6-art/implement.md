# Implement：整合鬼怪族 T6 核准立繪

## Execution Checklist

- [x] Add a deterministic Sharp authoring script containing the approved 6-role mapping.
- [x] Convert six card PNG sources to high-quality 3:4 WebP targets.
- [x] Chroma-key, de-spill, trim, pad, resize, and encode six transparent battle WebP targets.
- [x] Validate all 12 target files for format, dimensions, alpha/corners, and size.
- [x] Create and visually inspect a temporary contact sheet; adjust post-processing if green spill, clipping, or lost translucent effects are visible.
- [x] Run focused card catalog tests.
- [x] Run the production build.
- [x] Confirm the local app is running and provide the user a local inspection path; do not deploy.

## Validation Commands

```powershell
node scripts/integrate-approved-ghost-t6-art.mjs --check
npm test -- --watchAll=false src/components/member/cards/cardCatalog.test.js src/components/member/cards/catalogInvariants.test.js
npm run build
```

## Risk and Rollback Points

- The historical source filenames say `t1`, but the approved set is T6. The mapping table in `design.md` is authoritative.
- The three leader sources must be remapped rather than copied by matching their historical role names.
- Green spill and semi-transparent blue effects are the main image-processing risks; automated alpha checks alone are insufficient, so visual contact-sheet inspection is mandatory.
- Restrict writes to the 12 explicit T6 target files and the new authoring script. Preserve all unrelated dirty files.
