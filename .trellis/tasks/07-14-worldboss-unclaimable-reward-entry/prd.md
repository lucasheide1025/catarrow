# World Boss unclaimable reward entry

## Goal

Do not present a World Boss reward-claim action to a player who has no
claimable reward from the most recently defeated World Boss.

Restore the World Boss round demonstration in the unified battle UI before
adding virtual-teammate combat behavior.

Replace the inconsistent battle damage behavior with one score-and-body-part
contract for solo, party, World Boss, and dungeon battles (both solo and
party).

## Requirements

- Determine claimability from the latest defeated event for the current
  player, not merely from the existence of a past World Boss event.
- Show the pending-reward entry and the reward claim action only when the
  current player participated and their reward has not already been claimed.
- Hide the entry when the player did not participate, has already claimed, is
  a guest/kid account, or there is no defeated event with a reward available.
- Preserve the existing two-step preview then confirm claim flow for a truly
  claimable reward.
- After a World Boss score submission, show each resolved arrow in sequence:
  boss hit reaction, floating damage (or miss), critical feedback, and HP
  updates. Do not expose virtual-teammate attacks in this change.
- Do not show random pre-round events in World Boss battles. Mirror the
  single-player battle presentation with player arrow travel, cat attack, and
  World Boss counterattack animation.
- Every non-M arrow is a hit and deals damage. M is the sole zero-damage
  outcome; score rings do not introduce an additional miss chance.
- Use these outgoing score multipliers in every in-scope battle: X x2.0
  (critical), 10 x1.2 (guaranteed hit), 9 x1.0, then 8 through 1 descend by
  0.1 to x0.2.
- Resolve a random target body part from a pool determined by the score ring.
  Preserve the progressive unlock rule: chest unlocks heart/lung, belly
  unlocks kidney, and groin unlocks the vulnerable target.
- Damage randomness must not make a lower ring out-damage a higher ring.
  Randomness is limited to the chosen body part.
- Monster counterattacks must select a player hit part using the round's
  average arrow score (M counts as zero). Lower averages may select stronger
  player hit parts, but player-specific hit multipliers cap at x1.30 and a
  single counterattack caps at 25% of that player's maximum HP.
- Apply the same outgoing and incoming body-part rules to solo monster,
  party, World Boss, dungeon solo, and dungeon party battles. Preserve each
  mode's existing mode-specific buffs, shields, and counter-reduction effects.

## Acceptance Criteria

- [ ] A player with no unclaimed reward cannot see or click an old-reward
  claim entry.
- [ ] An eligible participating member can still preview and claim their
  pending reward exactly once.
- [ ] Guest/kid mode does not expose the formal reward claim entry.
- [ ] The production build completes successfully.
- [ ] A six-arrow World Boss round visibly plays all six player-arrow results
  in the unified battle screen before the counterattack phase.
- [ ] A World Boss round has no random event modal and visibly includes player,
  cat (when equipped), and World Boss counterattack presentation.
- [ ] In every in-scope battle, X/10/9/.../1 have deterministic descending
  score multipliers and only M deals zero damage.
- [ ] The combat log and animation payload identify the resolved body part for
  both outgoing hits and counterattacks.
- [ ] A player counterattack cannot exceed 25% of their maximum HP after all
  applicable reductions, and no player hit-part multiplier exceeds x1.30.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
