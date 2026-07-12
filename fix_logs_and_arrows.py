with open('src/components/member/MonsterBattle.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add addRoundArrows after Archer XP section
old = '''      // Archer XP (non-guest)
      if (!isGuest && profile?.id) {
        const archerXP = MONSTER_TIER_XP[monster?.tier] || 5;
        setGainedArcherXP(archerXP);
        addArcherXP(profile.id, archerXP).catch(() => {});
        const catXP = hasCat ? (CAT_TIER_XP[monster?.tier] || 5) : 0;
        setGainedCatXP(catXP);
      }'''

new = '''      // Archer XP (non-guest) + lifetime arrow tracking
      if (!isGuest && profile?.id) {
        const archerXP = MONSTER_TIER_XP[monster?.tier] || 5;
        setGainedArcherXP(archerXP);
        addArcherXP(profile.id, archerXP).catch(() => {});
        const catXP = hasCat ? (CAT_TIER_XP[monster?.tier] || 5) : 0;
        setGainedCatXP(catXP);
        addRoundArrows(profile.id, arrowsPerRound).catch(() => {});
      }'''

if old in content:
    content = content.replace(old, new, 1)
    print("Added addRoundArrows")
else:
    print("WARNING: Could not find Archer XP section for addRoundArrows")

# Add practice log after monster log
old2 = '''      // Quest kill callback
      if (questContext?.monsterId === monster?.id && onKillForQuest) onKillForQuest(monster?.id);'''

new2 = '''      // Practice log (minimal, since BattleScreen doesn't expose scores)
      if (profile?.id && !isGuest) {
        addPracticeLog(profile.id, {
          date: new Date().toISOString().slice(0, 10),
          source: "monster",
          monsterName: monster?.name, monsterTier: monster?.tier, mode, battleMode, result: "win",
          equipment: Array.isArray(profile?.equipment) && profile?.equipment[0]?.label
            ? profile.equipment[0].label : "打怪練習",
          rounds: [], total: 0, totalArrows: arrowsPerRound,
        }, profile.id).catch(() => {});
      }

      // Quest kill callback
      if (questContext?.monsterId === monster?.id && onKillForQuest) onKillForQuest(monster?.id);'''

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Added practice log")
else:
    print("WARNING: Could not find Quest kill callback section for practice log")

# Add practice log for lose path too
old3 = '''    } else {
      playBattleSound("soft_fail", { monsterName: monster?.name, playerName: profile?.name, round });
      setPhase("result");
    }'''

new3 = '''    } else {
      playBattleSound("soft_fail", { monsterName: monster?.name, playerName: profile?.name, round });
      // Practice log for loss (minimal)
      if (profile?.id && !isGuest) {
        addPracticeLog(profile.id, {
          date: new Date().toISOString().slice(0, 10),
          source: "monster",
          monsterName: monster?.name, monsterTier: monster?.tier, mode, battleMode, result: "lose",
          equipment: Array.isArray(profile?.equipment) && profile?.equipment[0]?.label
            ? profile.equipment[0].label : "打怪練習",
          rounds: [], total: 0, totalArrows: arrowsPerRound,
        }, profile.id).catch(() => {});
        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "lose", rounds: round,
          mode, battleMode, materials: [], roundScores: [],
        }).catch(() => {});
      }
      setPhase("result");
    }'''

if old3 in content:
    content = content.replace(old3, new3, 1)
    print("Added lose path logs")
else:
    print("WARNING: Could not find setPhase result for lose path")

with open('src/components/member/MonsterBattle.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("File saved")
