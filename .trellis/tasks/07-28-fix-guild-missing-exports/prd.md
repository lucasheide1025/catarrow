# Fix adventurer guild missing exports

## Goal

Restore compilation and backend access after `GuildTestApp` was rewritten against three nonexistent exports.

## Confirmed facts

- `GuildTestApp` imports `parsePartyCats` and `calcPartyCatsCombatStats`, but `guildCats.js` intentionally exposes `buildCatRoster`, `pickPartyCats`, and `togglePartyCat`.
- The established party selection contract is `pickPartyCats(roster, selectedIds)`; its result already contains combat-ready cat objects.
- `GuildTestApp` imports `buyGuildShopItem` from the pure catalog module `data/guildShop.js`.
- The real async purchase operation is exported by `db/guildDb.js`; the catalog module must remain data-only.
- The current `GuildTestApp` contains substantial uncommitted AGY changes, so this fix must avoid replacing or reverting the file.

## Requirements

- Replace nonexistent cat helper imports with the established `pickPartyCats` contract.
- Derive selected IDs from the returned party cats for existing UI consumers.
- Import `buyGuildShopItem` from `db/guildDb.js`.
- Do not modify public APIs in `guildCats.js` or `guildShop.js`.
- Do not revert unrelated AGY work.

## Acceptance criteria

- The three reported missing-export errors are absent.
- Relevant guild domain tests pass.
- Production build proceeds past module export validation.
- Any subsequent independent compilation/runtime errors are reported separately rather than hidden.

## Out of scope

- Repairing broader gameplay or UX regressions introduced by the AGY rewrite.
- Refactoring `GuildTestApp`.
- Firestore deployment or rule changes.

## Open questions

None.
