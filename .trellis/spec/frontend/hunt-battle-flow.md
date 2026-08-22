# Free Hunt Battle Flow

## Purpose

Free Hunt solo and party battles share the same mobile-first interaction and settlement rules. Legacy battle and loot interfaces must not be used as fallbacks for Free Hunt.

## Round contract

- Arrow entry is draft state only. Adding, deleting, or replacing a score (including inner-ten `X`) must not roll randomness, apply damage, or mutate statuses.
- Resolve damage, card effects, specialization effects, resistances, and cat actions exactly once from the final submitted end.
- Guard submission synchronously as well as in rendered state. A rapid double tap must not create two resolutions.
- Presentation consumes resolved events and must never perform combat calculation. A cat action appears at most once per round.
- Preserve the waiting phase for player rest. After the resolved presentation delay, solo battle advances to the next input round automatically.
- Multi-monster party rooms use a versioned, server-authoritative loadout snapshot and round resolver. Clients submit only arrows, attack mode, target, and revision; they must not write combat HP, targets, snapshots, resolutions, or outcomes directly.
- The server rebuilds each active-room loadout from authoritative member, certification, dex, equipment/specialization, card, cat, guild, and duel sources. A client-provided snapshot may be used as a request hint only and must never be the source of combat authority.
- Browser ESM and Functions CJS combat calculations are generated from the same runtime source. The Functions predeploy pipeline must regenerate the artifact, and golden parity tests must fail when browser and server results drift.
- Active rooms freeze their combat/effect version. Reconnect, card changes, cat changes, and equipment upgrades must not switch formulas mid-battle.

## Arrow progress contract

- Every successful authoritative round submission records the number of actually shot arrows exactly once for today's local arrow count and official cloud progression.
- Use a stable member + battle/sortie + round identity. Draft entry, failed submission, revision before lock, presentation replay, reconnect, reward claim, and duplicate retry must not add arrows again.
- Free Hunt solo, Free Hunt party, solo multi-monster, party multi-monster, and the current World Boss flow all use the same idempotent battle-round recorder.
- Guest and kid accounts still increment the local today count; official cloud progress remains gated by the existing account-type policy.
- Consumables, support actions, and other non-arrow battle events must not be included in the arrow count.

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
- Forge a client loadout with higher stats or different cards/cat: the v2 room still uses the server-rebuilt snapshot.
- Submit, retry, reconnect, and replay one battle round: today's arrow count increases only once by the submitted arrow length.
- A World Boss round containing consumable actions counts only its actual arrows.
