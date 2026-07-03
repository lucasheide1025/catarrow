# Cat Companion System

## Type compatibility

- The persisted type key `allround` is retained for existing member documents, but its user-facing label is `治癒型`.
- Fixed rows remain:
  - `daming`, `gege`, `meimei`: healing
  - `niuniu`, `haji`, `baobao`: attack
  - `youyou`, `xiaoan`, `diandian`: defense

## Combat stats

- `src/lib/catCombat.js::calcCatCombatStats()` is the single source of truth for final cat HP, ATK, and DEF.
- Do not duplicate the type/bond/equipment formula in hooks or pages.
- Apply `CAT_BUILD_PROFILES[catId].allocation` after level, bond, and equipment growth. This preserves individual differences at high levels.
- `useCatCompanion`, expedition calculations, and collection detail UI must all use the same calculator.

## Individual traits

- Every cat has an explicit build title, HP/ATK/DEF allocation, skill-power modifier, skill-chance modifier, and trait description.
- Skill chance and effect calculations accept `catId`; omitting it preserves neutral backward-compatible behavior.
- UI copy must explain both the row role and the individual build. Avoid describing the healing row as generic or all-round.
