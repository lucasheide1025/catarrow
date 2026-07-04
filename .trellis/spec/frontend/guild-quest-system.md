# Guild Quest System — Frontend Spec

> Contracts and gotchas for `guildQuests` (Adventurer Guild) task publishing/validation.
> Covers: `AdventurerGuild.jsx`, `AdminGuildQuests.jsx`, `db.js` guild-quest functions, `adventurerSystem.js`.

---

## Three Independent Quest-Generation Systems Share One `guildQuests` Collection

| System | Function | Cadence | Storage | Coach-editable |
|---|---|---|---|---|
| Daily target-paper tasks | `adventurerSystem.js::getDailyGuildTasks(date)` | Daily (date-seeded, client-only) | Not persisted — pure function, recomputed every render | No |
| Bi-weekly kill-monster bounties | `generateBiWeeklyBounties()` + `autoPublishBountyQuests()` | 14 days (`guildMeta/bountyPeriod` guards re-publish) | `guildQuests`, tagged `periodTag` | Generation rule constants (`BOUNTY_TIER_CONFIG`) are hardcoded, not editable; published instances are editable via existing CRUD |
| Daily general bounty (2026-07-04) | `autoPublishDailyGeneralBounties()` | Daily (`guildMeta/dailyGeneralBounty` guards re-publish) | `guildQuests`, tagged `bountySource:"daily_general"` + `bountyDifficulty` | Template pool (`guildBountyTemplates`) and reward table (`guildBountyRewards`) both coach-editable |

All three write into the same `guildQuests` collection and reuse the same `publishGuildQuest`/`submitGuildQuestCompletion` accept-hunt-submit-claim pipeline. Do not assume a quest document's origin from its shape alone — always check the distinguishing tag (`periodTag` for bi-weekly, `bountySource`/`bountyDifficulty` for daily general).

## `questSubtype` Is Not Just a Label — It Gates Validation

`AdventurerGuild.jsx`'s completion-eligibility check hard-codes behavior per `questSubtype`:

```js
// AdventurerGuild.jsx ~line 425
const killPassed = sub === "kill_monster"
  ? (isAccepted && killProgress >= (req.killCount || 1))
  : true;   // <-- any OTHER questSubtype value skips kill validation entirely
```

**Any quest whose `requirement.type` is `"kill_monster"` must be published with `questSubtype: "kill_monster"`, never a new/custom subtype like `"general"`.** Using a different `questSubtype` value does not just change the display label — it silently disables the kill-count check, letting a player accept and immediately claim the reward without killing anything.

This bit the 2026-07-04 daily-general-bounty feature: `design.md` originally specified `questSubtype:"general"` to distinguish it from the bi-weekly system, but that would have broken validation. The fix was to **keep `questSubtype:"kill_monster"`** (sharing the existing validation path with bi-weekly bounties) and use the separate `bountySource`/`bountyDifficulty` fields — which have no effect on `AdventurerGuild.jsx`'s gating logic — to distinguish "which generator published this quest" for UI badges and expiry queries.

**Rule for future quest-type work**: before introducing a new `questSubtype` value, grep `AdventurerGuild.jsx` for every `sub === "..."` branch (validation gate, requirement-detail rendering, submit-button routing) and confirm the new subtype either matches an existing branch's validation semantics or that you're adding a genuinely new branch with its own validation — never invent a subtype value purely for categorization/display purposes when an existing subtype's validation behavior actually applies.

## Daily-Refresh Pattern (client-triggered, no cron)

This project has no Cloud Functions. Both `autoPublishBountyQuests()` (bi-weekly) and `autoPublishDailyGeneralBounties()` (daily general) follow the same pattern:

1. Check a singleton `guildMeta/{key}` document's stored period/date key.
2. If it matches "now", return `{ok:true, reason:"already_exists"}` and do nothing.
3. Otherwise: expire yesterday's quests tagged with this generator's marker, generate a new batch (date-seeded RNG via `adventurerSystem.js::makeSeedRand`, exported for reuse), publish via `publishGuildQuest`, then write the new period/date key to `guildMeta/{key}`.

Call this from a component that mounts when the relevant screen is viewed (e.g. `AdventurerGuild.jsx` on mount) — never assume a background job will run it. If a template pool is empty for a given difficulty/tier, skip that slot silently (`.filter(Boolean)`) rather than throwing; a partial batch is acceptable, an unhandled empty pool should not be.

## Chest Rewards Reuse `CHEST_TYPES`

`src/lib/itemData.js::CHEST_TYPES` has exactly 4 tiers (`wood`/`iron`/`gold`/`epic`) — a natural 1:1 fit for any new 4-tier difficulty system. Before inventing new chest categories for a new reward table, check whether the existing 4 (or the coin-chest tier system in `lootTable.js`) already cover the need. Grant chests via the existing `addChests(memberId, chests)` (`db.js`), matching the established chest object shape `{id, type, family, tier, from, ts}`.
