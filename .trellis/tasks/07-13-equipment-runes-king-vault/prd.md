# Dungeon loot, king vault, and equipment rune rebuild

## Goal

First make dungeon chest and boss-vault rewards deterministic, tier-correct, and shared by the whole team. Then use those rewards as the foundation for the new equipment-rune and socketing system.

## Priority order

1. Dungeon ordinary chest, boss loot, and post-boss king-vault rewards.
2. King Seal inventory and equipment breakthrough costs.
3. New equipment-rune data and transactions.
4. Socketing and inventory/equipment UI.
5. Removal and migration of the old dungeon rune system.

## Requirements

- Ordinary chest-room rewards are created once by the host and persisted. Every team member receives the same resolved contents.
- Ordinary chests may grant coins, material chests, and existing non-equipment item rewards, but material tier may never exceed T4.
- A normal chest room must not grant legendary equipment.
- Post-boss king vault uses the existing T1--T6 dungeon tier model, not an invented separate chest tier.
- Boss/hidden/special content is the source of King Seals and future rune fragments/full runes.
- Team reward generation and claiming must remain atomic and reconnect-safe.
- The old rune system must not be silently deleted from existing accounts; migration policy is decided before it is removed.

## Acceptance criteria

- [ ] One persisted ordinary-chest reward object is rendered identically for every member of a team run.
- [ ] Ordinary chest materials are capped at T4 in all dungeon tiers.
- [ ] Boss and king-vault rewards visibly follow the run's T1--T6 tier.
- [ ] No chest or boss flow creates direct legendary equipment drops.
- [ ] King Seal grants are stored and can later be consumed by equipment systems.
- [ ] Existing expedition reward claiming remains safe against duplicate grants.

## Rune synthesis rebalance — 2026-07-16

### Confirmed facts

- Rune synthesis already has hidden success rates: T1→T2 80%, T2→T3 65%, T3→T4 50%.
- A synthesis attempt requires two identical un-socketed runes. One is preserved as the base; the other rune and all gold are consumed on failure.
- The UI currently shows only the target tier. It does not show success rate, gold cost, or failure loss before confirmation, making synthesis appear deterministic.
- Current attempt costs are only 900 / 2,400 / 6,000 gold, derived directly from the target rune's `goldCost`.

### Requirements

- Show success rate, gold cost, consumed rune count, and failure consequence before synthesis.
- Add a clear synthesis confirmation and success/failure animation; do not allow accidental one-tap resource loss.
- Raise synthesis costs enough to remain meaningful in the current coin economy while keeping T2 accessible.
- Keep the base rune safe on failure; failure consumes only the material rune and gold.
- Keep the existing synthesis success curve at 80% / 65% / 50% and display it directly on each synthesis action.
- Set synthesis attempt costs to 2,000 gold for T1→T2, 10,000 gold for T2→T3, and 30,000 gold for T3→T4.
- Display each rune's concrete combat effect in the crafting list, rune inventory, synthesis confirmation, and socket selection UI. Cat runes must explicitly state that the percentage applies to ATK, DEF, and HP together.
- Move socket opening and rune insertion out of the default equipment information panel. Each equipped-item modal must have three top tabs: `資訊／升級`, `更換品項`, and `打洞／符文`.
- Opening the equipment modal must always default to `資訊／升級`; socket operations are available only after deliberately selecting the third tab.
- Opening a socket requires a confirmation step that shows socket number, success rate, King Seal cost, failure loss, and the guarantee that equipment is not damaged.

### Open questions

- Whether repeated failures should receive pity protection.
