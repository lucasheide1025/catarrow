# Unify cat village potion material identity

## Goal

Make it clear throughout the product that cat-grass potion and catnip potion are the same village material series, while preserving its original tier system.

## Confirmed facts

- `貓草藥水`, `貓薄荷藥水`, and `貓草藥水材料` currently appear as different labels for the same `potion` resource family.
- The resource family is intentionally tiered and stored as `potion_t1`, `potion_t2`, etc.
- Member village UI already totals the tiered keys, but labels the total differently from tier rows and other screens.
- Portable potion recipes intentionally consume tier-specific potion material.
- Expeditions correctly reward the tiered `potion` family, from `potion_t1` through `potion_t5`.
- Cat equipment refinement is the functional defect: the potion equipment slot is special-cased to consume a flat `potion` key, while every other tiered equipment material consumes `<resource>_t<tier>`.
- The potion equipment slot is also mislabeled `貓草藥水`, making that flat key look like a separate third material.

## Requirements

- Preserve `potion` as one tiered resource family.
- Preserve all `potion_tN` storage keys, production, exchanges, rewards, and recipe requirements.
- Use `貓薄荷藥水` as the canonical player-facing name for this resource family across affected village, expedition, goal, gathering, equipment, and zombie-mode references.
- Do not create a third material identity by appending `材料` to only some occurrences.
- Make cat equipment refinement consume `potion_t<tier>` according to the same grade-to-tier rule used by the other equipment slots.

## Acceptance criteria

- A regression check proves `potion` remains in `TIERED_RESOURCES`.
- All player-facing references to the `potion` material use `貓薄荷藥水`.
- Member/admin village views continue to show the existing tier breakdown under that one name.
- Existing `potion_tN` balances and potion recipes are unchanged.
- Expedition rewards continue to grant `potion_tN`.
- Refining the potion equipment at each grade consumes the matching `potion_tN` balance and never reads or writes flat `potion`.
- Relevant tests, lint, and build pass.

## Out of scope

- Changing potion tiers, inventory keys, production, exchanges, or recipes.
- Rebalancing potion effects or costs.
- Renaming unrelated battle consumables whose names describe distinct crafted items.

## Open questions

None.
