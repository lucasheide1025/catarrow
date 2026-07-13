import re

with open('src/components/party/PartyBattleRoom.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# 1. Add import for getCatStatMult
old_import = 'import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";'
new_import = 'import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";\nimport { getCatStatMult } from "../../lib/catData";'
content = content.replace(old_import, new_import)
print("1. Added getCatStatMult import")

# 2. Add catType and bondLv to useCatCompanion destructuring
old_destructure = 'const { catMsg, clearCatMsg, triggerCatAction, saveBond, hasCat, catId, catName, catATK } = useCatCompanion(guestOverride || null);'
new_destructure = 'const { catMsg, clearCatMsg, triggerCatAction, saveBond, hasCat, catId, catName, catType, bondLv, catATK } = useCatCompanion(guestOverride || null);'
content = content.replace(old_destructure, new_destructure)
print("2. Added catType, bondLv to destructuring")

# 3. Update getArcherStats function to include cat multiplier
# The function already has catMult parameter, we just need to compute it properly at call sites.
# Also, let's add a helper to compute the cat multiplier:
old_fn = """// 計算自己當前裝備的怪物卡片加成（從 ref 取最新值，不觸發 re-render）
  function getMyCardBonus() {
    return calcEquippedBonus(resolveEquippedCards(cardCollRef.current));
  }"""

new_fn = """// 計算自己當前裝備的怪物卡片加成（從 ref 取最新值，不觸發 re-render）
  function getMyCardBonus() {
    return calcEquippedBonus(resolveEquippedCards(cardCollRef.current));
  }

  // 計算貓貓羈絆加乘倍率（未裝備貓貓或羈絆 0 級回傳 1.0）
  function getMyCatMult() {
    if (!hasCat) return 1.0;
    const bondLevel = bondLv || 0;
    if (!bondLevel) return 1.0;
    return getCatStatMult(catType, bondLevel);
  }"""

content = content.replace(old_fn, new_fn)
print("3. Added getMyCatMult helper function")

# 4. Update waiting room stats write to include cat multiplier
old_waiting_call = """    const cardBonus = getMyCardBonus();
    const stats = getArcherStats(profile, [], cardBonus, 1.0);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def"""
new_waiting_call = """    const cardBonus = getMyCardBonus();
    const catMult = getMyCatMult();
    const stats = getArcherStats(profile, [], cardBonus, catMult);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def"""
# Use count= to replace both occurrences (waiting + active)
content = content.replace(old_waiting_call, new_waiting_call)
print("4. Updated waiting room stats write with catMult")

# 5. Update battle start stats write (second occurrence of the same pattern)
# The str_replace count approach should handle both, but let's verify
# Actually the second occurrence is slightly different - let me check
old_active_call = """    const cardBonus = getMyCardBonus();
    const stats = getArcherStats(profile, selectedPotions, cardBonus, 1.0);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def"""
# Replace with same catMult pattern
new_active_call = """    const cardBonus = getMyCardBonus();
    const catMult = getMyCatMult();
    const stats = getArcherStats(profile, selectedPotions, cardBonus, catMult);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def"""
content = content.replace(old_active_call, new_active_call)
print("5. Updated battle start stats write with catMult")

# 6. Also update the drawnMonsters effect (which also uses getArcherStats with 1.0)
old_drawn = """    const stats = getArcherStats(profile, [], getMyCardBonus(), 1.0);
    const power = calcArcherPower(stats);
    setDrawnMonsters(drawMatchedMonsters(power));"""
new_drawn = """    const stats = getArcherStats(profile, [], getMyCardBonus(), getMyCatMult());
    const power = calcArcherPower(stats);
    setDrawnMonsters(drawMatchedMonsters(power));"""
content = content.replace(old_drawn, new_drawn)
print("6. Updated drawnMonsters power calc with catMult")

# 7. Update handleRedrawMonsters
old_redraw = """  function handleRedrawMonsters() {
    const stats = getArcherStats(profile, [], getMyCardBonus(), 1.0);
    const power = calcArcherPower(stats);"""
new_redraw = """  function handleRedrawMonsters() {
    const stats = getArcherStats(profile, [], getMyCardBonus(), getMyCatMult());
    const power = calcArcherPower(stats);"""
content = content.replace(old_redraw, new_redraw)
print("7. Updated handleRedrawMonsters with catMult")

# 8. Update the myStats variable in the render (used for display)
old_mystats = """  const myStats  = getArcherStats(profile, [], getMyCardBonus(), 1.0);"""
new_mystats = """  const myStats  = getArcherStats(profile, [], getMyCardBonus(), getMyCatMult());"""
content = content.replace(old_mystats, new_mystats)
print("8. Updated myStats display with catMult")

with open('src/components/party/PartyBattleRoom.jsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("\nAll cat bond bonus changes applied!")
