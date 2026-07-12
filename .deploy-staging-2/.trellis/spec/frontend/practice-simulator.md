# Professional Practice Simulator

## Target specification

- A target format owns scoring range, face diameter, and layout.
- Read target geometry and tap scoring from `src/lib/targetFace.js`; practice
  must not maintain a second ring implementation.
- Keep legacy target IDs readable; new records additionally persist `targetSpec`.
- Vertical triple faces score 6–10 and use one arrow per face for a three-arrow end by default.
- Qualification presets may set bow division, distance, face, arrows per end, ends, and timing, but every field remains editable.

## Competition timing

- Timed ends follow `line_call -> preparation -> shooting -> ended`.
- Use an absolute millisecond deadline. Intervals only refresh the display and must never be the time source.
- Official qualification timing is 30 seconds per arrow for World Ranking events; support 40 seconds per arrow for other events.
- Play two signals to enter the line, wait 10 seconds, play one start signal, show yellow at 30 seconds, and play two stop signals at expiry.
- Assisted voice/minute cues are optional and separate from official range signals.
- At expiry, lock score input and record every missing arrow as a timed-out miss.

## Record compatibility

- Preserve `rounds` and `arrowPositions` for existing history and analytics.
- Add `targetSpec`, `competition`, and `roundTiming` without rewriting old logs.
- Do not collect or write per-arrow score-entry timing. Historical
  `arrowEntries` fields may remain on old records and must stay readable.
- Store X as `"X"` while calculating it as 10 points.

## Individual match simulation

- Recurve and barebow individual matches use three-arrow sets: win = two set points, draw = one each, first to six wins.
- Compound individual matches use five three-arrow ends and compare the 15-arrow cumulative score.
- Regulation ties enter a one-arrow, 20-second shoot-off through the same timing state machine.
- A shoot-off arrow never changes the regulation cumulative total.
- If shoot-off arrow values tie, compare normalized distance to centre. Target input uses the recorded coordinate; button input may use a simulated distance and must identify the session as a simulation.
- Persist virtual opponent strength and every regulation opponent arrow in the match record.

## Lifecycle safety

- Clear refresh intervals and speech on unmount.
- Warn before page unload during preparation or shooting.
- Guard internal app navigation while scoring or an unsaved result is active;
  confirmed navigation keeps recovery state intact.
- Cancelling an active session requires confirmation.
- Persist unfinished scoring and unsaved result state in versioned,
  member-scoped browser storage.
- Persist absolute preparation/shooting deadlines rather than countdown
  display values. Time away from the page still consumes the active limit.
- Clear recovery state after a successful save or explicit cancellation.
