// src/components/worldboss/WorldBossAttack.jsx — 世界大 Boss 戰鬥室
import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import { attackWorldBoss, hireWorldBossBot, updateWorldBossHP, distributeWorldBossRewards } from "../../lib/worldBossDb";
import { addPracticeLog, getCertRecords, subscribeCertification, subscribeCardCollection, addArcherXP, addAdventurerXP, addArrowdew, addGachaCoins, addRoundArrows, addCoins, recordGuestBattleStats, subscribePotions, usePotions, recordPotionUsed, finalizeGameShootingSession, subscribeLocalTodayArrows, initializeTodayArrows } from "../../lib/db";
import { addCatXP } from "../../lib/catDb";
import { CAT_BOSS_XP } from "../../lib/catLevel";
import { WORLD_BOSS_XP_CAP, WORLD_BOSS_XP_MULT, archerLevelFromXP, archerLevelBonus } from "../../lib/archerLevel";
import { calcArcherStats } from "../../lib/monsterData";
import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";
import { getParticipantBonus, simulateBotRound, drawRandomBot, BOSS_QUOTES } from "../../lib/worldBossData";
import { getWorldBossSkillConfig } from "../../lib/worldBossSkillData";
import { getWorldBossScheduledStrike, getWorldBossTelegraph, resolveWorldBossStrike } from "../../lib/worldBossStrikeEngine";
import WorldBossSVG from "./WorldBossSVG";
import WorldBossBattleCard from "./WorldBossBattleCard";
import CatMsg from "../cat/CatMsg";
import { sfxTap, sfxArrowHit, sfxCritBoom, sfxSoftFail, sfxCounter, sfxCounterCrit, sfxRoundEnd, sfxCast, sfxPotionDrink, vibrate } from "../../lib/sound";
import { playBattleSound } from "../../lib/battleSound";
import BattleSoundIndicator from "../shared/BattleSoundIndicator";
import TargetFaceOverlay, { TargetFmtPicker, InputModePicker, getBattleTargetFmt, setBattleTargetFmt, getBattleInputMode, setBattleInputMode } from "../shared/TargetFaceOverlay";
import BattleShootingProfile from "../shared/BattleShootingProfile";
import { loadBattleShootingProfile } from "../../lib/battlePractice";
import { BattleHPBar, BattleArrowSlots, BattleScoreButtons, BattleResultHeader, BattleStatRow, BattleLogPanel } from "../shared/SharedBattleComponents";
import { labelToValue, getScoreColor } from "../../lib/score";
import { getTargetScoreLabels } from "../../lib/targetFace";
import { calcWorldBossArrowDmg as wbArrowDmg, calcWorldBossCounter as wbCounter, resolvePlayerCounter, resolveStandardArrowHit } from "../../lib/damage";
import { BattleResultPanel } from "../shared/BattleResultPanel";
import { getMilestonesReached, getRewardsForMilestone } from "../../lib/arrowMilestone";
import { SmallMilestonePopup } from "../member/ArrowMilestonePopup";
import CatRoundOverlay from "../cat/CatRoundOverlay";
import { createDispatch } from "../../battle/BattleAnimation";
import { RoundController } from "../../battle/RoundController";
import WorldBossCardBadge from "../shared/WorldBossCardBadge";
import { POTIONS as BATTLE_CONSUMABLES, calcPotionBuffs } from "../../lib/itemData";
import { getConsumablesForMode, mergeCarryBuff, resolveConsumable } from "../../lib/consumableSystem";
import BattleScreen from "../battle/BattleScreen";

// ── WorldBoss 事件型別（客製，不經過 BattleAnimation） ──────
const WB_EVT = {
  ARROW:   'wb_arrow',
  CAT_MSG: 'wb_cat_msg',
  SUPPORT: 'wb_support',
};

// 世界王採「玩家 + AI 遠征隊」的合作演出，不把全服參戰者當成同一個即時房間。
// 上限包含玩家本人，因此最多 19 位虛擬隊友。
const WORLD_BOSS_PARTY_LIMIT = 14;
const VIRTUAL_TEAMMATE_NAMES = [
  "曙光", "星羽", "疾風", "鐵弦", "月影", "赤楓", "霜羽", "流火", "蒼穹", "晨星",
  "靜謐", "遠雷", "銀鈴", "青嵐", "夜梟", "飛燕", "白露", "熾羽", "破曉",
];

// scoreVal/scoreColor 統一由 ../../lib/score 管理
function scoreVal(s) { return labelToValue(s); }
function scoreColor(s) { return getScoreColor(s === 10 ? "X" : s === 0 ? "M" : String(s), "hex"); }

// ── Boss 反擊台詞池 ──────────────────────────────────────────
const BOSS_TAUNTS = [
  ["⚡", "黑暗之力爆發！"],
  ["🔥", "業火席捲戰場！"],
  ["💀", "怒吼震天！大地龜裂！"],
  ["🌑", "暗黑衝擊波席捲而來！"],
  ["💥", "狂暴化！攻擊力倍增！"],
  ["🌪️", "黑暗旋風吹來！"],
];
const BOSS_FINAL_TAUNTS = [
  ["☠️", "絕命一擊！傾盡全力！"],
  ["⚡", "終焉之力降臨！最後的怒吼！"],
  ["🌑", "末日審判——！"],
];

// ── 隊友助攻台詞池 ───────────────────────────────────────
const SUPPORT_MSGS = [
  (n, d) => `⚔️ ${n} 趁隙補刀！ -${d}`,
  (n, d) => `🏹 ${n} 援護箭命中！ -${d}`,
  (n, d) => `💥 ${n} 助攻暴擊！ -${d}`,
  (n, d) => `🔥 ${n} 點燃 Boss 弱點！ -${d}`,
  (n, d) => `⚡ ${n} 雷矢貫穿！ -${d}`,
  (n, d) => `🌀 ${n} 連環突擊！ -${d}`,
  (n, d) => `💫 ${n} 精準命中要害！ -${d}`,
  (n, d) => `🗡️ ${n} 背後偷襲！ -${d}`,
  (n, d) => `🌟 ${n} 星光箭矢！ -${d}`,
  (n, d) => `🔮 ${n} 魔力衝擊！ -${d}`,
  (n, d) => `🐾 ${n} 全力施為！ -${d}`,
  (n, d) => `☄️ ${n} 流星一箭！ -${d}`,
  (n, d) => `🎯 ${n} 精確射擊！ -${d}`,
  (n, d) => `💢 ${n} 爆怒斬擊！ -${d}`,
  (n, d) => `🌊 ${n} 潮浪強擊！ -${d}`,
];

// ── 藥水選項 ─────────────────────────────────────────────────
const POTIONS = [
  { id: "none",   label: "不使用",     mult: 1.0, cost: 0,    color: "#475569" },
  { id: "p_1.5",  label: "微光強化",   mult: 1.5, cost: 250,  color: "#22c55e" },
  { id: "p_2.0",  label: "強效激發",   mult: 2.0, cost: 800,  color: "#3b82f6" },
  { id: "p_2.5",  label: "狂暴衝擊",   mult: 2.5, cost: 1500, color: "#8b5cf6" },
  { id: "p_3.0",  label: "極限突破",   mult: 3.0, cost: 2500, color: "#f59e0b" },
  { id: "p_4.0",  label: "神話降臨",   mult: 4.0, cost: 4000, color: "#ef4444" },
];

const DEF_POTIONS = [
  { id: "def_none", label: "不使用",   defMult: 1.0, cost: 0,    color: "#475569" },
  { id: "def_1.5",  label: "鋼鐵壁壘", defMult: 1.5, cost: 250,  color: "#22c55e" },
  { id: "def_2.0",  label: "金剛身軀", defMult: 2.0, cost: 800,  color: "#3b82f6" },
  { id: "def_2.5",  label: "泰坦盾甲", defMult: 2.5, cost: 1500, color: "#8b5cf6" },
  { id: "def_3.0",  label: "無敵力場", defMult: 3.0, cost: 2500, color: "#f59e0b" },
  { id: "def_4.0",  label: "神聖結界", defMult: 4.0, cost: 4000, color: "#ef4444" },
];

const HP_POTIONS = [
  { id: "hp_none",  label: "不使用",   hpMult: 1.0, cost: 0,    color: "#475569" },
  { id: "hp_1.5",   label: "生命露水", hpMult: 1.5, cost: 250,  color: "#22c55e" },
  { id: "hp_2.0",   label: "活力泉湧", hpMult: 2.0, cost: 800,  color: "#3b82f6" },
  { id: "hp_2.5",   label: "巨人基因", hpMult: 2.5, cost: 1500, color: "#8b5cf6" },
  { id: "hp_3.0",   label: "不死長生", hpMult: 3.0, cost: 2500, color: "#f59e0b" },
  { id: "hp_4.0",   label: "血脈復甦", hpMult: 4.0, cost: 4000, color: "#ef4444" },
];

// ── 小元件 ──────────────────────────────────────────────────
function MiniHP({ current, max }) {
  const pct = max > 0 ? Math.max(0, current / max) * 100 : 0;
  const color = pct > 50 ? "#22c55e" : pct > 20 ? "#f97316" : "#ef4444";
  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function HPBar({ label, current, max, color }) {
  const pct = max > 0 ? Math.max(0, current / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400 font-bold">{label}</span>
        <span className="font-mono" style={{ color }}>{current} / {max}</span>
      </div>
      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}/>
      </div>
    </div>
  );
}

// ── 工具 ────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Boss 死亡動畫 ────────────────────────────────────────────
const KILL_NARRATIVES = {
  "X":  { emoji:"🎯", title:"黃金爆頭！",   sub:"正中10環，Boss 瞬間斃命！" },
  "10": { emoji:"⚔️", title:"精準一擊！",   sub:"完美落點，Boss 轟然倒下！" },
  "9":  { emoji:"🏹", title:"有效一擊！",   sub:"果斷射出，功成身退！" },
  "8":  { emoji:"💫", title:"險勝告終！",   sub:"差點讓 Boss 逃走，好險！" },
  "7":  { emoji:"😅", title:"千鈞一髮！",   sub:"這箭幸好沒飛走，一局定勝負！" },
  "6":  { emoji:"😱", title:"奇蹟邊界！",   sub:"最後一箭差點打到地板，Boss 倒了！" },
  "M":  { emoji:"🤯", title:"傳奇脫靶！",   sub:"箭飛了，Boss 竟然嚇死了⋯" },
};

function WorldBossDeathAnim({ boss, killerName, killerStyle, finishingArrow, onDone }) {
  const narrative = KILL_NARRATIVES[finishingArrow] || { emoji:"🏆", title:"Boss 擊殺！", sub:"英雄集體努力，終於告捷！" };
  useEffect(() => {
    const t = setTimeout(onDone, 6000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div onClick={onDone} style={{
      position:"fixed", inset:0, zIndex:9998, background:"rgba(0,0,0,0.97)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:24, cursor:"pointer", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", inset:0, background:"white", animation:"wb-screen-flash 0.55s ease forwards", pointerEvents:"none" }}/>
      {/* 射手 vs Boss */}
      <div style={{ display:"flex", alignItems:"flex-end", gap:16, marginBottom:16 }}>
        <div style={{ animation:"wb-archer-kill 0.5s ease 0.4s both", opacity:0, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <img
            src={`/cats/archers/${killerStyle || "baobao"}.webp`}
            alt={killerName || "射手"}
            onError={e => { e.target.style.display="none"; }}
            style={{ height:120, objectFit:"contain", objectPosition:"center bottom",
              filter:"drop-shadow(0 0 16px rgba(251,191,36,0.8))",
              animation:"mb-archer-attack 0.4s ease 0.8s" }}
          />
          <div style={{ fontSize:10, color:"#fbbf24", fontWeight:900 }}>{killerName}</div>
        </div>
        <div style={{ fontSize:28, animation:"wb-death-text 0.4s ease 1.0s both", opacity:0 }}>⚔️</div>
        <div style={{ animation:"wb-death-shake 1.2s ease 0.3s both", opacity:0.45 }}>
          <WorldBossSVG bossKey={boss.bossKey || boss.pixelKey || "head_coach"} currentHP={0} maxHP={1000} size={120}/>
        </div>
      </div>
      {/* DEFEATED! */}
      <div style={{
        fontSize:"2.8rem", fontWeight:900, color:"#fbbf24",
        textShadow:"0 0 40px #f59e0b, 0 0 80px #f59e0b88, 0 4px 20px rgba(0,0,0,0.9)",
        animation:"wb-death-text 0.7s cubic-bezier(.17,.67,.35,1.5) 0.7s both",
        letterSpacing:"0.1em", textAlign:"center",
      }}>DEFEATED!</div>
      {/* 擊殺方式台詞 */}
      <div style={{ animation:"wb-death-killer 0.5s ease 1.3s both", opacity:0, textAlign:"center", marginTop:12 }}>
        <div style={{ fontSize:"1.4rem", fontWeight:900, color:"#e2e8f0", marginBottom:4 }}>
          {narrative.emoji} {narrative.title}
        </div>
        {finishingArrow && (
          <div style={{ fontSize:"0.75rem", color:"#94a3b8" }}>最後一箭：<span style={{ color:"#fbbf24", fontWeight:900 }}>{finishingArrow}</span> — {narrative.sub}</div>
        )}
      </div>
      {/* Boss 已被討伐 */}
      <div style={{ marginTop:8, fontSize:"0.9rem", color:"rgba(255,255,255,0.45)", animation:"wb-death-killer 0.4s ease 1.7s both", opacity:0 }}>
        {boss.name}「{boss.title}」 已被討伐
      </div>
      <div style={{ marginTop:24, fontSize:"0.65rem", color:"rgba(255,255,255,0.2)", animation:"wb-death-killer 0.4s ease 2.5s both", opacity:0 }}>
        點擊繼續
      </div>
    </div>
  );
}

// ── 顏色池（隊員頭像）───────────────────────────────────────
const AVATAR_COLORS = ["#f59e0b","#ef4444","#3b82f6","#10b981","#8b5cf6","#ec4899","#f97316","#06b6d4"];
const ARCHER_STYLES = ["baobao","daming","diandian","gege","haji","meimei","niuniu","xiaoan","youyou"];

// ── 主元件 ──────────────────────────────────────────────────
const TOTAL_ROUNDS = 5;
const ARROWS_PER   = 6;

export default function WorldBossAttack({ event, onBack, guestOverride, onComplete }) {
  const { profile: authProfile } = useAuth();
  const profile = guestOverride || authProfile;
  const isGuest  = !!guestOverride || ["guest", "kid"].includes(profile?.accountType);
  const { saveBond, hasCat, catName, catATK, triggerCatSkill } = useCatCompanion(isGuest ? profile : null);
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── 正確載入檢定資料，確保 ATK 包含檢定加成 ─────────────
  const [certRecords,   setCertRecords]   = useState([]);
  const [certification, setCertification] = useState(null);
  const [certReady,     setCertReady]     = useState(false);
  useEffect(() => {
    if (isGuest || !profile?.id) { setCertReady(true); return; }
    getCertRecords(profile.id).then(r => { setCertRecords(r); setCertReady(true); }).catch(() => setCertReady(true));
    const unsub = subscribeCertification(profile.id, setCertification);
    return () => unsub?.();
  }, [profile?.id]); // eslint-disable-line

  const [cardColl,  setCardColl]  = useState({ cards: {}, equipped: [] });
  const [cardReady, setCardReady] = useState(false);
  useEffect(() => {
    if (isGuest || !profile?.id) { setCardReady(true); return; }
    return subscribeCardCollection(profile.id, c => { setCardColl(c); setCardReady(true); });
  }, [profile?.id, isGuest]); // eslint-disable-line

  const statsReady = certReady && cardReady;

  const archerBase = useMemo(() =>
    calcArcherStats({ member: profile, certification, certRecords, dexStats: null }),
  [profile, certification, certRecords]);

  const cardEquip = useMemo(() => calcEquippedBonus(resolveEquippedCards(cardColl)), [cardColl]);
  const archerLevel = isGuest ? 1 : archerLevelFromXP(profile?.archerXP || 0);
  const lvBon   = isGuest ? { hp:0, atk:0, def:0 } : archerLevelBonus(archerLevelFromXP(profile?.archerXP||0));
  const baseATK = (archerBase.atk || 0) + (cardEquip.atk || 0) + lvBon.atk;
  const baseDEF = (archerBase.def || 0) + (cardEquip.def || 0) + lvBon.def;
  const baseHP  = (archerBase.hp  || 0) + (cardEquip.hp  || 0) + lvBon.hp;
  const wbDmgBonusPct  = cardEquip.dmgBonusPct  || 0;
  const wbDmgReducePct = cardEquip.dmgReducePct || 0;

  const participantBonus = getParticipantBonus(event.totalParticipants || 0).atkMult;
  const boss             = event.bossData || {};
  // Older events and manually-created events can contain a missing/string HP.
  // Never leak that into the UI as "undefined / 470,000".
  const bossMaxHP = Math.max(1, Number(event.bossMaxHP) || Number(boss.hp) || 1);
  const participantDamage = Object.values(event.participants || {}).reduce((sum, participant) => sum + (Number(participant?.totalDmg) || 0), 0);
  const storedCurrentHP = Number(event.bossCurrentHP);
  const bossCurrentHP = Math.max(0, Math.min(bossMaxHP,
    Number.isFinite(storedCurrentHP) ? storedCurrentHP : bossMaxHP - participantDamage));

  // ── 中途記憶：同裝置可能輪流給多位孩子使用，暫存 key 必須綁玩家 ──────────
  // 必須在 baseHP 之後宣告，否則 TDZ ReferenceError
  const _storageOwnerId = guestOverride?.id || profile?.id || "unknown";
  const _saveKey = `wb_battle_${event.id}_${_storageOwnerId}`;
  const _guestPotionKey = `guest_wb_potion_${event.id}_${_storageOwnerId}`;
  const _guestPotionMemberKey = `guest_wb_potion_${_storageOwnerId}`;
  const _guestCoinsKey = `guest_wb_coins_${_storageOwnerId}`;
  const _saved = (() => {
    try { return JSON.parse(localStorage.getItem(_saveKey) || "null"); } catch { return null; }
  })();
  const _hasSave = _saved && _saved.eventId === event.id && _saved.memberId === _storageOwnerId && (_saved.roundIdx || 0) > 0;

  // ── 狀態 ───────────────────────────────────────────────────
  const [showFullLog, setShowFullLog] = useState(true);
  const [showBattleLog, setShowBattleLog] = useState(false);

  // 隨機從參戰勇者中取最多 8 位同伴
  const [legacyCompanions] = useState(() => {
    return Array.from({ length: WORLD_BOSS_PARTY_LIMIT - 1 }, (_, index) => {
      const bot = drawRandomBot();
      const atk = Math.max(24, Math.round(baseATK * (bot.atkMult || 0.7)));
      return {
        id: `wb-ai-${index + 1}`,
        name: VIRTUAL_TEAMMATE_NAMES[index] || `遠征隊員 ${index + 1}`,
        atk,
        def: Math.max(12, Math.round(atk * 0.55)),
        hp: Math.max(120, atk * 5),
        botTier: bot.id,
      };
    });

    /* Legacy real-participant companion source intentionally disabled.
       World Boss uses the local AI expedition roster above.
    const _selfId = guestOverride?.id || profile?.id;
    const parts = Object.entries(event.participants || {})
      .filter(([id]) => id !== _selfId)
      .map(([id, p]) => {
        // 優先使用 Firestore 已存的完整數值；舊資料 atk 偏低時設合理下限
        const atk = Math.max(p.atk || 0, 30);
        const def = p.def || Math.round(atk * 0.5);
        const hp  = p.hp  || atk * 5;
        return { id, name: p.name || "射手", atk, def, hp };
      });
    for (let i = parts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [parts[i], parts[j]] = [parts[j], parts[i]];
    }
    return parts.slice(0, 8);
    */
  });

  // Only real participants are shown and used as World Boss assists.
  const companions = useMemo(() => {
    const selfId = guestOverride?.id || profile?.id;
    return Object.entries(event.participants || {})
      .filter(([id]) => id !== selfId)
      .slice(0, WORLD_BOSS_PARTY_LIMIT)
      .map(([id, participant], index) => {
        const atk = Math.max(1, Number(participant?.atk) || 1);
        return {
          id,
          name: participant?.name || "射手",
          atk,
          def: Math.max(0, Number(participant?.def) || Math.round(atk * 0.5)),
          hp: Math.max(1, Number(participant?.hp) || atk * 5),
          avatarId: participant?.avatarId || null,
          catId: participant?.catId || participant?.archerStyle || ARCHER_STYLES[index % ARCHER_STYLES.length],
          role: index < 7 ? "front" : "rear",
        };
      });
  }, [event.participants, guestOverride?.id, profile?.id]);

  const [phase,    setPhase]    = useState(_hasSave ? "battle" : "prep");
  // subPhase: shooting | processing | roundResult | counterAttack | done
  const [subPhase, setSubPhase] = useState("shooting");
  const [processingIdx, setProcessingIdx] = useState(-1);

  const [potion,   setPotion]   = useState(() =>
    guestOverride ? (sessionStorage.getItem(_guestPotionKey) || sessionStorage.getItem(_guestPotionMemberKey) || "none") : "none"
  );
  const [defPotion, setDefPotion] = useState("def_none");
  const [hpPotion,  setHpPotion]  = useState("hp_none");
  const [coins,    setCoins]    = useState(() =>
    guestOverride
      ? (profile?.coins ?? parseInt(sessionStorage.getItem(_guestCoinsKey) || "500", 10))
      : (profile?.coins || 0)
  );

  const [roundIdx,     setRoundIdx]     = useState(_hasSave ? _saved.roundIdx     : 0);
  const [arrows,       setArrows]       = useState([]);
  const [targetMode,   setTargetMode]   = useState(() => getBattleInputMode() === "target");
  const [targetPending, setTargetPending] = useState(false);
  const [targetFmt,    setTargetFmt]    = useState(getBattleTargetFmt);
  const [allRounds,    setAllRounds]    = useState(_hasSave ? _saved.allRounds   : []);
  const [roundSummary, setRoundSummary] = useState(null);
  const shootingProfileRef = useRef(null);
  const shootingSessionIdRef = useRef(null);

  const [myHP,       setMyHP]       = useState(_hasSave ? _saved.myHP       : baseHP);
  const [bossHP,     setBossHP]     = useState(() => {
    const savedHP = Number(_saved?.localBossHP);
    return _hasSave && Number.isFinite(savedHP) ? Math.max(0, Math.min(bossMaxHP, savedHP)) : bossCurrentHP;
  });

  // boss 反擊
  const [counterDmg,    setCounterDmg]    = useState(0);
  const [bossAttackIcon, setBossAttackIcon] = useState("⚡");
  const [bossAttackText, setBossAttackText] = useState("");

  const [dmgLog,    setDmgLog]    = useState([]);
  const [catMsg,    setCatMsg]    = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [potionInv, setPotionInv] = useState({});
  const [consumableUsedRound, setConsumableUsedRound] = useState(false);
  const [activeCarryBuffs, setActiveCarryBuffs] = useState(_hasSave ? (_saved.activeCarryBuffs || {}) : {});
  const [raidUsed, setRaidUsed] = useState(_hasSave ? (_saved.raidUsed || {}) : {});
  const [sortieDmgPct, setSortieDmgPct] = useState(_hasSave ? (_saved.sortieDmgPct || 0) : 0);
  const [botDmgPct, setBotDmgPct] = useState(_hasSave ? (_saved.botDmgPct || 0) : 0);
  const [potionShield, setPotionShield] = useState(_hasSave ? (_saved.potionShield || 0) : 0);
  const [nextCounterReducePct, setNextCounterReducePct] = useState(_hasSave ? (_saved.nextCounterReducePct || 0) : 0);

  // ── 世界王 R2/R4 強攻（PRD 11-21;結算走 worldBossStrikeEngine,once-only + 重連一致）──
  const strikeConfig = getWorldBossSkillConfig(event.bossKey);
  const [sortieId] = useState(() => _saved?.sortieId || `wb:${event.id}:${_storageOwnerId}:${Date.now()}`);
  const [resolvedStrikeKeys, setResolvedStrikeKeys] = useState(_hasSave ? (_saved.resolvedStrikeKeys || []) : []);
  // 強攻附加的玩家減益,只作用「下一回合」：{ atkDownPct, defDownPct, healDownPct, dealtDownPct, dotMaxHpPct }
  const [strikeDebuffs, setStrikeDebuffs] = useState(_hasSave ? (_saved.strikeDebuffs || {}) : {});
  const [pendingTelegraph, setPendingTelegraph] = useState(_hasSave ? (_saved.pendingTelegraph || null) : null);

  useEffect(() => {
    if (isGuest || !profile?.id) return undefined;
    return subscribePotions(profile.id, setPotionInv);
  }, [profile?.id, isGuest]);

  const worldBossConsumables = useMemo(
    () => getConsumablesForMode(BATTLE_CONSUMABLES, "worldboss").filter(item => (potionInv[item.id] || 0) > 0),
    [potionInv],
  );
  const [result,     setResult]    = useState(null);
  const [guestActivityReward, setGuestActivityReward] = useState(null);
  const [showCard,   setShowCard]  = useState(false);
  const [animBossHit,   setAnimBossHit]   = useState(false);
  const [animCrit,      setAnimCrit]      = useState(false);
  const [animMonsterHit, setAnimMonsterHit] = useState(false);
  const [animBossCharge, setAnimBossCharge] = useState(false);
  const [animBossAttackDown, setAnimBossAttackDown] = useState(false);
  const [animPlayerHit,  setAnimPlayerHit]  = useState(false);
  const [archerShoot,    setArcherShoot]    = useState(false);
  const [floatDmg,         setFloatDmg]         = useState(null); // { dmg, isCrit, isMiss }
  const [companionShootIdx, setCompanionShootIdx] = useState(-1);
  const [companionHPs, setCompanionHPs] = useState(() =>
    _hasSave && _saved.companionHPs
      ? _saved.companionHPs
      : Object.fromEntries(companions.map(c => [c.id, c.hp]))
  );
  const [showDeathAnim,     setShowDeathAnim]     = useState(false);
  const [deathKiller,       setDeathKiller]       = useState(null);
  const [deathFinishArrow,  setDeathFinishArrow]  = useState(null);
  const [milestoneQueue,    setMilestoneQueue]    = useState([]);
  const [showExitConfirm,   setShowExitConfirm]   = useState(false);
  const [showPrepExit,      setShowPrepExit]      = useState(false);
  const [todayArrows,       setTodayArrows]       = useState(0);
  const [scoringReady,      setScoringReady]      = useState(false);
  const [showCatRound,      setShowCatRound]      = useState(false);
  const [catRoundCats,      setCatRoundCats]      = useState([]);
  const [catRoundTotalDmg,  setCatRoundTotalDmg]  = useState(0);
  const [battleDemo,        setBattleDemo]        = useState(null);
  const processingRef = useRef(false);
  const timerRef      = useRef([]);
  // ⚡ 事件派遣器 + 回合控制器（只在首次渲染時建立）
  const dispatchRef = useRef(null);
  const controllerRef = useRef(null);
  if (!dispatchRef.current) {
    dispatchRef.current = createDispatch(
      { shoot() {}, hit() {}, miss() {}, crit() {} },
      {},
      {},
      () => {},
      ms => new Promise(r => setTimeout(r, ms)),
    );
  }
  if (!controllerRef.current) {
    controllerRef.current = new RoundController(dispatchRef.current, {
      customDelays: { [WB_EVT.ARROW]: 600 },
    });
  }

  const myId   = guestOverride?.id   || profile?.id;
  const myName = guestOverride?.name || profile?.nickname || profile?.name || "射手";
  const weapon = profile?.bowType || "複合弓";
  const potionDef  = POTIONS.find(p => p.id === potion);
  const potionMult = potionDef?.mult || 1;

  // ── 今日箭數：從 localStorage 讀取（addRoundArrows 每回合累加），用於里程碑正確計算基線
  useEffect(() => {
    if (!myId) return;
    initializeTodayArrows(myId).catch(() => {});
    return subscribeLocalTodayArrows(myId, setTodayArrows);
  }, [myId]);

  // 清理所有 timer（離開時避免洩漏）
  useEffect(() => () => timerRef.current.forEach(clearTimeout), []);

  function addTimer(fn, ms) {
    const t = setTimeout(fn, ms);
    timerRef.current.push(t);
    return t;
  }

  function flashBossHit(isCrit, dmg, isMiss) {
    setAnimBossHit(true);
    setAnimMonsterHit(true);
    setArcherShoot(true);
    if (isCrit) setAnimCrit(true);
    setFloatDmg({ dmg: dmg || 0, isCrit: !!isCrit, isMiss: !!isMiss });
    setTimeout(() => {
      setAnimBossHit(false); setAnimCrit(false);
      setAnimMonsterHit(false); setArcherShoot(false);
    }, 430);
    setTimeout(() => setFloatDmg(null), 2000);
  }

  // 注入 CSS keyframes（只一次）
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = `
      @keyframes wbFadeOut{from{opacity:1}to{opacity:0}}
      @keyframes wbShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
      @keyframes mb-float{0%{transform:translateY(0) scale(1.15);opacity:1}100%{transform:translateY(-60px) scale(0.85);opacity:0}}
      @keyframes mb-monster-hit{0%{filter:brightness(1)}40%{filter:brightness(2.2) saturate(0)}100%{filter:brightness(1)}}
      @keyframes mb-archer-attack{0%{transform:translateX(0)}30%{transform:translateX(10px)}60%{transform:translateX(-3px)}100%{transform:translateX(0)}}
      @keyframes mb-screen-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}80%{transform:translateX(-3px)}}
      @keyframes mb-charge{0%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.35) rotate(-12deg)}60%{transform:scale(1.5) rotate(0deg)}80%{transform:scale(1.35) rotate(10deg)}100%{transform:scale(1) rotate(0deg)}}
      @keyframes mb-miss{0%{opacity:1;transform:translateY(0) scale(1.1)}100%{opacity:0;transform:translateY(-40px) scale(0.85)}}
      @keyframes mb-monster-attack{0%{transform:translateY(0) scale(1)}35%{transform:translateY(55px) scale(1.14)}68%{transform:translateY(24px) scale(1.05)}100%{transform:translateY(0) scale(1)}}
      @keyframes mb-monster-attack-crit{0%{transform:translateY(0) scale(1);filter:brightness(1)}35%{transform:translateY(55px) scale(1.18);filter:brightness(1.9) drop-shadow(0 0 20px #ef4444)}68%{transform:translateY(24px) scale(1.06)}100%{transform:translateY(0) scale(1);filter:brightness(1)}}
      @keyframes wb-death-shake{0%,100%{transform:scale(1) rotate(0)}15%{transform:scale(1.22) rotate(-9deg)}35%{transform:scale(0.82) rotate(7deg)}55%{transform:scale(1.15) rotate(-5deg)}75%{transform:scale(0.9) rotate(3deg)}90%{transform:scale(1.05) rotate(-2deg)}}
      @keyframes wb-death-text{0%{opacity:0;transform:scale(0.15) rotate(-18deg)}55%{transform:scale(1.08) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
      @keyframes wb-death-killer{0%{opacity:0;transform:translateY(24px) scale(0.85)}100%{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes wb-screen-flash{0%,100%{opacity:0}20%{opacity:0.9}}
      @keyframes wb-archer-kill{0%{opacity:0;transform:translateX(-40px) scale(0.7)}70%{transform:translateX(6px) scale(1.05)}100%{opacity:1;transform:translateX(0) scale(1)}}
    `;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  // ── 雇用機器人 ───────────────────────────────────────────
  async function handleHireBot() {
    if (coins < 100 || hiring) return;
    setHiring(true);
    if (isGuest) {
      const bot = drawRandomBot();
      setBots(prev => [...prev, bot]);
      const newC = Math.max(0, coins - 100);
      sessionStorage.setItem(_guestCoinsKey, String(newC));
      setCoins(newC);
      if (myId) addCoins(myId, -100).catch(() => {});
    } else {
      const res = await hireWorldBossBot(event.id, myId);
      if (res.ok) {
        setBots(prev => [...prev, res.bot]);
        setCoins(c => c - 100);
      }
    }
    setHiring(false);
  }

  // ── 輸入分數（只記錄，不計算傷害）──────────────────────
  function handleScore(s, landing) {
    if (arrows.length >= ARROWS_PER || subPhase !== "shooting") return;
    shootingProfileRef.current ||= loadBattleShootingProfile(myId);
    sfxTap(); vibrate(10);
    const rawScore = scoreVal(s);
    const score = (targetFmt === "field_16" && rawScore > 0)
      ? Math.min(rawScore + 5, 10)
      : rawScore;
    setArrows(prev => [...prev, {
      label:String(s),
      score,
      ...(landing ? {
        nx:landing.nx,
        ny:landing.ny,
        faceIndex:landing.faceIndex || 0,
        targetFormat:landing.targetFormat || targetFmt,
      } : {}),
    }]);
  }
  function handleTargetSubmit() {
    if (targetPending) return; // 防止重複觸發疊加多個 timeout
    setTargetPending(true);
    setTimeout(() => { setTargetPending(false); finishRound(arrows); }, 2000);
  }

  async function useWorldBossConsumable(item) {
    if (consumableUsedRound || subPhase !== "shooting" || (potionInv[item.id] || 0) <= 0) return;
    if (item.oncePerSortie && raidUsed[item.id]) return;
    if (item.requiresBot) return;
    if (item.actionCost === "arrow" && arrows.length >= ARROWS_PER) return;
    const resolved = resolveConsumable(item, {
      mode:"worldboss", playerAtk:baseATK, enemyHp:bossHP, enemyMaxHp:event.bossMaxHP, botCount:0,
    });
    if (!resolved.ok) return;

    if (!isGuest && myId) {
      const used = await usePotions(myId, [item.id]);
      if (!used.ok) return;
      recordPotionUsed(myId, item.id).catch(() => {});
    }
    setPotionInv(current => ({ ...current, [item.id]:Math.max(0, (current[item.id] || 0) - 1) }));
    setConsumableUsedRound(true);
    sfxPotionDrink();

    if (item.category === "carry") {
      setActiveCarryBuffs(current => mergeCarryBuff(current, item));
      if (item.effect?.hpPct) setMyHP(current => Math.min(baseHP, current + Math.round(baseHP * item.effect.hpPct / 100)));
      if (item.effect?.shieldPct) setPotionShield(current => Math.max(current, Math.round(baseHP * item.effect.shieldPct / 100)));
    } else if (item.actionCost === "arrow") {
      setArrows(current => [...current, { label:item.icon, score:0, consumableId:item.id }]);
      setRaidUsed(current => ({ ...current, [item.id]:true }));
    } else {
      if (item.effect?.sortieDmgPct) setSortieDmgPct(current => Math.max(current, item.effect.sortieDmgPct));
      if (item.effect?.botDmgPct) setBotDmgPct(current => Math.max(current, item.effect.botDmgPct));
      if (item.effect?.counterReducePct) setNextCounterReducePct(current => Math.max(current, item.effect.counterReducePct));
      setRaidUsed(current => ({ ...current, [item.id]:true }));
    }
  }

  // ── 回合結算流程（逐箭計算）──────────────────────────────
  async function finishRound(fullArrows) {
    setSubPhase("processing");
    setDmgLog([]);
    setBattleDemo(null);

    let totalDmg = 0;
    let crits = 0;
    let localBossHP = bossHP; // 本地追蹤 HP，迴圈中用此計算
    const carryBuffs = calcPotionBuffs(Object.values(activeCarryBuffs).map(entry => entry.id));
    // 強攻減益只作用本回合（上一回合 R2/R4 強攻附加;PRD 22-26）
    const atkDebuffMult   = 1 - (strikeDebuffs.atkDownPct   || 0) / 100;
    const dealtDebuffMult = 1 - (strikeDebuffs.dealtDownPct || 0) / 100;
    const healDebuffMult  = 1 - (strikeDebuffs.healDownPct  || 0) / 100;
    const effectiveATK = Math.round(baseATK * (carryBuffs.atkMult || 1) * atkDebuffMult);
    const playerDmgMult = (carryBuffs.dmgMult || 1) * (1 + sortieDmgPct / 100) * dealtDebuffMult;

    // 取出其他隊員列表（所有曾參戰者，不限今日）
    const teammates = companions;
    const rearTeammates = teammates.filter(teammate => teammate.role === "rear");
    const frontTeammates = teammates.filter(teammate => teammate.role === "front");
    const rearBoost = rearTeammates.length > 0 && Math.random() < 0.5 ? 0.05 : 0;
    const rearHeal = rearBoost === 0 && rearTeammates.length > 0 ? Math.round(baseHP * 0.05 * healDebuffMult) : 0;

    // ── 1. 預先計算所有事件 ─────────────────────────────────
    const events = [];
    let unlockedParts = new Set();

    if (rearTeammates.length > 0) {
      const rear = rearTeammates[Math.floor(Math.random() * rearTeammates.length)];
      if (rearBoost > 0) {
        events.push({ type: WB_EVT.SUPPORT, payload: { sdmg: 0, msg: `${rear.name} 後衛助攻：本回合傷害 +5%`, tmName: rear.name, currentBossHP: localBossHP } });
      } else {
        setMyHP(current => Math.min(baseHP, current + rearHeal));
        events.push({ type: WB_EVT.SUPPORT, payload: { sdmg: 0, msg: `${rear.name} 後衛治療：玩家回復 ${rearHeal} HP`, tmName: rear.name, currentBossHP: localBossHP } });
      }
    }

    // 前衛每回合各攻擊一次；每位傷害取自該參戰者的快照數值。
    frontTeammates.forEach((teammate, index) => {
      const frontDmg = Math.max(1, Math.round(wbArrowDmg(7 + (index % 3), teammate.atk, boss.def, participantBonus)));
      totalDmg += frontDmg;
      localBossHP = Math.max(0, localBossHP - frontDmg);
      events.push({ type: WB_EVT.SUPPORT, payload: { sdmg: frontDmg, msg: `${teammate.name} 前衛攻擊：-${frontDmg}`, tmName: teammate.name, currentBossHP: localBossHP } });
    });

    for (let i = 0; i < fullArrows.length; i++) {
      const a   = fullArrows[i];
      const raidHit = a.consumableId
        ? resolveConsumable(a.consumableId, { mode:"worldboss", playerAtk:effectiveATK, enemyHp:localBossHP, enemyMaxHp:event.bossMaxHP, botCount:0 })
        : null;
      const arrowHit = a.consumableId ? null : resolveStandardArrowHit(
        a, effectiveATK, boss.def, unlockedParts,
        potionMult * playerDmgMult * (1 + rearBoost) * (1 + wbDmgBonusPct) - 1,
      );
      if (arrowHit) unlockedParts = arrowHit.unlockedParts;
      const dmg = raidHit?.ok ? raidHit.damage : arrowHit.dmg;
      const isCrit = !a.consumableId && arrowHit.isCrit;
      if (isCrit) crits++;
      totalDmg += dmg;
      localBossHP = Math.max(0, localBossHP - dmg);

      events.push({
        type: WB_EVT.ARROW,
        payload: { i, label: a.label, dmg, isCrit, isMiss: !a.consumableId && a.score === 0, part:arrowHit?.part || null, currentBossHP: localBossHP },
      });

      // 貓咪助攻（25%，視覺效果）
      if (profile?.equippedCat && Math.random() < 0.25) {
        const name = profile.equippedCat.name || "貓咪";
        const msgs = [`🐱 ${name} 撲了過去！暴擊加成 ×1.2 ⚡`, `🐱 ${name} 舔了你的傷口，回復 HP 💚`,
                      `🐱 ${name} 偷藏了一枚金幣 💰`, `🐱 ${name} 嚇到 Boss！防禦暫時下降 🐾`];
        events.push({
          type: WB_EVT.CAT_MSG,
          payload: { msg: msgs[Math.floor(Math.random() * msgs.length)] },
        });
      }

      // 隊友助攻（隊員越多、觸發率越高）
      if (false && teammates.length > 0) {
        const tm    = teammates[Math.floor(Math.random() * teammates.length)];
        const tmATK = Math.round((tm.atk || baseATK * 0.8) * (1 + botDmgPct / 100));
        const sdmg  = Math.max(1, Math.round(wbArrowDmg(
          6 + Math.floor(Math.random() * 4), tmATK * 0.7, boss.def, participantBonus
        )));
        totalDmg += sdmg;
        localBossHP = Math.max(0, localBossHP - sdmg);
        const tmMsg = SUPPORT_MSGS[Math.floor(Math.random() * SUPPORT_MSGS.length)](tm.name, sdmg);
        events.push({
          type: WB_EVT.SUPPORT,
          payload: { sdmg, msg: tmMsg, tmName: tm.name, currentBossHP: localBossHP },
        });
      }
    }

    setProcessingIdx(-1);

    // ── 2. 透過 RoundController 播放事件序列 ────────────────
    const controller = controllerRef.current;
    await controller.playEvents(events, {}, {
      [WB_EVT.ARROW]: (p) => {
        const { i, label, dmg, isCrit, isMiss, part, currentBossHP } = p;
        setProcessingIdx(i);
        setBattleDemo({ key:`${roundIdx}:${i}:${Date.now()}`, type:"arrow", damage:dmg, isCrit, isMiss, message:isMiss ? `第 ${i + 1} 箭：脫靶` : `第 ${i + 1} 箭：${part?.icon || "🏹"}${part?.name || "命中"} -${dmg}${isCrit ? " 暴擊" : ""}` });
        if (isMiss) { sfxSoftFail(); flashBossHit(false, 0, true); }
        else if (isCrit) { sfxCritBoom(); flashBossHit(true, dmg, false); vibrate(30); }
        else { sfxArrowHit(); flashBossHit(false, dmg, false); vibrate(10); }
        setDmgLog(prev => [...prev,
          isCrit      ? `💥 ${label} 暴擊！ -${dmg}`
          : isMiss    ? `💨 M 飛矢落空`
                      : `🏹 ${label}環 命中${part?.name || "目標"} -${dmg}`
        ]);
        setBossHP(currentBossHP);
      },
      [WB_EVT.CAT_MSG]: (p) => {
        setCatMsg(p.msg);
      },
      [WB_EVT.SUPPORT]: (p) => {
        const { msg, tmName, currentBossHP } = p;
        setDmgLog(prev => [...prev, msg]);
        setBossHP(currentBossHP);
        const cIdx = companions.findIndex(c => c.name === tmName);
        if (cIdx >= 0) {
          setCompanionShootIdx(cIdx);
          setTimeout(() => setCompanionShootIdx(-1), 500);
        }
      },
    });

    // ── 貓貓每回合攻擊（與打怪模式相同，HP > 0 才出擊）────────
    if (hasCat && catATK && localBossHP > 0) {
      let catDmg = 0;
      for (let i = 0; i < 6; i++) {
        const s = Math.max(5, Math.min(10, Math.round(7 + (Math.random() * 6 - 3))));
        catDmg += wbArrowDmg(s, catATK, boss.def, participantBonus);
      }
      catDmg = Math.round(catDmg);
      const catSkill = triggerCatSkill?.();
      let skillNote = "";
      if (catSkill?.triggered) {
        if (catSkill.skillGroup === "atk") {
          const bonus = Math.round(catDmg * (catSkill.extraMult || 0.5));
          catDmg += bonus;
          skillNote = ` ✨ 特技爆發！傷害 ×${(1 + (catSkill.extraMult || 0.5)).toFixed(1)}`;
        } else if (catSkill.skillGroup === "heal") {
          skillNote = ` 💚 ${catName} 治療技能觸發！`;
        } else if (catSkill.skillGroup === "def") {
          skillNote = ` 🛡️ ${catName} 防護姿態觸發！`;
        }
      }
      totalDmg += catDmg;
      localBossHP = Math.max(0, localBossHP - catDmg);
      setBossHP(localBossHP);
      setDmgLog(prev => [...prev, `🐱 ${catName} 出擊！6箭齊射 -${catDmg}${skillNote}`]);
      // 顯示貓貓回合覆蓋層
      setCatRoundCats([{ catId: profile?.equippedCat?.catId || "baobao", catName, dmg: catDmg }]);
      setCatRoundTotalDmg(catDmg);
      setBattleDemo({ key:`${roundIdx}:cat:${Date.now()}`, type:"cat", damage:catDmg, skillTriggered:!!catSkill?.triggered, skillLabel:catSkill?.skillName || catSkill?.skillGroup, message:`🐾 ${catName} 協戰：-${catDmg}${catSkill?.triggered ? " 技能發動" : ""}` });
      setShowCatRound(true);
      sfxArrowHit();
      await delay(1800);
      setShowCatRound(false);
    }

    const roundData  = { arrows: fullArrows, dmg: totalDmg, crits };
    const nextRounds = [...allRounds, roundData];
    setAllRounds(nextRounds);
    setRoundSummary(roundData);
    sfxRoundEnd();
    // 即時同步本回合傷害到 Firestore（讓大廳看到進度）
    if (!isGuest) updateWorldBossHP(event.id, localBossHP).catch(() => {});
    const bossKilledThisRound = localBossHP <= 0;
    setSubPhase("roundResult");
    setAnimBossCharge(true);

    addTimer(() => {
      setAnimBossCharge(false);
      const defDebuffMult = 1 - (strikeDebuffs.defDownPct || 0) / 100;
      const effectiveDef = Math.round(baseDEF * (carryBuffs.defMult || 1) * defDebuffMult);
      const rawPlayerCdmg = Math.round(wbCounter(boss.atk || 100, effectiveDef, wbDmgReducePct) * (1 - nextCounterReducePct / 100));

      // ── R2/R4 強攻：以本回合射箭破解,走 worldBossStrikeEngine（PRD 14-19）──
      const roundNumber = nextRounds.length;
      const scheduledStrike = getWorldBossScheduledStrike(strikeConfig, roundNumber);
      let strikeResult = null;
      if (scheduledStrike) {
        strikeResult = resolveWorldBossStrike({
          sortieId, round: roundNumber, bossKey: event.bossKey, skill: scheduledStrike,
          arrows: fullArrows.filter(a => !a.consumableId).map(a => a.label),
          targetFmt,
          baseCounterDamage: rawPlayerCdmg,
          playerHp: myHP, playerMaxHp: baseHP,
          shield: potionShield,
          resolvedSkillKeys: resolvedStrikeKeys,
        });
        if (!strikeResult?.ok) strikeResult = null; // 資料異常時退回標準反擊,不擋戰鬥
      }
      let cdmg, absorbed, counterHitText;
      if (strikeResult) {
        cdmg = strikeResult.damage; // 已含倍率/破解減幅/護盾;R2 保 1、R4 可歸零
        absorbed = Math.max(0, potionShield - strikeResult.shieldRemaining);
        counterHitText = `「${scheduledStrike.name}」`;
      } else {
        const playerCounter = resolvePlayerCounter({ arrows:fullArrows, baseDamage:rawPlayerCdmg, maxHP:baseHP });
        absorbed = Math.min(potionShield, playerCounter.damage);
        cdmg = playerCounter.damage - absorbed;
        counterHitText = playerCounter.part.name;
      }
      const nextResolvedKeys = strikeResult && !strikeResult.alreadyResolved
        ? [...resolvedStrikeKeys, strikeResult.resolvedKey]
        : resolvedStrikeKeys;
      if (nextResolvedKeys !== resolvedStrikeKeys) setResolvedStrikeKeys(nextResolvedKeys);

      const companionCounterDmgs = Object.fromEntries(companions.map(companion => [companion.id, Math.round(wbCounter(boss.atk || 100, companion.def, wbDmgReducePct) * (1 - nextCounterReducePct / 100))]));
      const totalCounterDmg = cdmg + Object.values(companionCounterDmgs).reduce((sum, damage) => sum + damage, 0);
      setPotionShield(current => Math.max(0, current - absorbed));
      setNextCounterReducePct(0);
      const isLast = nextRounds.length === TOTAL_ROUNDS;
      // 有專屬語錄的王（目前是六族小王）優先用自己的梗，其餘沿用通用台詞池
      const ownQuotes = BOSS_QUOTES[event?.bossKey];
      const pool   = (ownQuotes && !isLast) ? ownQuotes : (isLast ? BOSS_FINAL_TAUNTS : BOSS_TAUNTS);
      const [icon, text] = pool[Math.floor(Math.random() * pool.length)];
      const strikeIcon = strikeResult ? (roundNumber === 4 ? "☄️" : "⚡") : icon;
      // 破解評語（結算與演出分離：alreadyResolved 只播演出）
      const breakLabel = strikeResult && strikeResult.outcome ? ({
        full: "🛡️ 完全破解！毫髮無傷", major: "💪 高分破解！傷害大減",
        partial: "👍 部分破解！傷害減輕", none: "💢 未能破解，全額承受",
      })[strikeResult.outcome.level] : "";

      setCounterDmg(totalCounterDmg);
      setBossAttackIcon(strikeIcon);
      setBossAttackText(strikeResult ? `${scheduledStrike.name}！` : text);
      setBattleDemo({ key:`${roundIdx}:counter:${Date.now()}`, type:"counter", damage:cdmg, message:`${strikeIcon} 世界王${strikeResult ? "發動" : "命中玩家"}${counterHitText}：-${cdmg} HP` });
      setSubPhase("counterAttack");
      setAnimBossAttackDown(true);
      if (isLast || (strikeResult && roundNumber === 4)) { sfxCounterCrit(); vibrate(50); } else { sfxCounter(); vibrate(20); }
      setDmgLog(prev => [...prev,
        strikeResult
          ? `${strikeIcon} ${boss.name} 發動強攻「${scheduledStrike.name}」，造成 ${cdmg} 傷害！${breakLabel}`
          : `${icon} ${text} 命中玩家${counterHitText}，造成 ${cdmg} 傷害！`,
      ]);
      if (strikeResult?.status) {
        setDmgLog(prev => [...prev, `🌀 附加「${strikeResult.status.name || strikeResult.status.effect}」：下一回合生效`]);
      }

      addTimer(() => {
        setAnimBossAttackDown(false);
        // 睡飽回復吃治療減益（大娘/毒雲/白卷,PRD 22/26）
        const regen = Math.round(baseHP * (carryBuffs.regenPct || 0) / 100 * healDebuffMult);
        // 蜂毒（上回合附加）：本回合結算,毒不致死（最低留 1 HP）
        const poisonPct = strikeDebuffs.dotMaxHpPct || 0;
        const poisonDmg = poisonPct > 0 ? Math.max(1, Math.round(baseHP * poisonPct / 100)) : 0;
        let afterCounter = Math.max(0, myHP - cdmg);
        if (poisonDmg > 0 && afterCounter > 0) {
          const afterPoison = Math.max(1, afterCounter - poisonDmg);
          setDmgLog(prev => [...prev, `🕷️ 蜂毒發作：-${afterCounter - afterPoison} HP`]);
          afterCounter = afterPoison;
        }
        // R4 擊倒後,睡飽等回合末回復不可復活（PRD 18/127）
        const knockedOut = strikeResult?.knockedOut === true;
        const nextMyHP = knockedOut ? 0 : Math.min(baseHP, afterCounter + regen);
        const nextCompHPs = {};
        companions.forEach(c => { nextCompHPs[c.id] = Math.max(0, (companionHPs[c.id] ?? c.hp) - (companionCounterDmgs[c.id] || 0)); });
        setMyHP(nextMyHP);
        setCompanionHPs(nextCompHPs);
        setAnimPlayerHit(true);
        setTimeout(() => setAnimPlayerHit(false), 650);

        // 下一回合的減益（本次強攻附加;非強攻回合歸零）與 R1/R3 末預告（PRD 12）
        const nextDebuffs = strikeResult?.status
          ? { [strikeResult.status.effect]: strikeResult.status.strength }
          : {};
        const telegraph = getWorldBossTelegraph(strikeConfig, roundNumber);
        setStrikeDebuffs(nextDebuffs);
        setPendingTelegraph(telegraph);

        addTimer(() => {
          const playerDied = nextMyHP <= 0;
          if (bossKilledThisRound || isLast || playerDied) {
            // Boss 已死／最後一回合／玩家陣亡 → 結束
            setSubPhase("done");
            submitAttack(nextRounds, playerDied);
          } else {
            // 中途記憶：反擊結算後，下一回合開始前儲存（含強攻 once-only/預告/減益）
            try {
              localStorage.setItem(_saveKey, JSON.stringify({
                eventId: event.id, memberId: _storageOwnerId, roundIdx: nextRounds.length,
                allRounds: nextRounds, myHP: nextMyHP,
                localBossHP, companionHPs: nextCompHPs,
                activeCarryBuffs, raidUsed, sortieDmgPct, botDmgPct,
                potionShield:Math.max(0, potionShield - absorbed), nextCounterReducePct:0,
                sortieId, resolvedStrikeKeys: nextResolvedKeys,
                strikeDebuffs: nextDebuffs, pendingTelegraph: telegraph,
              }));
            } catch { /**/ }
            setArrows([]);
            setRoundIdx(r => r + 1);
            setConsumableUsedRound(false);
            setDmgLog([]);
            setScoringReady(true);
            setSubPhase("shooting");
          }
        }, 1500);
      }, 480);
    }, 2200);
  }

  // ── 送出攻擊 ─────────────────────────────────────────────
  async function submitAttack(rounds, playerDied = false) {
    if (processingRef.current) return;
    processingRef.current = true;
    // 清除中途記憶（戰鬥已結束）
    try { localStorage.removeItem(_saveKey); } catch { /**/ }
    setSubmitting(true);
    setPhase("result");

    const _killerStyle   = profile?.equippedCat?.catId || (typeof localStorage !== "undefined" ? localStorage.getItem("mb_archer_style") : null) || "baobao";
    const _lastRound     = rounds[rounds.length - 1];
    const _lastArrow     = _lastRound?.arrows?.[(_lastRound.arrows.length ?? 1) - 1];
    const _finishArrow   = _lastArrow?.label ?? null;

    let res;
    try {
      res = await attackWorldBoss({
        eventId:       event.id,
        memberId:      myId,
        memberName:    myName,
        weapon,
        roundResults:  rounds,
        isGuest,
        accountType:    profile?.accountType || (isGuest ? "guest" : "official"),
        sessionSourceId: guestOverride?.currentSessionSourceId || profile?.lastSessionSourceId || profile?.sessionSourceId || null,
        potionDmgMult: 1,
        bots:          [],
        memberAtk:     baseATK,
        memberDef:     baseDEF,
        memberHP:      baseHP,
        killerStyle:   _killerStyle,
        finishingArrow: _finishArrow,
      });
    } catch (err) {
      res = { ok: false, reason: err?.message || "網路錯誤" };
    }

    setResult({ ...res, playerDied });
    setSubmitting(false);
    processingRef.current = false;
    setPhase("result");
    if (res.ok) {
      if (res.defeated) {
        playBattleSound("victory_cheer", {});
        // 結算定案 + 寫入歷史快照（防重複由 rewardDistributed flag 保護）。
        // 沒有這步,Lobby 的 getLatestWorldBossKill 查不到歷史 → 領取入口不會出現。
        distributeWorldBossRewards(event.id).catch(() => {});
        setDeathKiller(myName);
        setDeathFinishArrow(_finishArrow);
        setShowDeathAnim(true);
      } else {
        playBattleSound("victory_cheer", {});
      }
      saveBond("worldboss");
      if (isGuest && myId) {
        const dmgPct = (res.dmg || 0) / (event.bossMaxHP || 1);
        const coinsGain = Math.min(30, Math.max(10, Math.round(dmgPct * 300)));
        const catId = profile?.equippedCat?.catId;
        const catXpGain = catId ? Math.min(35, Math.max(15, Math.round(dmgPct * 350))) : 0;
        const arrowList = rounds.flatMap(round => round.arrows || []);
        const scoreTotal = arrowList.reduce((sum, arrow) => sum + (Number.isFinite(arrow?.score) ? arrow.score : scoreVal(arrow?.label ?? arrow)), 0);
        await addCoins(myId, coinsGain).catch(() => {});
        if (catId && catXpGain > 0) await addCatXP(myId, catId, catXpGain).catch(() => {});
        recordGuestBattleStats(myId, {
          mode: "worldboss",
          result: res.defeated ? "win" : "done",
          arrows: arrowList.length,
          score: scoreTotal,
          damage: res.dmg || 0,
          target: event.bossData?.name || "世界王",
        }).catch(() => {});
        setCoins(c => c + coinsGain);
        setGuestActivityReward({ coins: coinsGain, catXP: catXpGain });
      }
      // 村目標傷害貢獻已移至 finalizeMonsterShootingSession 統一處理
      if (!isGuest && myId && rounds.length > 0) {
        const practiceRounds = rounds.map(r =>
          (r.arrows || []).map(arrow => scoreVal(arrow?.label ?? arrow))
        );
        const capturedEnds = rounds.map(round => (round.arrows || []).map(arrow => ({
          label:arrow?.label ?? String(arrow),
          ...(Number.isFinite(arrow?.nx) && Number.isFinite(arrow?.ny) ? { landing:{ nx:arrow.nx, ny:arrow.ny, faceIndex:arrow.faceIndex || 0, targetFormat:arrow.targetFormat || targetFmt } } : {}),
        })));
        const arrowPositions = rounds.flatMap((battleRound, battleRoundIndex) =>
          (battleRound.arrows || []).flatMap((arrow, arrowIndex) =>
            Number.isFinite(arrow?.nx) && Number.isFinite(arrow?.ny)
              ? [{
                  score:arrow.label,
                  nx:arrow.nx,
                  ny:arrow.ny,
                  faceIndex:arrow.faceIndex || 0,
                  targetFormat:arrow.targetFormat || targetFmt,
                  round:battleRoundIndex,
                  arrow:arrowIndex + 1,
                }]
              : []
          )
        );
        const shootingProfile = shootingProfileRef.current || loadBattleShootingProfile(myId);
        const totalArrowsSent = practiceRounds.flat().length;
        if (totalArrowsSent > 0) {
          addRoundArrows(myId, totalArrowsSent).catch(() => {});
          const wbMilestones = getMilestonesReached(todayArrows, todayArrows + totalArrowsSent);
          if (wbMilestones.length > 0) {
            const { grantArrowMilestoneRewards } = await import("../../lib/db");
            grantArrowMilestoneRewards(myId, wbMilestones).catch(() => {});
            setMilestoneQueue(wbMilestones.map(ms => ({ ms, rewards: getRewardsForMilestone(ms) })));
          }
        }
        addPracticeLog(myId, {
          date: todayStr, source: "worldboss",
          bossName: event.bossData?.name || "世界王",
          result: res.defeated ? "win" : "lose",
          damage:res.dmg || 0,
          rounds: practiceRounds,
          total: practiceRounds.flat().reduce((s, v) => s + v, 0),
          totalArrows:practiceRounds.flat().length,
          bowType:shootingProfile.bowType,
          distance:shootingProfile.distance,
          targetFormat:targetFmt,
          inputMode:arrowPositions.length ? "target" : "button",
          ...(arrowPositions.length ? { arrowPositions } : {}),
        }, myId).catch(() => {});
        const sessionKey = shootingSessionIdRef.current ||= `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        finalizeGameShootingSession({
          sessionId:`worldboss_${event.id}_${myId}_${sessionKey}`, memberId:myId, capturedEnds,
          shootingProfile, targetFormat:targetFmt, arrowsPerEnd:ARROWS_PER,
          result:res.defeated ? "win" : "lose", sourceMode:"worldBoss",
          monster:{ id:event.bossKey || boss.id, name:boss.name, tier:"mythic", hp:event.bossMaxHP },
          totalDamage:res.dmg || 0, finalMonsterHp:res.bossHP ?? bossHP,
          characterSnapshot:{ level:archerLevel, attack:baseATK, defense:baseDEF },
        }).catch(error => console.warn("world boss shooting performance dual-write failed", error));
        // 射手 / 貓貓 XP：依貢獻傷害比例，min 50 max 300
        const _dmgPct = (res.dmg || 0) / (event.bossMaxHP || 1);
        const bossXP  = Math.min(WORLD_BOSS_XP_CAP, Math.max(50, Math.round(_dmgPct * 10000)));
        addArcherXP(myId, bossXP).catch(() => {});
        // 世界王同時給冒險者 XP（標準＝與射手 XP 同額）；世界王是冒險者 XP 主要來源之一
        addAdventurerXP(myId, bossXP).catch(() => {});
        const _wbCatId = profile?.equippedCat?.catId;
        if (_wbCatId) addCatXP(myId, _wbCatId, bossXP).catch(() => {});
        // 箭露：30 箭，每箭 +1~5 隨機（min 30 / max 150）
        const arrowDewGain = Array.from({ length: 30 }, () => Math.floor(Math.random() * 5) + 1).reduce((a, b) => a + b, 0);
        addArrowdew(myId, arrowDewGain).catch(() => {});
        // 扭蛋幣：1~5 隨機
        const gachaCoinGain = Math.floor(Math.random() * 5) + 1;
        addGachaCoins(myId, gachaCoinGain).catch(() => {});
      }
      onComplete?.(res);
    }
  }

  // ── 消耗品列（共用元件，避免重複渲染）──────────────────────
  function ConsumablesBar({ compact = false }) {
    if (worldBossConsumables.length === 0) return null;
    return (
      <div style={compact ? { marginBottom:4, background:"rgba(0,0,0,0.86)", borderRadius:8, border:"1px solid rgba(251,191,36,0.2)", padding:"4px 6px" } : { flex:"0 0 auto", background:"rgba(0,0,0,0.86)", borderTop:"1px solid rgba(251,191,36,0.2)", padding:"6px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, overflowX:"auto" }}>
          <span style={{ fontSize:10, color:"#fbbf24", fontWeight:900, flexShrink:0 }}>消耗品</span>
          {worldBossConsumables.map(item => {
            const disabled = consumableUsedRound || (item.oncePerSortie && raidUsed[item.id]) || item.requiresBot || (item.actionCost === "arrow" && arrows.length >= ARROWS_PER);
            return (
              <button key={item.id} disabled={disabled} onClick={() => useWorldBossConsumable(item)} title={`${item.name}：${item.effectText}`}
                style={{ flexShrink:0, width:compact?64:68, minHeight:compact?44:48, borderRadius:8, border:`1px solid ${item.category === "raid" ? "#fbbf2466" : "#60a5fa55"}`, background:disabled?"rgba(255,255,255,0.03)":"rgba(251,191,36,0.09)", color:disabled?"#475569":"#e2e8f0", opacity:disabled ? 0.45 : 1, fontSize:9, fontWeight:800, padding:compact?"2px 3px":"3px" }}>
                <div style={{ fontSize:compact?15:16 }}>{item.icon}</div>
                <div>{item.name}</div>
                <div style={{ color:"#94a3b8", fontSize:8 }}>×{potionInv[item.id] || 0}</div>
              </button>
            );
          })}
        </div>
        <div style={{ textAlign:"center", color:"#64748b", fontSize:8, marginTop:compact?1:2 }}>{consumableUsedRound ? "本回合已使用消耗品" : "每回合最多使用一個；一般投擲物不能用於世界王"}</div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ── 畫面：準備 ───────────────────────────────────────────
  if (phase === "prep") {
    const potionCost = potionDef?.cost || 0;
    const canAfford  = coins >= potionCost;

    return (
      <div className="h-[100dvh] flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white relative">
        {/* Prep 退出確認 */}
        {showPrepExit && (
          <div style={{ position:"absolute", inset:0, zIndex:50, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.2)", borderRadius:24, padding:24, width:"100%", textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
              <div className="text-sm font-bold text-white mb-2">確定返回大廳？</div>
              <div className="text-xs text-slate-400 mb-4">今日挑戰次數不受影響，可隨時重新進入</div>
              <div style={{ display:"flex", gap:12 }}>
                <button onClick={() => setShowPrepExit(false)} style={{ flex:1, padding:"12px", borderRadius:12, background:"rgba(255,255,255,0.1)", color:"#e2e8f0", fontWeight:700, border:"none", cursor:"pointer" }}>取消</button>
                <button onClick={onBack} style={{ flex:1, padding:"12px", borderRadius:12, background:"#475569", color:"white", fontWeight:900, border:"none", cursor:"pointer" }}>返回大廳</button>
              </div>
            </div>
          </div>
        )}
        {/* 史詩殿堂頭部 */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-slate-950/85 border-b border-amber-500/30 backdrop-blur-md z-30 shadow-xl">
          <button onClick={() => setShowPrepExit(true)} className="text-slate-400 text-sm font-bold hover:text-white flex items-center gap-1">
            ← 返回
          </button>
          <div className="text-center">
            <div className="text-[10px] font-black text-amber-400 tracking-wider flex items-center justify-center gap-1">
              <span>🔥</span> WORLD BOSS RAID
            </div>
            <div className="text-base font-black text-white">{boss.name} 討伐殿堂</div>
          </div>
          <span className="text-xs font-black text-amber-300 font-mono bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl">💰 {coins}</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-5 pb-24">
          {/* Boss 史詩橫幅 */}
          <div className="relative overflow-hidden rounded-3xl border border-rose-500/40 bg-gradient-to-br from-slate-950 via-slate-900/90 to-rose-950/50 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-4 relative z-10">
              <div className="relative shrink-0 flex items-center justify-center w-24 h-24 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-2 shadow-inner">
                <WorldBossSVG bossKey={event.bossKey} currentHP={event.bossCurrentHP} maxHP={event.bossMaxHP} size={84}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 border border-rose-500/40 text-rose-300">
                    🔥 討伐目標
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 border border-amber-400/30 text-amber-300">
                    ⚔️ 參戰 {event.totalParticipants || 0} 人
                  </span>
                </div>
                <h2 className="text-xl font-black text-white truncate" style={{ color: boss.accent }}>
                  {boss.name}
                </h2>
                <div className="text-xs text-slate-400 mt-0.5">「{boss.title}」</div>

                {/* HP 血條 */}
                <div className="mt-2.5 space-y-1">
                  <div className="flex justify-between text-[11px] font-black">
                    <span className="text-rose-300">BOSS 血量</span>
                    <span className="font-mono text-amber-300">{event.bossCurrentHP?.toLocaleString()} / {event.bossMaxHP?.toLocaleString()}</span>
                  </div>
                  <MiniHP current={event.bossCurrentHP} max={event.bossMaxHP}/>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-md">
            <div className="text-xs font-black text-amber-300 mb-1 flex items-center gap-1.5">
              <span>🏹</span> 實際距離與本場裝備
            </div>
            <div className="text-[11px] text-slate-400 mb-3">開始挑戰後會鎖定這組設定，並寫入本次射箭表現。</div>
            <BattleShootingProfile memberId={myId} />
          </div>

          {/* 戰鬥說明 */}
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl px-4 py-3 text-xs text-rose-300 space-y-1 leading-relaxed">
            <div className="font-black text-rose-200 mb-1">⚔️ 戰鬥流程</div>
            <div>1. 每回合射 6 箭對 Boss 造成傷害</div>
            <div>2. 每回合結束後 Boss 會進行反擊</div>
            <div>3. 共 5 大回合，最終回合 Boss 全力攻擊</div>
          </div>

          {/* 屬性與加成 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-md">
            <div className="text-xs font-black text-amber-300 mb-3 flex items-center gap-1.5">
              <span>🛡️</span> 個人討伐能力值
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[["HP", baseHP, "#22c55e"], ["ATK", baseATK, "#f87171"], ["DEF", baseDEF, "#60a5fa"]].map(([k, v, c]) => (
                <div key={k} className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-0.5">{k}</div>
                  <div className="font-black font-mono text-sm" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-center text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-2xl">
              ⚡ 每位隊友 +15% ATK，共 {event.totalParticipants || 0} 人 → 戰力 ×{participantBonus.toFixed(2)}
            </div>
          </div>

          {/* 戰術加購藥水櫃 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
            <div className="text-xs font-black text-amber-300 flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5">💊 戰術加購藥水櫃</span>
              <span className="text-[11px] text-slate-400 font-normal">多重藥水可同時採購加成</span>
            </div>

            {/* 1. 攻擊加成藥水 (最高 4 倍) */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-rose-400 flex items-center justify-between">
                <span>🔥 攻擊加成藥水 (倍率：1.5x / 2x / 2.5x / 3x / 4x)</span>
                <span className="text-[10px] text-slate-400 font-mono">{POTIONS.find(p => p.id === potion)?.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {POTIONS.map(p => (
                  <button key={p.id} onClick={() => { setPotion(p.id); if (p.id !== "none") sfxPotionDrink(); }}
                    disabled={p.cost > 0 && coins < p.cost}
                    className={`p-2 rounded-2xl text-xs font-bold border transition-all disabled:opacity-30 flex flex-col justify-between text-left active:scale-95 ${potion === p.id ? "border-rose-400 bg-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "border-slate-800 bg-slate-950/60 text-slate-300"}`}>
                    <div className="font-black text-white text-[11px] truncate">{p.label}</div>
                    <div className="text-[11px] font-mono mt-0.5" style={{ color: p.color }}>{p.mult > 1 ? `ATK ×${p.mult.toFixed(1)}` : "基礎"}</div>
                    {p.cost > 0 && <div className="text-[10px] text-amber-300 font-mono mt-0.5">💰 {p.cost}</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 防禦防護藥水 (倍率：1.5x / 2x / 2.5x / 3x / 4x) */}
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <div className="text-xs font-bold text-blue-400 flex items-center justify-between">
                <span>🛡️ 防禦加護藥水 (倍率：1.5x / 2x / 2.5x / 3x / 4x)</span>
                <span className="text-[10px] text-slate-400 font-mono">{DEF_POTIONS.find(p => p.id === defPotion)?.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEF_POTIONS.map(p => (
                  <button key={p.id} onClick={() => { setDefPotion(p.id); if (p.id !== "def_none") sfxPotionDrink(); }}
                    disabled={p.cost > 0 && coins < p.cost}
                    className={`p-2 rounded-2xl text-xs font-bold border transition-all disabled:opacity-30 flex flex-col justify-between text-left active:scale-95 ${defPotion === p.id ? "border-blue-400 bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "border-slate-800 bg-slate-950/60 text-slate-300"}`}>
                    <div className="font-black text-white text-[11px] truncate">{p.label}</div>
                    <div className="text-[11px] font-mono mt-0.5" style={{ color: p.color }}>{p.defMult > 1 ? `DEF ×${p.defMult.toFixed(1)}` : "基礎"}</div>
                    {p.cost > 0 && <div className="text-[10px] text-amber-300 font-mono mt-0.5">💰 {p.cost}</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 血量極限藥水 (倍率：1.5x / 2x / 2.5x / 3x / 4x) */}
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <div className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                <span>❤️ 生命上限藥水 (倍率：1.5x / 2x / 2.5x / 3x / 4x)</span>
                <span className="text-[10px] text-slate-400 font-mono">{HP_POTIONS.find(p => p.id === hpPotion)?.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {HP_POTIONS.map(p => (
                  <button key={p.id} onClick={() => { setHpPotion(p.id); if (p.id !== "hp_none") sfxPotionDrink(); }}
                    disabled={p.cost > 0 && coins < p.cost}
                    className={`p-2 rounded-2xl text-xs font-bold border transition-all disabled:opacity-30 flex flex-col justify-between text-left active:scale-95 ${hpPotion === p.id ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "border-slate-800 bg-slate-950/60 text-slate-300"}`}>
                    <div className="font-black text-white text-[11px] truncate">{p.label}</div>
                    <div className="text-[11px] font-mono mt-0.5" style={{ color: p.color }}>{p.hpMult > 1 ? `HP ×${p.hpMult.toFixed(1)}` : "基礎"}</div>
                    {p.cost > 0 && <div className="text-[10px] text-amber-300 font-mono mt-0.5">💰 {p.cost}</div>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 靶面設定 */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-md">
            <div className="text-xs font-black text-amber-300 mb-3 flex items-center gap-1.5">
              <span>🎯</span> 射擊靶面與操控方式
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <TargetFmtPicker value={targetFmt} onChange={v => { setTargetFmt(v); setBattleTargetFmt(v); }} />
              </div>
              <div className="flex-1">
                <InputModePicker value={targetMode ? "target" : "button"} onChange={v => { const t = v === "target"; setTargetMode(t); setBattleInputMode(v); }} />
              </div>
            </div>
          </div>
        </div>

        {/* 底部固定「開始挑戰」按鈕 */}
        {(() => {
          const p1 = POTIONS.find(p => p.id === potion)?.cost || 0;
          const p2 = DEF_POTIONS.find(p => p.id === defPotion)?.cost || 0;
          const p3 = HP_POTIONS.find(p => p.id === hpPotion)?.cost || 0;
          const totalPotionCost = p1 + p2 + p3;
          const canAffordAll = coins >= totalPotionCost;

          return (
            <div className="shrink-0 px-4 pt-3 sticky bottom-0 z-30 border-t border-slate-800/80 shadow-2xl backdrop-blur-md"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))", background: "linear-gradient(0deg, #070b16 95%, rgba(7,11,22,0.8) 100%)" }}>
              {totalPotionCost > 0 && (
                <div className="flex justify-between items-center text-xs px-1 mb-2 font-bold">
                  <span className="text-slate-400">採購藥水小計</span>
                  <span className={canAffordAll ? "text-amber-300 font-mono" : "text-rose-400 font-mono"}>
                    💰 {totalPotionCost.toLocaleString()} 金幣 {!canAffordAll && "(金幣不足)"}
                  </span>
                </div>
              )}
              <button
                onClick={async () => {
                  sfxCast();
                  if (totalPotionCost > 0) {
                    if (isGuest) {
                      const newC = Math.max(0, coins - totalPotionCost);
                      sessionStorage.setItem(_guestCoinsKey, String(newC));
                      setCoins(newC);
                      if (myId) addCoins(myId, -totalPotionCost).catch(() => {});
                    } else {
                      const { addCoins } = await import("../../lib/db");
                      await addCoins(myId, -totalPotionCost).catch(() => {});
                      setCoins(c => c - totalPotionCost);
                    }
                  }
                  sessionStorage.removeItem(_guestPotionKey);
                  sessionStorage.removeItem(_guestPotionMemberKey);
                  setPhase("battle");
                }}
                disabled={totalPotionCost > 0 && !canAffordAll}
                className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-2xl transition-all active:scale-95 disabled:opacity-40 border border-rose-400/40 flex items-center justify-center gap-2 wb-btn-anim"
                style={{ background: `linear-gradient(135deg, ${boss.accent || "#f59e0b"}, #ef4444)` }}>
                <span>🔥</span> 吹響號角！開始討伐（{TOTAL_ROUNDS} 回合 × {ARROWS_PER} 箭）
              </button>
            </div>
          );
        })()}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ── 畫面：戰鬥中（MonsterBattle 風格）────────────────────
  if (phase === "battle") {
    const supportRoster = companions.map((companion, index) => {
      const hp = companionHPs[companion.id] ?? companion.hp;
      return {
        ...companion,
        hp,
        maxHp: companion.hp,
        catId: companion.catId || ARCHER_STYLES[index % ARCHER_STYLES.length],
        role: companion.role || (index < 10 ? "front" : "rear"),
        isFront: (companion.role || (index < 10 ? "front" : "rear")) === "front",
        ready: subPhase !== "shooting",
      };
    });
    return (
      <div style={{ position:"fixed", inset:0, zIndex:9999, maxWidth:540, margin:"0 auto", background:"#0a1018" }}>
        {subPhase === "showcase" && !submitting && (
          <div style={{position:"absolute",inset:0,zIndex:80,pointerEvents:"none",display:"grid",placeItems:"center",background:"rgba(2,6,23,.58)"}}>
            <div style={{padding:"18px 28px",borderRadius:18,background:"rgba(15,23,42,.94)",border:"1px solid rgba(251,191,36,.65)",boxShadow:"0 0 35px rgba(251,191,36,.3)",textAlign:"center"}}>
              <div style={{fontSize:28,animation:"mb-archer-attack .55s ease-in-out infinite"}}>🏹 ⚡ 💥</div>
              <div style={{marginTop:8,color:"#fbbf24",fontSize:16,fontWeight:900}}>戰鬥演示中</div>
              <div style={{marginTop:4,color:"#cbd5e1",fontSize:11}}>正在播放射擊、助攻與王反擊</div>
            </div>
          </div>
        )}
        {/* ⚡ R2/R4 強攻預告（R1/R3 末設定,重連自 save 還原;PRD 12）*/}
        {subPhase === "shooting" && pendingTelegraph && (
          <div style={{ position:"absolute", top:8, left:8, right:8, zIndex:60, pointerEvents:"none",
            padding:"8px 12px", borderRadius:12, textAlign:"center",
            background: pendingTelegraph.isFinisher ? "rgba(76,5,25,.92)" : "rgba(66,32,6,.92)",
            border: `1.5px solid ${pendingTelegraph.isFinisher ? "#f43f5e" : "#fbbf24"}`,
            boxShadow: `0 0 18px ${pendingTelegraph.isFinisher ? "rgba(244,63,94,.35)" : "rgba(251,191,36,.3)"}` }}>
            <div style={{ fontSize:12, fontWeight:900, color: pendingTelegraph.isFinisher ? "#fda4af" : "#fcd34d" }}>
              {pendingTelegraph.isFinisher ? "☄️ 終結技預告" : "⚡ 強攻預告"}：「{pendingTelegraph.name}」
            </div>
            <div style={{ fontSize:10, color:"#e2e8f0", marginTop:2, lineHeight:1.5 }}>{pendingTelegraph.counterText}</div>
          </div>
        )}
        <BattleScreen
          fullScreen
          autoStart
          externalBattle
          externalRoundKey={roundIdx}
          externalLocked={subPhase !== "shooting" || submitting}
          externalDemo={battleDemo}
          battleMode="score"
          scoreInput={targetMode ? "target" : "keypad"}
          targetFormat={targetFmt}
          arrowsPerRound={ARROWS_PER}
          bgImage="/ui/dungeon-bg.webp"
          player={{ name:myName, lv:archerLevel, avatarId:profile?.avatarId || null, catId:profile?.equippedCat?.catId || "diandian", hp:myHP, maxHp:baseHP, atk:baseATK, def:baseDEF }}
          monster={{ id:event?.bossKey || boss.id, name:boss.name || "世界王", family:boss.family || "worldboss", hp:bossHP, maxHp:bossMaxHP, atk:Number(boss.atk) || 0, def:Number(boss.def) || 0, tier:"mythic", variant:"boss" }}
          cat={hasCat ? { catId:profile?.equippedCat?.catId || "diandian", catName, type:"allround", catXP:profile?.equippedCat?.xp || 0, bond:profile?.equippedCat?.bond || 0 } : null}
          allies={supportRoster}
          renderMonster={(size, mon) => <WorldBossSVG bossKey={event.bossKey} currentHP={mon?.hp ?? bossHP} maxHP={mon?.maxHp ?? bossMaxHP} size={size} />}
          onLeaveBattle={onBack}
          onSubmit={(scores) => {
            if (subPhase !== "shooting" || submitting) return;
            const labelMap = { 10:"X", 9:"9", 8:"8", 7:"7", 6:"6", 5:"5", 4:"4", 3:"3", 2:"2", 1:"1", 0:"M" };
            const roundArrows = scores.map(score => ({ score, label:labelMap[score] || String(score) }));
            setArrows(roundArrows);
            sfxCast();
            finishRound(roundArrows);
          }}
        />
      </div>
    );
  }

  if (phase === "battle") {
    const frontCompanions = companions.slice(0, 3);
    const backCompanions  = companions.slice(3, 6);
    const frontCount = frontCompanions.length + 1; // +1 for player
    const backCount  = backCompanions.length;
    const frontW = Math.min(72, Math.floor((528 - Math.max(0, frontCount - 1) * 3) / (frontCount || 1)));
    const backW  = Math.min(64, Math.floor((528 - Math.max(0, backCount  - 1) * 3) / (backCount  || 1)));
    const showBackRow = subPhase !== "shooting";
    const isLastRound = roundIdx === TOTAL_ROUNDS - 1;

    return (
      <div style={{
        position:"fixed", top:0, bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:540, zIndex:9999, display:"flex", flexDirection:"column",
        backgroundImage:"url(/ui/dungeon-bg.webp)", backgroundSize:"cover", backgroundPosition:"center",
        overflow:"hidden", fontFamily:"sans-serif",
      }}>

        {/* 暴擊/命中閃爍 */}
        {animCrit && <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:30, background:"radial-gradient(ellipse at center,rgba(245,158,11,0.28) 0%,transparent 70%)", animation:"wbFadeOut 0.42s ease forwards" }}/>} 
        {animBossHit && !animCrit && <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:30, background:"rgba(239,68,68,0.10)", animation:"wbFadeOut 0.3s ease forwards" }}/>} 

        {/* 新版組隊資訊列：完整顯示 19 位 AI 隊員，主角卡仍在下方。 */}
        <div style={{position:"absolute",zIndex:8,top:48,left:8,display:"grid",gridTemplateColumns:"repeat(5, 25px)",gap:4,padding:5,borderRadius:10,background:"rgba(7,12,22,.68)",border:"1px solid rgba(255,255,255,.1)",backdropFilter:"blur(6px)"}}>
          {companions.map((companion,index)=>{const hp=companionHPs[companion.id]??companion.hp;const active=companionShootIdx===index;return <div key={companion.id} title={`${companion.name} · HP ${hp}/${companion.hp}`} style={{width:25,height:25,borderRadius:8,display:"grid",placeItems:"center",fontSize:8,fontWeight:900,color:hp>0?"#eaf4ff":"#64748b",background:hp>0?"linear-gradient(135deg,rgba(59,130,246,.6),rgba(124,58,237,.55))":"rgba(71,85,105,.5)",border:active?"2px solid #fbbf24":"1px solid rgba(255,255,255,.18)",boxShadow:active?"0 0 12px rgba(251,191,36,.9)":"none",filter:hp>0?"none":"grayscale(1)",animation:active?"mb-archer-attack .4s ease":"none"}}>{companion.name.slice(0,1)}</div>})}
        </div>

        {/* 貓咪回合覆蓋層 */}
        <CatRoundOverlay
          open={showCatRound}
          cats={catRoundCats}
          totalDmg={catRoundTotalDmg}
        />

        {/* 退出確認 */}
        {showExitConfirm && (
          <div style={{ position:"absolute", inset:0, zIndex:50, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.2)", borderRadius:24, padding:24, width:"100%", textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
              <div style={{ fontSize:18, fontWeight:900, color:"white", marginBottom:8 }}>確定退出戰鬥？</div>
              <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16 }}>目前進度不會儲存，今日可重新進入</div>
              <div style={{ display:"flex", gap:12 }}>
                <button onClick={() => setShowExitConfirm(false)} style={{ flex:1, padding:"12px", borderRadius:12, background:"rgba(255,255,255,0.1)", color:"#e2e8f0", fontWeight:700, border:"none", cursor:"pointer" }}>取消</button>
                <button onClick={() => { timerRef.current.forEach(clearTimeout); onBack(); }} style={{ flex:1, padding:"12px", borderRadius:12, background:"#dc2626", color:"white", fontWeight:900, border:"none", cursor:"pointer" }}>退出</button>
              </div>
            </div>
          </div>
        )}

        {/* 回合結算 overlay */}
        {subPhase === "roundResult" && (
          <div style={{ position:"absolute", inset:0, zIndex:40, background:"rgba(0,0,0,0.82)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14 }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>
              第 {allRounds.length} 回合結算
            </div>
            <div style={{ fontSize:52, fontWeight:900, color:"#f87171", animation:"wbShake 0.4s ease" }}>
              -{roundSummary?.dmg.toLocaleString()}
            </div>
            {roundSummary?.crits > 0 && <div style={{ fontSize:12, color:"#fbbf24" }}>⚡ {roundSummary.crits} 次暴擊！</div>}
            <div style={{ display:"flex", gap:6 }}>
              {roundSummary?.arrows.map((a, i) => (
                <div key={i} style={{ width:38, height:38, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, background:`${scoreColor(a.label)}22`, border:`1px solid ${scoreColor(a.label)}`, color:scoreColor(a.label) }}>{a.label}</div>
              ))}
            </div>
            <div style={{ width:"72%", marginTop:4 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:4 }}>{boss.name} HP</div>
              <div style={{ height:8, background:"rgba(255,255,255,0.1)", borderRadius:4, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.max(0,bossHP/event.bossMaxHP)*100}%`, background:boss.accent||"#f59e0b", transition:"width 0.7s" }}/>
              </div>
            </div>
            <div style={{ fontSize:11, color: isLastRound ? "#fca5a5" : "rgba(255,255,255,0.3)", animation:"wbShake 0.6s ease infinite", animationDelay:"0.8s" }}>
              {isLastRound ? "⚠️ Boss 集結全力…" : "⚡ Boss 正在蓄力…"}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {Array.from({ length: TOTAL_ROUNDS }).map((_,i) => (
                <div key={i} style={{ width:20, height:4, borderRadius:2, background: i < allRounds.length ? "#f59e0b" : "rgba(255,255,255,0.15)" }}/>
              ))}
            </div>
            {isLastRound && (
              <div style={{ display:"flex", gap:12, marginTop:4 }}>
                <div style={{ background:"rgba(14,165,233,0.2)", border:"1px solid #0ea5e966", borderRadius:10, padding:"5px 12px", textAlign:"center" }}>
                  <span style={{ fontSize:13 }}>🏹</span>
                  <span style={{ fontSize:13, fontWeight:900, color:"#7dd3fc", marginLeft:4 }}>+50~300 XP</span>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)" }}>射手經驗（依傷害）</div>
                </div>
                {profile?.equippedCat?.catId && (
                  <div style={{ background:"rgba(236,72,153,0.2)", border:"1px solid #ec489966", borderRadius:10, padding:"5px 12px", textAlign:"center" }}>
                    <span style={{ fontSize:13 }}>🐱</span>
                    <span style={{ fontSize:13, fontWeight:900, color:"#f9a8d4", marginLeft:4 }}>+50~300 XP</span>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)" }}>貓貓經驗（依傷害）</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        {/* ── 頂部資訊列（HP 條 + 名字 + 統計 + 日誌視窗） ── */}
        <div style={{ flexShrink:0, background:"rgba(0,0,0,0.75)", zIndex:2, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          <BattleHPBar current={bossHP} max={event.bossMaxHP} height={22} showBorder={false} compact />

          <div style={{ padding:"3px 10px 4px" }}>
            {/* Boss 名字（血條下方）+ 回合點 + 離開按鈕 */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><BattleSoundIndicator compact /><span style={{ fontSize:13, fontWeight:900, color:boss.accent||"#f59e0b", textShadow:"0 2px 8px #000" }}>{boss.name}</span></span>
                <div style={{ display:"flex", gap:2 }}>
                  {Array.from({ length: TOTAL_ROUNDS }).map((_,i) => (
                    <div key={i} style={{ width:12, height:3, borderRadius:2, background: i < roundIdx ? "#f59e0b" : i === roundIdx ? "#f87171" : "rgba(255,255,255,0.15)" }}/>
                  ))}
                  {isLastRound && <span style={{ fontSize:9, color:"#fca5a5", marginLeft:2 }}>⚠️</span>}
                </div>
              </div>
              <button onClick={() => setShowBattleLog(v => !v)}
                style={{ background: showBattleLog?"rgba(251,191,36,0.2)":"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color: showBattleLog?"#fbbf24":"rgba(255,255,255,0.55)", borderRadius:7, padding:"1px 8px", fontSize:11, cursor:"pointer", marginRight:4 }}>
                📜
              </button>
              <button onClick={() => setShowExitConfirm(true)}
                style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color:"rgba(255,255,255,0.55)", borderRadius:7, padding:"1px 8px", fontSize:11, cursor:"pointer" }}>
                離開
              </button>
            </div>

            {/* 統計列 */}
            <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginBottom:3 }}>
              <div style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:5, padding:"1px 6px", fontSize:10, color:"#94a3b8" }}>⚔️ 第{roundIdx+1}回</div>
              <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid #f8717144", borderRadius:5, padding:"1px 6px", fontSize:10, color:"#f87171" }}>💢 {boss.atk}</div>
              <div style={{ background:"rgba(59,130,246,0.15)", border:"1px solid #60a5fa44", borderRadius:5, padding:"1px 6px", fontSize:10, color:"#60a5fa" }}>🛡️ {boss.def}</div>
              <div style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:5, padding:"1px 6px", fontSize:10, color:"#94a3b8" }}>🏹 {arrows.length}/{ARROWS_PER}</div>
            </div>

          </div>
        </div>

        {/* ── Boss 圖區（填滿剩餘空間） ── */}
        <div style={{ flex:"1 1 0", position:"relative", minHeight:0, overflow:"hidden", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:6 }}>
          {/* CatMsg 放在 Boss 圖區內，不蓋住底部控制列 */}
          {catMsg && <CatMsg msg={catMsg} onDone={() => setCatMsg(null)}/>}
<div style={{ animation: animBossAttackDown ? "mb-monster-attack 0.65s ease" : animBossCharge ? "mb-charge 0.7s ease infinite" : animMonsterHit ? "mb-monster-hit 0.5s ease" : undefined }}>
            <WorldBossSVG bossKey={event.bossKey} currentHP={bossHP} maxHP={event.bossMaxHP} size={280}/>
          </div>
          {/* 浮動傷害 / MISS */}
          {floatDmg && (
            floatDmg.isMiss
              ? <span style={{ position:"absolute", top:"25%", left:"50%", transform:"translateX(-50%)", fontSize:"1.3rem", fontWeight:900, color:"#94a3b8", textShadow:"0 2px 8px rgba(0,0,0,0.9)", animation:"mb-miss 2.0s ease-out forwards", pointerEvents:"none", whiteSpace:"nowrap" }}>MISS</span>
              : <span style={{ position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)", fontSize: floatDmg.isCrit?"2rem":"1.6rem", fontWeight:900, color: floatDmg.isCrit?"#fbbf24":"#f87171", textShadow:"0 2px 10px rgba(0,0,0,0.9)", animation:"mb-float 2.0s ease-out forwards", pointerEvents:"none", whiteSpace:"nowrap" }}>
                  -{floatDmg.dmg}{floatDmg.isCrit?"💥":""}
                </span>
          )}

          {/* ── 戰鬥紀錄折疊面板 ── */}
          <BattleLogPanel open={showBattleLog} onClose={() => setShowBattleLog(false)}>
              {/* 已完成回合總覽 */}
              {allRounds.length === 0 && dmgLog.length === 0 ? (
                <div style={{ color:"#475569", padding:"20px 0", textAlign:"center" }}>戰鬥尚未開始</div>
              ) : (
                <>
                  {allRounds.map((r, i) => (
                    <div key={i} style={{ marginBottom:6, borderBottom:"1px solid rgba(255,255,255,0.04)", paddingBottom:5 }}>
                      <div style={{ color:"#fbbf24", fontWeight:700, fontSize:11, marginBottom:2 }}>
                        第 {i+1} 回合 · 傷害 {r.dmg} · 暴擊 {r.crits} 次
                      </div>
                      <div style={{ display:"flex", gap:2, flexWrap:"wrap", marginBottom:2 }}>
                        {r.arrows.map((a, j) => (
                          <span key={j} style={{ fontSize:10, fontWeight:700, padding:"1px 4px", borderRadius:3, color: scoreColor(a.label), background:`${scoreColor(a.label)}22` }}>{a.label}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* 本回合即時傷害紀錄 */}
                  {dmgLog.length > 0 && (
                    <div>
                      <div style={{ color:"#94a3b8", fontWeight:700, fontSize:10, marginBottom:3 }}>即時紀錄</div>
                      {dmgLog.map((l, i, arr) => (
                        <div key={i} style={{ fontSize:10, lineHeight:1.6, color: i===arr.length-1 ? "#e2e8f0" : "rgba(255,255,255,0.45)" }}>{l}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </BattleLogPanel>
        </div>

        {/* ⚡ R2/R4 強攻預告（R1/R3 末設定,重連自 save 還原;PRD 12） */}
        {subPhase === "shooting" && pendingTelegraph && (
          <div style={{ margin:"4px 6px", padding:"8px 10px", borderRadius:10,
            background: pendingTelegraph.isFinisher ? "rgba(244,63,94,.14)" : "rgba(251,191,36,.12)",
            border: `1.5px solid ${pendingTelegraph.isFinisher ? "#f43f5e" : "#fbbf24"}` }}>
            <div style={{ fontSize:12, fontWeight:900, color: pendingTelegraph.isFinisher ? "#fda4af" : "#fcd34d" }}>
              {pendingTelegraph.isFinisher ? "☄️ 終結技預告" : "⚡ 強攻預告"}：「{pendingTelegraph.name}」
            </div>
            <div style={{ fontSize:10, color:"#e2e8f0", marginTop:2, lineHeight:1.5 }}>{pendingTelegraph.counterText}</div>
          </div>
        )}

        {subPhase === "shooting" && !scoringReady && <ConsumablesBar />}

        {/* ── 輸入區（Boss 圖正下方） ── */}
        <div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.82)", padding:"4px 6px 2px" }}>
          {subPhase === "shooting" && !scoringReady && (
            <>
              {/* 🎯 開始計分 → 啟動新式 BattleScreen 計分 */}
              <button
                onClick={() => { setScoringReady(true); }}
                style={{ width:"100%", padding:"11px 0", borderRadius:12, fontWeight:900, fontSize:14, cursor:"pointer",
                  background:"linear-gradient(135deg,#7c3aed,#2563eb)", color:"white", border:"none", marginTop:2 }}>
                🎯 開始計分
              </button>
              {/* 保留舊式計分捷徑（按箭頭展開） */}
              {false && <details style={{ marginTop:6 }}>
                <summary style={{ fontSize:10, color:"#94a3b8", cursor:"pointer", fontWeight:700, textAlign:"center" }}>使用舊式計分 ⚙️</summary>
                <div style={{ marginTop:4 }}>
                  <div style={{ display:"flex", gap:3, marginBottom:4, justifyContent:"center", alignItems:"center" }}>
                    <BattleArrowSlots
                        arrows={arrows}
                        totalArrows={ARROWS_PER}
                        onUndo={() => setArrows(prev => prev.slice(0,-1))}
                        showUndo={arrows.length > 0}
                        slotSize={36}
                        showScore={false}
                        processing={false}
                        processingIdx={-1}
                        extraContent={
                          arrows.length === 0 && (
                            <button onClick={() => setTargetMode(m => !m)} style={{
                              marginLeft:2, padding:"2px 7px", borderRadius:6, fontSize:11, fontWeight:700,
                              background: targetMode?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.07)",
                              border:`1px solid ${targetMode?"#22c55e":"rgba(255,255,255,0.15)"}`,
                              color: targetMode?"#4ade80":"rgba(255,255,255,0.4)", cursor:"pointer",
                            }}>🎯</button>
                          )
                        }
                      />
                      <span style={{ color:"#f1f5f9", fontWeight:900, fontSize:12, marginLeft:4 }}>
                        {arrows.length}/{ARROWS_PER} 箭
                      </span>
                  </div>
                  {targetPending && <div style={{ textAlign:"center", fontSize:12, color:"#a78bfa", fontWeight:700, marginBottom:4 }}>計算中…⚔️</div>}
                  <TargetFaceOverlay
                    open={targetMode && !targetPending}
                    fmtId={targetFmt}
                    arrowLabels={arrows.map(a => a.label)}
                    arrowPositions={arrows.filter(arrow => Number.isFinite(arrow.nx))}
                    arrowsPerRound={ARROWS_PER}
                    onArrow={handleScore}
                    onUndo={() => setArrows(prev => prev.slice(0,-1))}
                    onSubmit={handleTargetSubmit}
                  />
                  <BattleScoreButtons
                      labels={getTargetScoreLabels(targetFmt)}
                      onScore={handleScore}
                      disabled={false}
                      variant="image"
                    />
                  {arrows.length >= ARROWS_PER && !targetPending && (
                    <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:4 }}>
                      {!statsReady && <div style={{ textAlign:"center", fontSize:11, color:"#94a3b8", paddingBottom:4 }}>⏳ 數值載入中…</div>}
                      <button onClick={() => { sfxCast(); finishRound(arrows); }}
                        disabled={!statsReady}
                        style={{ width:"100%", padding:"12px", background: statsReady ? `linear-gradient(135deg, ${boss.accent||"#f59e0b"}, #ef4444)` : "#374151", border:"none", borderRadius:12, color:"white", fontSize:16, fontWeight:900, cursor: statsReady ? "pointer" : "not-allowed", boxShadow: statsReady ? `0 4px 20px ${boss.accent||"#f59e0b"}44` : "none", opacity: statsReady ? 1 : 0.5 }}>
                        ⚔️ 送出 {ARROWS_PER} 箭！
                      </button>
                      <button onClick={() => setArrows(prev => prev.slice(0,-1))}
                        style={{ width:"100%", padding:"5px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"rgba(255,255,255,0.35)", fontSize:11, cursor:"pointer" }}>
                        ← 取消上一箭
                      </button>
                    </div>
                  )}
                </div>
              </details>}
            </>
          )}
          {/* ⬇ BattleScreen 計分模式（世界王） ⬇ */}
          {subPhase === "shooting" && scoringReady && (
            <div style={{padding:"6px 0 8px"}}>
              <ConsumablesBar compact />
              <BattleScreen
                scoringMode
                player={{
                  name: myName,
                  lv: archerLevel,
                  atk: baseATK,
                  def: baseDEF,
                  hp: myHP,
                  maxHp: baseHP,
                }}
                monster={{
                  id: event?.bossData?.id,
                  name: boss.name,
                  family: boss.family,
                  hp: bossHP,
                  atk: boss.atk,
                  def: boss.def,
                  tier: "mythic",
                }}
                battleMode="score"
                scoreInput={targetMode ? "target" : "keypad"}
                arrowsPerRound={ARROWS_PER}
                onSubmit={(scores) => {
                  const labelMap = {10:"X",9:"9",8:"8",7:"7",6:"6",5:"5",4:"4",3:"3",2:"2",1:"1",0:"M"};
                  const newArrows = scores.map(s => ({
                    score: s,
                    label: labelMap[s] || String(s),
                  }));
                  setArrows(newArrows);
                  sfxCast();
                  finishRound(newArrows);
                  setScoringReady(false);
                }}
              />
            </div>
          )}
          {subPhase === "processing" && (
            <div style={{ minHeight:110, display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", gap:8, padding:10, borderRadius:14, background:"radial-gradient(circle,rgba(245,158,11,.18),rgba(15,23,42,.72))", border:"1px solid rgba(251,191,36,.3)" }}>
              <div style={{ fontSize:13, fontWeight:900, color:"#fbbf24", animation:"wb-pulse 0.8s ease-in-out infinite" }}>⚔️ 戰鬥演示中…</div>
              {dmgLog.slice(-3).map((l, i, arr) => (
                <div key={i} style={{ fontSize:11, textAlign:"center", fontWeight:700, color: i===arr.length-1 ? "white" : "rgba(255,255,255,0.4)", marginBottom:2 }}>{l}</div>
              ))}
            </div>
          )}
        </div>

        {/* ── 弓箭手 + 資訊同框列：前後排 ── */}
        <div style={{ flexShrink:0, background:"rgba(0,0,0,0.88)", borderTop:"1px solid rgba(255,255,255,0.1)", paddingBottom:"max(6px, env(safe-area-inset-bottom))" }}>
          {/* 前排：前3位同伴 + 玩家（固定顯示） */}
          <div style={{ display:"flex", gap:3, padding:"4px 6px 4px", justifyContent:"center",
            animation: animPlayerHit ? "mb-screen-shake 0.55s ease" : undefined }}>
            {frontCompanions.map((c, idx) => {
              const cStyle = ARCHER_STYLES[idx % ARCHER_STYLES.length];
              return (
                <div key={c.id} style={{ flexShrink:0, width:frontW, display:"flex", flexDirection:"column",
                  border:"1px solid rgba(255,255,255,0.09)", borderRadius:8, overflow:"hidden",
                  background:"rgba(255,255,255,0.04)" }}>
                  <div style={{ height:80, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                    <img src={`/cats/archers/${cStyle}.webp`} alt={c.name}
                      style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom",
                        animation: companionShootIdx === idx ? "mb-archer-attack 0.4s ease" : undefined,
                        filter: companionShootIdx === idx ? "drop-shadow(0 0 8px rgba(255,255,255,0.7))" : undefined }}
                      onError={e => { e.target.style.display="none"; }}/>
                  </div>
                  <div style={{ height:1, background:"rgba(255,255,255,0.07)" }}/>
                  <div style={{ padding:"2px 2px 3px", textAlign:"center" }}>
                    {(() => {
                      const cHP = companionHPs[c.id] ?? c.hp;
                      const cPct = Math.max(0, cHP / c.hp);
                      return (
                        <div style={{ height:4, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:2 }}>
                          <div style={{ height:"100%", borderRadius:3, transition:"width 0.5s ease", width:`${cPct*100}%`,
                            background: cPct>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":cPct>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)" }}/>
                        </div>
                      );
                    })()}
                    <div style={{ fontSize:8, color:"rgba(255,255,255,0.55)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:1 }}>{c.name?.slice(0,5)}</div>
                    <div style={{ display:"flex", justifyContent:"center", gap:3, marginBottom:1 }}>
                      <div style={{ fontSize:8, color:"#f87171" }}>⚔️{c.atk}</div>
                      <div style={{ fontSize:8, color:"#60a5fa" }}>🛡{c.def}</div>
                    </div>
                    <div style={{ fontSize:8, color: (companionHPs[c.id]??c.hp)/c.hp<=0.25?"#f87171":"#4ade80", fontWeight:700 }}>HP {companionHPs[c.id]??c.hp}</div>
                  </div>
                </div>
              );
            })}

            {/* 玩家（金框高亮，固定在前排） */}
            <div style={{ flexShrink:0, width:frontW, display:"flex", flexDirection:"column",
              border:"1px solid rgba(251,191,36,0.5)", borderRadius:8, overflow:"hidden",
              background:"rgba(251,191,36,0.06)" }}>
              <div style={{ height:80, position:"relative", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                {animPlayerHit && (
                  <span style={{ position:"absolute", top:"0%", left:"50%", transform:"translateX(-50%)", zIndex:10, animation:"mb-float 1.0s ease-out forwards", fontWeight:900, fontSize:"0.9rem", color:"#f43f5e", textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap", pointerEvents:"none" }}>
                    💢-{counterDmg}
                  </span>
                )}
                <img src={`/cats/archers/${profile?.equippedCat?.catId || guestOverride?.archerStyle || "baobao"}.webp`} alt={myName}
                  style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom",
                    filter: archerShoot ? "drop-shadow(0 0 8px rgba(251,191,36,0.8))" : "drop-shadow(0 0 4px rgba(251,191,36,0.35))",
                    animation: archerShoot ? "mb-archer-attack 0.4s ease" : undefined,
                    outline:"2px solid rgba(251,191,36,0.6)", outlineOffset:2, borderRadius:2 }}
                  onError={e => { e.target.style.display="none"; }}/>
              </div>
              <div style={{ height:1, background:"rgba(251,191,36,0.25)" }}/>
              <div style={{ padding:"3px 2px 4px", textAlign:"center" }}>
                <div style={{ height:4, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:2 }}>
                  <div style={{ height:"100%", borderRadius:3, transition:"width 0.5s",
                    width:`${Math.max(0,myHP/baseHP)*100}%`,
                    background: myHP/baseHP>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":myHP/baseHP>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)" }}/>
                </div>
                <div style={{ fontSize:9, fontWeight:700, color:"#fbbf24", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{myName?.slice(0,6)}</div>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:1 }}>
                  <WorldBossCardBadge equipped={cardColl.equipped} />
                </div>
                <div style={{ display:"flex", justifyContent:"center", gap:3, marginBottom:1 }}>
                  <div style={{ fontSize:8, color:"#f87171" }}>⚔{baseATK}</div>
                  <div style={{ fontSize:8, color:"#60a5fa" }}>🛡{baseDEF}</div>
                </div>
                <div style={{ fontSize:8, fontWeight:700, color: myHP/baseHP>0.5?"#4ade80":myHP/baseHP>0.25?"#fbbf24":"#f87171", marginTop:1 }}>HP {myHP}</div>
              </div>
            </div>
          </div>
          {/* 後排（多餘同伴）：僅射手圖+血條+名字，輸入分數時隱藏 */}
          {backCompanions.length > 0 && showBackRow && (
            <div style={{ display:"flex", gap:3, padding:"0 6px 6px", justifyContent:"center" }}>
              {backCompanions.map((c, idx) => {
                const cIdx = idx + 3;
                const cStyle = ARCHER_STYLES[cIdx % ARCHER_STYLES.length];
                return (
                  <div key={c.id} style={{ flexShrink:0, width:backW, display:"flex", flexDirection:"column",
                    border:"1px solid rgba(255,255,255,0.09)", borderRadius:8, overflow:"hidden",
                    background:"rgba(255,255,255,0.04)" }}>
                    <div style={{ height:60, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                      <img src={`/cats/archers/${cStyle}.webp`} alt={c.name}
                        style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom" }}
                        onError={e => { e.target.style.display="none"; }}/>
                    </div>
                    <div style={{ height:1, background:"rgba(255,255,255,0.07)" }}/>
                    <div style={{ padding:"2px 2px 3px", textAlign:"center" }}>
                      {(() => {
                        const cHP = companionHPs[c.id] ?? c.hp;
                        const cPct = Math.max(0, cHP / c.hp);
                        return (
                          <div style={{ height:4, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:1 }}>
                            <div style={{ height:"100%", borderRadius:3, transition:"width 0.5s ease", width:`${cPct*100}%`,
                              background: cPct>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":cPct>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)" }}/>
                          </div>
                        );
                      })()}
                      <div style={{ fontSize:8, color:"rgba(255,255,255,0.55)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name?.slice(0,5)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ── 畫面：結果 ────────────────────────────────────────────
  if (phase === "result") {
    const totalPlayerDmg = allRounds.reduce((s, r) => s + r.dmg, 0);
    const totalCrits     = allRounds.reduce((s, r) => s + r.crits, 0);

    // 聚合箭矢分數分佈
    const wbAllArrows = allRounds.flatMap(r => r.arrows || []);
    const wbScoreBreakdown = {};
    for (const a of wbAllArrows) {
      const key = a.label === "X" ? "X" : a.label === "M" || (a.score ?? 0) === 0 ? "M" : String(a.score);
      wbScoreBreakdown[key] = (wbScoreBreakdown[key] || 0) + 1;
    }
    const wbAvgScore = wbAllArrows.length
      ? parseFloat((wbAllArrows.reduce((s, a) => s + (a.score ?? 0), 0) / wbAllArrows.length).toFixed(1))
      : 0;

    const wbResultData = {
      monster: {
        id: event?.bossData?.id || "world_boss",
        name: event?.bossData?.name || "世界 Boss",
        icon: event?.bossData?.icon || "👹",
        tier: "mythic",
        family: event?.bossData?.family || "ghost",
        variant: "boss",
        isDungeonBoss: false,
      },
      drops: { coins: 0, materials: [], chest: false, goldChest: false, card: null, arrowDew: 0 },
      stats: {
        dmgDealt: totalPlayerDmg,
        dmgTaken: 0,
        avgScore: wbAvgScore,
        arrowCount: wbAllArrows.length,
        roundCount: allRounds.length,
        critCount: totalCrits,
        scoreBreakdown: wbScoreBreakdown,
      },
    };

    // WorldBoss 專屬 config：傷害 + 爆擊 + 分數統計一次顯示
    const wbResultConfig = {
      showMonsterInfo: false,
      showDmgDealt: true,
      showCritCount: true,
      showAvgScore: true,
      showArrowCount: true,
      showRoundCount: true,
      showScoreBreakdown: true,
    };

    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        {milestoneQueue.length > 0 && (
          <SmallMilestonePopup
            milestone={milestoneQueue[0].ms}
            rewards={milestoneQueue[0].rewards}
            onClose={() => setMilestoneQueue(q => q.slice(1))} />
        )}
        {showDeathAnim && (
          <WorldBossDeathAnim
            boss={event.bossData || {}}
            killerName={deathKiller}
            killerStyle={profile?.equippedCat?.catId || guestOverride?.archerStyle || "baobao"}
            finishingArrow={deathFinishArrow}
            onDone={() => setShowDeathAnim(false)}
          />
        )}
        {showCard && (
          <WorldBossBattleCard
            archerName={myName}
            event={event}
            allRounds={allRounds}
            totalDmg={totalPlayerDmg}
            totalCrits={totalCrits}
            onClose={() => setShowCard(false)}
          />
        )}
        <div className="flex-1 overflow-y-auto px-4 py-8 space-y-5 flex flex-col items-center justify-center">
          {submitting ? (
            <div className="text-slate-400 text-sm animate-pulse">結算中…</div>
          ) : result?.ok ? (
            <>
              {result?.defeated ? (
                <BattleResultHeader emoji="💥" title="BOSS 擊殺！" subtitle={event.announcement || "全域廣播：FIRST KILL！"} color="amber" />
              ) : result.playerDied ? (
                <BattleResultHeader emoji="💀" title="陣亡…" subtitle={`你倒在了第 ${allRounds.length} 回合的反擊中`} color="red" />
              ) : (
                <BattleResultHeader emoji="⚔️" title="出戰完成！" subtitle={`Boss 剩餘 ${result.newHP?.toLocaleString()} HP`} color="slate" />
              )}

              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1">
                <div className="text-xs text-slate-400 font-bold mb-2">Boss 出戰報告</div>
                <BattleStatRow icon="⚔️" label="本次總傷害" value={result.dmg?.toLocaleString()} valueColor="#fbbf24" />
                <BattleStatRow icon="❤️" label="Boss 剩餘 HP" value={result.newHP?.toLocaleString()} valueColor="#cbd5e1" />
              </div>

              {wbAllArrows.length > 0 && (
                <BattleResultPanel data={wbResultData} config={wbResultConfig} />
              )}

              {/* 每日出戰獎勵 */}
              {result.dailyReward && (
                <div className="w-full bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4 space-y-1">
                  <div className="text-xs text-emerald-300 font-bold mb-2">🎁 出戰獎勵（已發放）</div>
                  <BattleStatRow icon="💰" label="參與金幣" value={`+${result.dailyReward.coins}`} valueColor="#fbbf24" />
                  {result.dailyReward.chest ? (
                    <BattleStatRow icon="📦" label="傷害寶箱" value={result.dailyReward.chest === "gold" ? "🏆 金寶箱" : "⚙️ 鐵寶箱"} valueColor="#34d399" />
                  ) : (
                    <div className="text-xs text-slate-500">傷害達 Boss HP 1% 可獲鐵寶箱，2.5% 可獲金寶箱</div>
                  )}
                  <div className="text-xs text-slate-500">本次傷害佔 Boss HP {result.dailyReward.pct}%</div>
                </div>
              )}

              {guestActivityReward && (
                <div className="w-full bg-sky-500/10 border border-sky-400/30 rounded-2xl p-4 space-y-1">
                  <div className="text-xs text-sky-300 font-bold mb-2">🎁 體驗參戰回饋（已發放）</div>
                  <BattleStatRow icon="💰" label="體驗金幣" value={`+${guestActivityReward.coins}`} valueColor="#fbbf24" />
                  {guestActivityReward.catXP > 0 && (
                    <BattleStatRow icon="🐱" label="貓貓經驗" value={`+${guestActivityReward.catXP}`} valueColor="#f9a8d4" />
                  )}
                  <div className="text-xs text-slate-500">正式世界王擊殺箱、王卡、排名獎與箭露僅正式角色可領取。</div>
                </div>
              )}

              {result.defeated && (
                <div className="w-full bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4 text-xs text-amber-200 leading-relaxed">
                  {isGuest ? "世界王已被擊倒！體驗角色會保留參戰紀錄，但不領取正式擊殺大獎。" : "🎁 擊殺大獎已自動發放給所有參戰者！"}
                </div>
              )}
              {result?.bossAlreadyDefeated && !result?.defeated && (
                <div className="w-full bg-indigo-500/10 border border-indigo-400/30 rounded-2xl p-4">
                  <div className="text-xs text-indigo-300 font-bold mb-1">⚔️ 尾刀遺憾</div>
                  <div className="text-xs text-slate-400 leading-relaxed">
                    {isGuest ? "Boss 在你出戰期間被隊友擊倒！你的傷害仍已計入活動排行，體驗回饋已正常發放。" : "Boss 在你出戰期間被隊友擊倒！你的傷害仍已計入排行，每日出戰獎勵已正常發放。"}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center space-y-3">
              <div className="text-4xl">⚠️</div>
              <div className="text-rose-400 font-bold">送出失敗</div>
              <div className="text-xs text-slate-500">{result?.reason || "請稍後再試"}</div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-4 pb-6 pt-2 space-y-2">
          {result?.ok && !submitting && (
            <button onClick={() => setShowCard(true)}
              className="w-full py-3 rounded-2xl font-black text-base text-white active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg,#7c3aed,#2563eb)" }}>
              🃏 生成戰鬥小卡
            </button>
          )}
          <button onClick={onBack} disabled={submitting}
            className="w-full py-4 rounded-2xl font-black text-lg bg-white/10 border border-white/20 text-white active:scale-95 transition-all disabled:opacity-40">
            返回大廳
          </button>
        </div>
      </div>
    );
  }

  return null;
}
