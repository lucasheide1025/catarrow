#!/usr/bin/env python3
"""Remove dead code in PartyBattleRoom.jsx: BattleBottomBar import + 3 unused states."""

import re

path = "src/components/party/PartyBattleRoom.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1) Remove import BattleBottomBar line
content = content.replace(
    "import BattleBottomBar from \"../member/BattleBottomBar\";\n",
    ""
)

# 2) Remove bottomTab state line
content = content.replace(
    "  const [bottomTab, setBottomTab] = useState(\"score\");\n",
    ""
)

# 3) Remove potionSubTab state line
content = content.replace(
    "  const [potionSubTab, setPotionSubTab] = useState(\"carry\");\n",
    "  // (removed potionSubTab — dead code)\n"
)

# 4) Remove potionUsedThisRound state line
content = content.replace(
    "  const [potionUsedThisRound, setPotionUsedThisRound] = useState(false);\n",
    ""
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Dead code removed successfully!")
