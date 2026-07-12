# Battle Practice Analysis

## Core principle

Every battle arrow is both game input and raw archery practice data. Keep the
two calculations separate:

- archery analysis reads raw labels/scores and optional target coordinates;
- combat reads converted score, equipment, skills, defence, buffs, and damage.

Never derive an archery score from damage.

## Personal shooting context

- Battle modes reuse a versioned, member-scoped browser profile for bow type
  and physical distance.
- Show the compact picker before scoring and snapshot it on the first arrow.
- Target format is supplied by the battle or room rule.
- Old records with missing context stay readable and display as unrecorded.

## Statistics

- Count every submitted arrow.
- X is 10 points and M is zero.
- True per-arrow average is `total / all arrows`; never exclude misses.
- Standard deviation includes misses.
- High-score threshold is 8 for ten-ring targets and 5 for 1-6 field targets.
- Compare first and second halves to expose fatigue or late-session recovery.
- Landing analysis is available only when real `nx`/`ny` values exist.

## History sources

History supports autonomous practice, solo monster, party, dungeon, world
boss, and duel sources. A battle card contains:

- encounter and result;
- personal bow, physical distance, and target;
- archery performance report;
- combat damage, role, team/MVP, and rewards when recorded.

Losses with submitted arrows are practice and must be saved. Button input
remains analyzable without fabricated landing coordinates.

## Compatibility

Normalize legacy numeric arrows, string labels, and `{label, score}` objects at
the analysis boundary. Unknown text is not a ten. Do not rewrite old logs.
