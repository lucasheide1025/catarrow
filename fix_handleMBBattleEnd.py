import re

with open('src/components/member/MonsterBattle.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the old handleMBBattleEnd function
old_pattern = r'  // BattleScreen callback: handle battle end -> loot/result\n  function handleMBBattleEnd\(result\) \{\n    if \(result === "won"\) \{\n      playBattleSound\("monster_death", \{ monsterName: monster\?\.name \}\);\n      setTimeout\(\(\) => playBattleSound\("victory_cheer", \{\}\), 600\);\n      const tierMap = \{ common:5, rare:10, elite:20, fierce:35, boss:50, mythic:80 \};\n      const coins = tierMap\[monster\?\.tier\] \|\| 10;\n      setDroppedCoins\(coins\);\n      setPhase\("monster_die"\);\n    \} else \{\n      playBattleSound\("soft_fail", \{ monsterName: monster\?\.name, playerName: profile\?\.name, round \}\);\n      setPhase\("result"\);\n    \}\n  \}'

# Simpler approach: find by exact substring
old_block = '''  // BattleScreen callback: handle battle end -> loot/result
  function handleMBBattleEnd(result) {
    if (result === "won") {
      playBattleSound("monster_death", { monsterName: monster?.name });
      setTimeout(() => playBattleSound("victory_cheer", {}), 600);
      const tierMap = { common:5, rare:10, elite:20, fierce:35, boss:50, mythic:80 };
      const coins = tierMap[monster?.tier] || 10;
      setDroppedCoins(coins);
      setPhase("monster_die");
    } else {
      playBattleSound("soft_fail", { monsterName: monster?.name, playerName: profile?.name, round });
      setPhase("result");
    }
  }'''

new_block = '''  // BattleScreen callback: handle battle end -> full loot/XP/rewards
  function handleMBBattleEnd(result) {
    if (result === "won") {
      playBattleSound("monster_death", { monsterName: monster?.name });
      setTimeout(() => playBattleSound("victory_cheer", {}), 600);

      if (isGuest || !profile?.id) {
        // Guest path
        const wonBefore = sessionStorage.getItem("guest_won_once");
        if (!wonBefore) {
          const guestLootItem = drawLoot(LOOT_TABLE_GUEST, monster?.id, monster?.tier);
          setLoot(guestLootItem);
          sessionStorage.setItem("guest_won_once", "1");
        } else {
          setLoot(null);
          setGuestWonBefore(true);
        }
        setWonChests([]);

        const mats = rollMaterialDrops(monster)
          .filter(m => !m.id?.startsWith("frag_"))
          .slice(0, 1);
        setDroppedMaterials(mats);
        if (profile?.id && mats.length > 0) {
          addMaterials(profile.id, mats).catch(() => {});
        }

        const baseCoins = rollCoins(monster?.tier, mode);
        const boost = parseFloat(sessionStorage.getItem("guest_coin_boost") || "1");
        const total = Math.max(1, Math.round(baseCoins * boost));
        sessionStorage.removeItem("guest_coin_boost");
        setDroppedCoins(total);
        if (profile?.id) {
          addCoins(profile.id, total).catch(() => {});
        } else {
          const prev = parseInt(sessionStorage.getItem("guest_coins") || "0", 10);
          sessionStorage.setItem("guest_coins", String(prev + total));
        }
      } else {
        // Full member rewards
        const { mainChest, potionChest } = makeChests(monster, mode);
        const mainChests = [mainChest, potionChest].filter(Boolean);
        setWonChests(mainChests);

        // Materials
        const matMult = (mode === "veteran" || mode === "match") ? 2 : 1;
        const mats = (mode === "novice"
          ? rollMaterialDrops(monster)
          : rollMaterialDropsGuaranteed(monster, matMult)
        ).filter(m => !m.id?.startsWith("frag_"));
        setDroppedMaterials(mats);
        if (mats.length > 0) {
          addMaterials(profile.id, mats).catch(() => {});
        }

        // Coins + coin chest
        const baseCoins = rollCoins(monster?.tier, mode);
        const coinChestChance = COIN_CHEST_CHANCE_BY_MODE[mode] ?? 0.5;
        const coinChest = Math.random() < coinChestChance ? makeCoinChest(monster?.tier, "\u6253\u602a\u6389\u843d") : null;
        setDroppedCoins(baseCoins);
        if (coinChest) setDroppedCoinChest(coinChest);
        addCoins(profile.id, baseCoins).catch(() => {});
        addChests(profile.id, [...mainChests, ...(coinChest ? [coinChest] : [])]).catch(() => {});

        // Monster card
        const card = rollCardDrop(monster);
        if (card) {
          setDroppedCard(card);
          addMonsterCard(profile.id, card).catch(() => {});
        }
      }

      // Archer XP (non-guest)
      if (!isGuest && profile?.id) {
        const archerXP = MONSTER_TIER_XP[monster?.tier] || 5;
        setGainedArcherXP(archerXP);
        addArcherXP(profile.id, archerXP).catch(() => {});
        const catXP = hasCat ? (CAT_TIER_XP[monster?.tier] || 5) : 0;
        setGainedCatXP(catXP);
      }

      // Cat bond + XP (non-guest)
      if (!isGuest) {
        saveBond("monster");
        saveXP(CAT_TIER_XP[monster?.tier] || 5).catch(() => {});
      }

      // Monster log
      if (profile?.id) {
        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "win", rounds: round,
          mode, battleMode, chestType: "wood", roundScores: [],
        }).catch(() => {});
      }

      // Quest kill callback
      if (questContext?.monsterId === monster?.id && onKillForQuest) onKillForQuest(monster?.id);

      // Milestone check (fire-and-forget)
      if (profile?.id && !isGuest) {
        import("../../lib/db").then(mod => {
          mod.checkAndGrantArrowMilestones(profile.id, arrowsPerRound).then(res => {
            if (res.milestones.length > 0) {
              setMilestoneQueue(res.milestones.map(ms => ({ ms, rewards: getRewardsForMilestone(ms) })));
            }
          }).catch(() => {});
        }).catch(() => {});
      }

      setPhase("monster_die");
    } else {
      playBattleSound("soft_fail", { monsterName: monster?.name, playerName: profile?.name, round });
      setPhase("result");
    }
  }'''

if old_block in content:
    print("Found exact old block!")
    content = content.replace(old_block, new_block, 1)
    with open('src/components/member/MonsterBattle.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replacement done!")
else:
    print("Old block not found. Checking for partial match...")
    # Try to find just the function signature
    idx = content.find('function handleMBBattleEnd(result)')
    if idx >= 0:
        line_no = content[:idx].count('\n') + 1
        print(f"Found handleMBBattleEnd at line {line_no}")
        # Show the old lines around it
        lines = content.split('\n')
        for i in range(max(0, line_no-2), min(len(lines), line_no+15)):
            marker = ">>>" if i+1 >= line_no and i+1 < line_no+13 else "   "
            print(f"{marker} {i+1}: {lines[i]}")
    else:
        print("handleMBBattleEnd not found at all!")
