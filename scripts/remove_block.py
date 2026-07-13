#!/usr/bin/env python3
"""Remove the duplicate BattleScreen block from PartyBattleRoom.jsx by line range."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

path = "src/components/party/PartyBattleRoom.jsx"

with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Remove lines 1889-1940 (0-indexed: 1888 to 1940)
# Line 1889 is the comment line before the duplicate BattleScreen
# Line 1940 is the closing of the BattleScreen block

# Check what we're about to remove
print(f"Lines 1889-1891: {repr(lines[1888:1891])}")
print(f"Lines 1939-1941: {repr(lines[1938:1941])}")

# Find the actual range - look for the comment marker
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if "BattleScreen 計分模式" in line:
        start_idx = i
        print(f"Found comment at line {i+1}")
    if start_idx is not None and i > start_idx:
        # Look for the closing )} after the BattleScreen block
        if line.strip() == ")}" and i > start_idx + 40:
            end_idx = i + 1  # include this line
            print(f"Found closing at line {i+1}")
            break

if start_idx is not None and end_idx is not None:
    # Remove the block
    new_lines = lines[:start_idx] + lines[end_idx:]
    print(f"Removed lines {start_idx+1} to {end_idx} ({end_idx - start_idx} lines)")
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("✅ Done")
else:
    print(f"❌ Could not find block boundaries. start={start_idx}, end={end_idx}")
