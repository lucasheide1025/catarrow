# Free Hunt Battle Flow

## Purpose

Free Hunt solo and party battles share the same mobile-first interaction and settlement rules. Legacy battle and loot interfaces must not be used as fallbacks for Free Hunt.

## Round contract

- Arrow entry is draft state only. Adding, deleting, or replacing a score (including inner-ten `X`) must not roll randomness, apply damage, or mutate statuses.
- Resolve damage, card effects, specialization effects, resistances, and cat actions exactly once from the final submitted end.
- Guard submission synchronously as well as in rendered state. A rapid double tap must not create two resolutions.
- Presentation consumes resolved events and must never perform combat calculation. A cat action appears at most once per round.
- Preserve the waiting phase for player rest. After the resolved presentation delay, solo battle advances to the next input round automatically.

## Mobile presentation

- The battle stage must keep the monster unobstructed. Persistent effect-chip clusters are forbidden over the stage.
- Player card, specialization, stat-source, resistance, shield, and active-status details belong behind one compact trigger and a dismissible bottom sheet.
- Labels shown to players must be localized; internal IDs such as specialization track IDs must not appear.

## Reward authority

- Victory automatically starts an idempotent server claim. The result screen renders a normalized server receipt, never a client-side reward preview.
- While the receipt is unavailable, display `獎勵同步中，系統會自動重試` and do not show guessed drops.
- Retries reuse the same deterministic claim ID. Retry attempts must be delayed to avoid a tight network loop.
- Server inventory writes and the returned receipt are one authoritative operation. Client code must not independently roll or add the same chests, materials, coins, or cards.
- Free Hunt solo and party use the shared `HuntBattleReport` information hierarchy; legacy result components remain only for legacy modes.

## Regression checks

- Enter `X`, undo it, and enter it again: no status or damage changes before submit.
- Double-tap submit: only one resolution is produced.
- A round with a cat produces one cat presentation.
- Disconnect during reward claim: no preview appears, and retry uses the same claim ID.
- Unknown catalog IDs use a safe localized fallback instead of exposing raw variables.
