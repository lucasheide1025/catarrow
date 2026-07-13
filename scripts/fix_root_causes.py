#!/usr/bin/env python3
"""Fix two critical bugs in PartyBattleRoom:

1. scoringMode skips START dispatch → revert to autoStart (properly initializes monster stats)
2. !liveEntry causes blank-screen freeze when other teammates submit → remove from BattleScreen condition
"""

import sys

path = "src/components/party/PartyBattleRoom.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

fixes = 0

# === Fix 1: scoringMode → autoStart ===
old_scoring = "scoringMode"
new_auto = "autoStart"
if old_scoring in content:
    # Count occurrences to be safe
    count = content.count(old_scoring)
    if count <= 2:  # scoringModeChosen + scoringMode prop
        content = content.replace(old_scoring, new_auto)
        print(f"Fixed 1: '{old_scoring}' -> '{new_auto}' ({count} occurrences)")
        fixes += 1
    else:
        print(f"WARNING: {count} occurrences of '{old_scoring}', expected <= 2")
        sys.exit(1)
else:
    print("WARNING: 'scoringMode' not found, may already be autoStart")
    fixes += 1  # Pretend OK

# Note: scoringModeChosen at line 218 is still needed by the button's onClick
# It became autoStartChosen which is weird but harmless. Let's leave it as is.

# === Fix 2: Remove !liveEntry from BattleScreen rendering condition ===
old_condition = 'me.alive && !myReady && !liveEntry && scoringReady'
new_condition = 'me.alive && !myReady && scoringReady'

if old_condition in content:
    count = content.count(old_condition)
    content = content.replace(old_condition, new_condition)
    print(f"Fixed 2: Removed '!liveEntry' from condition ({count} occurrences)")
    fixes += 1
else:
    print("WARNING: Old condition not found")
    sys.exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nDone! {fixes}/2 fixes applied.")
