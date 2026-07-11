# RPG Equipment System

## Bonus source of truth

- Use `getEquipSlotBonus(slotOrStat, equipment)` for every single-slot display and calculation.
- Use `calcEquipBonus(equipment)` only for aggregated ATK, DEF, and HP totals.
- Grade base values are `1, 6, 11, 16, 21, 26` from common through mythic. Add `plusLevel` after the grade base; multiply the final raw value by `5` for HP slots.
- Never display grade index `+1` as the equipment bonus. That omits the five-point grade steps and enhancement level.

## Upgrade display

- Show current and next bonus together before an upgrade.
- `+4 → +5` promotes to the next grade at `+0`; the displayed next value must use that promoted grade.
- Mythic equipment supports `+0` through `+4` and requires a configured mythic cost/material tier.
- Brand changes are cosmetic and preserve grade/plus level. UI copy must not imply brands change combat stats.
- Only play the upgrade sound and success presentation after the server confirms the upgrade.
- The success presentation must show the resulting grade, plus level, and stat bonus, and respect `prefers-reduced-motion`.
- Material curve changes must update `isMatsCurveCurrent()` expectations so persisted `nextMats` from older curves are regenerated instead of silently retaining obsolete costs.

## Equipment page

- Present one aggregate summary only: equipped slots, completion percentage, and ATK/DEF/HP totals.
- Explain how grade, enhancement, and the HP multiplier combine.
- Empty slots and empty item lists require actionable empty states.
- Present equipment slots as a two-column small-card grid. Each card must expose its slot, item, grade/plus level, and actual stat bonus without opening the detail dialog.
