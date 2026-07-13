import re

with open('src/components/member/MonsterBattle.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

# The exact prebattle stats block
old = """          {archerStats&&(
            <div className="bg-white/10 rounded-xl p-3 mb-3">
              <div className="text-purple-200 text-xs mb-2 text-center">你的數值</div>
              <div className="flex justify-around text-sm">
                {[["HP",archerStats.hp],["ATK",archerStats.atk],["DEF",archerStats.def]].map(([k,v])=>(
                  <div key={k} className="text-center"><div className="text-purple-200 text-xs">{k}</div><div className="font-black">{v}</div></div>
                ))}
              </div>
            </div>
          )}"""

new = """          {archerStats&&(()=>{
            const _lvBon=isGuest?{hp:0,atk:0,def:0}:archerLevelBonus(archerLevelFromXP(profile?.archerXP||0));
            const _cardBonus=isGuest?{hp:0,atk:0,def:0}:calcEquippedBonus(resolveEquippedCards(cardColl));
            const _fHp=archerStats.hp+_lvBon.hp+_cardBonus.hp;
            const _fAtk=archerStats.atk+_lvBon.atk+_cardBonus.atk;
            const _fDef=archerStats.def+_lvBon.def+_cardBonus.def;
            return (
            <div className="bg-white/10 rounded-xl p-3 mb-3">
              <div className="text-purple-200 text-xs mb-2 text-center">你的數值</div>
              <div className="flex justify-around text-sm">
                {[["HP",_fHp],["ATK",_fAtk],["DEF",_fDef]].map(([k,v])=>(
                  <div key={k} className="text-center"><div className="text-purple-200 text-xs">{k}</div><div className="font-black">{v}</div></div>
                ))}
              </div>
              {(_cardBonus.hp+_cardBonus.atk+_cardBonus.def+_lvBon.hp+_lvBon.atk+_lvBon.def)>0&&(
                <div className="text-xs text-center text-purple-300 mt-1">🃏 {_cardBonus.hp+_cardBonus.atk+_cardBonus.def>0?`卡片加成+${_cardBonus.hp+_cardBonus.atk+_cardBonus.def}`:''}{_lvBon.hp+_lvBon.atk+_lvBon.def>0?`${_cardBonus.hp+_cardBonus.atk+_cardBonus.def>0?'  ':'●'}射手等級+${_lvBon.hp+_lvBon.atk+_lvBon.def}`:''}</div>
              )}
            </div>
            );
          })()}"""

if old in content:
    content = content.replace(old, new)
    print("Prebattle stats replaced successfully")
else:
    print("ERROR: old string not found")
    # Show what's around "你的數值"
    idx = content.find('你的數值')
    if idx >= 0:
        start = max(0, idx - 50)
        end = min(len(content), idx + 300)
        print(f"Context around '你的數值' ({idx}):")
        print(repr(content[start:end]))
    else:
        print("'你的數值' not found at all")

with open('src/components/member/MonsterBattle.jsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Done")
