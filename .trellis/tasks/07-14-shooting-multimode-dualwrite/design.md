# Design: multi-mode shooting dual write

Each mode calls the common record builder only after its own authoritative
round/room data is finalized. The adapter receives raw personal arrows and a
mode-specific GamePerformance snapshot. It is best-effort and never blocks the
existing write path. Dungeon is first because it already combines a target
format with owned round results; party, world boss and duel follow after their
personal-arrow boundaries are verified.
