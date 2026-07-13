"""Add potions prop + onPotionUsed to MonsterBattle's BattleScreen usage"""
import sys

path = "src/components/member/MonsterBattle.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add availablePotions useMemo before the battle JSX
old_memo = '''          autoStart
          fullScreen
          renderMonster'''
new_memo = '''          autoStart
          fullScreen
          potions={availablePotions}
          onPotionUsed={(pid) => {
            setPotionInv(prev => ({ ...prev, [pid]: Math.max(0, (prev[pid] || 0) - 1) }));
            if (profile?.id && !isGuest) recordPotionUsed?.(profile.id, [pid]).catch(() => {});
          }}
          renderMonster'''

if old_memo in content:
    content = content.replace(old_memo, new_memo, 1)
    print("OK: added potions+onPotionUsed to BattleScreen")
else:
    print("ERROR: pattern not found for BattleScreen potions")
    sys.exit(1)

# 2. Add availablePotions useMemo before the battle return
# Find the `if (phase==="battle") {` block and add useMemo before it
old_compute = '''  if (phase==="battle") {
    // Use BattleScreen component instead of inline battle UI
    const playerCatId = archerStyle || (profile?.equippedCat?.catId) || CAT_IDS[0];
    return ('''

new_compute = '''  const availablePotions = useMemo(() => {
    const all = [...THROW_POTIONS, ...CARRY_POTIONS];
    return all.filter(p => (potionInv[p.id] || 0) > 0);
  }, [potionInv]);

  if (phase==="battle") {
    // Use BattleScreen component instead of inline battle UI
    const playerCatId = archerStyle || (profile?.equippedCat?.catId) || CAT_IDS[0];
    return ('''

if old_compute in content:
    content = content.replace(old_compute, new_compute, 1)
    print("OK: added availablePotions useMemo before battle phase")
else:
    print("ERROR: pattern not found for useMemo insertion")
    sys.exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("\nDone! MonsterBattle.jsx updated.")
