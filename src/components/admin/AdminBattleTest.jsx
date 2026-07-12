// src/components/admin/AdminBattleTest.jsx
// 教練後台 — 戰鬥模擬器（真戰鬥流程：射箭→計分→傷害→反擊→勝敗）
// 使用真實怪物資料與傷害公式

import { useState, useReducer, useMemo, useCallback, useEffect } from "react";
import MonsterSVG from "../MonsterSVG";
import CatSVG from "../cat/CatSVG";
import { MONSTERS as ALL_MONSTERS, resolveHitPart, BODY_PARTS } from "../../lib/monsterData";
import { calcStandardArrowDmg, calcStandardCounter } from "../../lib/damage";
import { POTIONS } from "../../lib/itemData";
import { CATS, CAT_IDS, CAT_TYPE_MAP, CAT_SKILL_GROUPS,
  calcCatSkillChance, calcCatSkillEffect } from "../../lib/catData";
import { calcCatCombatStats } from "../../lib/catCombat";
import { playBattleSound, toggleBattleSoundMode, getBattleSoundMode } from "../../lib/battleSound";

// ══════════════════════════════════════════════════════════════
// 精選 6 隻可用怪物（取真實資料）
// ══════════════════════════════════════════════════════════════
function getRealMonster(id) { return ALL_MONSTERS.find(m => m.id === id); }

const FAMILY_COLORS = { ghost:"#6366f1", mountain:"#16a34a", insect:"#ca8a04", workplace:"#dc2626", exam:"#7c3aed", temple:"#ea580c" };

const PICKED_IDS = ["ghost_6","mountain_5","insect_5","temple_6","workplace_6","exam_6"];
const MONSTERS = PICKED_IDS.map(id => {
  const m = getRealMonster(id);
  return { id, name: m.name, family: m.family, hp: m.hp, atk: m.atk, def: m.def, tier: m.tier, color: FAMILY_COLORS[m.family] || "#888" };
});

// 難度倍率
const DIFF_MULTS = [
  { id:"normal",    label:"普通",  color:"#4ade80", hp:1.0,  atk:1.0,  def:1.0  },
  { id:"hard",      label:"困難",  color:"#fbbf24", hp:1.5,  atk:1.25, def:1.15 },
  { id:"nightmare", label:"惡夢",  color:"#fca5a5", hp:2.2,  atk:1.5,  def:1.35 },
];

// 隊友假資料（僅視覺用，戰鬥以單人為主）
const MATE_DATA = [
  { catId:"daming",  name:"大娘",  atk:180, def:120, hp:3200, maxHp:3200, isFront:true,  done:true  },
  { catId:"gege",    name:"哥哥",  atk:150, def:130, hp:2800, maxHp:2800, isFront:true,  done:false },
  { catId:"meimei",  name:"妹妹",  atk:200, def:90,  hp:2400, maxHp:2400, isFront:false, done:true  },
  { catId:"niuniu",  name:"妞妞",  atk:210, def:80,  hp:2200, maxHp:2200, isFront:false, done:false },
  { catId:"haji",    name:"哈吉",  atk:140, def:140, hp:3000, maxHp:3000, isFront:true,  done:true  },
  { catId:"baobao",  name:"寶寶",  atk:190, def:100, hp:2600, maxHp:2600, isFront:false, done:true  },
  { catId:"youyou",  name:"悠悠",  atk:160, def:150, hp:3400, maxHp:3400, isFront:false, done:true  },
  { catId:"xiaoan",  name:"小安",  atk:130, def:160, hp:3600, maxHp:3600, isFront:true,  done:true  },
];

// 玩家基礎資料
const SELF = { catId:"diandian", name:"顛顛", lv:42, atk:275, def:165, hp:3180, maxHp:3180 };

// 貓貓進場戰吼（9 隻各 2 種，依類型配色）
const CAT_BATTLE_CRIES = {
  heal: [ "一起上吧！ 💚", "我來支援你！ ✨" ],
  atk:  [ "看我的厲害！ ⚡", "咬死牠！ 💥" ],
  def:  [ "別想傷害主人！ 🛡️", "我來擋住牠！ 🐾" ],
};

// 貓貓進場特效設定（依類型）
const CAT_INTRO_EFFECTS = {
  heal: {
    icon: "💚",
    label: "治癒型",
    particle: "✨",
    particleCount: 6,
    colors: ["#10b981","#34d399","#6ee7b7"],
    bgGradient: "radial-gradient(circle,rgba(16,185,129,.2),transparent 70%)",
    borderGlow: "0 0 20px #10b98166, 0 0 40px #10b98133",
  },
  atk: {
    icon: "⚡",
    label: "攻擊型",
    particle: "💥",
    particleCount: 5,
    colors: ["#ef4444","#f87171","#fbbf24"],
    bgGradient: "radial-gradient(circle,rgba(239,68,68,.2),transparent 70%)",
    borderGlow: "0 0 20px #ef444466, 0 0 40px #ef444433",
  },
  def: {
    icon: "🛡️",
    label: "防禦型",
    particle: "🔮",
    particleCount: 5,
    colors: ["#a78bfa","#8b5cf6","#c4b5fd"],
    bgGradient: "radial-gradient(circle,rgba(167,139,250,.2),transparent 70%)",
    borderGlow: "0 0 20px #a78bfa66, 0 0 40px #a78bfa33",
  },
};

// 貓貓訊息列表（9 隻各 3 種隨機台詞）
const CAT_MSG_POOL = {
  heal: [
    n => `🐱 ${n} 用尾巴掃過你的傷口，癒合了！💚`,
    n => `🐱 ${n} 叼來貓草葉，傷口在發光了 ✨`,
    n => `🐱 ${n} 蹭了蹭你的腳，一股暖流湧上 🫶`,
  ],
  atk: [
    n => `🐱 ${n} 利爪出擊！追加傷害！⚡`,
    n => `🐱 ${n} 目光如炬，找到了弱點 💥`,
    n => `🐱 ${n} 撲了上去追加一擊！🎯`,
  ],
  def: [
    n => `🐱 ${n} 擋在你面前！減傷！🛡️`,
    n => `🐱 ${n} 用腦袋頂開了攻擊！✨`,
    n => `🐱 ${n} 發出嘶吼威嚇怪物！🐾`,
  ],
};

// 貓貓回合傷害基值（後台模擬用固定值，降低隨機性方便觀察）
const CAT_MAX_HP_FIXED = 300;
const CAT_ATK_FIXED = 25;
const CAT_DEF_FIXED = 12;


// 測試用藥水庫存（後台無限，每種10瓶）
const TEST_POTIONS = [
  POTIONS.find(p => p.id === "carry_heal_basic"),
  POTIONS.find(p => p.id === "carry_heal_advanced"),
  POTIONS.find(p => p.id === "carry_power_basic"),
  POTIONS.find(p => p.id === "carry_power_advanced"),
  POTIONS.find(p => p.id === "carry_guard_basic"),
  POTIONS.find(p => p.id === "carry_guard_advanced"),
  POTIONS.find(p => p.id === "carry_shield_basic"),
  POTIONS.find(p => p.id === "carry_regen_basic"),
  POTIONS.find(p => p.id === "carry_berserk_basic"),
  POTIONS.find(p => p.id === "throw_knife"),
  POTIONS.find(p => p.id === "throw_bomb"),
  POTIONS.find(p => p.id === "throw_weaken"),
  POTIONS.find(p => p.id === "throw_armor_break"),
  POTIONS.find(p => p.id === "throw_paralyze"),
  POTIONS.find(p => p.id === "throw_smoke"),
  POTIONS.find(p => p.id === "throw_corrosion"),
].filter(Boolean);

const CARRY_TEST = TEST_POTIONS.filter(p => p.kind === "carry");
const THROW_TEST = TEST_POTIONS.filter(p => p.kind === "throw");

// 每回合射擊箭數
const ARROWS_PER_ROUND = 6;

// ══════════════════════════════════════════════════════════════
// 戰鬥狀態 reducer
// ══════════════════════════════════════════════════════════════
// 回合開始前的特殊事件（模擬用；效果多為示意，重點是演出「回合前會跳事件」）
const ROUND_EVENTS = [
  { icon: "🌪️", title: "逆風", desc: "強風干擾，本回合較難瞄準（示意）", color: "#7dd3fc" },
  { icon: "✨", title: "順風", desc: "順風助威，本回合手感絕佳（示意）", color: "#fbbf24" },
  { icon: "🎯", title: "全神貫注", desc: "本回合爆擊機率提升（示意）", color: "#f472b6" },
  { icon: "🩹", title: "補給箱", desc: "回合開始回復少量 HP", color: "#4ade80", heal: 200 },
  { icon: "🕸️", title: "怪物蓄力", desc: "怪物正在蓄力，小心這回合的反擊（示意）", color: "#f87171" },
];

// 裝備卡稱號 → 玩家卡外框配色（原本世界王卡的稱號特效，改成直接畫在玩家本體外框）
const FRAME_TIERS = {
  none:      { c: "#4cc9f0", glow: "transparent",              label: "無稱號" },
  rare:      { c: "#a78bfa", glow: "rgba(167,139,250,.55)",    label: "稀有卡" },
  epic:      { c: "#f472b6", glow: "rgba(244,114,182,.55)",    label: "傳說卡" },
  worldboss: { c: "#f5b942", glow: "rgba(245,185,66,.65)",     label: "世界王卡（金邊）" },
};

const PHASE = {
  IDLE:       "idle",
  INTRO:      "intro",          // VS 進場動畫
  PLAYING:    "playing",        // 可射擊
  SCORING:    "scoring",        // 輸入箭分數
  PROCESSING: "processing",     // 戰鬥過程動畫（逐箭→貓貓→反擊）
  ROUND_RES:  "round_result",   // 回合結果（已扣怪 HP + 已反擊）
  VICTORY_ANIM: "victory_anim", // 擊倒動畫
  WON:        "won",            // 勝利
  LOST:       "lost",           // 敗北
};

const initBattle = {
  phase: PHASE.IDLE,
  round: 1,
  arrowIdx: 0,
  arrows: [],          // [{score, dmg, isCrit, partName, partIcon}]
  monsterHp: 0,
  monsterMaxHp: 0,
  monsterAtk: 0,
  monsterDef: 0,
  monsterName: "",
  monsterFamily: "",
  battleMode: "score",
  unlockedParts: new Set(),
  playerHp: SELF.hp,
  playerMaxHp: SELF.maxHp,
  playerAtk: SELF.atk,
  playerDef: SELF.def,
  roundDmg: 0,
  roundCrits: 0,
  counterDmg: 0,
  pendingCounter: 0,   // 反擊傷害暫存：送出時算好，等動畫「反擊步驟」才真的扣玩家 HP
  potionShield: 0,
  messages: [],
  lastArrowDmg: 0,
  lastArrowCrit: false,
  lastArrowPart: "",
};

// 從已輸入的箭陣列重算殭屍靶已解鎖部位（刪除箭 / 重填時用，確保 undo 後解鎖狀態一致）
function computeUnlocked(arrows) {
  const set = new Set();
  arrows.forEach(a => {
    const p = a.part;
    if (!p) return;
    if (p.id === "chest") { set.add("chest"); set.add("heart"); set.add("lung"); }
    if (p.id === "belly") { set.add("belly"); set.add("kidney"); }
    if (p.id === "groin") { set.add("groin"); set.add("balls"); }
  });
  return set;
}

function battleReducer(state, action) {
  switch (action.type) {
    case "START_SCORING":
      return { ...state, phase: PHASE.SCORING, arrowIdx: 0, arrows: [], lastArrowDmg: 0, lastArrowCrit: false, lastArrowPart: "" };

    case "START": {
      const { monster, diff, battleMode } = action;
      const mon = monster;
      const mHp = Math.round(mon.hp * diff.hp);
      const mAtk = Math.round(mon.atk * diff.atk);
      const mDef = Math.round(mon.def * diff.def);
      return {
        ...initBattle,
        phase: PHASE.INTRO,
        battleMode: battleMode || "score",
        monsterHp: mHp,
        monsterMaxHp: mHp,
        monsterAtk: mAtk,
        monsterDef: mDef,
        monsterName: mon.name,
        monsterFamily: mon.family,
        playerHp: SELF.hp,
        messages: [`⚔️ 戰鬥開始！對上 ${mon.name}（HP:${mHp} ATK:${mAtk} DEF:${mDef}）`,
          battleMode === "zombie" ? "🧟 殭屍靶模式：分數決定命中部位，高部位倍率最高 ×3.0！" : "🎯 分數靶模式：每箭依環數計算傷害。"],
      };
    }

    case "SCORE_ARROW": {
      if (state.arrowIdx >= ARROWS_PER_ROUND) return state; // 已滿 6 箭，等玩家確認送出，不再收箭
      const { score, battleMode } = action;
      const isX = score === "X";
      const numScore = isX ? 10 : (score === "M" ? 0 : score);
      const isZombie = battleMode === "zombie";

      // 殭屍靶：解析命中部位
      let part = null;
      let partMult = 1.0;
      let newUnlocked = new Set(state.unlockedParts || []);
      if (isZombie) {
        part = resolveHitPart(numScore, newUnlocked, isX);
        if (part) {
          partMult = part.mult;
          if (part.id === "chest") { newUnlocked.add("chest"); newUnlocked.add("heart"); newUnlocked.add("lung"); }
          if (part.id === "belly") { newUnlocked.add("belly"); newUnlocked.add("kidney"); }
          if (part.id === "groin") { newUnlocked.add("groin"); newUnlocked.add("balls"); }
        }
      }

      const dmg = calcStandardArrowDmg(numScore, state.playerAtk, state.monsterDef, partMult);
      const isCrit = isZombie ? (part && part.mult >= 1.8) : (isX || Math.random() < 0.08);
      const newArrows = [...state.arrows, { score, dmg, isCrit, part: isZombie ? part : null }];

      // 只記錄這一箭，不結算、不跳關；滿 6 箭後停在 SCORING 等玩家按「送出」（SUBMIT_ROUND）
      return {
        ...state,
        arrows: newArrows,
        arrowIdx: state.arrowIdx + 1,
        unlockedParts: isZombie ? newUnlocked : (state.unlockedParts || new Set()),
        lastArrowDmg: dmg,
        lastArrowCrit: isCrit,
        lastArrowPart: isZombie && part
          ? `${part.icon} ${part.name} ×${part.mult}`
          : (numScore === 0 ? "脫靶" : (isX ? "X環" : `${numScore}環`)),
      };
    }

    case "UNDO_ARROW": {
      if (state.arrows.length === 0) return state;
      const newArrows = state.arrows.slice(0, -1);
      const last = newArrows[newArrows.length - 1];
      return {
        ...state,
        arrows: newArrows,
        arrowIdx: newArrows.length,
        unlockedParts: computeUnlocked(newArrows),
        lastArrowDmg: last ? last.dmg : 0,
        lastArrowCrit: last ? last.isCrit : false,
        lastArrowPart: last ? (last.part ? `${last.part.icon} ${last.part.name} ×${last.part.mult}` : "") : "",
      };
    }

    case "SUBMIT_ROUND": {
      // 玩家確認 6 箭後進入戰鬥動畫。這裡「不預扣」怪物 HP：
      // 怪物血由動畫逐箭 HIT_MONSTER 扣、玩家血由反擊步驟 APPLY_COUNTER 扣，血條才會跟著演出走。
      const { skipCounter, counterReduce } = action;
      const totalDmg = state.arrows.reduce((s, a) => s + a.dmg, 0);
      const crits = state.arrows.filter(a => a.isCrit).length;
      const shieldAbsorb = Math.min(state.potionShield || 0, state.monsterAtk * 2);
      const rawCounter = skipCounter === true ? 0 : calcStandardCounter(state.monsterAtk, state.playerDef);
      const pendingCounter = Math.max(0, Math.round(rawCounter * (1 - (counterReduce || 0) / 100) - shieldAbsorb));
      return {
        ...state,
        roundDmg: totalDmg,
        roundCrits: crits,
        pendingCounter,
        counterDmg: pendingCounter, // 結算面板顯示用
        phase: PHASE.PROCESSING,
        // monsterHp / playerHp 這裡都不動
      };
    }

    // 逐箭扣怪物 HP（動畫每命中一箭 dispatch 一次）
    case "HIT_MONSTER":
      return { ...state, monsterHp: Math.max(0, state.monsterHp - (action.dmg || 0)) };

    // 怪物被擊倒（逐箭扣到 0）→ 勝利動畫，略過反擊
    case "MONSTER_DIED":
      return {
        ...state,
        phase: PHASE.VICTORY_ANIM,
        messages: [...state.messages,
          `💀 ${state.monsterName} 被擊倒！`,
          `🏹 第${state.round}回合：${state.roundDmg} 傷害（${state.roundCrits} 爆擊）`,
        ],
      };

    // 動畫反擊步驟才真的扣玩家 HP，並判定是否敗北
    case "APPLY_COUNTER": {
      const newPlayerHp = Math.max(0, state.playerHp - (state.pendingCounter || 0));
      return {
        ...state,
        playerHp: newPlayerHp,
        phase: newPlayerHp <= 0 ? PHASE.LOST : state.phase,
        messages: [...state.messages,
          `🏹 第${state.round}回合：${state.roundDmg} 傷害（${state.roundCrits} 爆擊）`,
          `💥 怪物反擊：${state.pendingCounter} 傷害`,
        ],
      };
    }

    case "CARRY_BUFF": {
      const { atkAdd, defAdd, heal, shieldHp, buffMsgs, name } = action;
      const newAtk = state.playerAtk + (atkAdd || 0);
      const newDef = state.playerDef + (defAdd || 0);
      const healed = Math.min(state.playerMaxHp, state.playerHp + (heal || 0));
      const newShield = Math.max(state.potionShield || 0, shieldHp || 0);
      return {
        ...state,
        playerAtk: newAtk,
        playerDef: newDef,
        playerHp: healed,
        potionShield: newShield,
        messages: [...state.messages, ...(buffMsgs || [`⚗️ ${name || "藥水"} 效果發動！`])],
      };
    }

    case "THROW_DMG": {
      const { dmg, msg } = action;
      const newMonsterHp = Math.max(0, state.monsterHp - dmg);
      const won = newMonsterHp <= 0;
      return {
        ...state,
        monsterHp: newMonsterHp,
        phase: won ? PHASE.VICTORY_ANIM : state.phase,
        messages: [...state.messages, msg || `🔪 投擲傷害：${dmg}`],
      };
    }

    case "DEBUFF_MONSTER": {
      const { monAtkPct, monDefPct, msg } = action;
      const newMonsterAtk = monAtkPct ? Math.max(1, Math.round(state.monsterAtk * (1 - monAtkPct / 100))) : state.monsterAtk;
      const newMonsterDef = monDefPct ? Math.max(0, Math.round(state.monsterDef * (1 - monDefPct / 100))) : state.monsterDef;
      return {
        ...state,
        monsterAtk: newMonsterAtk,
        monsterDef: newMonsterDef,
        messages: [...state.messages, msg || `🧴 怪物被削弱！`],
      };
    }

    case "HEAL": {
      const healed = Math.min(state.playerMaxHp, state.playerHp + (action.amount || 0));
      return { ...state, playerHp: healed, messages: [...state.messages, `💚 回復 ${action.amount} HP`] };
    }

    case "START_PLAYING":
      return { ...state, phase: PHASE.PLAYING };

    case "SHOW_WON":
      return { ...state, phase: PHASE.WON };

    case "NEXT_PHASE":
      // 只有還在 PROCESSING 才進回合結算；若動畫中已判定 LOST/VICTORY 就不覆蓋
      return state.phase === PHASE.PROCESSING ? { ...state, phase: PHASE.ROUND_RES } : state;

    case "NEXT_ROUND":
      return {
        ...state,
        phase: PHASE.PLAYING,
        round: state.round + 1,
        arrowIdx: 0,
        arrows: [],
        roundDmg: 0,
        roundCrits: 0,
        counterDmg: 0,
        lastArrowDmg: 0,
        lastArrowCrit: false,
        lastArrowPart: "",
        // 殭屍靶保留已解鎖部位
      };

    case "RESET":
      return initBattle;

    default:
      return state;
  }
}

// ══════════════════════════════════════════════════════════════
// 主元件
// ══════════════════════════════════════════════════════════════
export default function AdminBattleTest() {
  const [mIdx, setMIdx] = useState(0);
  const [dIdx, setDIdx] = useState(2);
  const [playerCount, setPlayerCount] = useState(1);
  const [detailMateIdx, setDetailMateIdx] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [showCtl, setShowCtl] = useState(true);
  const [soundMode, setSoundMode] = useState(getBattleSoundMode());
  const [battle, dispatch] = useReducer(battleReducer, initBattle);
  const [battleMode, setBattleMode] = useState("score"); // score | zombie
  const [scoreInput, setScoreInput] = useState("keypad"); // keypad=數字計分 | target=點靶面計分
  const [cardFrame, setCardFrame] = useState("none"); // 裝備卡稱號 → 玩家卡外框色（世界王=金邊）
  const [teamFx, setTeamFx] = useState([]);   // 組隊演出：每個隊友這回合的攻擊結果 "crit"|"normal"|"miss"
  const [roundEvent, setRoundEvent] = useState(null); // 回合開始前的特殊事件卡
  const [showPotionPanel, setShowPotionPanel] = useState(false);
  const [potionTab, setPotionTab] = useState("carry");
  const [usedPotionInfo, setUsedPotionInfo] = useState(null);
  const [poofKey, setPoofKey] = useState(0);
  const [skipBigRound, setSkipBigRound] = useState(false);
  const [counterReducePct, setCounterReducePct] = useState(0);

  // 🎬 戰鬥過程動畫
  const [animStep, setAnimStep] = useState(-1); // -1=閒置, 0-5=逐箭, 6=貓貓, 7=反擊, 8=完成

  // 🐱 貓貓夥伴
  const [selectedCatId, setSelectedCatId] = useState(null); // null = 無貓貓
  const [catMsg, setCatMsg] = useState(null);
  const [catCurrentHP, setCatCurrentHP] = useState(0);
  const [catSkillActive, setCatSkillActive] = useState(null); // { type, value } for def shield

  const mon    = MONSTERS[mIdx];
  const diff   = DIFF_MULTS[dIdx];
  const bgUrl  = `/ui/battle-bg/bg_${mon.family}_${(mIdx % 6) + 1}.webp`;

  // 🐱 貓貓模擬資料
  const hasCat = !!selectedCatId;
  const catName = hasCat ? (CATS[selectedCatId]?.name || "") : "";
  const catType = hasCat ? (CAT_TYPE_MAP[selectedCatId] || "allround") : "allround";
  const skillGroup = hasCat ? (CAT_SKILL_GROUPS[selectedCatId] || "heal") : "heal";
  const catCombatStats = useMemo(() => hasCat ? calcCatCombatStats({ catId: selectedCatId, catXP: 5000, bond: 50, type: catType }) : null, [hasCat, selectedCatId, catType]);
  const catMaxHP = hasCat ? (catCombatStats?.catHP || CAT_MAX_HP_FIXED) : CAT_MAX_HP_FIXED;
  const catATK = hasCat ? (catCombatStats?.catATK || CAT_ATK_FIXED) : CAT_ATK_FIXED;
  const catDEF = hasCat ? (catCombatStats?.catDEF || CAT_DEF_FIXED) : CAT_DEF_FIXED;
  const catBondLv = hasCat ? (catCombatStats?.bondLv || 0) : 0;
  const catLevel = hasCat ? (catCombatStats?.catLevel || 1) : 1;

  const team = useMemo(() => {
    const cnt = Math.max(1, Math.min(playerCount - 1, MATE_DATA.length));
    return MATE_DATA.slice(0, cnt);
  }, [playerCount]);

  const inBattle = battle.phase !== PHASE.IDLE;
  const isIntro = battle.phase === PHASE.INTRO;
  const isPlaying = battle.phase === PHASE.PLAYING;
  const isScoring = battle.phase === PHASE.SCORING;
  const isRoundRes = battle.phase === PHASE.ROUND_RES;
  const isProcessing = battle.phase === PHASE.PROCESSING;
  const isVictoryAnim = battle.phase === PHASE.VICTORY_ANIM;
  const isWon = battle.phase === PHASE.WON;
  const isLost = battle.phase === PHASE.LOST;
  const showBattleUI = isPlaying || isScoring || isProcessing || isRoundRes || isVictoryAnim || isWon || isLost;

  // ⏱ 進場動畫：2.5 秒後自動進入 PLAYING
  useEffect(() => {
    if (!isIntro) return;
    // 🔊 貓貓進場音效預留
    if (hasCat) {
      const fx = CAT_INTRO_EFFECTS[skillGroup] || CAT_INTRO_EFFECTS.heal;
      playBattleSound("cat_intro", { catName, typeLabel: fx.label, typeIcon: fx.icon });
      playBattleSound("cat_type_sound", { skillGroup });
    }
    const t = setTimeout(() => dispatch({ type: "START_PLAYING" }), 2500);
    return () => clearTimeout(t);
  }, [isIntro, dispatch, hasCat, catName, skillGroup]);

  // 🎲 回合開始前特殊事件：每回合進入 PLAYING 時，60% 機率跳一張事件卡（模擬用）
  useEffect(() => {
    if (!isPlaying) return;
    if (Math.random() < 0.6) {
      const ev = ROUND_EVENTS[Math.floor(Math.random() * ROUND_EVENTS.length)];
      setRoundEvent(ev);
      if (ev.heal) dispatch({ type: "HEAL", amount: ev.heal });
    }
  }, [isPlaying, battle.round, dispatch]);

  // ⏱ 擊倒動畫：3 秒後自動顯示勝利畫面
  useEffect(() => {
    if (!isVictoryAnim) return;
    playBattleSound("victory_fanfare", { monsterName: battle.monsterName, round: battle.round, roundDmg: battle.roundDmg });
    const t = setTimeout(() => {
      playBattleSound("victory_cheer", {});
      dispatch({ type: "SHOW_WON" });
    }, 3000);
    return () => clearTimeout(t);
  }, [isVictoryAnim, dispatch, battle.monsterName, battle.round, battle.roundDmg]);

  // ⏱ 敗北畫面音效預留
  useEffect(() => {
    if (!isLost) return;
    playBattleSound("defeat_sigh", { monsterName: battle.monsterName, playerName: SELF.name, round: battle.round });
  }, [isLost, battle.monsterName, battle.round]);

  // ⏱ 戰鬥過程動畫：逐箭→貓貓→反擊→結算
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  useEffect(() => {
    if (!isProcessing) return;
    let cancelled = false;

    // 組隊演出：這一回合每個隊友擲一次攻擊結果（爆擊/普通/M），驅動下方隊友格的框色演出
    setTeamFx(team.map(() => { const r = Math.random(); return r < 0.2 ? "crit" : r < 0.32 ? "miss" : "normal"; }));

    (async () => {
      setAnimStep(0);
      await delay(500); // 進場緩衝，別讓第一箭瞬間就跳出來
      if (cancelled) return;

      // 逐箭扣血：hpAfter 從「這回合開始時的怪物 HP」起算（SUBMIT 沒預扣），每命中一箭才扣一箭的量。
      // ⚠️ 組隊落地要注意：真實組隊是多位玩家的箭都要逐一扣進同一隻怪，不能像單人只扣自己的箭，
      //    扣血動畫得依「命中順序」把所有人的箭串起來，且以伺服器的權威 HP 為準避免各自算出不同血量。
      let hpAfter = battle.monsterHp;
      for (let i = 0; i < ARROWS_PER_ROUND; i++) {
        setAnimStep(i + 1); // 1..6
        const a = battle.arrows[i];
        if (a) {
          playBattleSound("arrow_flight", { arrowIdx: i+1, monsterName: battle.monsterName, battleMode: battle.battleMode });
          playBattleSound("arrow_hit", { arrowIdx: i+1, score: a.score, dmg: a.dmg, isCrit: a.isCrit });
          dispatch({ type: "HIT_MONSTER", dmg: a.dmg }); // ← 命中才逐步扣血，血條跟著動畫掉
          hpAfter = Math.max(0, hpAfter - a.dmg);
        }
        await delay(a && a.isCrit ? 1200 : 900); // 爆擊那箭多停一下讓特效看得清楚
        if (cancelled) return;
        if (hpAfter <= 0) break; // 怪物已被擊倒，剩下的箭不用再演
      }
      await delay(450); // 逐箭結束後喘口氣
      if (cancelled) return;

      // 怪物被擊倒 → 勝利動畫（略過貓貓協戰與反擊）
      if (hpAfter <= 0) { dispatch({ type: "MONSTER_DIED" }); return; }

      // 貓貓協戰（訊息要讓玩家看得清楚，停久一點）
      if (hasCat) {
        setAnimStep(7);
        const fx = CAT_INTRO_EFFECTS[skillGroup] || CAT_INTRO_EFFECTS.heal;
        playBattleSound("cat_attack", { catName, particle: fx.particle, skillGroup });
        await delay(1700);
        if (cancelled) return;
      }

      // 怪物反擊（同樣停久一點，別讓反擊訊息一閃就過）
      if (battle.pendingCounter > 0) {
        setAnimStep(8);
        playBattleSound("monster_counter", { monsterName: battle.monsterName, counterDmg: battle.pendingCounter });
        await delay(1700);
        if (cancelled) return;
      }
      dispatch({ type: "APPLY_COUNTER" }); // ← 反擊步驟才真的扣玩家 HP + 補回合訊息

      // 若這一擊把玩家打死了就停在 LOST，不進回合結算
      if (battle.playerHp - battle.pendingCounter <= 0) return;

      // 完成，跳轉回合結算
      setAnimStep(9);
      await delay(450);
      if (cancelled) return;
      dispatch({ type: "NEXT_PHASE" });
    })();

    return () => { cancelled = true; };
  }, [isProcessing]);

  // 重置動畫狀態
  useEffect(() => {
    if (!isProcessing && animStep !== -1) setAnimStep(-1);
  }, [isProcessing, animStep]);

  // 🐱 貓貓回合結束處理：受傷 + 協戰（合併為一個 effect 避免 stale closure）
  useEffect(() => {
    if (!isRoundRes || !hasCat || !selectedCatId) return;
    let currentCatHP = catCurrentHP;

    // 1. 貓貓承受反擊傷害（怪物反擊的 35%，減去貓貓 DEF 的一半）
    if (battle.counterDmg > 0 && currentCatHP > 0) {
      const catDmg = Math.max(0, Math.round(battle.counterDmg * 0.35 - catDEF * 0.5));
      if (catDmg > 0) {
        currentCatHP = Math.max(0, currentCatHP - catDmg);
        setCatCurrentHP(currentCatHP);
        if (currentCatHP <= 0) {
          setCatMsg(`💔 ${catName} 承受了 ${catDmg} 傷害，倒地昏迷了... 😿`);
        } else {
          setCatMsg(`😿 ${catName} 被反擊波及，受到 ${catDmg} 傷害！（HP: ${currentCatHP}/${catMaxHP}）`);
        }
      }
    }

    // 2. 貓貓昏迷則停止後續
    if (currentCatHP <= 0) {
      const t = setTimeout(() => setCatMsg(null), 3000);
      return () => clearTimeout(t);
    }

    // 3. 貓貓協戰攻擊
    const catRoundDmg = Math.max(1, Math.round(catATK * 0.8 * (0.75 + Math.random() * 0.5)));
    dispatch({ type: "THROW_DMG", dmg: catRoundDmg, msg: `🐱 ${catName} 協戰攻擊：造成 ${catRoundDmg} 傷害！` });

    // 🎲 技能觸發判定
    const chance = calcCatSkillChance(catLevel, catBondLv, selectedCatId);
    if (Math.random() < chance) {
      const effect = calcCatSkillEffect(skillGroup, catLevel, catBondLv, selectedCatId);
      if (skillGroup === "heal" && effect.healed) {
        dispatch({ type: "HEAL", amount: effect.healed });
        showCatMsg(CAT_MSG_POOL.heal);
      } else if (skillGroup === "atk" && effect.extraMult) {
        const bonusDmg = Math.round(catRoundDmg * effect.extraMult);
        dispatch({ type: "THROW_DMG", dmg: bonusDmg, msg: `🐱 ${catName} ⚡ 追加傷害 +${bonusDmg}（×${effect.extraMult.toFixed(1)}）！` });
        showCatMsg(CAT_MSG_POOL.atk);
      } else if (skillGroup === "def" && effect.reduction) {
        const pct = Math.min(60, Math.round(effect.reduction * 100));
        setCounterReducePct(prev => Math.min(70, prev + pct));
        showCatMsg(CAT_MSG_POOL.def);
        setCatSkillActive({ type: "def", value: effect.reduction });
      }
    }

    // 3 秒後清除貓貓訊息
    const t = setTimeout(() => { setCatMsg(null); setCatSkillActive(null); }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [isRoundRes]);

  function showCatMsg(pool) {
    const fn = pool[Math.floor(Math.random() * pool.length)];
    setCatMsg(fn(catName));
  }

  const hpPct = inBattle ? (battle.monsterHp / battle.monsterMaxHp) * 100 : 100;
  const playerHpPct = inBattle ? (battle.playerHp / battle.playerMaxHp) * 100 : 100;

  // ── 箭數標籤按鈕 ──
  const scoreKeys = ["X","10","9","8","7","6","5","4","3","2","1","M"];

  const handleScore = useCallback((s) => {
    if (!isScoring) return;
    dispatch({ type: "SCORE_ARROW", score: s, battleMode });
  }, [isScoring, battleMode]);

  const handleUndo = useCallback(() => {
    if (!isScoring) return;
    dispatch({ type: "UNDO_ARROW" });
  }, [isScoring]);

  const handleSubmit = useCallback(() => {
    if (!isScoring || battle.arrows.length < ARROWS_PER_ROUND) return;
    dispatch({ type: "SUBMIT_ROUND", skipCounter: skipBigRound, counterReduce: counterReducePct });
  }, [isScoring, battle.arrows.length, skipBigRound, counterReducePct]);

  const handleStartBattle = useCallback(() => {
    dispatch({ type: "START", monster: mon, diff, battleMode });
    if (hasCat) setCatCurrentHP(catMaxHP);
  }, [mon, diff, battleMode, hasCat, catMaxHP]);

  const handleNextRound = useCallback(() => {
    dispatch({ type: "NEXT_ROUND" });
    setSkipBigRound(false);
    setCounterReducePct(0);
    setUsedPotionInfo(null);
  }, []);

  const handleReset = useCallback(() => {
    dispatch({ type: "RESET" });
    setSkipBigRound(false);
    setCounterReducePct(0);
    setUsedPotionInfo(null);
    setShowPotionPanel(false);
    setCatCurrentHP(0);
    setCatMsg(null);
    setCatSkillActive(null);
    setRoundEvent(null);
    setTeamFx([]);
  }, []);

  // ── 藥水函數 ──
  function useCarryPotion(potion) {
    if (usedPotionInfo || battle.phase === PHASE.SCORING) return;
    const e = potion.effect || {};
    let atkAdd = 0, defAdd = 0, heal = 0, shieldHp = 0;
    const msgs = [];
    if (e.hpPct) {
      heal = Math.round(battle.playerMaxHp * e.hpPct / 100);
      msgs.push(`💚 ${potion.icon} ${potion.name}：回復 ${heal} HP`);
    }
    if (e.atkPct) {
      atkAdd = Math.round(battle.playerAtk * e.atkPct / 100);
      msgs.push(`⚔️ ${potion.icon} ${potion.name}：ATK +${e.atkPct}%`);
    }
    if (e.defPct) {
      defAdd = Math.round(battle.playerDef * e.defPct / 100);
      msgs.push(`🛡️ ${potion.icon} ${potion.name}：DEF +${e.defPct}%`);
    }
    if (e.shieldPct) {
      shieldHp = Math.round(battle.playerMaxHp * e.shieldPct / 100);
      msgs.push(`🫧 ${potion.icon} ${potion.name}：獲得 ${shieldHp} 護盾`);
    }
    if (e.regenPct) {
      const regenAmt = Math.round(battle.playerMaxHp * e.regenPct / 100);
      heal += regenAmt;
      msgs.push(`🌱 ${potion.icon} ${potion.name}：回 ${e.regenPct}%/回合`);
    }
    if (e.dmgPct && e.defPenaltyPct) {
      atkAdd = Math.round(battle.playerAtk * e.dmgPct / 100);
      defAdd = -Math.round(battle.playerDef * e.defPenaltyPct / 100);
      msgs.push(`🔥 ${potion.icon} ${potion.name}：傷害 +${e.dmgPct}%，DEF -${e.defPenaltyPct}%`);
    }
    dispatch({ type: "CARRY_BUFF", atkAdd, defAdd, heal, shieldHp, buffMsgs: msgs, name: potion.name });
    setUsedPotionInfo({ icon: potion.icon, name: potion.name, effectText: potion.effectText });
    setShowPotionPanel(false);
    setPoofKey(k => k + 1);
  }

  function useThrowPotion(potion) {
    if (usedPotionInfo || battle.phase === PHASE.SCORING) return;
    const e = potion.effect || {};
    let dmg = 0;
    const msgs = [];
    if (e.throwDmg) dmg += e.throwDmg;
    if (e.throwPct) dmg += Math.round(battle.monsterMaxHp * e.throwPct);
    if (e.atkDamagePct) dmg += Math.round(battle.playerAtk * e.atkDamagePct / 100);
    if (e.throwDmgMin && e.throwDmgMax) dmg += e.throwDmgMin + Math.floor(Math.random() * (e.throwDmgMax - e.throwDmgMin + 1));
    if (dmg > 0) {
      dispatch({ type: "THROW_DMG", dmg, msg: `🔪 ${potion.icon} ${potion.name}：${dmg} 傷害！` });
    }
    if (e.monAtkPct) {
      dispatch({ type: "DEBUFF_MONSTER", monAtkPct: e.monAtkPct, msg: `🌫️ ${potion.icon} ${potion.name}：怪物 ATK -${e.monAtkPct}%！` });
    }
    if (e.monDefPct) {
      dispatch({ type: "DEBUFF_MONSTER", monDefPct: e.monDefPct, msg: `🧴 ${potion.icon} ${potion.name}：怪物 DEF -${e.monDefPct}%！` });
    }
    if (e.skipRound === "big") {
      setSkipBigRound(true);
      msgs.push(`🕸️ ${potion.icon} ${potion.name}：下次反擊跳過！`);
    }
    if (e.counterReducePct) {
      setCounterReducePct(p => Math.min(70, p + e.counterReducePct));
      msgs.push(`💨 ${potion.icon} ${potion.name}：反擊傷害 -${e.counterReducePct}%！`);
    }
    if (msgs.length > 0) {
      dispatch({ type: "CARRY_BUFF", atkAdd: 0, defAdd: 0, heal: 0, shieldHp: 0, buffMsgs: msgs });
    }
    setUsedPotionInfo({ icon: potion.icon, name: potion.name, effectText: potion.effectText });
    setShowPotionPanel(false);
    setPoofKey(k => k + 1);
  }

  const catTypeLabel = hasCat ? (catType === "heal" ? "治癒型" : catType === "atk" ? "攻擊型" : "防禦型") : "";
  const catGlowColor = skillGroup === "heal" ? "#10b981" : skillGroup === "atk" ? "#ef4444" : "#a78bfa";

  // 🗣️ 貓貓進場戰吼（每次戰鬥隨機挑一句）
  const catBattleCry = useMemo(() => {
    if (!hasCat) return "";
    const cries = CAT_BATTLE_CRIES[skillGroup] || CAT_BATTLE_CRIES.heal;
    return cries[Math.floor(Math.random() * cries.length)];
  }, [hasCat, skillGroup]);

  // ── Btn 元件 ──
  const Btn = ({ label, icon, primary, danger, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        display:"flex", alignItems:"center", gap:8,
        border: primary ? "1px solid rgba(255,255,255,.35)" : danger ? "1px solid rgba(239,83,80,.42)" : "1px solid rgba(255,255,255,.12)",
        borderRadius:12, padding: primary ? "11px 15px" : "9px 13px",
        background: primary ? "linear-gradient(135deg,#f7c65a,#e79a1e)" : "rgba(9,14,25,.86)",
        backdropFilter:"blur(9px)",
        color: primary ? "#241400" : danger ? "#ffd7d5" : "#eef3fc",
        fontSize: primary ? 14 : 13, fontWeight: primary ? 900 : 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        minWidth:104, justifyContent:"flex-end",
        boxShadow: primary ? "0 6px 20px rgba(231,154,30,.45)" : "0 5px 16px rgba(0,0,0,.45)",
        transition:"transform .12s, filter .12s",
      }}
      onMouseEnter={e=>{if(!disabled){e.currentTarget.style.filter="brightness(1.14)";e.currentTarget.style.transform="translateX(-2px)";}}}
      onMouseLeave={e=>{if(!disabled){e.currentTarget.style.filter="brightness(1)";e.currentTarget.style.transform="translateX(0)";}}}
      onMouseDown={e=>{if(!disabled)e.currentTarget.style.transform="scale(.97)";}}
      onMouseUp={e=>{if(!disabled)e.currentTarget.style.transform="";}}>
      {icon}
      {label}
    </button>
  );

  return (
    <div style={{
      padding:"16px 12px", background:"linear-gradient(180deg,#0f172a,#0a0e18)",
      minHeight:"100vh",
      fontFamily:'"Segoe UI Variable","Segoe UI",system-ui,-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif',
      display:"flex", flexDirection:"column", alignItems:"center", gap:20,
    }}>
      {/* 標題 */}
      <div style={{textAlign:"center",marginBottom:4}}>
        <div style={{fontSize:11,letterSpacing:".32em",color:"#f5b942",fontWeight:800,marginBottom:6}}>
          🐱 貓小隊 · 戰鬥模擬器
        </div>
        <div style={{fontSize:20,fontWeight:900,color:"#eef3fc"}}>
          ⚔️ {playerCount > 1 ? `${playerCount} 人組隊戰鬥` : "單人戰鬥"}
        </div>
        <div style={{fontSize:12,color:"#9fb0cf",marginTop:4}}>
          真怪物資料 · 真傷害公式 · 完整回合流程
        </div>
      </div>

      {/* ════ 手機戰鬥畫面 ════ */}
      <div style={{
        position:"relative", width:380, maxWidth:"92vw", aspectRatio:"9/19",
        borderRadius:30, overflow:"hidden",
        boxShadow:"0 30px 70px rgba(0,0,0,.6), 0 0 0 8px #0a0e18, 0 0 0 9px rgba(255,255,255,.06)",
        isolation:"isolate", userSelect:"none", background:"#0a1018",
      }}>
        {/* 背景 */}
        <img src={bgUrl} alt=""
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}
          onError={e=>{e.target.style.display="none"}} />
        <div style={{
          position:"absolute",inset:0,zIndex:1,pointerEvents:"none",
          background:"linear-gradient(180deg,rgba(4,7,13,.5),transparent 20%,transparent 55%,rgba(4,7,13,.72))",
        }}>
          <div style={{position:"absolute",inset:0,boxShadow:"inset 0 0 120px 20px rgba(0,0,0,.55)"}} />
        </div>

        {/* 頂部資訊列 */}
        <div style={{
          position:"absolute",top:0,left:0,right:0,zIndex:5,
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          padding:"7px 14px", fontSize:11, fontWeight:800, letterSpacing:".02em", color:"#dbe6f8",
          background:"linear-gradient(180deg,rgba(6,10,18,.9),rgba(6,10,18,.35))",
          borderBottom:"1px solid rgba(255,255,255,.08)",
        }}>
          <span style={{color:"#fff"}}>{battleMode === "zombie" ? "🧟 殭屍靶" : "🎯 分數靶"}</span>
          <span style={{color:"#6b7a99"}}>·</span>
          <span style={{color:diff.color}}>{diff.label}</span>
          <span style={{color:"#6b7a99"}}>·</span>
          <span>第 <b style={{color:inBattle?"#f5b942":"#6b7a99",fontVariantNumeric:"tabular-nums"}}>{inBattle?battle.round:"—"}</b> / 7 層</span>
        </div>

        {/* ── VS 進場動畫 ── */}
        {isIntro && (
          <div style={{
            position:"absolute",inset:0,zIndex:20,
            background:"linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            gap:8,
          }}>
            <div style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-around",padding:"0 16px"}}>
              {/* 射手 - 左進場 */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                <div style={{display:"flex",alignItems:"flex-end",gap:0,animation:"introArc .6s cubic-bezier(.34,1.56,.64,1) both"}}>
                  <CatSVG catId={SELF.catId} size={80} />
                  {/* 🐱 貓貓夥伴站在射手旁 */}
                  {hasCat && (() => {
                    const fx = CAT_INTRO_EFFECTS[skillGroup] || CAT_INTRO_EFFECTS.heal;
                    const particles = Array.from({length: fx.particleCount});
                    return (
                      <div style={{
                        marginLeft:-8,marginBottom:-4,
                        display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                        position:"relative",
                      }}>
                        {/* 類型專屬背景光暈 */}
                        <div style={{
                          position:"absolute",top:"50%",left:"50%",
                          transform:"translate(-50%,-50%)",
                          width:100,height:100,
                          background:fx.bgGradient,
                          borderRadius:"50%",
                          animation:"introCat .5s .3s cubic-bezier(.34,1.56,.64,1) both",
                          opacity:0,pointerEvents:"none",
                        }} />
                        {/* 粒子特效 */}
                        {particles.map((_, i) => (
                          <div key={i} style={{
                            position:"absolute",
                            left:`${30 + Math.sin(i * 1.2) * 35}%`,
                            top:`${25 + Math.cos(i * 0.9) * 35}%`,
                            fontSize:10,
                            animation:`catParticle .8s ${.35 + i * 0.08}s cubic-bezier(.34,1.56,.64,1) both`,
                            opacity:0,pointerEvents:"none",
                            filter:`drop-shadow(0 0 3px ${fx.colors[i % fx.colors.length]})`,
                          }}>
                            {fx.particle}
                          </div>
                        ))}
                        {/* 貓貓頭像 */}
                        <div style={{
                          animation:"introCat .5s .3s cubic-bezier(.34,1.56,.64,1) both",
                          opacity:0,position:"relative",zIndex:1,
                        }}>
                          <div style={{
                            width:44,height:44,borderRadius:11,overflow:"hidden",
                            boxShadow:`0 0 0 2px ${catGlowColor}66, ${fx.borderGlow}`,
                          }}>
                            <CatSVG catId={selectedCatId} size={44} />
                          </div>
                        </div>
                        {/* 類型標籤 */}
                        <div style={{
                          fontSize:7,fontWeight:900,
                          color:fx.colors[0],
                          background:`${fx.colors[0]}22`,
                          border:`1px solid ${fx.colors[0]}44`,
                          borderRadius:6,padding:"0 5px",
                          animation:"introCat .5s .5s cubic-bezier(.34,1.56,.64,1) both",
                          opacity:0,whiteSpace:"nowrap",zIndex:1,
                        }}>
                          {fx.icon} {fx.label}
                        </div>
                        {/* 貓貓戰吼文字 */}
                        <div style={{
                          fontSize:9,fontWeight:900,
                          color:catGlowColor,
                          textShadow:`0 0 8px ${catGlowColor}88,0 0 16px ${catGlowColor}44`,
                          animation:"catCry .4s .7s cubic-bezier(.34,1.56,.64,1) both",
                          opacity:0,whiteSpace:"nowrap",zIndex:1,
                          letterSpacing:".04em",
                        }}>
                          {catBattleCry}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,animation:"introArc .6s cubic-bezier(.34,1.56,.64,1) both"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#c4b5fd",textShadow:"0 0 8px #7c3aed"}}>{SELF.name}</div>
                  {hasCat && (
                    <div style={{
                      fontSize:10,fontWeight:700,color:catGlowColor,textShadow:`0 0 6px ${catGlowColor}88`,
                      animation:"introCat .5s .4s cubic-bezier(.34,1.56,.64,1) both",opacity:0,
                    }}>
                      + {catName}
                    </div>
                  )}
                </div>
              </div>
              {/* VS */}
              <div style={{animation:"introVs .8s .4s cubic-bezier(.34,1.56,.64,1) both"}}>
                <div style={{fontSize:38,fontWeight:900,color:"#fbbf24",textShadow:"0 0 24px #f59e0b, 0 0 48px #f59e0b"}}>VS</div>
              </div>
              {/* 怪物 - 右進場 */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,animation:"introMon .6s cubic-bezier(.34,1.56,.64,1) both"}}>
                <div style={{filter:"drop-shadow(0 0 16px #ef4444)"}}>
                  <MonsterSVG id={mon.id} size={80} />
                </div>
                <div style={{fontSize:12,fontWeight:700,color:"#fca5a5",textShadow:"0 0 8px #ef4444"}}>{battle.monsterName || mon.name}</div>
              </div>
            </div>
            {/* 戰鬥開始！ */}
            <div style={{marginTop:16,animation:"introStart .5s 1.2s cubic-bezier(.34,1.56,.64,1) both",opacity:0}}>
              <div style={{fontSize:24,fontWeight:900,color:"#fff",textShadow:"0 0 24px #fbbf24",letterSpacing:4,textAlign:"center"}}>
                ⚔️ 戰鬥開始！
              </div>
            </div>
            {/* 模式提示 */}
            <div style={{marginTop:4,fontSize:10,color:"#6b7a99",animation:"introStart .5s 1.6s both",opacity:0}}>
              {battleMode === "zombie" ? "🧟 殭屍靶模式" : "🎯 分數靶模式"} · {diff.label}
            </div>
          </div>
        )}

        {/* ── 擊倒動畫 ── */}
        {isVictoryAnim && (
          <div style={{
            position:"absolute",inset:0,zIndex:15,
            background:"linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            gap:16,
            animation:"defFade .4s ease-out",
          }}>
            {/* 怪物 fade */}
            <div style={{position:"relative",display:"inline-block"}}>
              <div style={{animation:"defMon .2s ease-out both"}}>
                <MonsterSVG id={mon.id} size={100} />
              </div>
              {/* 擊倒 印章 */}
              <div style={{
                position:"absolute",inset:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                animation:"defBadge .5s .5s cubic-bezier(.34,1.56,.64,1) both",opacity:0,
                pointerEvents:"none",
              }}>
                <div style={{
                  fontSize:24,fontWeight:900,color:"#ef4444",
                  border:"4px solid #ef4444",borderRadius:8,
                  padding:"4px 14px",letterSpacing:4,
                  textShadow:"0 0 12px #ef4444",
                  boxShadow:"0 0 18px #ef444488",
                  background:"rgba(0,0,0,.55)",
                  transform:"rotate(-8deg)",
                }}>
                  擊倒
                </div>
              </div>
            </div>
            {/* 勝利文字 */}
            <div style={{animation:"defVictory .6s .8s cubic-bezier(.34,1.56,.64,1) both",opacity:0,textAlign:"center"}}>
              <div style={{fontSize:28,fontWeight:900,color:"#fbbf24",textShadow:"0 0 32px #f59e0b",letterSpacing:4}}>
                💀 擊倒！
              </div>
              <div style={{fontSize:13,color:"#94a3b8",marginTop:4}}>
                {battle.monsterName} 已被消滅
              </div>
            </div>
            {/* 戰績 */}
            <div style={{animation:"defStats .5s 1.2s ease-out both",opacity:0,display:"flex",gap:16}}>
              {[
                {icon:"🏹",label:"總傷害",value:battle.roundDmg},
                {icon:"🔄",label:"回合數",value:battle.round},
                {icon:"🔥",label:"爆擊",value:battle.roundCrits},
              ].map((s,i) => (
                <div key={i} style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#9fb0cf",fontWeight:700}}>{s.icon} {s.label}</div>
                  <div style={{fontSize:22,fontWeight:900,color:"#ffd27a",fontVariantNumeric:"tabular-nums"}}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🐱 貓貓訊息彈窗 */}
        {catMsg && (
          <div style={{
            position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:25,
            background:"rgba(6,10,18,.88)",border:`1px solid ${catGlowColor}66`,
            borderRadius:16,padding:"10px 18px",fontSize:13,fontWeight:700,lineHeight:1.4,
            color:"#fff",backdropFilter:"blur(8px)",
            boxShadow:`0 0 30px ${catGlowColor}44, 0 0 60px ${catGlowColor}22`,
            animation:"msgIn .25s ease-out, catPulse 1.5s ease-in-out infinite",
            whiteSpace:"nowrap",pointerEvents:"none",textAlign:"center",
            borderLeft:`4px solid ${catGlowColor}`,
          }}>
            {catMsg}
          </div>
        )}

        {/* 戰鬥訊息（左上） */}
        {showBattleUI && <div style={{position:"absolute",zIndex:3,top:56,left:11,maxWidth:"46%",display:"flex",flexDirection:"column",gap:4,pointerEvents:"none"}}>
          {/* 常駐戰鬥紀錄：加深底色避免背景太亮看不到；跨回合保留（messages 不會被清空） */}
          {battle.messages.length > 0 && (
            <div style={{
              background:"rgba(6,10,20,.88)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,
              padding:"6px 9px",maxHeight:104,overflowY:"auto",
              display:"flex",flexDirection:"column",gap:2,pointerEvents:"auto",
              boxShadow:"0 4px 14px rgba(0,0,0,.55)",
            }}>
              {battle.messages.slice(-4).map((m,i)=>(
                <div key={i} style={{fontSize:10.5,lineHeight:1.35,color:"#dce6f7",textShadow:"0 1px 2px rgba(0,0,0,.9)"}}>{m}</div>
              ))}
            </div>
          )}
          {usedPotionInfo && (
            <div key={poofKey} style={{
              background:"rgba(9,14,25,.75)",border:"1px solid rgba(132,204,22,.4)",borderRadius:9,
              padding:"5px 9px",fontSize:11,lineHeight:1.3,
              color:"#bef264",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",
              animation:"msgIn .2s ease-out",
            }}>
              ⚗️ {usedPotionInfo.icon} <b>{usedPotionInfo.name}</b>
              <span style={{color:"#9fb0cf",fontWeight:400,marginLeft:4}}>{usedPotionInfo.effectText}</span>
            </div>
          )}              {isScoring && battle.lastArrowDmg > 0 && (
            <div style={{
              background:"rgba(9,14,25,.75)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,
              padding:"5px 9px",fontSize:11,lineHeight:1.3,
              color:"#dce6f7",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",
              animation:"msgIn .2s ease-out",
            }}>
              {battle.battleMode === "zombie" && battle.arrows.length > 0 && battle.arrows[battle.arrows.length-1]?.part ? (
                <>
                  <b>{battle.arrows[battle.arrows.length-1].part.icon} {battle.arrows[battle.arrows.length-1].part.name}</b>
                  {' ×'}{battle.arrows[battle.arrows.length-1].part.mult}
                </>
              ) : (
                <>
                  箭{battle.arrowIdx} · <b style={{color:"#ffd27a"}}>{battle.lastArrowPart}</b>
                </>
              )}
              {' · '}<b style={{color:battle.lastArrowCrit?"#fbbf24":"#ff7a7a"}}>{battle.lastArrowDmg}</b>
              {battle.lastArrowCrit && <span style={{color:"#fbbf24",fontWeight:900}}> 💥</span>}
            </div>
          )}
          {isRoundRes && (
            <div style={{
              background:"rgba(9,14,25,.75)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,
              padding:"5px 9px",fontSize:11,lineHeight:1.3,
              color:"#dce6f7",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",
              animation:"msgIn .2s ease-out",
            }}>
              回合合計 · <b style={{color:"#ffd27a"}}>{battle.roundDmg}</b> 傷害
              {battle.roundCrits > 0 && <span style={{color:"#fbbf24",fontWeight:900}}> 🔥×{battle.roundCrits}</span>}
            </div>
          )}
          {isRoundRes && battle.counterDmg > 0 && (
            <div style={{
              background:"rgba(9,14,25,.75)",border:"1px solid rgba(231,76,60,.4)",borderRadius:9,
              padding:"5px 9px",fontSize:11,lineHeight:1.3,
              color:"#ffc4c2",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",
              animation:"msgIn .2s ease-out .2s both",
            }}>
              怪物反擊 · <b style={{color:"#ff7a7a"}}>-{battle.counterDmg}</b> HP
            </div>
          )}
        </div>}

        {/* 逐箭命中特效（#2 打擊感）：傷害浮字 + 爆擊全螢幕閃光，key 綁 animStep 讓每箭重播 */}
        {isProcessing && animStep >= 1 && animStep <= 6 && battle.arrows[animStep-1] && (
          <div key={`dmg-${animStep}`} style={{
            position:"absolute", zIndex:6, top:60, right:"14%", pointerEvents:"none",
            fontSize: battle.arrows[animStep-1].isCrit ? 36 : 26, fontWeight:900,
            color: battle.arrows[animStep-1].isCrit ? "#fbbf24" : "#ff9a9a",
            textShadow:"0 2px 10px rgba(0,0,0,.85)", fontVariantNumeric:"tabular-nums",
            animation:"dmgFloat .8s ease-out forwards",
          }}>
            -{battle.arrows[animStep-1].dmg}{battle.arrows[animStep-1].isCrit ? " 💥" : ""}
          </div>
        )}
        {isProcessing && animStep >= 1 && animStep <= 6 && battle.arrows[animStep-1]?.isCrit && (
          <div key={`flash-${animStep}`} style={{
            position:"absolute", inset:0, zIndex:5, pointerEvents:"none",
            background:"radial-gradient(circle at 72% 20%, rgba(251,191,36,.4), transparent 55%)",
            animation:"critFlash .45s ease-out forwards",
          }} />
        )}

        {/* 怪物（右上） */}
        <div style={{
          position:"absolute", zIndex:2, top:52, right:"4%", width:"47%",
          display:"flex", flexDirection:"column", alignItems:"center", gap:7,
          filter:"drop-shadow(0 16px 26px rgba(0,0,0,.6))",
          animation:isWon?"wonShake .5s ease-out":(isProcessing && animStep >= 1 && animStep <= 6?(battle.arrows[animStep-1]?.isCrit?"hitShock .5s ease-out, procMonster .45s ease-out infinite":"procMonster .45s ease-out infinite"):(inBattle?"bob 4.6s ease-in-out infinite":"none")),
        }}>
          <div style={{
            width:"100%", borderRadius:18, overflow:"hidden",
            boxShadow:inBattle
              ? (isWon?`0 0 0 3px #4ade80, 0 0 40px #4ade8060`:`0 0 0 2px ${mon.color}59, 0 0 26px ${mon.color}47`)
              : "0 0 0 2px rgba(255,255,255,.12)",
            opacity:isWon?0.6:1,
            transition:"filter .3s",
            filter:isWon?"brightness(.5) saturate(.3)":"none",
          }}>
            <MonsterSVG id={mon.id} size={180} />
          </div>
          <div style={{width:"88%"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:11,fontWeight:800,marginBottom:3,textShadow:"0 2px 6px #000"}}>
              <b style={{color:"#fff",fontSize:12.5}}>
                {inBattle ? battle.monsterName : mon.name}
                {isWon && " 💀"}
              </b>
              <span style={{
                color: isWon ? "#4ade80" : "#f87171",
                fontVariantNumeric:"tabular-nums",
                fontSize: isWon ? 11 : 12.5,
              }}>
                {isWon ? "擊敗！" : `Lv.${((mIdx+1)*10).toFixed(0)}`}
              </span>
            </div>
            <div style={{
              height:7,borderRadius:99,background:"rgba(0,0,0,.55)",
              overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14)",
            }}>
              <div style={{
                width:`${hpPct}%`,height:"100%",borderRadius:99,
                background:isWon
                  ? "#4ade80"
                  : hpPct > 60
                    ? "linear-gradient(90deg,#ff7a7a,#e03b3b)"
                    : hpPct > 30
                      ? "linear-gradient(90deg,#fbbf24,#ea580c)"
                      : "linear-gradient(90deg,#f87171,#dc2626)",
                transition:"width .4s ease-out",
              }} />
            </div>
            <div style={{
              display:"flex",justifyContent:"space-between",fontSize:8.5,
              color:"#6b7a99",fontWeight:700,marginTop:2,
              fontVariantNumeric:"tabular-nums",
            }}>
              <span>HP</span>
              <span>
                <b style={{color:inBattle?"#dce8fb":"#6b7a99"}}>
                  {inBattle ? battle.monsterHp.toLocaleString() : "?"}
                </b>
                {" / "}
                {inBattle ? battle.monsterMaxHp.toLocaleString() : "?"}
              </span>
            </div>
          </div>
        </div>

        {/* 回合指示器 */}
        <div style={{position:"absolute",zIndex:4,right:16,bottom:"calc(14px + 4 * 44px + 6px)",display:"flex",gap:4}}>
          {Array.from({length:6}).map((_,i) => (
            <div key={i} style={{
              width:9,height:9,borderRadius:99,
              background: inBattle && i < battle.round
                ? "#f5b942"
                : "rgba(255,255,255,.24)",
              boxShadow: inBattle && i < battle.round
                ? "0 0 8px rgba(245,185,66,.7)"
                : "inset 0 0 0 1px rgba(255,255,255,.28)",
            }} />
          ))}
        </div>

        {/* 🐱 貓貓夥伴已整合進下方玩家卡（原本浮在左上會蓋住隊友格） */}

        {/* 左下：隊友 + 玩家 */}
        <div style={{position:"absolute",left:12,bottom:14,zIndex:4,display:"flex",flexDirection:"column",gap:8,alignItems:"flex-start"}}>
          {playerCount > 1 && (
            <div style={{
              width:180,display:"flex",flexWrap:"wrap",gap:7,
              background:"rgba(9,14,25,.4)",border:"1px solid rgba(255,255,255,.08)",
              borderRadius:14,padding:7,
            }}>
              {team.map((mate,i) => {
                const dead = false;
                // 組隊攻擊演出：處理中依這回合擲定的結果——爆擊金框、M暗掉、普通維持前橘/後藍
                const fx = (isProcessing && animStep >= 1 && animStep <= 6) ? teamFx[i] : null;
                const frameC = fx === "crit" ? "#f5b942" : fx === "miss" ? "#555" : (mate.isFront ? "#ffb454" : "#7dd3fc");
                const critGlow = fx === "crit" ? ", 0 0 14px rgba(245,185,66,.85)" : "";
                const missDim = fx === "miss";
                return (
                  <div key={i}
                    onClick={() => { setDetailMateIdx(i); setShowDetail(true); }}
                    style={{position:"relative",width:38,cursor:"pointer",transition:"transform .12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.09)";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
                    <div style={{
                      width:38,height:38,borderRadius:11,overflow:"hidden",
                      boxShadow:`0 4px 10px rgba(0,0,0,.55), inset 0 0 0 2px ${dead ? "#555" : frameC}${critGlow}`,
                      filter:(dead || missDim)?"grayscale(1) brightness(.45)":"none",
                      transition:"box-shadow .2s, filter .2s",
                      animation: fx ? "teamAttack .6s ease-out" : "none",
                    }}>
                      <CatSVG catId={mate.catId} size={38} />
                    </div>
                    <div style={{height:4,borderRadius:99,background:"rgba(0,0,0,.6)",marginTop:3,overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14)"}}>
                      <div style={{width:`${(mate.hp/mate.maxHp)*100}%`,height:"100%",background:"linear-gradient(90deg,#5ff0a3,#22b866)"}} />
                    </div>
                    <div style={{

                      position:"absolute",top:-5,right:-5,width:17,height:17,borderRadius:99,
                      display:"grid",placeItems:"center",fontSize:10,fontWeight:900,
                      background:mate.done?"#22c866":"rgba(245,185,66,.2)",
                      boxShadow:mate.done?"0 0 0 2px #0b1220":"0 0 0 2px rgba(245,185,66,.45)",
                      color:mate.done?"#0a1f12":"#f5b942",
                      animation:mate.done?"none":"admPulse 1.4s infinite",
                    }}>
                      {mate.done ? "✓" : "⏳"}
                    </div>
                    <div style={{
                      position:"absolute",bottom:14,left:-4,
                      fontSize:8,fontWeight:900,padding:"1px 4px",borderRadius:5,
                      color:"#111",background:mate.isFront?"#ffb454":"#7dd3fc",
                    }}>
                      {mate.isFront?"前":"後"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 玩家卡（外框＝裝備卡稱號色；含 ATK/DEF 讓藥水效果看得到；貓貓夥伴整合在右側） */}
          {(() => {
            const frame = FRAME_TIERS[cardFrame] || FRAME_TIERS.none;
            const curAtk = inBattle ? battle.playerAtk : SELF.atk;
            const curDef = inBattle ? battle.playerDef : SELF.def;
            const atkUp = inBattle && battle.playerAtk > SELF.atk;
            const defUp = inBattle && battle.playerDef > SELF.def;
            // 攻擊演出：處理中這一箭 爆擊→金框、M→暗框、普通→維持稱號框色
            const curArrow = (isProcessing && animStep >= 1 && animStep <= 6) ? battle.arrows[animStep - 1] : null;
            const atkFrameC = curArrow ? (curArrow.isCrit ? "#f5b942" : curArrow.score === "M" ? "#555" : frame.c) : frame.c;
            const atkGlow = curArrow?.isCrit ? "rgba(245,185,66,.75)" : frame.glow;
            const cardAnim = curArrow
              ? (curArrow.score === "M" ? "playerMiss .5s ease-out" : "playerAttack .5s ease-out")
              : (isProcessing && animStep === 8 ? "playerHurt .5s ease-out" : "none");
            return (
          <div key={`pc-${isProcessing ? animStep : "idle"}`} style={{
            width:214,
            background:"rgba(9,14,25,.62)",
            border:`2px solid ${atkFrameC}`,
            borderRadius:15,padding:"8px 10px",
            backdropFilter:"blur(8px)",
            boxShadow:`0 6px 18px rgba(0,0,0,.45), 0 0 ${curArrow?.isCrit ? 20 : 14}px ${atkGlow}`,
            animation:cardAnim,
          }}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{width:56,height:56,borderRadius:13,flexShrink:0,overflow:"hidden",boxShadow:`0 4px 12px rgba(0,0,0,.5), inset 0 0 0 2px ${frame.c}`}}>
                <CatSVG catId={SELF.catId} size={56} />
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:5,fontSize:14,fontWeight:900}}>
                  {SELF.name}
                  <span style={{fontSize:8.5,fontWeight:900,color:"#241400",background:"#f5b942",borderRadius:5,padding:"1px 5px",letterSpacing:".05em"}}>你</span>
                  <span style={{fontSize:9.5,fontWeight:800,color:"#04222e",background:"#4cc9f0",borderRadius:5,padding:"1px 5px"}}>Lv.{SELF.lv}</span>
                </div>
                <div style={{fontSize:11,color:"#9fb0cf",fontVariantNumeric:"tabular-nums",margin:"4px 0 3px"}}>
                  HP <b style={{color:"#dce8fb"}}>{inBattle ? battle.playerHp.toLocaleString() : SELF.hp.toLocaleString()}</b> / {SELF.maxHp.toLocaleString()}
                </div>
                <div style={{height:8,borderRadius:99,background:"rgba(0,0,0,.55)",overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14)"}}>
                  <div style={{
                    width:`${playerHpPct}%`,height:"100%",borderRadius:99,
                    background:playerHpPct > 60
                      ? "linear-gradient(90deg,#5ff0a3,#22b866)"
                      : playerHpPct > 30
                        ? "linear-gradient(90deg,#fbbf24,#ea580c)"
                        : "linear-gradient(90deg,#f87171,#dc2626)",
                    transition:"width .4s ease-out",
                  }} />
                </div>
              </div>
            </div>
            {/* ATK / DEF（吃藥水後上升會變綠並標 ▲，玩家一眼知道藥水有沒有用）＋貓貓夥伴 */}
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:7}}>
              <div style={{flex:1,display:"flex",gap:6}}>
                <div style={{flex:1,background:"rgba(255,255,255,.05)",borderRadius:8,padding:"3px 7px",fontVariantNumeric:"tabular-nums"}}>
                  <span style={{fontSize:9,color:"#9fb0cf",fontWeight:700}}>ATK </span>
                  <b style={{fontSize:12,color:atkUp?"#5ff0a3":"#f4a3a3"}}>{curAtk}{atkUp?" ▲":""}</b>
                </div>
                <div style={{flex:1,background:"rgba(255,255,255,.05)",borderRadius:8,padding:"3px 7px",fontVariantNumeric:"tabular-nums"}}>
                  <span style={{fontSize:9,color:"#9fb0cf",fontWeight:700}}>DEF </span>
                  <b style={{fontSize:12,color:defUp?"#5ff0a3":"#a3c4f4"}}>{curDef}{defUp?" ▲":""}</b>
                </div>
              </div>
              {hasCat && (
                <div style={{display:"flex",alignItems:"center",gap:5,paddingLeft:6,borderLeft:"1px solid rgba(255,255,255,.1)"}}
                  title={`${catName} · ${catTypeLabel}`}>
                  <div style={{width:30,height:30,borderRadius:8,overflow:"hidden",flexShrink:0,
                    boxShadow:`inset 0 0 0 2px ${catGlowColor}${catCurrentHP>0?"":"55"}`,
                    filter: catCurrentHP<=0?"grayscale(1) brightness(.45)":"none"}}>
                    <CatSVG catId={selectedCatId} size={30} />
                  </div>
                  <div style={{minWidth:32}}>
                    <div style={{fontSize:8.5,fontWeight:900,color:catCurrentHP>0?"#c4b5fd":"#6b7280"}}>{catName}{catCurrentHP<=0?" 💀":""}</div>
                    <div style={{height:3,borderRadius:99,background:"rgba(0,0,0,.6)",overflow:"hidden",marginTop:2}}>
                      <div style={{width:`${(catCurrentHP||catMaxHP)/Math.max(1,catMaxHP)*100}%`,height:"100%",background:catCurrentHP>0?"linear-gradient(90deg,#a78bfa,#7c3aed)":"#555"}} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
            );
          })()}
        </div>

        {/* 右側選單 */}
        <div style={{position:"absolute",zIndex:4,right:12,bottom:14,display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
          {!inBattle && (
            <Btn label="開始戰鬥" primary onClick={handleStartBattle}
              icon={<span style={{fontSize:16,flexShrink:0}}>⚔️</span>} />
          )}
          {isPlaying && (
            <Btn label="射　擊" primary onClick={()=>dispatch({type:"START_SCORING"})}
              icon={<svg style={{width:16,height:16,flexShrink:0}} viewBox="0 0 24 24" fill="none" stroke="#241400" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>} />
          )}
          {isRoundRes && (
            <Btn label="下一回合" primary onClick={handleNextRound}
              icon={<span style={{fontSize:16,flexShrink:0}}>➡️</span>} />
          )}
          {(isWon || isLost) && (
            <Btn label="再來一次" primary onClick={handleReset}
              icon={<span style={{fontSize:16,flexShrink:0}}>🔄</span>} />
          )}
          <Btn label={usedPotionInfo?"已用藥水":"藥　水"}
            disabled={!inBattle || isScoring || !!usedPotionInfo}
            onClick={()=>setShowPotionPanel(true)}
            icon={<span style={{fontSize:16,flexShrink:0}}>{usedPotionInfo?.icon||"🧪"}</span>} />
          {inBattle && (
            <Btn label="重置" onClick={handleReset}
              icon={<span style={{fontSize:16,flexShrink:0}}>↺</span>} />
          )}
        </div>

        {/* ── 藥水面板 ── */}
        {showPotionPanel && inBattle && (
          <div style={{
            position:"absolute",inset:0,zIndex:12,
            background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",
            display:"flex",flexDirection:"column",justifyContent:"flex-end",
          }}>
            <div style={{
              background:"linear-gradient(180deg,#101a2e,#0b1220)",
              borderTop:"1px solid rgba(255,255,255,.12)",
              borderRadius:"22px 22px 0 0",padding:"14px 14px 20px",
              boxShadow:"0 -20px 50px rgba(0,0,0,.6)",
              maxHeight:"70%",overflowY:"auto",
              animation:"rise .28s cubic-bezier(.2,.9,.3,1)",
            }}>
              {/* Tab 切換 */}
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                <button onClick={()=>setPotionTab("carry")}
                  style={{
                    flex:1,padding:"8px 0",borderRadius:10,
                    border:potionTab==="carry"?"1px solid #22c866":"1px solid rgba(255,255,255,.12)",
                    background:potionTab==="carry"?"rgba(34,200,102,.18)":"rgba(255,255,255,.05)",
                    color:potionTab==="carry"?"#4ade80":"#9fb0cf",
                    fontWeight:900,fontSize:12,cursor:"pointer",
                  }}>
                  🧪 攜帶型
                </button>
                <button onClick={()=>setPotionTab("throw")}
                  style={{
                    flex:1,padding:"8px 0",borderRadius:10,
                    border:potionTab==="throw"?"1px solid #f87171":"1px solid rgba(255,255,255,.12)",
                    background:potionTab==="throw"?"rgba(248,113,113,.18)":"rgba(255,255,255,.05)",
                    color:potionTab==="throw"?"#f87171":"#9fb0cf",
                    fontWeight:900,fontSize:12,cursor:"pointer",
                  }}>
                  🔪 投擲型
                </button>
                <button onClick={()=>setShowPotionPanel(false)}
                  style={{
                    padding:"8px 12px",borderRadius:10,
                    border:"1px solid rgba(255,255,255,.12)",
                    background:"rgba(255,255,255,.05)",
                    color:"#6b7a99",fontWeight:800,fontSize:12,cursor:"pointer",
                  }}>✕</button>
              </div>

              {/* 藥水列表 */}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {(potionTab === "carry" ? CARRY_TEST : THROW_TEST).map(p => (
                  <button key={p.id} onClick={() => potionTab === "carry" ? useCarryPotion(p) : useThrowPotion(p)}
                    disabled={!!usedPotionInfo}
                    style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"10px 12px",borderRadius:12,
                      border:"1px solid rgba(255,255,255,.08)",
                      background:usedPotionInfo?"rgba(255,255,255,.02)":"rgba(255,255,255,.05)",
                      cursor:usedPotionInfo?"not-allowed":"pointer",
                      opacity:usedPotionInfo?0.4:1,
                      textAlign:"left",width:"100%",
                      transition:"all .12s",
                    }}
                    onMouseEnter={e=>{if(!usedPotionInfo)e.currentTarget.style.background="rgba(255,255,255,.1)";}}
                    onMouseLeave={e=>{if(!usedPotionInfo)e.currentTarget.style.background="rgba(255,255,255,.05)";}}>
                    <span style={{fontSize:20}}>{p.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:900,color:"#eef3fc"}}>
                        {p.name}
                        <span style={{
                          fontSize:9,fontWeight:700,marginLeft:6,
                          color:p.rarity==="uncommon"?"#4ade80":p.rarity==="rare"?"#60a5fa":"#9fb0cf",
                        }}>
                          {p.rarity==="common"?"普通":p.rarity==="uncommon"?"高級":"稀有"}
                        </span>
                      </div>
                      <div style={{fontSize:10,color:"#9fb0cf",marginTop:1}}>{p.effectText}</div>
                    </div>
                    <span style={{fontSize:10,fontWeight:800,color:usedPotionInfo?"#6b7a99":"#f5b942"}}>
                      {usedPotionInfo ? "已用" : "使用"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 計分覆蓋層 ── */}
        {isScoring && (
          <div style={{
            position:"absolute",inset:0,zIndex:10,
            background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",
            display:"flex",flexDirection:"column",justifyContent:"flex-end",
          }}>
            <div style={{
              background:"linear-gradient(180deg,#101a2e,#0b1220)",
              borderTop:"1px solid rgba(255,255,255,.12)",
              borderRadius:"22px 22px 0 0",padding:"16px 16px 20px",
              boxShadow:"0 -20px 50px rgba(0,0,0,.6)",
              animation:"rise .28s cubic-bezier(.2,.9,.3,1)",
            }}>
              {/* 標題 + 目前已射箭數 */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:14,fontWeight:900,color:battle.arrows.length >= ARROWS_PER_ROUND ? "#f5b942" : "#eef3fc"}}>
                  {battle.arrows.length >= ARROWS_PER_ROUND
                    ? "✅ 6 箭已輸入，確認無誤後送出"
                    : `輸入第 ${battle.arrowIdx + 1} 箭分數`}
                </div>
                <div style={{fontSize:11,color:"#9fb0cf"}}>
                  {Math.min(battle.arrows.length, ARROWS_PER_ROUND)} / {ARROWS_PER_ROUND} 箭
                </div>
              </div>

              {/* 靶面計分模式：點靶面選環（不出數字鍵盤）；數字模式則完全不顯示靶紙 */}
              {scoreInput === "target" && (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:10}}>
                  <TargetFace arrows={battle.arrows} onPick={battle.arrows.length < ARROWS_PER_ROUND ? handleScore : undefined} />
                  <div style={{fontSize:11,color:"#9fb0cf",marginTop:4}}>👆 點靶面對應環數計分（中心＝X、靶外＝脫靶M）</div>
                </div>
              )}

              {/* 已射箭回顧 */}
              <div style={{display:"flex",gap:6,marginBottom:12,minHeight:36,alignItems:"center"}}>
                {Array.from({length:ARROWS_PER_ROUND}).map((_, i) => {
                  const a = battle.arrows[i];
                  return (
                    <div key={i} style={{
                      flex:1,height:34,borderRadius:9,
                      border: a
                        ? (a.isCrit ? "1px solid #fbbf24" : "1px solid rgba(255,255,255,.2)")
                        : (i === battle.arrowIdx ? "2px solid #f5b942" : "1px dashed rgba(255,255,255,.16)"),
                      display:"grid",placeItems:"center",fontSize:14,fontWeight:900,
                      color: a ? "#eaf6ff" : (i === battle.arrowIdx ? "#f5b942" : "#6b7a99"),
                      background: a
                        ? (a.isCrit ? "rgba(251,191,36,.18)" : "rgba(255,255,255,.08)")
                        : (i === battle.arrowIdx ? "rgba(245,185,66,.12)" : "rgba(255,255,255,.03)"),
                      fontVariantNumeric:"tabular-nums",
                      boxShadow:i === battle.arrowIdx ? "0 0 0 2px rgba(245,185,66,.3)" : "none",
                    }}>
                      {a ? a.score : (i === battle.arrowIdx ? "▼" : "")}
                    </div>
                  );
                })}
              </div>

              {/* 數字鍵盤（滿 6 箭後停用，改由下方「送出」出擊）— 只在數字計分模式顯示 */}
              {scoreInput === "keypad" && <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,
                opacity: battle.arrows.length >= ARROWS_PER_ROUND ? .35 : 1,
                pointerEvents: battle.arrows.length >= ARROWS_PER_ROUND ? "none" : "auto"}}>
                {scoreKeys.map(k => (
                  <button key={k} onClick={() => handleScore(k)} style={{
                    height:46,borderRadius:11,
                    border:k==="X"
                      ?"1px solid rgba(245,185,66,.4)"
                      :k==="M"
                        ?"1px solid rgba(239,83,80,.4)"
                        :"1px solid rgba(255,255,255,.12)",
                    background:"rgba(255,255,255,.05)",
                    color:k==="X"?"#f5b942":k==="M"?"#f87171":"#eef3fc",
                    fontSize:18,fontWeight:800,cursor:"pointer",
                    fontVariantNumeric:"tabular-nums",
                    transition:"transform .1s, background .1s",
                  }}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.11)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";}}
                    onMouseDown={e=>{e.currentTarget.style.transform="scale(.93)";}}
                    onMouseUp={e=>{e.currentTarget.style.transform="scale(1)";}}>
                    {k}
                  </button>
                ))}
              </div>}

              {/* 控制列：刪除上一箭 / 送出 —— 分數輸入後由玩家確認才出擊 */}
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={handleUndo} disabled={battle.arrows.length === 0} style={{
                  flex:"0 0 auto",padding:"0 16px",height:46,borderRadius:11,
                  border:"1px solid rgba(255,255,255,.14)",
                  background:"rgba(255,255,255,.05)",
                  color: battle.arrows.length === 0 ? "#5a6b8a" : "#cbd6ea",
                  fontSize:14,fontWeight:800,
                  cursor: battle.arrows.length === 0 ? "not-allowed" : "pointer",
                }}>⌫ 刪除上一箭</button>
                <button onClick={handleSubmit} disabled={battle.arrows.length < ARROWS_PER_ROUND} style={{
                  flex:1,height:46,borderRadius:11,border:"none",
                  background: battle.arrows.length >= ARROWS_PER_ROUND
                    ? "linear-gradient(180deg,#ffcf5a,#f5a623)"
                    : "rgba(255,255,255,.06)",
                  color: battle.arrows.length >= ARROWS_PER_ROUND ? "#3a2600" : "#5a6b8a",
                  fontSize:16,fontWeight:900,
                  cursor: battle.arrows.length >= ARROWS_PER_ROUND ? "pointer" : "not-allowed",
                  boxShadow: battle.arrows.length >= ARROWS_PER_ROUND ? "0 6px 18px rgba(245,166,35,.4)" : "none",
                  transition:"transform .1s",
                }}
                  onMouseDown={e=>{if(battle.arrows.length>=ARROWS_PER_ROUND)e.currentTarget.style.transform="scale(.97)";}}
                  onMouseUp={e=>{e.currentTarget.style.transform="scale(1)";}}>
                  {battle.arrows.length >= ARROWS_PER_ROUND ? "🏹 送出這一回合" : `再輸入 ${ARROWS_PER_ROUND - battle.arrows.length} 箭`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 逐箭命中不再用覆蓋層遮畫面：改由怪物身上的傷害浮字 + 玩家/隊友框演出呈現（見上方） */}

        {/* 貓貓協戰動畫（不遮全畫面，只置中一張小卡） */}
        {isProcessing && animStep === 7 && (
          <div key="cat-step" style={{
            position:"absolute",inset:0,zIndex:9,
            display:"flex",alignItems:"center",justifyContent:"center",
            pointerEvents:"none",animation:"defFade .25s ease-out",
          }}>
            <div style={{
              background:"rgba(6,10,18,.85)",border:`1px solid ${catGlowColor}66`,
              borderRadius:16,padding:"12px 24px",
              boxShadow:`0 0 30px ${catGlowColor}44`,
              animation:"pop .3s cubic-bezier(.2,.9,.3,1)",
              textAlign:"center",
            }}>
              <div style={{fontSize:14,fontWeight:900,color:"#fff",marginBottom:2}}>🐱 {catName} 協戰攻擊！</div>
              <div style={{fontSize:12,color:catGlowColor,fontWeight:700}}>造成 {Math.round(catATK * 0.8)} 傷害</div>
            </div>
          </div>
        )}

        {/* 怪物反擊動畫（不遮全畫面，只置中一張小卡；玩家卡同時播 playerHurt 紅震） */}
        {isProcessing && animStep === 8 && (
          <div key="counter-step" style={{
            position:"absolute",inset:0,zIndex:9,
            display:"flex",alignItems:"center",justifyContent:"center",
            pointerEvents:"none",animation:"defFade .25s ease-out",
          }}>
            <div style={{
              background:"rgba(30,10,10,.88)",border:"1px solid rgba(239,83,80,.5)",
              borderRadius:16,padding:"12px 24px",
              boxShadow:"0 0 30px rgba(239,83,80,.3)",
              animation:"pop .3s cubic-bezier(.2,.9,.3,1)",
              textAlign:"center",
            }}>
              <div style={{fontSize:14,fontWeight:900,color:"#f87171",marginBottom:2}}>💥 怪物反擊！</div>
              <div style={{fontSize:12,color:"#ffc4c2",fontWeight:700}}>{SELF.name} 受到 {battle.counterDmg} 傷害</div>
            </div>
          </div>
        )}

        {/* ── 回合開始前特殊事件卡 ── */}
        {roundEvent && isPlaying && (
          <div onClick={()=>setRoundEvent(null)} style={{
            position:"absolute",inset:0,zIndex:11,
            background:"rgba(4,7,13,.5)",backdropFilter:"blur(2px)",
            display:"flex",alignItems:"center",justifyContent:"center",padding:20,
          }}>
            <div onClick={e=>e.stopPropagation()} style={{
              width:"100%",maxWidth:260,textAlign:"center",
              background:"linear-gradient(180deg,#141f36,#0c1424)",
              border:`1px solid ${roundEvent.color}66`,borderRadius:18,padding:"22px 18px",
              boxShadow:`0 20px 60px rgba(0,0,0,.6), 0 0 34px ${roundEvent.color}33`,
              animation:"pop .26s cubic-bezier(.2,.9,.3,1)",
            }}>
              <div style={{fontSize:11,fontWeight:800,color:"#9fb0cf",letterSpacing:".1em",marginBottom:6}}>回合開始前 · 特殊事件</div>
              <div style={{fontSize:44,marginBottom:6}}>{roundEvent.icon}</div>
              <div style={{fontSize:20,fontWeight:900,color:roundEvent.color,marginBottom:6}}>{roundEvent.title}</div>
              <div style={{fontSize:12,color:"#c7d3e6",lineHeight:1.6,marginBottom:16}}>{roundEvent.desc}</div>
              <button onClick={()=>setRoundEvent(null)} style={{
                width:"100%",padding:11,borderRadius:11,border:"none",cursor:"pointer",
                background:`linear-gradient(135deg,${roundEvent.color},${roundEvent.color}bb)`,
                color:"#0b1220",fontSize:14,fontWeight:900,letterSpacing:".05em",
              }}>了解，開始這回合</button>
            </div>
          </div>
        )}

        {/* ── 回合結果覆蓋層 ── */}
        {isRoundRes && (
          <div style={{
            position:"absolute",inset:0,zIndex:10,
            background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",
            display:"flex",flexDirection:"column",justifyContent:"flex-end",
          }}>
            <div style={{
              background:"linear-gradient(180deg,#101a2e,#0b1220)",
              borderTop:"1px solid rgba(255,255,255,.12)",
              borderRadius:"22px 22px 0 0",padding:"16px 16px 20px",
              boxShadow:"0 -20px 50px rgba(0,0,0,.6)",
              animation:"rise .28s cubic-bezier(.2,.9,.3,1)",
            }}>
              <div style={{textAlign:"center",marginBottom:14}}>
                <div style={{fontSize:15,fontWeight:900,color:"#eef3fc",marginBottom:6}}>
                  🏹 第 {battle.round} 回合 結算
                </div>
                <div style={{display:"flex",justifyContent:"center",gap:24}}>
                  <div>
                    <div style={{fontSize:10,color:"#9fb0cf",fontWeight:700}}>造成傷害</div>
                    <div style={{fontSize:24,fontWeight:900,color:"#ffd27a",fontVariantNumeric:"tabular-nums"}}>
                      {battle.roundDmg}
                    </div>
                  </div>
                  <div style={{width:1,background:"rgba(255,255,255,.1)"}} />
                  <div>
                    <div style={{fontSize:10,color:"#9fb0cf",fontWeight:700}}>爆擊次數</div>
                    <div style={{fontSize:24,fontWeight:900,color:"#fbbf24",fontVariantNumeric:"tabular-nums"}}>
                      🔥{battle.roundCrits}
                    </div>
                  </div>
                  <div style={{width:1,background:"rgba(255,255,255,.1)"}} />
                  <div>
                    <div style={{fontSize:10,color:"#9fb0cf",fontWeight:700}}>受到反擊</div>
                    <div style={{fontSize:24,fontWeight:900,color:"#ff7a7a",fontVariantNumeric:"tabular-nums"}}>
                      -{battle.counterDmg}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleNextRound} style={{
                width:"100%",padding:13,borderRadius:11,
                background:"linear-gradient(135deg,#f7c65a,#e79a1e)",
                color:"#241400",fontSize:16,fontWeight:900,
                border:"none",cursor:"pointer",letterSpacing:".06em",
              }}>下一回合 ➡️</button>
            </div>
          </div>
        )}

        {/* ── 勝利覆蓋層 ── */}
        {isWon && (
          <div style={{
            position:"absolute",inset:0,zIndex:10,
            background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",
            display:"flex",alignItems:"center",justifyContent:"center",padding:20,
          }}>
            <div style={{
              width:"100%",maxWidth:280,
              background:"linear-gradient(180deg,#0f2a1e,#0a1f14)",
              border:"1px solid rgba(74,222,128,.35)",
              borderRadius:18,padding:"28px 20px",
              boxShadow:"0 20px 60px rgba(0,0,0,.6), 0 0 40px rgba(74,222,128,.15)",
              animation:"pop .24s cubic-bezier(.2,.9,.3,1)",
              textAlign:"center",
            }}>
              <div style={{fontSize:48,marginBottom:10}}>🏆</div>
              <div style={{fontSize:22,fontWeight:900,color:"#4ade80",marginBottom:6}}>戰鬥勝利！</div>
              <div style={{fontSize:12,color:"#9fb0cf",lineHeight:1.6,marginBottom:16}}>
                花了 <b style={{color:"#dbe6f8"}}>{battle.round}</b> 回合擊敗了 <b style={{color:"#dbe6f8"}}>{battle.monsterName}</b>
                <br />
                總傷害：<b style={{color:"#ffd27a"}}>{battle.arrows.reduce((s,a)=>s+a.dmg,0) + battle.roundDmg}</b>
              </div>
              <button onClick={handleReset} style={{
                width:"100%",padding:12,borderRadius:11,
                background:"linear-gradient(135deg,#4ade80,#22b866)",
                color:"#0a1f14",fontSize:15,fontWeight:900,
                border:"none",cursor:"pointer",letterSpacing:".06em",
              }}>🔄 再戰一次</button>
            </div>
          </div>
        )}

        {/* ── 敗北覆蓋層 ── */}
        {isLost && (
          <div style={{
            position:"absolute",inset:0,zIndex:10,
            background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",
            display:"flex",alignItems:"center",justifyContent:"center",padding:20,
          }}>
            <div style={{
              width:"100%",maxWidth:280,
              background:"linear-gradient(180deg,#2a0f0f,#1a0a0a)",
              border:"1px solid rgba(239,83,80,.35)",
              borderRadius:18,padding:"28px 20px",
              boxShadow:"0 20px 60px rgba(0,0,0,.6), 0 0 40px rgba(239,83,80,.15)",
              animation:"pop .24s cubic-bezier(.2,.9,.3,1)",
              textAlign:"center",
            }}>
              <div style={{fontSize:48,marginBottom:10}}>💀</div>
              <div style={{fontSize:22,fontWeight:900,color:"#f87171",marginBottom:6}}>戰鬥敗北...</div>
              <div style={{fontSize:12,color:"#9fb0cf",lineHeight:1.6,marginBottom:16}}>
                在第 <b style={{color:"#dbe6f8"}}>{battle.round}</b> 回合被 <b style={{color:"#dbe6f8"}}>{battle.monsterName}</b> 擊倒
                <br />
                怪物還剩 <b style={{color:"#f87171"}}>{battle.monsterHp.toLocaleString()}</b> HP
              </div>
              <button onClick={handleReset} style={{
                width:"100%",padding:12,borderRadius:11,
                background:"linear-gradient(135deg,#f87171,#dc2626)",
                color:"#fff",fontSize:15,fontWeight:900,
                border:"none",cursor:"pointer",letterSpacing:".06em",
              }}>🔄 重來一次</button>
            </div>
          </div>
        )}

        {/* ── 隊友詳情覆蓋層 ── */}
        {showDetail && team.length > 0 && (
          <div onClick={()=>setShowDetail(false)} style={{
            position:"absolute",inset:0,zIndex:10,
            background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",
            display:"flex",alignItems:"center",justifyContent:"center",padding:20,
          }}>
            <div onClick={e=>e.stopPropagation()} style={{
              width:"100%",maxWidth:300,
              background:"linear-gradient(180deg,#141f36,#0c1424)",
              border:"1px solid rgba(255,255,255,.12)",borderRadius:18,padding:18,
              boxShadow:"0 20px 60px rgba(0,0,0,.6)",
              animation:"pop .24s cubic-bezier(.2,.9,.3,1)",
            }}>
              <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14}}>
                <div style={{width:62,height:62,borderRadius:15,overflow:"hidden",flexShrink:0,boxShadow:"inset 0 0 0 2px " + (team[detailMateIdx]?.isFront?"#ffb454":"#7dd3fc")}}>
                  <CatSVG catId={team[detailMateIdx]?.catId} size={62} />
                </div>
                <div>
                  <div style={{fontSize:17,fontWeight:900,color:"#eef3fc",display:"flex",alignItems:"center",gap:7}}>
                    {team[detailMateIdx]?.name}
                    <span style={{fontSize:10,fontWeight:900,color:"#111",borderRadius:6,padding:"2px 7px",background:team[detailMateIdx]?.isFront?"#ffb454":"#7dd3fc"}}>
                      {team[detailMateIdx]?.isFront?"前衛":"後衛"}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"14px 0"}}>
                {[
                  {label:"ATK",value:team[detailMateIdx]?.atk,color:"#f87171"},
                  {label:"DEF",value:team[detailMateIdx]?.def,color:"#60a5fa"},
                  {label:"HP",value:team[detailMateIdx]?.hp?.toLocaleString(),color:"#4ade80"},
                  {label:"狀態",value:team[detailMateIdx]?.done?"✓ 已出手":"⏳ 等待中",color:team[detailMateIdx]?.done?"#4ade80":"#f5b942"},
                ].map((s,i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:"8px 10px"}}>
                    <div style={{fontSize:10,color:"#9fb0cf",letterSpacing:".04em"}}>{s.label}</div>
                    <div style={{fontSize:16,fontWeight:900,color:s.color,fontVariantNumeric:"tabular-nums",marginTop:1}}>{s.value}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setShowDetail(false)} style={{
                width:"100%",padding:11,borderRadius:11,
                border:"1px solid rgba(255,255,255,.12)",
                background:"rgba(255,255,255,.06)",
                color:"#eef3fc",fontWeight:800,fontSize:14,cursor:"pointer",
              }}>關閉</button>
            </div>
          </div>
        )}
      </div>

      {/* ════ 控制面板 ════ */}
      {showCtl && (
        <div style={{width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:14}}>
          <CtrlGroup title="怪物選擇">
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {MONSTERS.map((m,i)=>(
                <Chip key={m.id} active={mIdx===i} onClick={()=>{if(!inBattle)setMIdx(i);}}
                  disabled={inBattle}>
                  <MonsterSVG id={m.id} size={18} /> {m.name}
                </Chip>
              ))}
            </div>
          </CtrlGroup>
          <CtrlGroup title="難度">
            <div style={{display:"flex",gap:6}}>
              {DIFF_MULTS.map((d,i)=>(
                <Chip key={d.id} active={dIdx===i} onClick={()=>{if(!inBattle)setDIdx(i);}}
                  disabled={inBattle}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </CtrlGroup>
          <CtrlGroup title="戰鬥模式">
            <div style={{display:"flex",gap:6}}>
              <Chip active={battleMode==="score"} onClick={()=>{if(!inBattle)setBattleMode("score");}}
                disabled={inBattle}>
                🎯 分數靶
              </Chip>
              <Chip active={battleMode==="zombie"} onClick={()=>{if(!inBattle)setBattleMode("zombie");}}
                disabled={inBattle}>
                🧟 殭屍靶
              </Chip>
            </div>
          </CtrlGroup>
          <CtrlGroup title="計分方式（進場前設定）">
            <div style={{display:"flex",gap:6}}>
              <Chip active={scoreInput==="keypad"} onClick={()=>{if(!inBattle)setScoreInput("keypad");}}
                disabled={inBattle}>
                🔢 數字計分
              </Chip>
              <Chip active={scoreInput==="target"} onClick={()=>{if(!inBattle)setScoreInput("target");}}
                disabled={inBattle}>
                🎯 靶面計分
              </Chip>
            </div>
          </CtrlGroup>
          <CtrlGroup title="裝備卡稱號（玩家卡外框）">
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {Object.entries(FRAME_TIERS).map(([id,f]) => (
                <Chip key={id} active={cardFrame===id} onClick={()=>setCardFrame(id)}>
                  <span style={{width:10,height:10,borderRadius:99,background:f.c,display:"inline-block"}} /> {f.label}
                </Chip>
              ))}
            </div>
          </CtrlGroup>
          <CtrlGroup title="🐱 貓貓夥伴">
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
              <Chip active={!selectedCatId} onClick={()=>{if(!inBattle)setSelectedCatId(null);}}
                disabled={inBattle} style={{fontSize:10}}>
                ❌ 無
              </Chip>
              {CAT_IDS.map(cid => (
                <Chip key={cid} active={selectedCatId===cid}
                  onClick={()=>{if(!inBattle)setSelectedCatId(cid);}}
                  disabled={inBattle}
                  style={{fontSize:10,gap:3}}>
                  <CatSVG catId={cid} size={16} /> {CATS[cid]?.name}
                </Chip>
              ))}
            </div>
            {hasCat && !inBattle && (
              <div style={{fontSize:10,color:"#a78bfa",fontWeight:700}}>
                🎯 {catName} · {catTypeLabel} · Lv.{catLevel} · 羈絆 Lv.{catBondLv}
                · HP:{catMaxHP} ATK:{catATK} DEF:{catDEF}
              </div>
            )}
          </CtrlGroup>
          <CtrlGroup title="玩家人數（隊友視覺）">
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[1,2,3,4,5,6,7,8].map(n=>(
                <Chip key={n} active={playerCount===n}
                  onClick={()=>setPlayerCount(n)}
                  disabled={inBattle}>
                  {n===1?"單人":`${n}人`}
                </Chip>
              ))}
            </div>
          </CtrlGroup>
          <CtrlGroup title="戰鬥資訊">
            <div style={{fontSize:12,color:"#9fb0cf",lineHeight:1.8}}>
              {inBattle ? (
                <div>
                  <div>🏁 第 <b style={{color:"#f5b942"}}>{battle.round}</b> 回合</div>
                  <div>👹 {battle.monsterName}：HP <b style={{color:"#f87171"}}>{battle.monsterHp.toLocaleString()}</b> / {battle.monsterMaxHp.toLocaleString()}</div>
                  <div>🦸 {SELF.name}：HP <b style={{color:"#4ade80"}}>{battle.playerHp.toLocaleString()}</b> / {battle.playerMaxHp.toLocaleString()}</div>
                  <div>🏹 已射 {battle.arrowIdx}/{ARROWS_PER_ROUND} 箭 | 累計 {battle.arrows.reduce((s,a)=>s+a.dmg,0)} 傷害</div>
                  {usedPotionInfo && <div>⚗️ 藥水：{usedPotionInfo.icon} {usedPotionInfo.name}</div>}
                  {skipBigRound && <div>🕸️ 怪物反擊跳過</div>}
                  {counterReducePct > 0 && <div>💨 反擊 -{counterReducePct}%</div>}
                  {battle.potionShield > 0 && <div>🫧 護盾 {battle.potionShield}</div>}
                  {hasCat && <div>🐱 {catName}：HP <b style={{color:"#a78bfa"}}>{catCurrentHP || catMaxHP}</b>/{catMaxHP} ATK:{catATK}</div>}
                  {hasCat && catSkillActive && <div style={{color:"#a78bfa"}}>🛡️ 貓貓防禦技能作用中</div>}
                  {battle.battleMode === "zombie" && battle.unlockedParts?.size > 0 && (
                    <div style={{marginTop:4}}>
                      🗝️ 已解鎖部位：
                      {Array.from(battle.unlockedParts).filter(id => ["chest","belly","groin","heart","lung","kidney","balls"].includes(id)).map((id,i,a) => {
                        const p = BODY_PARTS.find(bp => bp.id === id);
                        return p ? (
                          <span key={id} style={{marginRight:4}}>{p.icon}</span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div>點擊「開始戰鬥」進行實戰測試</div>
              )}
              {battle.messages.length > 0 && (
                <div style={{marginTop:8,borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:8,maxHeight:80,overflowY:"auto"}}>
                  {battle.messages.slice(-3).map((msg,i)=>(
                    <div key={i} style={{opacity:0.8}}>{msg}</div>
                  ))}
                </div>
              )}
            </div>
          </CtrlGroup>
          {/* 音效模式切換 */}
          <div style={{display:"flex",gap:8}}>
            <button onClick={() => {
              toggleBattleSoundMode();
              setSoundMode(getBattleSoundMode());
            }}
              style={{
                flex:1,
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                padding:"10px 12px",borderRadius:11,
                border:"1px solid " + (soundMode === "live" ? "rgba(132,204,22,.5)" : "rgba(255,255,255,.12)"),
                background: soundMode === "live"
                  ? "rgba(132,204,22,.12)"
                  : "rgba(255,255,255,.05)",
                color: soundMode === "live" ? "#bef264" : "#9fb0cf",
                fontSize:12,fontWeight:800,
                cursor:"pointer",transition:"all .15s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.filter="brightness(1.15)";}}
              onMouseLeave={e=>{e.currentTarget.style.filter="brightness(1)";}}>
              {soundMode === "live" ? "🎵" : "🔧"} 音效：{soundMode === "live" ? "播放中" : "除錯"}
            </button>
          </div>

          {!inBattle && (
            <button onClick={handleStartBattle}
              style={{
                width:"100%",padding:"14px 0",borderRadius:14,
                background:"linear-gradient(135deg,#f7c65a,#e79a1e)",
                border:"none",
                color:"#241400",fontSize:16,fontWeight:900,
                cursor:"pointer",boxShadow:"0 8px 24px rgba(231,154,30,.4)",
                transition:"transform .12s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.02)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}
              onMouseDown={e=>{e.currentTarget.style.transform="scale(.97)";}}>
              ⚔️ 開始戰鬥
            </button>
          )}
        </div>
      )}

      <button onClick={()=>setShowCtl(s=>!s)}
        style={{padding:"8px 20px",borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.06)",color:"#9fb0cf",fontSize:12,fontWeight:800,cursor:"pointer",transition:"all .15s"}}>
        {showCtl?"🙈 隱藏控制面板":"👁️ 顯示控制面板"}
      </button>

      <style>{`
        @keyframes bob { 50% { transform: translateY(-8px); } }
        @keyframes rise { from { transform: translateY(60px); opacity: 0; } }
        @keyframes pop { from { transform: scale(.9); opacity: 0; } }
        @keyframes msgIn { from { transform: translateX(-20px); opacity: 0; } }
        @keyframes admPulse { 50% { opacity: .4; } }
        @keyframes wonShake { 0% { transform: rotate(0); } 25% { transform: rotate(-5deg); } 75% { transform: rotate(5deg); } 100% { transform: rotate(0); } }
        @keyframes introArc { from{opacity:0;transform:translateX(-90px) scale(.6)} to{opacity:1;transform:translateX(0) scale(1)} }
        @keyframes introMon { from{opacity:0;transform:translateX(90px) scale(.6)} to{opacity:1;transform:translateX(0) scale(1)} }
        @keyframes introVs { 0%{opacity:0;transform:scale(.2) rotate(-18deg)} 55%{transform:scale(1.3) rotate(4deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes introStart { from{opacity:0;transform:translateY(18px) scale(.85)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes introCat { from{opacity:0;transform:translateX(-30px) scale(.5) rotate(-12deg)} to{opacity:1;transform:translateX(0) scale(1) rotate(0)} }
        @keyframes defFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes defMon { 0%{filter:brightness(1)} 20%{filter:brightness(3.5) drop-shadow(0 0 40px #ef4444)} 100%{filter:brightness(.1) grayscale(.8) drop-shadow(0 0 6px #555)} }
        @keyframes defBadge { 0%{opacity:0;transform:scale(2.2) rotate(-20deg)} 55%{opacity:1;transform:scale(.92) rotate(6deg)} 100%{opacity:1;transform:scale(1) rotate(-8deg)} }
        @keyframes defVictory { 0%{opacity:0;transform:scale(.3) rotate(-12deg)} 55%{transform:scale(1.2) rotate(3deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes defStats { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes catPulse { 50% { filter: drop-shadow(0 0 6px var(--cat-glow, #a78bfa)); } }
        @keyframes catCry { 0%{opacity:0;transform:scale(.3) translateY(8px) rotate(-10deg)} 55%{opacity:1;transform:scale(1.2) translateY(-2px) rotate(3deg)} 100%{opacity:1;transform:scale(1) translateY(0) rotate(0)} }
        @keyframes catParticle { 0%{opacity:0;transform:scale(0) translateY(10px) rotate(0deg)} 50%{opacity:1;transform:scale(1.3) translateY(-15px) rotate(180deg)} 100%{opacity:0;transform:scale(.5) translateY(-30px) rotate(360deg)} }
        @keyframes procMonster { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px) rotate(-2deg)} 75%{transform:translateX(6px) rotate(2deg)} }
        @keyframes dmgFloat { 0%{opacity:0;transform:translateY(6px) scale(.6)} 25%{opacity:1;transform:translateY(-6px) scale(1.15)} 100%{opacity:0;transform:translateY(-38px) scale(1)} }
        @keyframes critFlash { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }
        @keyframes hitShock { 0%{filter:brightness(1)} 15%{filter:brightness(2.6) drop-shadow(0 0 18px #fff)} 100%{filter:brightness(1)} }
        @keyframes playerAttack { 0%{transform:translateY(0)} 35%{transform:translateY(-14px)} 100%{transform:translateY(0)} }
        @keyframes playerMiss { 0%,100%{transform:translateY(0);opacity:1} 40%{transform:translateY(3px);opacity:.65} }
        @keyframes playerHurt { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 45%{transform:translateX(6px)} 70%{transform:translateX(-3px)} }
        @keyframes teamAttack { 0%{transform:translateY(0)} 40%{transform:translateY(-10px)} 100%{transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ── 射箭靶面：顯示這一回合各箭落點 ──────────────────────────────
// 只知道環數、不知確切座標，故每箭用固定角度表 + 依環數決定半徑帶，落點穩定不亂跳。
const TARGET_ANGLES = [35, 160, 275, 95, 210, 330]; // 6 箭固定分佈，避免落點重疊
function arrowMark(i, score) {
  const isX = score === "X", isM = score === "M";
  const num = isX ? 10 : (isM ? 0 : Number(score));
  const ang = TARGET_ANGLES[i % TARGET_ANGLES.length] * Math.PI / 180;
  const rNorm = isM ? 1.08 : isX ? 0.04 : ((10 - num) + 0.5) / 10; // 分數越高越靠中心
  return { x: Math.cos(ang) * rNorm, y: Math.sin(ang) * rNorm };
}
function TargetFace({ arrows, onPick }) {
  const R = 90, c = 100;
  // 世界射箭靶配色：外到內＝白 / 黑 / 藍 / 紅 / 金（每色兩環）
  const bands = [
    { r: 1.0, fill: "#dfe5ec" },
    { r: 0.8, fill: "#2b3242" },
    { r: 0.6, fill: "#3f8ee0" },
    { r: 0.4, fill: "#e8524e" },
    { r: 0.2, fill: "#f5c93f" },
  ];
  // 點靶面 → 依落點半徑換算環數（onPick 存在時才可點）
  function handleClick(e) {
    if (!onPick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 200 - c;
    const y = (e.clientY - rect.top) / rect.height * 200 - c;
    const rNorm = Math.sqrt(x * x + y * y) / R;
    if (rNorm > 1.0) return onPick("M");
    if (rNorm <= 0.05) return onPick("X");
    onPick(String(Math.max(1, Math.min(10, 10 - Math.floor(rNorm * 10)))));
  }
  return (
    <svg viewBox="0 0 200 200" onClick={handleClick}
      style={{ width: onPick ? 210 : 168, height: onPick ? 210 : 168, cursor: onPick ? "crosshair" : "default", filter: "drop-shadow(0 6px 16px rgba(0,0,0,.5))" }}>
      {bands.map((b, i) => <circle key={i} cx={c} cy={c} r={R * b.r} fill={b.fill} />)}
      {Array.from({ length: 10 }).map((_, i) => (
        <circle key={"l" + i} cx={c} cy={c} r={R * (i + 1) / 10} fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="0.6" />
      ))}
      <circle cx={c} cy={c} r={R * 0.05} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="0.7" />
      {arrows.map((a, i) => {
        const m = arrowMark(i, a.score);
        const px = c + m.x * R, py = c + m.y * R;
        const isLast = i === arrows.length - 1;
        return (
          <circle key={i} cx={px} cy={py} r={isLast ? 5 : 3.6}
            fill={a.isCrit ? "#fff2a8" : "#8affc0"} stroke="#0b1220" strokeWidth="1.4">
            {isLast && <animate attributeName="r" values="7;5" dur="0.3s" repeatCount="1" />}
          </circle>
        );
      })}
    </svg>
  );
}

function CtrlGroup({ title, children }) {
  return (
    <div style={{background:"linear-gradient(180deg,rgba(20,29,48,.9),rgba(12,18,32,.9))",border:"1px solid rgba(255,255,255,.12)",borderRadius:16,padding:"14px 16px"}}>
      <div style={{margin:"0 0 8px",fontSize:11,letterSpacing:".14em",textTransform:"uppercase",color:"#f5b942",fontWeight:800}}>{title}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children, disabled }) {
  return (
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      style={{
        display:"inline-flex",alignItems:"center",gap:5,
        padding:"7px 12px",borderRadius:11,
        border:active?"1px solid transparent":"1px solid rgba(255,255,255,.12)",
        background:active?"linear-gradient(135deg,#f7c65a,#e79a1e)":"rgba(255,255,255,.05)",
        color:active?"#241400":(disabled?"#6b7a99":"#eef3fc"),
        fontWeight:800,fontSize:12,
        cursor:disabled?"not-allowed":"pointer",
        opacity:disabled?0.5:1,transition:"all .12s",
      }}
      onMouseEnter={e=>{if(!active&&!disabled)e.currentTarget.style.background="rgba(255,255,255,.11)";}}
      onMouseLeave={e=>{if(!active&&!disabled)e.currentTarget.style.background="rgba(255,255,255,.05)";}}>
      {children}
    </button>
  );
}
