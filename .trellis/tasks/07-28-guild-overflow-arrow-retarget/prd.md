# Retarget overflow arrows in guild combat

## Goal

Prevent already-fired arrows from being wasted when earlier arrows in the same round kill their selected target while another monster remains alive.

## Confirmed facts

- Solo and team combat both resolve submitted shots sequentially.
- Both implementations currently skip a shot when its recorded target is no longer alive.
- Shot count and score must still include every fired arrow.

## Requirements

- Keep the originally selected target when it is alive.
- If that target has died, redirect the shot to a deterministic surviving monster.
- Retarget priority: nearest distance, then lowest current HP, then stable battlefield order.
- Stop processing remaining arrows only when no monster remains alive.
- Apply identical target-selection behavior to solo and team combat.
- Record the actual redirected target in the combat log so animation and replay consumers receive the resolved target.

## Acceptance criteria

- With three shots aimed at monster A, if shot two kills A and monster B survives, shot three damages B.
- If all monsters are dead, remaining shots produce no damage log.
- Solo and team regression tests pass.
- Full guild tests and production build pass.

## Out of scope

- Carrying arrows into the next wave.
- Changing damage, critical-hit, accuracy, or loot formulas.
