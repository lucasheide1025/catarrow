#!/usr/bin/env python3
"""
Fix 4 issues in solo dungeon battle mode:

1. Card/level bonus race condition in DungeonExpedition.jsx 
   - Add cardCollectionVersion guard so stats aren't computed before card data loads.
2. Missing cat bond multiplier in buildExpeditionMemberData.js
   - Add getCatStatMult import and apply it to HP/ATK/DEF.
3. No settlement screen in DungeonBattleRoom.jsx
   - Auto-confirm dungeon resolution when solo player (host) wins.
4. Input/animation locking in DungeonBattleRoom.jsx
   - Add postSubmitted state to guard inputs during animation playback.
"""

import re

# ═══════════════════════════════════════════════════════════════
# 1. DungeonExpedition.jsx — cardCollectionVersion guard
# ═══════════════════════════════════════════════════════════════
print("="*60)
print("1. DungeonExpedition.jsx — cardCollectionVersion guard")
print("="*60)

with open("src/components/dungeon/DungeonExpedition.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add cardCollectionVersion state next to cardColl
old_card_state = "  const [cardColl, setCardColl] = useState({ cards: {}, wbCards: {}, equipped: [] });"
new_card_state = "  const [cardColl, setCardColl] = useState({ cards: {}, wbCards: {}, equipped: [] });\n  const [cardCollectionVersion, setCardCollectionVersion] = useState(0);"

if old_card_state in content:
    content = content.replace(old_card_state, new_card_state)
    print("  ✓ Added cardCollectionVersion state")
else:
    print("  ✗ Could not find cardColl state")

# Update the subscribeCardCollection effect to set version
old_sub = """  useEffect(() => {
    if (!myId) return;
    return subscribeCardCollection(myId, setCardColl);
  }, [myId]);"""

new_sub = """  useEffect(() => {
    if (!myId) return;
    return subscribeCardCollection(myId, (data) => {
      setCardColl(data);
      setCardCollectionVersion(v => v + 1);
    });
  }, [myId]);"""

if old_sub in content:
    content = content.replace(old_sub, new_sub)
    print("  ✓ Updated card subscription to set version")
else:
    print("  ✗ Could not find card subscription effect")

# Update the intro effect to depend on cardCollectionVersion and skip if version is 0
old_intro = """  // 初始化玩家狀態 + 第一層
  useEffect(() => {
    if (phase === "intro") {
      const base = buildExpeditionMemberData(profile, cardBonus);"""

new_intro = """  // 初始化玩家狀態 + 第一層（等待卡片資料載入後才計算數值）
  useEffect(() => {
    if (phase === "intro" && cardCollectionVersion > 0) {
      const base = buildExpeditionMemberData(profile, cardBonus);"""

if old_intro in content:
    content = content.replace(old_intro, new_intro)
    print("  ✓ Added cardCollectionVersion guard to intro effect")
else:
    print("  ✗ Could not find intro effect")
    # Try with just the comment line
    
# Add cardCollectionVersion to the effect's eslint-disable comment line
# The effect deps are [phase, startFloor] - need to add cardCollectionVersion
old_dep_line = "  }, [phase, startFloor]); // eslint-disable-line"
new_dep_line = "  }, [phase, cardCollectionVersion, startFloor]); // eslint-disable-line"

if old_dep_line in content:
    content = content.replace(old_dep_line, new_dep_line)
    print("  ✓ Added cardCollectionVersion to effect deps")
else:
    print("  ✗ Could not find effect deps")

with open("src/components/dungeon/DungeonExpedition.jsx", "w", encoding="utf-8") as f:
    f.write(content)

# ═══════════════════════════════════════════════════════════════
# 2. buildExpeditionMemberData.js — cat bond multiplier
# ═══════════════════════════════════════════════════════════════
print()
print("="*60)
print("2. buildExpeditionMemberData.js — cat bond multiplier")
print("="*60)

with open("src/lib/expeditionMemberData.js", "r", encoding="utf-8") as f:
    content = f.read()

# Add getCatStatMult import
old_import = """import { calcArcherStats } from "./monsterData";
import { archerLevelBonus, archerLevelFromXP } from "./archerLevel";
import { calcCatFullStats } from "./expeditionData";"""

new_import = """import { calcArcherStats } from "./monsterData";
import { archerLevelBonus, archerLevelFromXP } from "./archerLevel";
import { calcCatFullStats } from "./expeditionData";
import { getCatStatMult } from "./catData";"""

if old_import in content:
    content = content.replace(old_import, new_import)
    print("  ✓ Added getCatStatMult import")
else:
    print("  ✗ Could not find imports block")

# Update buildExpeditionMemberData to include catMult
old_build = """export function buildExpeditionMemberData(profile, cardBonus = null) {
  const base = calcArcherStats({
    member: profile,
    certification: null,
    certRecords: profile?.certRecords || [],
    dexStats: null,
  });
  const archerLevel = archerLevelFromXP(profile?.archerXP || 0);
  const level = archerLevelBonus(archerLevel);
  const cb = cardBonus || { hp:0, atk:0, def:0, dmgBonusPct:0, dmgReducePct:0, healBonusPct:0 };
  const hp = (base.hp || 0) + (level.hp || 0) + (cb.hp || 0);
  const equippedCat = profile?.equippedCat;
  const catStats = equippedCat?.catId ? calcCatFullStats(equippedCat) : null;
  return {
    ...profile,
    level: archerLevel,
    hp,
    maxHP: hp,
    atk: (base.atk || 0) + (level.atk || 0) + (cb.atk || 0),
    def: (base.def || 0) + (level.def || 0) + (cb.def || 0),
    catId: equippedCat?.catId || "",
    catName: equippedCat?.name || "",
    catAtk: catStats?.catATK || 0,
    wbBonus: { dmgBonusPct: cb.dmgBonusPct || 0, dmgReducePct: cb.dmgReducePct || 0, healBonusPct: cb.healBonusPct || 0 },
  };
}"""

new_build = """export function buildExpeditionMemberData(profile, cardBonus = null) {
  const base = calcArcherStats({
    member: profile,
    certification: null,
    certRecords: profile?.certRecords || [],
    dexStats: null,
  });
  const archerLevel = archerLevelFromXP(profile?.archerXP || 0);
  const level = archerLevelBonus(archerLevel);
  const cb = cardBonus || { hp:0, atk:0, def:0, dmgBonusPct:0, dmgReducePct:0, healBonusPct:0 };
  let hp = (base.hp || 0) + (level.hp || 0) + (cb.hp || 0);
  let atk = (base.atk || 0) + (level.atk || 0) + (cb.atk || 0);
  let def = (base.def || 0) + (level.def || 0) + (cb.def || 0);
  const equippedCat = profile?.equippedCat;
  const catStats = equippedCat?.catId ? calcCatFullStats(equippedCat) : null;
  // 貓貓羈絆加成（比照 PartyBattleRoom 的 getMyCatMult/getCatStatMult）
  const bondLevel = profile?.equippedCat?.bond || 0;
  const catType = profile?.equippedCat?.type || "allround";
  const catMult = bondLevel > 0 ? getCatStatMult(catType, bondLevel) : (equippedCat?.catId ? getCatStatMult(catType, 0) : 1.0);
  if (catMult !== 1.0) {
    hp  = Math.round(hp  * catMult);
    atk = Math.round(atk * catMult);
    def = Math.round(def * catMult);
  }
  return {
    ...profile,
    level: archerLevel,
    hp,
    maxHP: hp,
    atk,
    def,
    catId: equippedCat?.catId || "",
    catName: equippedCat?.name || "",
    catAtk: catStats?.catATK || 0,
    wbBonus: { dmgBonusPct: cb.dmgBonusPct || 0, dmgReducePct: cb.dmgReducePct || 0, healBonusPct: cb.healBonusPct || 0 },
  };
}"""

if old_build in content:
    content = content.replace(old_build, new_build)
    print("  ✓ Updated buildExpeditionMemberData with cat bond multiplier")
else:
    print("  ✗ Could not find buildExpeditionMemberData function")
    # Debug: find what's around the function
    idx = content.find("buildExpeditionMemberData")
    if idx >= 0:
        print(f"  Found at index {idx}, showing 100 chars: {repr(content[idx:idx+100])}")
    else:
        # Try exact match with tabs
        idx = content.find("export function buildExpeditionMemberData")
        print(f"  Found at index {idx}")

with open("src/lib/expeditionMemberData.js", "w", encoding="utf-8") as f:
    f.write(content)

# ═══════════════════════════════════════════════════════════════
# 3. DungeonBattleRoom.jsx — postSubmitted + victory auto-confirm
# ═══════════════════════════════════════════════════════════════
print()
print("="*60)
print("3. DungeonBattleRoom.jsx — postSubmitted + victory auto-confirm")
print("="*60)

with open("src/components/dungeon/DungeonBattleRoom.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# ── Add postSubmitted state ──
old_states = """  const [arrows,        setArrows]        = useState([]);
  const targetMode = false;
  const [rearChoice,    setRearChoice]    = useState(null); // \"heal\" | \"dmg\" | null（後衛選擇）"""

new_states = """  const [postSubmitted, setPostSubmitted] = useState(false); // 動畫鎖：送出後到下回合前鎖定輸入
  const [arrows,        setArrows]        = useState([]);
  const targetMode = false;
  const [rearChoice,    setRearChoice]    = useState(null); // \"heal\" | \"dmg\" | null（後衛選擇）"""

if old_states in content:
    content = content.replace(old_states, new_states)
    print("  ✓ Added postSubmitted state")
else:
    print("  ✗ Could not find states block")

# ── Set postSubmitted in onSubmitSuccess ──
old_on_submit_success = """    onSubmitSuccess: (submittedArrows) => {
      if (!isGuestMode && myId && Array.isArray(submittedArrows) && submittedArrows.length > 0) {
        addRoundArrows(myId, submittedArrows.length).catch(() => {});
      }
    },"""

new_on_submit_success = """    onSubmitSuccess: (submittedArrows) => {
      setPostSubmitted(true);
      if (!isGuestMode && myId && Array.isArray(submittedArrows) && submittedArrows.length > 0) {
        addRoundArrows(myId, submittedArrows.length).catch(() => {});
      }
    },"""

if old_on_submit_success in content:
    content = content.replace(old_on_submit_success, new_on_submit_success)
    print("  ✓ Set postSubmitted in onSubmitSuccess")
else:
    print("  ✗ Could not find onSubmitSuccess")

# ── Reset postSubmitted on round change ──
old_round_reset = """  // 換回合時重置 submitted/arrows（Firestore round 變化）
  useEffect(() => {
    if (!room || room.status !== "active") return;
    const key = `${room.currentFloor || 1}-${room.round || 1}`;
    if (key !== prevRoundKeyRef.current) {
      prevRoundKeyRef.current = key;
      setFsSubmitted(false);
      setArrows([]);
      setPotionUsedThisRound(false);
    }
  }, [room?.status, room?.currentFloor, room?.round]); // eslint-disable-line"""

new_round_reset = """  // 換回合時重置 submitted/arrows/postSubmitted（Firestore round 變化）
  useEffect(() => {
    if (!room || room.status !== "active") return;
    const key = `${room.currentFloor || 1}-${room.round || 1}`;
    if (key !== prevRoundKeyRef.current) {
      prevRoundKeyRef.current = key;
      setFsSubmitted(false);
      setPostSubmitted(false);
      setArrows([]);
      setPotionUsedThisRound(false);
    }
  }, [room?.status, room?.currentFloor, room?.round]); // eslint-disable-line"""

if old_round_reset in content:
    content = content.replace(old_round_reset, new_round_reset)
    print("  ✓ Reset postSubmitted on round change")
else:
    print("  ✗ Could not find round reset effect")

# ── Guard handleDungeonSubmit with postSubmitted ──
old_submit_fn = """  async function handleDungeonSubmit(scores) {
    if (submitted || submitting) return;
    if (me.role === \"rear\" && !rearChoice) return;"""

new_submit_fn = """  async function handleDungeonSubmit(scores) {
    if (submitted || submitting || postSubmitted) return;
    if (me.role === \"rear\" && !rearChoice) return;"""

if old_submit_fn in content:
    content = content.replace(old_submit_fn, new_submit_fn)
    print("  ✓ Guarded handleDungeonSubmit with postSubmitted")
else:
    print("  ✗ Could not find handleDungeonSubmit")
    idx = content.find("async function handleDungeonSubmit")
    print(f"  Found at index {idx}, showing: {repr(content[idx:idx+150])}")

# ── Guard addArrow with postSubmitted ──
old_add_arrow = """  function addArrow(label, landing) {
    if (arrows.length >= (room?.arrowsPerRound || 6)) return;"""

new_add_arrow = """  function addArrow(label, landing) {
    if (arrows.length >= (room?.arrowsPerRound || 6) || postSubmitted) return;"""

if old_add_arrow in content:
    content = content.replace(old_add_arrow, new_add_arrow)
    print("  ✓ Guarded addArrow with postSubmitted")
else:
    print("  ✗ Could not find addArrow")

# ── Guard onCarryPotion with postSubmitted ──
old_carry_potion = """  async function onCarryPotion(lv) {
    if (potionUsedThisRound) return;
    const count = (potionInv[lv.id] || 0);
    if (count <= 0) return;"""

new_carry_potion = """  async function onCarryPotion(lv) {
    if (postSubmitted || potionUsedThisRound) return;
    const count = (potionInv[lv.id] || 0);
    if (count <= 0) return;"""

if old_carry_potion in content:
    content = content.replace(old_carry_potion, new_carry_potion)
    print("  ✓ Guarded onCarryPotion with postSubmitted")
else:
    print("  ✗ Could not find onCarryPotion")

# ── Guard onThrowPotion with postSubmitted ──
old_throw_potion = """  function onThrowPotion(p) {
    const _apr = room?.arrowsPerRound || 6;
    if (potionUsedThisRound || (p.actionCost === \"arrow\" && arrows.length >= _apr)) return;"""

new_throw_potion = """  function onThrowPotion(p) {
    const _apr = room?.arrowsPerRound || 6;
    if (postSubmitted || potionUsedThisRound || (p.actionCost === \"arrow\" && arrows.length >= _apr)) return;"""

if old_throw_potion in content:
    content = content.replace(old_throw_potion, new_throw_potion)
    print("  ✓ Guarded onThrowPotion with postSubmitted")
else:
    print("  ✗ Could not find onThrowPotion")

# ── Guard undoArrow with postSubmitted ──
old_undo_arrow = """  function undoArrow() {
    setArrows(prev => prev.slice(0, -1));
    if (submitted) setFsSubmitted(false);
  }"""

new_undo_arrow = """  function undoArrow() {
    if (postSubmitted) return;
    setArrows(prev => prev.slice(0, -1));
    if (submitted) setFsSubmitted(false);
  }"""

if old_undo_arrow in content:
    content = content.replace(old_undo_arrow, new_undo_arrow)
    print("  ✓ Guarded undoArrow with postSubmitted")
else:
    print("  ✗ Could not find undoArrow")

# ── Add victory auto-confirm for solo host ──
# When the solo player wins, auto-transition to completed screen after kill animation
# Find the handleConfirmDungeonResolution function and add auto-confirm logic
old_resolution_fn = """  async function handleConfirmDungeonResolution() {
    if (!isHost || status !== \"resolving\") return;
    await confirmDungeonResolution(roomId);
  }"""

new_resolution_fn = """  async function handleConfirmDungeonResolution() {
    if (!isHost || status !== \"resolving\") return;
    await confirmDungeonResolution(roomId);
  }

  // 單人模式：BattleScreen 勝利動畫結束後自動確認，不再需要手動點擊「確認戰鬥結算」
  // 組隊模式則保留按鈕讓房主手動確認（非房主等待房主確認）
  const soloAutoConfirmRef = useRef(null);
  useEffect(() => {
    if (!partyMode || !isHost || status !== \"resolving\" || room?.result !== \"win\") return;
    if (Object.keys(room?.members || {}).length > 1) return; // 組隊模式保留手動確認
    // 等待 3.2 秒（BattleScreen 擊倒動畫 + 勝利覆蓋）後自動確認
    const t = setTimeout(() => {
      if (status === \"resolving\" && room?.result === \"win\") {
        confirmDungeonResolution(roomId).catch(() => {});
      }
    }, 3200);
    soloAutoConfirmRef.current = t;
    return () => { if (soloAutoConfirmRef.current) clearTimeout(soloAutoConfirmRef.current); };
  }, [room?.status, room?.result, isHost, partyMode]);"""

if old_resolution_fn in content:
    content = content.replace(old_resolution_fn, new_resolution_fn)
    print("  ✓ Added solo victory auto-confirm")
else:
    print("  ✗ Could not find handleConfirmDungeonResolution")

# ── Add partyMode reference for the auto-confirm effect ──
# We need partyMode to exist as a variable name - it's not explicitly defined,
# but the BattleScreen check uses it. DungeonBattleRoom always passes partyMode={true}
# so we can use a constant. Actually, let me just remove the partyMode check.
# Wait, the battle room doesn't have a `partyMode` variable. Let me change the effect.
# 
# Since solo dungeon always has 1 member, we can just check member count.
# Let me fix the effect:

old_solo_confirm = """  // 單人模式：BattleScreen 勝利動畫結束後自動確認，不再需要手動點擊「確認戰鬥結算」
  // 組隊模式則保留按鈕讓房主手動確認（非房主等待房主確認）
  const soloAutoConfirmRef = useRef(null);
  useEffect(() => {
    if (!partyMode || !isHost || status !== \"resolving\" || room?.result !== \"win\") return;
    if (Object.keys(room?.members || {}).length > 1) return; // 組隊模式保留手動確認
    // 等待 3.2 秒（BattleScreen 擊倒動畫 + 勝利覆蓋）後自動確認
    const t = setTimeout(() => {
      if (status === \"resolving\" && room?.result === \"win\") {
        confirmDungeonResolution(roomId).catch(() => {});
      }
    }, 3200);
    soloAutoConfirmRef.current = t;
    return () => { if (soloAutoConfirmRef.current) clearTimeout(soloAutoConfirmRef.current); };
  }, [room?.status, room?.result, isHost, partyMode]);"""

new_solo_confirm = """  // 單人模式：BattleScreen 勝利動畫結束後自動確認，不再需要手動點擊「確認戰鬥結算」
  // 組隊模式則保留按鈕讓房主手動確認（非房主等待房主確認）
  const soloAutoConfirmRef = useRef(null);
  useEffect(() => {
    if (!isHost || status !== \"resolving\" || room?.result !== \"win\") return;
    if (Object.keys(room?.members || {}).length > 1) return; // 組隊模式保留手動確認
    // 等待 3.2 秒（BattleScreen 擊倒動畫 + 勝利覆蓋）後自動確認
    const t = setTimeout(() => {
      if (status === \"resolving\" && room?.result === \"win\") {
        confirmDungeonResolution(roomId).catch(() => {});
      }
    }, 3200);
    soloAutoConfirmRef.current = t;
    return () => { if (soloAutoConfirmRef.current) clearTimeout(soloAutoConfirmRef.current); };
  }, [room?.status, room?.result, isHost]);   // eslint-disable-line"""

# Replace the old solo confirm with the corrected version
# Since we know the exact text, do a direct replacement
if old_solo_confirm in content:
    content = content.replace(old_solo_confirm, new_solo_confirm)
    print("  ✓ Fixed solo auto-confirm deps (removed partyMode)")

# ── Update partySubmitted prop to include postSubmitted ──
old_party_submitted_prop = """        partySubmitted={submitted}"""
new_party_submitted_prop = """        partySubmitted={submitted || postSubmitted}"""

if old_party_submitted_prop in content:
    content = content.replace(old_party_submitted_prop, new_party_submitted_prop)
    print("  ✓ Updated partySubmitted prop to include postSubmitted")
else:
    print("  ✗ Could not find partySubmitted prop")
    # Try alternate spacing
    idx = content.find("partySubmitted={submitted}")
    if idx >= 0:
        print(f"  Found at index {idx}")
        print(f"  Context: {repr(content[idx-20:idx+50])}")

with open("src/components/dungeon/DungeonBattleRoom.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print()
print("="*60)
print("All fixes applied!")
print("="*60)
