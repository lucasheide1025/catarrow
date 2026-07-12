with open('src/components/member/MonsterBattle.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Hoist chestType variable before guest/member branch
old = '''      if (isGuest || !profile?.id) {
        // Guest path'''
new = '''      let chestType = "wood";
      if (isGuest || !profile?.id) {
        // Guest path'''

if old in content:
    content = content.replace(old, new, 1)
    print("Added chestType hoisting")
else:
    print("WARNING: chestType hoisting failed")

# Fix 2: Update chestType inside member path when mainChest is available
old2 = '''        const { mainChest, potionChest } = makeChests(monster, mode);
        const mainChests = [mainChest, potionChest].filter(Boolean);
        setWonChests(mainChests);'''
new2 = '''        const { mainChest, potionChest } = makeChests(monster, mode);
        const mainChests = [mainChest, potionChest].filter(Boolean);
        setWonChests(mainChests);
        chestType = mainChest?.type || "wood";'''

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Updated chestType from mainChest")
else:
    print("WARNING: chestType update failed")

# Fix 3: Use chestType variable in saveMonsterLog
old3 = '''        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "win", rounds: round,
          mode, battleMode, chestType: "wood", roundScores: [],
        }).catch(() => {});'''
new3 = '''        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "win", rounds: round,
          mode, battleMode, chestType, roundScores: [],
        }).catch(() => {});'''

if old3 in content:
    content = content.replace(old3, new3, 1)
    print("Fixed saveMonsterLog chestType")
else:
    print("WARNING: saveMonsterLog chestType fix failed")

# Fix 4: Add bowType/distance/targetFmt to win practice log
old4 = '''      // Practice log (minimal, since BattleScreen doesn't expose scores)
      if (profile?.id && !isGuest) {
        addPracticeLog(profile.id, {
          date: new Date().toISOString().slice(0, 10),
          source: "monster",
          monsterName: monster?.name, monsterTier: monster?.tier, mode, battleMode, result: "win",
          equipment: Array.isArray(profile?.equipment) && profile?.equipment[0]?.label
            ? profile.equipment[0].label : "\u6253\u602a\u7df4\u7fd2",
          rounds: [], total: 0, totalArrows: arrowsPerRound,
        }, profile.id).catch(() => {});
      }'''
new4 = '''      // Practice log (minimal, since BattleScreen doesn't expose scores)
      if (profile?.id && !isGuest) {
        const sp = shootingProfileRef.current;
        addPracticeLog(profile.id, {
          date: new Date().toISOString().slice(0, 10),
          source: "monster",
          monsterName: monster?.name, monsterTier: monster?.tier, mode, battleMode, result: "win",
          equipment: Array.isArray(profile?.equipment) && profile?.equipment[0]?.label
            ? profile.equipment[0].label : "\u6253\u602a\u7df4\u7fd2",
          rounds: [], total: 0, totalArrows: arrowsPerRound,
          bowType: sp?.bowType || "",
          distance: sp?.distance || 0,
          battleDistance: selectedDistance,
          targetFormat: targetFmt,
          inputMode: "button",
        }, profile.id).catch(() => {});
      }'''

if old4 in content:
    content = content.replace(old4, new4, 1)
    print("Updated win practice log with bowType/distance")
else:
    print("WARNING: win practice log fix failed")

# Fix 5: Add bowType/distance to lose practice log
old5 = '''          equipment: Array.isArray(profile?.equipment) && profile?.equipment[0]?.label
            ? profile.equipment[0].label : "\u6253\u602a\u7df4\u7fd2",
          rounds: [], total: 0, totalArrows: arrowsPerRound,
        }, profile.id).catch(() => {});
        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "lose", rounds: round,'''
new5 = '''          equipment: Array.isArray(profile?.equipment) && profile?.equipment[0]?.label
            ? profile.equipment[0].label : "\u6253\u602a\u7df4\u7fd2",
          rounds: [], total: 0, totalArrows: arrowsPerRound,
          bowType: sp?.bowType || "",
          distance: sp?.distance || 0,
          battleDistance: selectedDistance,
          targetFormat: targetFmt,
          inputMode: "button",
        }, profile.id).catch(() => {});
        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "lose", rounds: round,''' 

if old5 in content:
    # Need to add sp declaration before the lose practice log
    # Find the lose practice log and add sp ref
    content = content.replace(old5, new5, 1)
    print("Updated lose practice log with bowType/distance")
else:
    print("WARNING: lose practice log fix failed")

# Fix 6: Add `const sp = shootingProfileRef.current;` before the lose practice log
# Since we already have "sp" in scope from the win path, and both are in the same function,
# we need to check if sp is available. Actually the lose path is in a separate `else` block,
# so sp isn't in scope. Let me add it.
old6 = '''     playBattleSound("soft_fail", { monsterName: monster?.name, playerName: profile?.name, round });
      // Practice log for loss (minimal)
      if (profile?.id && !isGuest) {
        addPracticeLog(profile.id, {'''
new6 = '''     playBattleSound("soft_fail", { monsterName: monster?.name, playerName: profile?.name, round });
      // Practice log for loss (minimal)
      if (profile?.id && !isGuest) {
        const sp = shootingProfileRef.current;
        addPracticeLog(profile.id, {'''

if old6 in content:
    content = content.replace(old6, new6, 1)
    print("Added shootingProfileRef to lose path")
else:
    print("WARNING: lose path sp ref failed")

with open('src/components/member/MonsterBattle.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("All fixes saved to file")
