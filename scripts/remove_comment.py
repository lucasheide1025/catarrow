#!/usr/bin/env python3
"""Remove the unnecessary comment about potionSubTab being dead code."""

import sys

path = "src/components/party/PartyBattleRoom.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = "  // (removed potionSubTab — dead code)\n"
if old in content:
    content = content.replace(old, "")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Comment removed.")
else:
    print("Comment not found — already removed?")
    sys.exit(0)
