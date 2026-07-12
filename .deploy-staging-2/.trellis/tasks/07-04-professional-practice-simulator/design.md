# Technical Design

## State machine

`line_call -> preparation -> shooting -> ended`

- `line_call`: user gesture unlocks Web Audio and plays two signals.
- `preparation`: absolute 10-second deadline.
- `shooting`: absolute deadline of `arrowCount * secondsPerArrow`.
- `ended`: input locked; missing arrows become timeout misses and the end advances.

## Timing

- Store `deadlineMs` in a ref/state.
- Render remaining time from `Math.ceil((deadlineMs - Date.now()) / 1000)`.
- A short interval only refreshes UI; it is not the source of truth.
- Track announced thresholds in a ref to prevent duplicate sound after rerenders.

## Record contract

```js
competition: {
  ruleset, secondsPerArrow, preparationSeconds, assistedMinuteCue
}
roundTiming: [{
  round, startedAtMs, endedAtMs, allowedSeconds, usedSeconds,
  remainingSeconds, timedOut, timeoutArrows
}]
arrowEntries: [{
  round, arrow, score, enteredAtMs, elapsedMs, timedOut
}]
```

Existing `rounds` and `arrowPositions` remain unchanged for old consumers.

## Match state

- `qualification`: existing fixed-end completion.
- `recurve_set`: update player/opponent set points after every three-arrow end; stop at six points or enter shoot-off at 5:5.
- `compound_total`: compare cumulative totals after five three-arrow ends; tie enters shoot-off.
- Shoot-off changes the effective arrow count to one and the allowed time to 20 seconds without creating a second timer implementation.
- Virtual opponent arrows are generated around the selected average and persisted in `match.opponentEnds`.
