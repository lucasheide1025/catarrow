# Fix village goal display and duration

## Goal

Automatically spawned village goals must clearly identify the required activity and provide a realistically achievable completion window.

## Confirmed facts

- The reported live goal displays a generic `完成村目標` label with progress `0 / 20` and only 24 hours remaining.
- `0 / 20` matches the Tier-0 `monster_kills` target, but the player-facing label does not explain that twenty monster kills are required.
- Current code defaults automatic goals to 720 hours (30 days), but Firestore `sysConfig/villageGoal.schedule` overrides that default. A persisted legacy `baseHours: 24` therefore continues producing 24-hour automatic goals.
- Automatic goal documents store `goalType`, target, tier, and target-specific fields, but do not store a canonical display snapshot (`title`/`description`). Different surfaces derive or fall back differently.
- Manual-goal forms in two admin surfaces still default to 24 hours.
- `contributeKillToGoal()` exists but has no caller anywhere in `src/`; its comment references an obsolete `saveMonsterLog` path.
- `finalizeMonsterShootingSession()` defers the first completion locally. Its later flush contributes damage and world-boss spawn progress, but never contributes to `monster_kills`.
- The `board_laps` goal name and description still describe a circular board. The current village journey is a linear exploration map with canonical completion counters (`maps.*.clears`); solo and team completion paths already have explicit terminal seams.

## Requirements

1. Every village-goal surface must show an explicit activity label, such as `擊殺怪物 0 / 20`, rather than generic `完成村目標` wording.
2. Automatically spawned goals must use the normalized current schedule and never silently inherit the obsolete 24-hour default.
3. Persisted legacy schedule settings that still represent the obsolete 24-hour behavior must be migrated safely to the intended modern duration.
4. Existing active 24-hour goals must receive a fair extended deadline rather than requiring manual cancellation.
5. Manual-goal admin forms must default consistently with the current schedule instead of hard-coding 24 hours.
6. Existing custom titles/descriptions remain authoritative.
7. Goal cards must clearly separate and explain the fixed participation reward, contribution-weighted effort reward, and completion celebration chests; they must not present only the legacy `goal.rewards` subset as the whole reward.
8. A qualifying monster victory must increment `monster_kills` exactly once through the canonical shooting-session finalization boundary, including deferred/offline retry.
9. Contribution writes must be idempotent by shooting session ID so immediate feedback and later queue flush cannot double-count the same kill.
10. Replace the obsolete `board_laps` product concept with completed cat-exploration-map count. Solo and team journeys increment it exactly once at actual map completion.
11. Existing `board_laps` goal documents remain compatible and display/advance as exploration completions during migration.
12. Increase `monster_kills` targets from `20/50/80/120` to `40/100/160/240` for village tiers 0 through 3.
13. Keep exploration-completion targets at `30/70/105/150` for tiers 0 through 3.

## Acceptance criteria

- A regression test proves a Tier-0 `monster_kills` goal renders an activity-specific title and `0 / 20` progress.
- Schedule normalization/migration tests prove legacy 24-hour settings resolve to the intended modern duration without changing deliberate modern custom schedules.
- Existing active short goals can be upgraded idempotently.
- An existing active legacy 24-hour goal receives a fresh 30-day deadline measured from migration time.
- Both automatic and manual creation paths produce consistent deadlines.
- The player card names the activity and target, and previews all reward layers with an explicit note that effort rewards vary by contribution.
- A focused regression drives a won monster session (`result: win`, final HP `<= 0`) and observes village-goal progress increase once; replaying the session does not double-count.
- Solo and team journey-completion tests increment the exploration-completion goal exactly once, while ordinary movement does not.
- Focused village-goal tests and production build pass.

## Out of scope

- Rebalancing the goal target numbers or reward tables.
- Changing contribution weighting or reward accounting.
- Redesigning the village-goal card.

## Product decision

- Existing active legacy 24-hour goals receive a full new 30-day window from migration time.
- The UI must clearly display both the task objective and the complete reward model.
- Exploration-completion targets remain `30/70/105/150`; monster-kill targets double to `40/100/160/240`.
