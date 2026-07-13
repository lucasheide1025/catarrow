import re

with open('src/components/party/PartyBattleRoom.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize to \n
content = content.replace('\r\n', '\n')

# 1. statsWaitingRef -> statsWaitingVersionRef
content = content.replace(
    "  const statsWrittenRef   = useRef(false); // 戰鬥中寫入\n  const statsWaitingRef   = useRef(false); // 等待室寫入",
    "  const statsWrittenRef   = useRef(false); // 戰鬥中寫入\n  const statsWaitingVersionRef = useRef(-1); // 等待室最後寫入的 cardCollectionVersion"
)

# 2. Add comment to subscription
content = content.replace(
    "    return subscribeCardCollection(myId, data => { cardCollRef.current = data; setCardCollectionVersion(version => version + 1); });",
    "    // cardCollectionVersion written in waiting room stats effect deps; ensures card data loaded before stats write.\n    return subscribeCardCollection(myId, data => { cardCollRef.current = data; setCardCollectionVersion(v => v + 1); });"
)

# 3. Reset statsWaitingVersionRef in reset effect
content = content.replace(
    "    statsWrittenRef.current  = false;\n    statsWaitingRef.current  = false;",
    "    statsWrittenRef.current  = false;\n    statsWaitingVersionRef.current = -1;"
)

# 4. Fix waiting room stats write effect
old_waiting_effect = """  // 等待室就先寫入真實數值（讓所有人看到彼此的數值）
  useEffect(() => {
    if (!room || !myId || room.status !== "waiting" || statsWaitingRef.current) return;
    const me = room.members?.[myId];
    if (!me) return;
    statsWaitingRef.current = true;
    const cardBonus = getMyCardBonus();
    const stats = getArcherStats(profile, [], cardBonus, 1.0);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def, localStorage.getItem("mb_archer_style") || "", hasCat ? (catATK || 0) : 0, hasCat ? (catName || "") : "", hasCat ? (catId || "") : "", profile?.avatarId || "",
      { dmgBonusPct: cardBonus.dmgBonusPct || 0, dmgReducePct: cardBonus.dmgReducePct || 0, healBonusPct: cardBonus.healBonusPct || 0 }, profile?.nickname || profile?.name || "射手", archerLevelFromXP(profile?.archerXP || 0), getBattleCosmetics(profile, cardCollRef.current));
  }, [room?.status, myId]); // eslint-disable-line"""

new_waiting_effect = """  // 等待室就先寫入真實數值（讓所有人看到彼此的數值）
  // 需要等 cardCollectionVersion > 0 確保卡片資料已載入，才能寫入正確的卡片加成。
  // statsWaitingVersionRef 記錄已寫入的版本，避免同一版本重複寫入。
  useEffect(() => {
    if (!room || !myId || room.status !== "waiting") return;
    if (!isGuestMode && cardCollectionVersion === 0) return; // 卡片資料尚未載入
    if (statsWaitingVersionRef.current === cardCollectionVersion) return;
    const me = room.members?.[myId];
    if (!me) return;
    statsWaitingVersionRef.current = cardCollectionVersion;
    const cardBonus = getMyCardBonus();
    const stats = getArcherStats(profile, [], cardBonus, 1.0);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def, localStorage.getItem("mb_archer_style") || "", hasCat ? (catATK || 0) : 0, hasCat ? (catName || "") : "", hasCat ? (catId || "") : "", profile?.avatarId || "",
      { dmgBonusPct: cardBonus.dmgBonusPct || 0, dmgReducePct: cardBonus.dmgReducePct || 0, healBonusPct: cardBonus.healBonusPct || 0 }, profile?.nickname || profile?.name || "射手", archerLevelFromXP(profile?.archerXP || 0), getBattleCosmetics(profile, cardCollRef.current));
  }, [room?.status, myId, cardCollectionVersion, isGuestMode]); // eslint-disable-line"""

if old_waiting_effect in content:
    content = content.replace(old_waiting_effect, new_waiting_effect)
    print("Waiting room effect replaced successfully")
else:
    print("ERROR: Could not find waiting room effect to replace")
    # Debug: find where "等待室就先寫入真實數值" is
    idx = content.find("等待室就先寫入真實數值")
    if idx >= 0:
        print(f"Found at index {idx}")
        print(repr(content[idx:idx+500]))
    else:
        print("Not found at all")

with open('src/components/party/PartyBattleRoom.jsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Done")
