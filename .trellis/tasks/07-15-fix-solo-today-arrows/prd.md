# 修正單人模式今日箭數不增加

## Goal

Ensure every submitted solo-battle round immediately increases the current member's Asia/Taipei daily arrow mileage and survives refresh, even when cloud synchronization fails.

## Requirements

- Record the local daily counter synchronously before any authentication lookup, Firestore access, cost-control gate, or asynchronous queue work.
- Use the actual submitted-arrow count rather than assuming the configured arrows-per-round value.
- Preserve official-member durable aggregation and idempotent Firestore synchronization.
- Guest/kid accounts remain local-only and must not enqueue official cloud progress.
- Do not silently swallow failures; retain a scoped diagnostic warning while keeping gameplay non-blocking.
- Apply the same local-first contract through the shared arrow API so coach, member, guest, and kid identities behave consistently.

## Acceptance Criteria

- [ ] A coach in archer mode sees today's arrows increase immediately after submitting a solo round and the value survives refresh on the same origin.
- [ ] An official student sees the same behavior.
- [ ] A guest/kid sees local daily progress without an official Firestore operation being queued.
- [ ] A cloud/account-type lookup failure does not roll back or suppress the local daily increase.
- [ ] Invalid member IDs/counts do not mutate local or cloud state.
- [ ] Repeated cloud retries remain idempotent and do not duplicate lifetime arrows.
- [ ] Focused tests, production build, and `git diff --check` pass.

## Confirmed Evidence

- Both coach archer mode and official student mode reproduce on `https://student.catgroup.com.tw/`.
- The custom domain serves the current bundle containing the local daily-arrow and durable queue code.
- `MonsterBattle.submitRound()` calls `addRoundArrows(...).catch(() => {})`, hiding the runtime failure.
- `addRoundArrows()` currently combines synchronous display mutation and asynchronous account/cloud work behind one Promise-returning API.
