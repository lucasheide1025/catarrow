import re

with open('src/components/member/MonsterBattle.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize line endings
content = content.replace('\r\n', '\n')

# === Issue 2: Change initial phase from "archer_select" to "select" ===
content = content.replace(
    '  const [phase, setPhase]           = useState("archer_select");',
    '  const [phase, setPhase]           = useState("select");'
)

# === Issue 2: Remove the entire archer_select rendering block ===
# Find the archer_select block - it starts with `if (phase==="archer_select") {`
# and ends at the next top-level phase check
archer_select_start = content.find('\n  if (phase==="archer_select") {')
if archer_select_start >= 0:
    # Find the end - it's the next `if (phase===` or the `// ── 畫面 ──` comment
    next_phase = content.find('\n  if (phase==="select") {', archer_select_start + 1)
    if next_phase > archer_select_start:
        block = content[archer_select_start:next_phase]
        content = content.replace(block, '\n  // ═══ archer_select removed — avatar system replaces cat archer selection ═══')
        print(f"Removed archer_select block ({len(block)} chars)")
    else:
        print("ERROR: Could not find next phase marker")
else:
    print("ERROR: Could not find archer_select block")
    # Debug search
    idx = content.find('phase==="archer_select"')
    if idx >= 0:
        print(f"Found 'phase===\"archer_select\"' at index {idx}")
        print(repr(content[idx-20:idx+200]))
    else:
        print("Pattern 'phase===\"archer_select\"' not found")

# === Issue 3: Fix prebattle stats to include card bonus + level bonus ===
old_prebattle_stats = """              {archerStats&&(
            <div className="bg-white/10 rounded-xl p-3 mb-3">
              <div className="text-purple-200 text-xs mb-2 text-center">你的數值</div>
              <div className="flex justify-around text-sm">
                {[["HP",archerStats.hp],["ATK",archerStats.atk],["DEF",archerStats.def]].map(([k,v])=>(
                  <div key={k} className="text-center"><div className="text-purple-200 text-xs">{k}</div><div className="font-black">{v}</div></div>
                ))}
              </div>
            </div>
          )}"""

new_prebattle_stats = """              {archerStats&&(()=>{
                const _lvBon=isGuest?{hp:0,atk:0,def:0}:archerLevelBonus(archerLevelFromXP(profile?.archerXP||0));
                const _cardBonus=isGuest?{hp:0,atk:0,def:0}:calcEquippedBonus(resolveEquippedCards(cardColl));
                const _finalHp=archerStats.hp+_lvBon.hp+_cardBonus.hp;
                const _finalAtk=archerStats.atk+_lvBon.atk+_cardBonus.atk;
                const _finalDef=archerStats.def+_lvBon.def+_cardBonus.def;
                return (
            <div className="bg-white/10 rounded-xl p-3 mb-3">
              <div className="text-purple-200 text-xs mb-2 text-center">你的數值</div>
              <div className="flex justify-around text-sm">
                {[["HP",_finalHp],["ATK",_finalAtk],["DEF",_finalDef]].map(([k,v])=>(
                  <div key={k} className="text-center"><div className="text-purple-200 text-xs">{k}</div><div className="font-black">{v}</div></div>
                ))}
              </div>
              {(_cardBonus.hp+_cardBonus.atk+_cardBonus.def+_lvBon.hp+_lvBon.atk+_lvBon.def)>0&&(
                <div className="text-xs text-center text-purple-300 mt-1">🃏 {_cardBonus.hp+_cardBonus.atk+_cardBonus.def>0?`卡片加成+${_cardBonus.hp+_cardBonus.atk+_cardBonus.def}`:''}{_lvBon.hp+_lvBon.atk+_lvBon.def>0?`${_cardBonus.hp+_cardBonus.atk+_cardBonus.def>0?'  ':'●'}射手等級+${_lvBon.hp+_lvBon.atk+_lvBon.def}`:''}</div>
              )}
            </div>
                );
              })()}"""

if old_prebattle_stats in content:
    content = content.replace(old_prebattle_stats, new_prebattle_stats)
    print("Prebattle stats replaced successfully")
else:
    print("ERROR: Could not find prebattle stats block")
    idx = content.find('你的數值')
    if idx >= 0:
        print(f"Found '你的數值' at index {idx}")
        print(repr(content[idx-10:idx+300]))

# === Issue 2: Replace the "更換射手外觀" button to use avatar system ===
old_appearance_button = """          {/* 外觀更換 */}
          <button
            onClick={() => { setArcherSelectReturn("prebattle"); setPhase("archer_select"); }}
            className="w-full py-2 rounded-xl text-sm font-bold mb-1"
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            🎨 更換射手外觀（{CATS[archerStyle]?.name || "未選擇"}）
          </button>"""

new_appearance_button = """          {/* 外觀更換 - 使用大頭像 */}
          <button
            onClick={() => { if (typeof onImmersiveChange === 'function' && onImmersiveChange.toString().includes('||')){/* noop */ } if (onBack) onBack(); else onImmersiveChange?.(false); setTimeout(() => window.scrollTo(0,0), 50); }}
            className="w-full py-2 rounded-xl text-sm font-bold mb-1"
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            🎨 更換大頭像（可在「我的」頁面設定）
          </button>"""

# Actually this is getting complex. Let me just simplify the button to link to the profile page
old_appearance_button_simple = "🎨 更換射手外觀（{CATS[archerStyle]?.name || \"未選擇\"}）"
new_appearance_button_simple = "🎨 更換大頭像（可在「我的」頁面設定）"

if old_appearance_button in content:
    content = content.replace(old_appearance_button, new_appearance_button)
    print("Appearance button replaced successfully (full block)")
elif old_appearance_button_simple in content:
    content = content.replace(old_appearance_button_simple, new_appearance_button_simple)
    print("Appearance button text replaced successfully (simple)")
else:
    print("ERROR: Could not find appearance button")
    idx = content.find('更換射手外觀')
    if idx >= 0:
        print(f"Found '更換射手外觀' at index {idx}")
        print(repr(content[idx-10:idx+200]))
    else:
        print("Pattern '更換射手外觀' not found")

# Make sure the button onClick is updated too - find the full button context
old_button_onclick = 'onClick={() => { setArcherSelectReturn("prebattle"); setPhase("archer_select"); }}'
new_button_onclick = 'onClick={() => { import("../shared/PlayerAvatar").then(m => m.showAvatarPicker?.()); }}'

# Actually the simplest approach: make both replaces
content = content.replace(
    'onClick={() => { setArcherSelectReturn("prebattle"); setPhase("archer_select"); }}',
    'onClick={() => window.open("/member", "_self")}'
)

# Also remove the archerSelectReturn set if it's used in prebattle
content = content.replace(
    'setArcherSelectReturn("prebattle")',
    '/* removed: setArcherSelectReturn("prebattle") */'
)

with open('src/components/member/MonsterBattle.jsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("\nAll changes written to MonsterBattle.jsx")
