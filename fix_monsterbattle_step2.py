# fix_monsterbattle_step2.py
# Re-applies BattleScreen integration to MonsterBattle.jsx
# Written as a Python script for precise control over large file modifications

import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

FILEPATH = 'src/components/member/MonsterBattle.jsx'

with open(FILEPATH, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

changes = 0

# ──────────────────────────────────────────────
# 1. ADD IMPORTS for BattleScreen + battleSound + battleAssets
# ──────────────────────────────────────────────

# Find the last import line and add our imports after it
# The import section ends with imports like:
#   import { BattleResultPanel, RESULT_CONFIG_SOLO } from "../shared/BattleResultPanel";
# We'll add BattleScreen import after the existing battle imports

import_patterns = [
    # Add BattleScreen import
    ('from "../shared/BattleResultPanel"', 
     'from "../shared/BattleResultPanel";\nimport BattleScreen from "../battle/BattleScreen";\nimport { playBattleSound } from "../../lib/battleSound";\nimport BattleSoundIndicator from "../shared/BattleSoundIndicator";\nimport { getBattleBackgroundUrl } from "../../lib/battleAssets";'),
]

for old, new in import_patterns:
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
        print(f"✅ Added BattleScreen/battleSound/battleAssets imports after '{old}'")
    else:
        print(f"⚠️  Pattern '{old}' not found - imports may already exist")

# Also add the aliased import for labelToValue if not present
# The alias line should be near line 68
if 'import BattleScreen' not in content:
    # Find the backward compatibility aliases section
    alias_section = "// 向後相容 alias"
    if alias_section in content:
        # Add BattleScreen import before the aliases
        new_imports = '\nimport BattleScreen from "../battle/BattleScreen";\nimport { playBattleSound } from "../../lib/battleSound";\nimport BattleSoundIndicator from "../shared/BattleSoundIndicator";\nimport { getBattleBackgroundUrl } from "../../lib/battleAssets";\n'
        old_section = f"{alias_section}"
        content = content.replace(old_section, new_imports + old_section, 1)
        changes += 1
        print(f"✅ Added BattleScreen imports before alias section")

# ──────────────────────────────────────────────
# 2. REPLACE pickBg function
# ──────────────────────────────────────────────

old_pickbg = """function pickBg(family) {
  const imgs = [
    '/ui/battle-bg/bg_'+family+'_1.webp',
    '/ui/battle-bg/bg_'+family+'_2.webp',
    '/ui/battle-bg/bg_'+family+'_3.webp',
    '/ui/battle-bg/bg_'+family+'_4.webp',
    '/ui/battle-bg/bg_'+family+'_5.webp',
    '/ui/battle-bg/bg_'+family+'_6.webp',
  ];
  return imgs[Math.floor(Math.random()*imgs.length)] || '/ui/dungeon-bg.webp';
}"""

new_pickbg = """function pickBg(family) {
  return getBattleBackgroundUrl(family);
}"""

if old_pickbg in content:
    content = content.replace(old_pickbg, new_pickbg, 1)
    changes += 1
    print(f"✅ Replaced pickBg function")
else:
    # Try alternative pattern
    alt_pickbg = "function pickBg(family)"
    if alt_pickbg in content:
        print(f"⚠️  pickBg found but pattern doesn't match exactly - checking...")
        idx = content.find(alt_pickbg)
        end_idx = content.find('\n}', idx) + 2
        actual = content[idx:end_idx]
        print(f"   Actual: {actual[:60]}...")
        # Replace whatever is there with the new version
        # Find the end of the function: next line after }
        start = idx
        # Find closing of function
        brace_count = 0
        found_open = False
        end_pos = start
        for i, ch in enumerate(content[start:], start):
            if ch == '{':
                brace_count += 1
                found_open = True
            elif ch == '}':
                brace_count -= 1
                if found_open and brace_count == 0:
                    end_pos = i + 1
                    break
        
        old_func = content[start:end_pos]
        content = content.replace(old_func, new_pickbg, 1)
        changes += 1
        print(f"✅ Replaced pickBg function (alternative match)")

# ──────────────────────────────────────────────
# 3. ADD catId to useCatCompanion destructuring
# ──────────────────────────────────────────────

old_cat = 'const { hasCat, catName, catMsg, clearCatMsg, triggerCatAction, saveBond, saveXP, calcCatRoundDamage, triggerCatSkill, catHP: catMaxHP, catDEF: catBaseDEF } = useCatCompanion(isGuest ? profile : null);'
new_cat = 'const { hasCat, catName, catId, catMsg, clearCatMsg, triggerCatAction, saveBond, saveXP, calcCatRoundDamage, triggerCatSkill, catHP: catMaxHP, catDEF: catBaseDEF } = useCatCompanion(isGuest ? profile : null);'

if old_cat in content:
    content = content.replace(old_cat, new_cat, 1)
    changes += 1
    print(f"✅ Added catId to useCatCompanion destructuring")
else:
    print(f"⚠️  cat destructuring pattern not found - catId may already be there")

# ──────────────────────────────────────────────
# 4. REPLACE battle phase (lines 1801-2191) with BattleScreen
# ──────────────────────────────────────────────

# The battle phase starts with:   if (phase==="battle") {
# And ends with:   }  (the closing of the if block at line 2191)
# Next phase:   if (phase==="loot") at line 2193

# Find the battle phase boundaries
battle_start = "  if (phase===\"battle\") {\n    const maxHP = (battleStats||archerStats)?.hp||100;"
battle_end_next = "\n  if (phase===\"loot\") {"

if battle_start in content and battle_end_next in content:
    # Find the exact start and end
    start_idx = content.find(battle_start)
    end_idx = content.find(battle_end_next)
    
    # The battle phase ends at the } before loot phase
    # We need to find the closing } at line 2191
    # Look backwards from loot phase start to find the matching }
    before_loot = content[start_idx:end_idx]
    
    # Count braces to find the matching close
    brace_count = 0
    close_idx = 0
    for i, ch in enumerate(before_loot):
        if ch == '{':
            brace_count += 1
        elif ch == '}':
            brace_count -= 1
            if brace_count == 0:
                close_idx = i
                break
    
    # The battle phase is from start_idx to start_idx + close_idx + 1
    old_battle = content[start_idx:start_idx + close_idx + 1]
    
    new_battle = """  if (phase==="battle") {
    // Use BattleScreen component instead of inline battle UI
    const playerCatId = archerStyle || (profile?.equippedCat?.catId) || CAT_IDS[0];
    return (
      <div style={{ height:"100dvh", display:"flex", flexDirection:"column", background:"#0f172a", color:"white", fontFamily:"sans-serif" }}>
        <style>{BATTLE_CSS}</style>
        <BattleScreen
          player={{
            name: profile?.name || "射手",
            catId: playerCatId,
            hp: (battleStats||archerStats)?.hp || 100,
            maxHp: (battleStats||archerStats)?.hp || 100,
            atk: (battleStats||archerStats)?.atk || 10,
            def: (battleStats||archerStats)?.def || 10,
            lv: typeof archerLevelFromXP === 'function' ? archerLevelFromXP(profile?.archerXP || 0) : 0,
          }}
          monster={{
            id: monster?.id,
            name: monster?.name,
            family: monster?.family,
            hp: monsterHP,
            maxHp: monster?.hp || monsterHP,
            atk: monster?.atk || 0,
            def: monster?.def || 0,
            color: monster?.color,
            tier: monster?.tier,
          }}
          battleMode={battleMode}
          difficulty={{hp:1, atk:1, def:1}}
          arrowsPerRound={arrowsPerRound}
          allies={[]}
          cat={hasCat ? { catId, catName, type: "allround", catXP: 0, bond: 0 } : null}
          bgImage={battleBg}
          onBattleEnd={handleMBBattleEnd}
          autoStart
        />
      </div>
    );
  }"""
    
    content = content.replace(old_battle, new_battle, 1)
    changes += 1
    print(f"✅ Replaced battle phase with BattleScreen component")
else:
    print(f"⚠️  Battle phase boundaries not found")

# ──────────────────────────────────────────────
# 5. ADD handleMBBattleEnd function before component close
# ──────────────────────────────────────────────

# Component ends with:
#   return null;
# }

handle_mb_battle_end = """
  // BattleScreen callback: handle battle end -> full loot/XP/rewards
  function handleMBBattleEnd(result) {
    if (result === "won") {
      playBattleSound("monster_death", { monsterName: monster?.name });
      setTimeout(() => playBattleSound("victory_cheer", {}), 600);

      // Guest vs member rewards
      if (isGuest || !profile?.id) {
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
      } else {
        const { mainChest, potionChest } = makeChests(monster, mode);
        const mainChests = [mainChest, potionChest].filter(Boolean);
        setWonChests(mainChests);
        addChests(profile.id, [...mainChests]).catch(() => {});
      }

      // Materials + coins
      if (!isGuest && profile?.id) {
        const mats = (mode === "novice"
          ? rollMaterialDrops(monster)
          : rollMaterialDropsGuaranteed(monster, (mode === "veteran" || mode === "match") ? 2 : 1)
        ).filter(m => !m.id?.startsWith("frag_"));
        setDroppedMaterials(mats);
        if (mats.length > 0) addMaterials(profile.id, mats).catch(() => {});

        const baseCoins = rollCoins(monster?.tier, mode);
        setDroppedCoins(baseCoins);
        addCoins(profile.id, baseCoins).catch(() => {});

        const card = rollCardDrop(monster);
        if (card) {
          setDroppedCard(card);
          addMonsterCard(profile.id, card).catch(() => {});
        }
      } else if (isGuest || profile?.id) {
        const mats = rollMaterialDrops(monster).filter(m => !m.id?.startsWith("frag_")).slice(0, 1);
        setDroppedMaterials(mats);
        if (profile?.id && mats.length > 0) addMaterials(profile.id, mats).catch(() => {});

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
      }

      // Archer XP + cat bond
      if (!isGuest) {
        const archerXP = MONSTER_TIER_XP[monster?.tier] || 5;
        setGainedArcherXP(archerXP);
        addArcherXP(profile.id, archerXP).catch(() => {});
        const catXP = hasCat ? (CAT_TIER_XP[monster?.tier] || 5) : 0;
        setGainedCatXP(catXP);
        if (hasCat) {
          saveBond("monster");
          saveXP(CAT_TIER_XP[monster?.tier] || 5).catch(() => {});
        }
      }

      // Save monster log
      if (profile?.id) {
        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "win",
          rounds: round, mode, battleMode,
        }).catch(() => {});
      }

      // Quest kill callback
      if (questContext?.monsterId === monster?.id && onKillForQuest) onKillForQuest(monster?.id);

      // Milestone check
      if (profile?.id && !isGuest) {
        import("../../lib/db").then(mod => {
          if (mod.checkAndGrantArrowMilestones) {
            mod.checkAndGrantArrowMilestones(profile.id, arrowsPerRound).then(res => {
              if (res.milestones?.length > 0) {
                setMilestoneQueue(res.milestones.map(ms => ({ ms, rewards: getRewardsForMilestone(ms) })));
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      setPhase("monster_die");
    } else {
      playBattleSound("soft_fail", { monsterName: monster?.name, playerName: profile?.name, round });
      if (profile?.id) {
        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "lose",
          rounds: round, mode, battleMode,
        }).catch(() => {});
      }
      setPhase("result");
    }
  }

"""

# Insert handleMBBattleEnd before the closing return null;
end_marker = "\n  return null;\n}"
if end_marker in content:
    content = content.replace(end_marker, handle_mb_battle_end + end_marker, 1)
    changes += 1
    print(f"✅ Added handleMBBattleEnd function")
else:
    print(f"⚠️  Component end marker not found")

# ──────────────────────────────────────────────
# 6. REPLACE sound calls (sfxBattleIntro, sfxMonsterDead, sfxSoftFail, sfxVictoryFanfare, sfxSuccess)
# ──────────────────────────────────────────────

# These are the sound replacements from the previous Step 2 implementation
sound_replacements = [
    # battle_intro
    ("sfxBattleIntro();", "playBattleSound(\"battle_intro\", { monsterName: monster?.name, playerName: profile?.name });"),
    # victory_fanfare
    ("sfxVictoryFanfare();", "playBattleSound(\"victory_fanfare\", { monsterName: monster?.name, round, roundDmg: totalDmgDealt });"),
    # monster_death (sfxMonsterDead -> playBattleSound)
    ("sfxMonsterDead();", "playBattleSound(\"monster_death\", { monsterName: monster?.name });"),
    # victory_cheer (sfxSuccess -> playBattleSound)
    ("sfxSuccess();", "playBattleSound(\"victory_cheer\", {});"),
    # soft_fail
    ("sfxSoftFail();", "playBattleSound(\"soft_fail\", { monsterName: monster?.name, playerName: profile?.name, round });"),
]

for old_sfx, new_sfx in sound_replacements:
    if old_sfx in content:
        content = content.replace(old_sfx, new_sfx, 1)
        changes += 1
        print(f"✅ Replaced '{old_sfx}' with playBattleSound")

# ──────────────────────────────────────────────
# WRITE FILE
# ──────────────────────────────────────────────

if changes > 0:
    with open(FILEPATH, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print(f"\n✅ Applied {changes} changes to {FILEPATH}")
else:
    print(f"\n⚠️  No changes made to {FILEPATH}")
