"""Replace useMemo with plain variable in MonsterBattle.jsx to fix missing import"""
path = "src/components/member/MonsterBattle.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '  const availablePotions = useMemo(() => {\n    const all = [...THROW_POTIONS, ...CARRY_POTIONS];\n    return all.filter(p => (potionInv[p.id] || 0) > 0);\n  }, [potionInv]);'
new = '  const availablePotions = [...THROW_POTIONS, ...CARRY_POTIONS].filter(p => (potionInv[p.id] || 0) > 0);'

if old in content:
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: replaced useMemo with plain variable")
else:
    print("ERROR: pattern not found")
    # Debug: show surrounding context
    idx = content.find("availablePotions")
    if idx >= 0:
        print("Found availablePotions:")
        print(repr(content[idx:idx+200]))
