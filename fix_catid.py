import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/member/MonsterBattle.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: add catId to useCatCompanion destructuring
old = 'const { hasCat, catName, catMsg, clearCatMsg, triggerCatAction, saveBond, saveXP, calcCatRoundDamage, triggerCatSkill, catHP: catMaxHP, catDEF: catBaseDEF } = useCatCompanion(isGuest ? profile : null);'
new = 'const { hasCat, catName, catId, catMsg, clearCatMsg, triggerCatAction, saveBond, saveXP, calcCatRoundDamage, triggerCatSkill, catHP: catMaxHP, catDEF: catBaseDEF } = useCatCompanion(isGuest ? profile : null);'

if old in content:
    content = content.replace(old, new, 1)
    with open('src/components/member/MonsterBattle.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("[OK] Added catId to useCatCompanion destructuring")
else:
    print("[WARN] Pattern not found - checking for alternatives")
    # Check if catId already exists
    idx = content.find('catName, catMsg')
    if idx >= 0:
        line_no = content[:idx].count('\n') + 1
        print(f"Found at line {line_no}")
        # Show surrounding context
        lines = content.split('\n')
        for i in range(max(0, line_no-2), min(len(lines), line_no+2)):
            marker = ">>>" if i+1 == line_no else "   "
            print(f"{marker} {i+1}: {lines[i][:100]}")
    # Check if catId is already there
    if 'catName, catId,' in content:
        print("catId already present!")
