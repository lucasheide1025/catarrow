"""Remove all zombie references from MonsterBattle.jsx"""
import sys

path = "src/components/member/MonsterBattle.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    # 1. Start log label (line ~862)
    ('battleMode==="zombie"?"殭屍靶紙":"分數靶紙"', '"分數靶紙"'),
    # 2. bmLabel (line ~1339)
    ('const bmLabel   = battleMode==="zombie"?"🧟殭屍":"🎯分數";', 'const bmLabel   = "🎯分數";'),
    # 3. Event config display (line ~1401)
    ('ec.battleMode === "zombie" ? "🧟 殭屍靶" : "🎯 分數靶"', '"🎯 分數靶"'),
    # 4. Remove zombie selection button (lines ~1469-1479)
    ('''        <button onClick={()=>{ setBattleMode("zombie"); setPhase("difficulty"); }}
          className="rounded-2xl p-5 text-left border-2 border-purple-500/40 bg-purple-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🧟 殭屍靶紙模式</div>
          <div className="font-black text-white mb-1">分數決定命中部位，觸發部位加成</div>
          <div className="text-slate-400 text-sm">高分命中頭部/心臟，傷害爆表！解鎖器官部位增加趣味。</div>
        </button>''', ''),
    # 5. Event mode battle mode display (line ~1518)
    ('eventConfig.battleMode === "zombie" ? "🧟 殭屍靶" : "🎯 分數靶"', '"🎯 分數靶"'),
    # 6. Prebattle battle mode display (line ~1682)
    ('battleMode==="zombie"?"🧟 殭屍靶紙":"🎯 分數靶紙"', '"🎯 分數靶紙"'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"  OK #{count}")
    else:
        print(f"  NOT FOUND #{count}")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\nApplied {count}/{len(replacements)} replacements")
sys.exit(0 if count == len(replacements) else 1)
