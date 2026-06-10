// src/components/member/MonsterBattle.jsx
// 打怪模式 — 完整版：分數靶紙/殭屍靶紙、每2箭反擊、距離、隨機事件、開寶箱、每日上限
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getCertRecords, getCertification, subscribeDexGrants, getDexConfig,
  createNotification, saveMonsterLog, getMonsterLogs,
  getMonsterDailyConfig, checkMonsterDailyLimit, recordMonsterSession,
  addMaterials,
} from "../../lib/db";
import { computeDexStats } from "../../lib/achievementDex";
import { MONSTERS, BODY_PARTS, TIER_LABEL, calcArcherStats, calcDamage, calcCounterDamage, resolveHitPart } from "../../lib/monsterData";
import { getLootTable, drawLoot, isRareLoot } from "../../lib/lootTable";
import LootBox from "./LootBox";
import { drawMaterial, MATERIALS } from "../../lib/monsterMaterials";
import { drawRandomEvent, shouldTriggerEvent } from "../../lib/randomEvents";
import { sfxEpic, sfxSuccess, sfxTap, sfxSoftFail, sfxCast, sfxBuff } from "../../lib/sound";
import BattleCard from "./BattleCard";

const ARROWS_PER_ROUND = 6;   // 每回合6箭
const ARROWS_PER_COUNTER = 2; // 每2箭怪物反擊一次
const DISTANCE_START = 15;
const DISTANCE_STEP  = 5;

// 半靶分數選項
const HALF_SCORES = [
  { label:"X",  val:10, color:"#fbbf24" },
  { label:"10", val:10, color:"#fbbf24" },
  { label:"9",  val:9,  color:"#fbbf24" },
  { label:"8",  val:8,  color:"#ef4444" },
  { label:"7",  val:7,  color:"#ef4444" },
  { label:"6",  val:6,  color:"#3b82f6" },
  { label:"5",  val:5,  color:"#3b82f6" },
  { label:"4",  val:4,  color:"#1e293b" },
  { label:"3",  val:3,  color:"#1e293b" },
  { label:"2",  val:2,  color:"#9ca3af" },
  { label:"1",  val:1,  color:"#9ca3af" },
  { label:"M",  val:0,  color:"#64748b" },
];

const BATTLE_CSS = `
@keyframes mb-pop    { 0%{transform:scale(.7);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes mb-shake  { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
@keyframes mb-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes mb-fade   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes mb-glow   { 0%,100%{box-shadow:0 0 10px #fbbf2488} 50%{box-shadow:0 0 28px #fbbf24cc} }
@keyframes mb-chest  { 0%,100%{transform:translateY(0) scale(1)} 30%{transform:translateY(-14px) scale(1.12)} 60%{transform:translateY(-4px) scale(1.05)} }
@keyframes mb-hit    { 0%{transform:scale(1)} 30%{transform:scale(1.15)} 60%{transform:scale(.95)} 100%{transform:scale(1)} }
@keyframes mb-crit   { 0%{transform:scale(1) rotate(0)} 20%{transform:scale(1.3) rotate(-5deg)} 50%{transform:scale(1.2) rotate(3deg)} 100%{transform:scale(1) rotate(0)} }
@keyframes mb-float  { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-30px);opacity:0} }
`;

// 攻擊文字池（依部位+傷害量）
const HIT_TEXTS = {
  head:    ["頭骨碎裂！💀","眼冒金星！😵","頭部重創！🤕","正中眉心！🎯","爆頭！💥"],
  neck:    ["頸部命中！🎯","咽喉要害！⚡","頸動脈！🩸","精準頸擊！"],
  chest:   ["胸腔震動！","心跳加速！🫀","肋骨斷了！","正中胸口！💢"],
  belly:   ["腹部重擊！","腸子都出來了！😱","腹腔命中！","肚子痛！🤢"],
  arm:     ["手臂受傷！","武器打飛！💨","手臂擦過！","側翼命中！"],
  groin:   ["要害！😱","下三路！⚡","鼠蹊重創！","痛到跳腳！🦵"],
  heart:   ["心臟穿透！❤️‍🔥","致命一擊！💔","心跳停止！☠️","CRITICAL！❤️"],
  kidney:  ["腎臟破碎！🫘","內臟劇痛！😭","腰部重擊！","致命內傷！"],
  lung:    ["肺葉穿透！🫁","呼吸困難！😤","氣胸！🫧","胸腔積血！"],
  balls:   ["GG了！💥","天下第一痛！😭","不孝有三！⚡","後代斷絕！"],
  miss:    ["嗖～沒中","靶紙在哪？😅","飛過去了！","差一點！"],
};
const DMGCOLOR = { low:"#86efac", mid:"#fbbf24", high:"#f97316", crit:"#ef4444", organ:"#c084fc" };

function getHitText(partId) {
  const pool = HIT_TEXTS[partId] || HIT_TEXTS.chest;
  return pool[Math.floor(Math.random() * pool.length)];
}
function getDmgColor(dmg, isCrit, isOrgan) {
  if (isOrgan) return DMGCOLOR.organ;
  if (isCrit) return DMGCOLOR.crit;
  if (dmg >= 40) return DMGCOLOR.high;
  if (dmg >= 20) return DMGCOLOR.mid;
  return DMGCOLOR.low;
}

export default function MonsterBattle({ onBack, isGuest = false }) {
  const { profile } = useAuth();
  const [phase, setPhase]     = useState("select");
  const [battleMode, setBattleMode] = useState("score"); // score | zombie
  const [mode, setMode]       = useState("novice");      // novice | veteran
  const [monster, setMonster] = useState(null);
  const [archerStats, setArcherStats] = useState(null);
  const [certRecords, setCertRecords] = useState([]);
  const [certification, setCertification] = useState(null);
  const [dexGrants, setDexGrants] = useState([]);
  const [dexConfig,  setDexConfig]  = useState({ physicalMax: 20, pointMax: 20 });
  const [history, setHistory] = useState([]);
  const [dailyLeft, setDailyLeft] = useState(null);  // 今日剩餘次數
  const [dailyMax,  setDailyMax]  = useState(5);

  // 戰鬥狀態
  const [archerHP,      setArcherHP]      = useState(100);
  const [monsterHP,     setMonsterHP]     = useState(0);
  const [archerATKMod,  setArcherATKMod]  = useState(0);
  const [distance,      setDistance]      = useState(DISTANCE_START);
  const [round,         setRound]         = useState(1);
  const [log,           setLog]           = useState([]);
  const [battlePhase,   setBattlePhase]   = useState("input"); // input|processing|counter|event|done
  const [arrows,        setArrows]        = useState([]);   // 已輸入的分數陣列
  const [unlockedParts, setUnlockedParts] = useState(new Set());
  const [revived,       setRevived]       = useState(false);
  const [loot,          setLoot]          = useState(null);
  const [lootRevealed,  setLootRevealed]  = useState(false);
  const [showLootBox,   setShowLootBox]   = useState(false);
  const [showBattleCard, setShowBattleCard] = useState(false);
  const [droppedMaterials, setDroppedMaterials] = useState([]); // 本場掉落的材料
  const [currentEvent,  setCurrentEvent]  = useState(null);
  const [skipCounter,   setSkipCounter]   = useState(false);
  const [processing,    setProcessing]    = useState(false); // 防止重複點擊
  const [totalDmgDealt,   setTotalDmgDealt]   = useState(0);
  const [totalDmgRecvd,   setTotalDmgRecvd]   = useState(0);
  const [critCount,       setCritCount]       = useState(0);
  const [animHit,       setAnimHit]       = useState(false);
  const [animCounter,   setAnimCounter]   = useState(false);
  const logEndRef = useRef(null);
  // 怪物選擇（不能放在 if 條件裡，必須在頂層）
  const [randMonsters]  = useState(() => [...MONSTERS].sort(() => Math.random() - 0.5).slice(0, 4));
  const [pickedMonster, setPickedMonster] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    getCertRecords(profile.id).then(setCertRecords).catch(() => {});
    getCertification(profile.id).then(setCertification).catch(() => {});
    getDexConfig().then(setDexConfig).catch(() => {});
    const unsub = subscribeDexGrants(profile.id, setDexGrants);
    // 每日上限
    getMonsterDailyConfig().then(cfg => {
      setDailyMax(cfg.dailyMax || 5);
      checkMonsterDailyLimit(profile.id, cfg.dailyMax || 5).then(left => setDailyLeft(left));
    }).catch(() => setDailyLeft(5));
    return () => unsub && unsub();
  }, [profile?.id]);

  useEffect(() => {
    if (!profile || !certRecords) return;
    const ds = computeDexStats({ member: profile, certification, certRecords, checkinCount: profile?.dailyQuestCount || 0, granted: dexGrants, physicalMax: dexConfig.physicalMax, pointMax: dexConfig.pointMax });
    setArcherStats(calcArcherStats({ member: profile, certification, certRecords, dexStats: ds }));
  }, [profile, certification, certRecords, dexGrants]); // eslint-disable-line

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function addLog(entry) { setLog(l => [...l, entry]); }

  // 點擊輸入分數
  function inputArrow(val) {
    if (arrows.length >= ARROWS_PER_ROUND || processing) return;
    sfxTap();
    setArrows(prev => [...prev, val]);
  }
  function undoArrow() {
    if (!arrows.length || processing) return;
    setArrows(prev => prev.slice(0, -1));
  }

  // 送出本回合6箭，開始計算
  async function submitRound() {
    if (arrows.length < ARROWS_PER_ROUND || processing) return;
    setProcessing(true);
    setBattlePhase("processing");

    let curMonHP = monsterHP;
    let curArchHP = archerHP;
    let curUnlocked = new Set(unlockedParts);
    let curDist = distance;
    let headHitCount = 0;
    let skipCtr = skipCounter;

    addLog({ type: "system", text: `── 第 ${round} 回合，${mode === "veteran" ? `距離 ${distance}米` : "10米"} ──` });
    await delay(400);

    // 逐箭處理（每2箭反擊一次）
    for (let i = 0; i < ARROWS_PER_ROUND; i++) {
      const score = arrows[i];
      let part, dmg;

      // 兩種模式都判定部位
      part = resolveHitPart(score, curUnlocked);
      if (part.id === "chest") curUnlocked = new Set([...curUnlocked, "chest"]);
      if (part.id === "belly") curUnlocked = new Set([...curUnlocked, "belly"]);
      if (part.id === "groin") curUnlocked = new Set([...curUnlocked, "groin"]);
      setUnlockedParts(curUnlocked);

      const effATK2 = (archerStats?.atk || 10) + archerATKMod;
      dmg = calcDamage({ score, archerATK: effATK2, monsterDEF: monster.def, partMult: part.mult });
      if (part.id === "head") headHitCount++;

      const isOrganPart = ["heart","kidney","lung","balls"].includes(part.id);
      const hitText = getHitText(part.id);

      if (part.mult === 0) {
        // 脫靶
        sfxSoftFail();
        addLog({ type: "miss", text: `${i+1}箭　${hitText}　(${score}分)` });
      } else if (isOrganPart) {
        // 器官命中：最強音效
        sfxEpic();
        addLog({ type: "hit_organ", text: `${i+1}箭 ${score}分　${part.icon} ${hitText}　傷害 ${dmg}！` });
      } else if (part.mult >= 1.8 || score >= 10) {
        // 高倍部位或X分
        sfxEpic();
        addLog({ type: "hit_crit", text: `${i+1}箭 ${score}分　${part.icon} ${hitText}　傷害 ${dmg}💥` });
      } else if (score >= 8) {
        sfxSuccess();
        addLog({ type: "hit", text: `${i+1}箭 ${score}分　${part.icon} ${hitText}　傷害 ${dmg}` });
      } else {
        sfxTap();
        addLog({ type: "hit", text: `${i+1}箭 ${score}分　${part.icon} ${part.name}　傷害 ${dmg}` });
      }

      curMonHP = Math.max(0, curMonHP - dmg);
      setMonsterHP(curMonHP);
      setAnimHit(true);
      setTimeout(() => setAnimHit(false), 600);
      if (dmg > 0) setTotalDmgDealt(v => v + dmg);
      if (score >= 10) setCritCount(v => v + 1);
      await delay(1500);

      if (curMonHP <= 0) {
        await endBattle("win", curArchHP, curMonHP);
        setProcessing(false);
        return;
      }

      // 每2箭怪物反擊一次
      if ((i + 1) % ARROWS_PER_COUNTER === 0) {
        // 隨機事件（20%機率）
        if (shouldTriggerEvent()) {
          const ev = drawRandomEvent();
          setCurrentEvent(ev);
          setBattlePhase("event");
          addLog({ type: ev.type === "buff" ? "event_good" : "event_bad", text: `✨【${ev.title}】${ev.desc}` });
          sfxCast();
          const ef = ev.effect || {};
          if (ef.healArcher)   curArchHP = Math.min(archerStats?.hp || 100, curArchHP + ef.healArcher);
          if (ef.archerHP)     curArchHP = Math.max(0, curArchHP + ef.archerHP);
          if (ef.archerATK)    setArcherATKMod(m => m + ef.archerATK);
          if (ef.monsterHP)    curMonHP  = Math.max(0, curMonHP + ef.monsterHP);
          if (ef.skipCounter)  skipCtr = true;
          setArcherHP(curArchHP);
          setMonsterHP(curMonHP);
          await delay(2500);
          if (curMonHP <= 0) { await endBattle("win", curArchHP, curMonHP); setProcessing(false); return; }
        }

        // 怪物反擊
        if (!skipCtr) {
          setBattlePhase("counter");
          setAnimCounter(true);
          setTimeout(() => setAnimCounter(false), 800);

          // 老手模式爆擊判定（距離近時機率高）
          const critChance = mode === "veteran" ? Math.max(0, (DISTANCE_START - curDist) / DISTANCE_START * 0.5) : 0;
          const isCrit = Math.random() < critChance;
          const headStunned = headHitCount > 0 && battleMode === "zombie";
          const cdmg = calcCounterDamage({ monsterATK: monster.atk, archerDEF: archerStats?.def || 10, headStunned, isCrit });

          const counterTxt = isCrit
            ? `${monster.icon} 爆擊！${monster.name} 猛烈反擊！受到 ${cdmg} 傷害（距離${curDist}米）`
            : headStunned
              ? `${monster.icon} 被打暈，反擊減半，受到 ${cdmg} 傷害`
              : `${monster.icon} ${monster.name} 反擊！受到 ${cdmg} 傷害`;
          if (isCrit) sfxEpic();
          else sfxBuff();
          addLog({ type: "counter", text: counterTxt });
          curArchHP = Math.max(0, curArchHP - cdmg);
          setArcherHP(curArchHP);
          if (cdmg > 0) setTotalDmgRecvd(v => v + cdmg);

          // 老手模式縮短距離
          if (mode === "veteran" && cdmg > 0) {
            curDist = Math.max(0, curDist - DISTANCE_STEP);
            setDistance(curDist);
            if (curDist === 0) {
              addLog({ type: "event_bad", text: `😱 距離歸零！${monster.name} 衝到面前！` });
              await delay(500);
              curDist = DISTANCE_STEP;
              setDistance(curDist);
            } else {
              addLog({ type: "system", text: `📍 距離縮短至 ${curDist}米` });
            }
          }

          await delay(2000);

          if (curArchHP <= 0) {
            if (!revived) {
              const reviveHP = Math.ceil((archerStats?.hp || 100) * 0.3);
              setArcherHP(reviveHP);
              curArchHP = reviveHP;
              setRevived(true);
              addLog({ type: "revive", text: "💖 教練施展【完全治癒術】！恢復30% HP，最後一條命！" });
              sfxEpic();
              await delay(2500);
            } else {
              await endBattle("lose", curArchHP, curMonHP);
              setProcessing(false);
              return;
            }
          }
        } else {
          addLog({ type: "system", text: "🛡️ 怪物反擊被阻止！" });
          skipCtr = false;
        }
        setSkipCounter(false);
        setCurrentEvent(null);
        headHitCount = 0;
      }
    }

    // 老手模式命中頭部延長距離
    if (mode === "veteran" && battleMode === "zombie" && headHitCount > 0) {
      curDist = Math.min(DISTANCE_START, curDist + DISTANCE_STEP);
      setDistance(curDist);
      addLog({ type: "system", text: `💀 頭部命中！距離延長至 ${curDist}米` });
    }

    // 回合結算
    const roundTotal = arrows.reduce((s, v) => s + v, 0);
    addLog({ type: "total", text: `本回合 ${roundTotal}分　${monster.name} 剩 HP：${curMonHP}` });
    await delay(1500);

    // 下一回合
    setArrows([]);
    setArcherATKMod(0);
    setRound(r => r + 1);
    setBattlePhase("input");
    setProcessing(false);
  }

  async function startBattle() {
    // 扣除每日次數
    await recordMonsterSession(profile.id).catch(() => {});
    setDailyLeft(l => Math.max(0, (l || 1) - 1));

    setArcherHP(archerStats?.hp || 100);
    const boostedHP  = mode === "veteran" ? Math.round(monster.hp  * 1.5) : monster.hp;
const boostedATK = mode === "veteran" ? Math.round(monster.atk * 1.5) : monster.atk;
const boostedDEF = mode === "veteran" ? Math.round(monster.def * 1.3) : monster.def;
// 把增強後的怪物存起來覆蓋（只影響本場）
setMonster(prev => ({ ...prev, hp: boostedHP, atk: boostedATK, def: boostedDEF }));
setMonsterHP(boostedHP);
    setRound(1);
    setDistance(DISTANCE_START);
    setLog([
      { type: "system", text: `⚔️ 戰鬥開始！對手：${monster.icon} ${monster.name}` },
      { type: "system", text: `🎯 模式：${battleMode === "zombie" ? "殭屍靶紙（部位判定）" : "分數靶紙（純傷害）"}　${mode === "veteran" ? "老手" : "新手"}` },
    ]);
    setBattlePhase("input");
    setArrows([]);
    setUnlockedParts(new Set());
    setRevived(false);
    setLoot(null);
    setLootRevealed(false);
    setCurrentEvent(null);
    setSkipCounter(false);
    setArcherATKMod(0);
    setPhase("battle");
    setTotalDmgDealt(0);
    setTotalDmgRecvd(0);
    setCritCount(0);
    sfxTap();
  }

  async function endBattle(result, finalArchHP, finalMonHP) {
    if (result === "win") {
      sfxEpic();
      // 選擇掉寶表
      const table = getLootTable({ isGuest, mode, battleMode, tier: monster.tier });
      const lootItem = drawLoot(table, monster.id, monster.tier);
      setLoot(lootItem);
      // 材料掉落
      const matCountMap = { easy: 1, normal: 2, hard: 3, boss: 3 };
const matCount = matCountMap[monster.tier] || 1;
const mats = Array.from({ length: matCount }, () => drawMaterial(monster.id, monster.tier)).filter(Boolean);
      setDroppedMaterials(mats);
      if (mats.length > 0 && profile?.id && !isGuest) {
        addMaterials(profile.id, mats).catch(() => {});
      }
      addLog({ type: "win", text: `🏆 擊倒 ${monster.name}！勝利！` });
      addLog({ type: "system", text: `📦 寶箱等你打開...` });
      if (isRareLoot(lootItem) && profile?.id) {
        createNotification({
          type: "high_score",
          title: `🎁 ${profile.nickname || profile.name} 獲得稀有掉落！`,
          content: `${profile.nickname || profile.name} 擊倒了 ${monster.name}，獲得稀有道具！`,
          targetMemberId: null, subjectMemberId: profile.id,
          subjectInfo: { nickname: profile.nickname || profile.name, item: lootItem.name },
        }, profile.id).catch(() => {});
      }
      await saveMonsterLog(profile.id, { monsterName: monster.name, monsterId: monster.id, result: "win", rounds: round, lootName: lootItem.name, lootIcon: lootItem.icon, lootType: lootItem.type, mode, battleMode }).catch(() => {});
      await delay(1000);
      setPhase("loot");
    } else {
      sfxSoftFail();
      addLog({ type: "lose", text: `💀 被 ${monster.name} 擊倒…下次再戰！` });
      await saveMonsterLog(profile.id, { monsterName: monster.name, monsterId: monster.id, result: "lose", rounds: round, mode, battleMode }).catch(() => {});
      await delay(1000);
      setPhase("result");
    }
  }

  // ── 畫面 ──────────────────────────────────────────────

  if (phase === "select") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <div className="flex items-center justify-between">
          {onBack && <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>}
          <button onClick={() => { getMonsterLogs(profile.id).then(setHistory); setPhase("history"); }}
            className="text-xs text-blue-600 font-bold">📊 戰績記錄</button>
        </div>

        <div className="rounded-2xl p-5 text-white" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="text-xs tracking-widest text-purple-200 font-black mb-1">⚔️ 打怪模式</div>
          <div className="text-2xl font-black mb-2">今日對手</div>
          {archerStats && (
            <div className="flex gap-2 text-xs flex-wrap">
              <span className="bg-white/15 px-2 py-0.5 rounded-full">❤️ {archerStats.hp}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">⚔️ {archerStats.atk}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">🛡️ {archerStats.def}</span>
              {dailyLeft !== null && (
                <span className={`px-2 py-0.5 rounded-full font-bold ${dailyLeft > 0 ? "bg-emerald-500/80 text-white" : "bg-red-500/80 text-white"}`}>
                  今日剩 {dailyLeft}/{dailyMax} 次
                </span>
              )}
            </div>
          )}
        </div>

        {dailyLeft === 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">😴</div>
            <div className="font-black text-red-700">今日挑戰次數已用完</div>
            <div className="text-gray-500 text-sm mt-1">明天再來挑戰！</div>
          </div>
        ) : (
          <>
            {/* 今日隨機對手 */}
            <div className="grid grid-cols-2 gap-3">
              {randMonsters.map(m => {
                const tier = TIER_LABEL[m.tier];
                const isPicked = pickedMonster?.id === m.id;
                return (
                  <button key={m.id} onClick={() => setPickedMonster(m)}
                    className="rounded-2xl p-4 text-left transition-all active:scale-95"
                    style={{
                      background: isPicked ? "#ede9fe" : "white",
                      border: `2px solid ${isPicked ? "#7c3aed" : "#e2e8f0"}`,
                    }}>
                    <div className="text-3xl mb-2">{m.icon}</div>
                    <div className="font-black text-gray-800 text-sm">{m.name}</div>
                    <div className="text-xs mt-0.5 font-bold" style={{ color: tier.color }}>【{tier.label}】</div>
                    <div className="flex gap-2 mt-1 text-xs text-gray-400">
                      <span>❤️{m.hp}</span><span>⚔️{m.atk}</span><span>🛡️{m.def}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {pickedMonster && (
              <button onClick={() => {
                if (dailyLeft !== null && dailyLeft <= 0) return;
                setMonster(pickedMonster); setPhase("mode");
              }}
                className="w-full py-4 rounded-2xl font-black text-lg text-white disabled:opacity-50"
                disabled={dailyLeft !== null && dailyLeft <= 0}
                style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)", animation: dailyLeft > 0 ? "mb-glow 2s ease infinite" : "none" }}>
                {dailyLeft !== null && dailyLeft <= 0 ? "😴 今日次數已用完" : `⚔️ 挑戰 ${pickedMonster.name}！`}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  if (phase === "mode") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => setPhase("select")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="text-gray-800 font-black text-xl text-center">選擇靶紙模式</div>

        <button onClick={() => { setBattleMode("score"); setPhase("difficulty"); }}
          className="rounded-2xl p-5 text-left border-2 border-blue-200 bg-blue-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🎯 分數靶紙模式</div>
          <div className="font-black text-gray-800 mb-1">輸入每箭環數，系統算傷害</div>
          <div className="text-gray-500 text-sm">簡單直接，分數越高傷害越大。</div>
        </button>

        <button onClick={() => { setBattleMode("zombie"); setPhase("difficulty"); }}
          className="rounded-2xl p-5 text-left border-2 border-purple-200 bg-purple-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🧟 殭屍靶紙模式</div>
          <div className="font-black text-gray-800 mb-1">分數決定命中部位，觸發部位加成</div>
          <div className="text-gray-500 text-sm">高分命中頭部/心臟，傷害爆表！解鎖器官部位增加趣味。</div>
        </button>
      </div>
    );
  }

  if (phase === "difficulty") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => setPhase("mode")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="text-gray-800 font-black text-xl text-center">選擇難度</div>

        <button onClick={() => { setMode("novice"); setPhase("prebattle"); }}
          className="rounded-2xl p-5 text-left border-2 border-green-200 bg-green-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🟢 新手模式</div>
          <div className="font-black text-gray-800 mb-1">固定10米，無爆擊</div>
          <div className="text-gray-500 text-sm">每2箭怪物反擊一次，傷害穩定。</div>
          <div className="text-green-600 text-xs font-bold mt-2">掉寶：紀念徽章 / 成就銀章 / 9折券</div>
        </button>

        <button onClick={() => { setMode("veteran"); setPhase("prebattle"); }}
          className="rounded-2xl p-5 text-left border-2 border-orange-200 bg-orange-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🟠 老手模式</div>
          <div className="font-black text-gray-800 mb-1">距離15米起，被打近時觸發爆擊</div>
          <div className="text-gray-500 text-sm">距離越近怪物爆擊率越高，命中頭部可延長距離。</div>
          <div className="text-orange-600 text-xs font-bold mt-2">掉寶更豐富，含5折券</div>
        </button>
      </div>
    );
  }

  if (phase === "prebattle") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => setPhase("difficulty")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="rounded-2xl p-6 text-white text-center" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="text-6xl mb-3" style={{ animation:"mb-bounce 1.5s ease infinite" }}>{monster.icon}</div>
          <div className="text-2xl font-black mb-1">{monster.name}</div>
          <div className="text-purple-200 text-sm mb-4">{monster.desc}</div>
          <div className="flex justify-center gap-3 mb-4">
            {[["HP",monster.hp],["ATK",monster.atk],["DEF",monster.def]].map(([k,v])=>(
              <div key={k} className="bg-white/15 rounded-xl px-4 py-2">
                <div className="text-purple-200 text-xs">{k}</div>
                <div className="font-black text-xl">{v}</div>
              </div>
            ))}
          </div>
          {archerStats && (
            <div className="bg-white/10 rounded-xl p-3 mb-3 text-left">
              <div className="text-purple-200 text-xs mb-2 text-center">你的數值</div>
              <div className="flex justify-around text-sm">
                {[["HP",archerStats.hp],["ATK",archerStats.atk],["DEF",archerStats.def]].map(([k,v])=>(
                  <div key={k} className="text-center"><div className="text-purple-200 text-xs">{k}</div><div className="font-black">{v}</div></div>
                ))}
              </div>
            </div>
          )}
          <div className="text-purple-200 text-xs mb-4">
            {battleMode === "zombie" ? "🧟 殭屍靶紙" : "🎯 分數靶紙"}　
            {mode === "veteran" ? "⚔️ 老手・起始15米" : "🟢 新手・固定10米"}　
            每 {ARROWS_PER_COUNTER} 箭反擊一次
          </div>
          <button onClick={startBattle}
            className="w-full py-4 rounded-2xl font-black text-lg"
            style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>
            ⚔️ 開始挑戰！
          </button>
        </div>
      </div>
    );
  }

  if (phase === "battle") {
    const maxHP   = archerStats?.hp || 100;
    const archPct = Math.max(0, Math.round(archerHP / maxHP * 100));
    const monPct  = Math.max(0, Math.round(monsterHP / monster.hp * 100));
    const total6  = arrows.reduce((s,v) => s + v, 0);

    return (
      <div className="p-4 flex flex-col gap-3">
        <style>{BATTLE_CSS}</style>

        {/* HP 條 */}
        <div className="rounded-2xl p-4" style={{ background:"linear-gradient(135deg,#1e293b,#0e7490)" }}>
          <div className="flex justify-between text-white text-xs font-bold mb-2">
            <span>第 {round} 回合</span>
            {mode === "veteran" && <span>📍 {distance}米</span>}
            <span>{ARROWS_PER_ROUND}箭/回合，每{ARROWS_PER_COUNTER}箭反擊</span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-xs text-cyan-200 mb-0.5">
              <span style={animHit ? { animation:"mb-shake .5s ease" } : {}}>
                {monster.icon} {monster.name}
              </span>
              <span>{monsterHP}/{monster.hp}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width:`${monPct}%`, background:monPct>50?"#ef4444":monPct>25?"#f59e0b":"#dc2626" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-cyan-200 mb-0.5">
              <span>🏹 {profile?.nickname||profile?.name}{revived?" 💖":""}</span>
              <span style={animCounter ? { animation:"mb-shake .5s ease" } : {}}>{archerHP}/{maxHP}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                style={{ width:`${archPct}%` }} />
            </div>
          </div>
        </div>

        {/* 隨機事件提示 */}
        {battlePhase === "event" && currentEvent && (
          <div className={`rounded-2xl p-4 text-center border-2 ${currentEvent.type === "buff" ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300"}`}
            style={{ animation:"mb-pop .4s ease" }}>
            <div className="text-3xl mb-1">{currentEvent.icon}</div>
            <div className="font-black text-gray-800">{currentEvent.title}</div>
            <div className="text-gray-500 text-xs mt-1">{currentEvent.desc}</div>
          </div>
        )}

        {/* 怪物反擊提示 */}
        {battlePhase === "counter" && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 text-center"
            style={{ animation:"mb-shake .5s ease" }}>
            <div className="text-3xl mb-1">{monster.icon}</div>
            <div className="text-red-700 font-black text-lg">反擊中！</div>
          </div>
        )}

        {/* 計分輸入（6箭）*/}
        {battlePhase === "input" && (
          <div className="bg-white rounded-2xl p-4">
            <div className="text-gray-700 text-sm font-black mb-2">
              輸入本回合 {ARROWS_PER_ROUND} 箭分數
              <span className="text-gray-400 font-normal ml-1">（每 {ARROWS_PER_COUNTER} 箭後怪物反擊）</span>
            </div>
            {/* 已輸入箭數顯示 */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              {Array.from({length: ARROWS_PER_ROUND}).map((_,i) => (
                <div key={i} className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black
                  ${i < arrows.length
                    ? "bg-blue-600 text-white"
                    : i === arrows.length
                      ? "bg-blue-100 text-blue-400 ring-2 ring-blue-400"
                      : "bg-gray-100 text-gray-300"}`}>
                  {i < arrows.length ? (arrows[i] === 0 ? "M" : arrows[i]) : ""}
                </div>
              ))}
              {arrows.length > 0 && (
                <button onClick={undoArrow} className="text-xs text-gray-400 underline ml-1 self-center">↩退</button>
              )}
            </div>
            {/* 中間提示（第幾箭，2箭一組）*/}
            {arrows.length < ARROWS_PER_ROUND && (
              <div className="text-xs text-center text-blue-500 font-bold mb-2">
                第 {arrows.length + 1} 箭
                {arrows.length === 1 ? "　→ 再1箭怪物反擊" :
                 arrows.length === 3 ? "　→ 再1箭怪物反擊" :
                 arrows.length === 5 ? "　→ 最後一箭！" : ""}
              </div>
            )}
            {/* 分數按鈕 */}
            {arrows.length < ARROWS_PER_ROUND && (
              <div className="grid grid-cols-6 gap-1.5">
                {HALF_SCORES.map(s => (
                  <button key={s.label} onClick={() => inputArrow(s.val)}
                    className="py-2 rounded-lg font-black text-white text-sm active:scale-90 transition-transform"
                    style={{ background: s.color }}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            {/* 加總 + 送出 */}
            <div className="flex items-center justify-between mt-3 bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-gray-600 text-sm font-bold">本回合總分</span>
              <span className="text-blue-600 font-black text-xl">{total6}<span className="text-xs text-gray-400 ml-1">/ 60</span></span>
            </div>
            {arrows.length >= ARROWS_PER_ROUND && (
              <button onClick={submitRound} disabled={processing}
                className="w-full mt-3 py-3 rounded-xl font-black text-white disabled:opacity-50"
                style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)" }}>
                {processing ? "計算中…" : "⚔️ 送出，開始戰鬥！"}
              </button>
            )}
          </div>
        )}

        {/* 戰鬥日誌 */}
        <div className="bg-gray-900 rounded-2xl p-3 max-h-52 overflow-y-auto">
          {log.map((e,i) => (
            <div key={i} className={`text-xs py-0.5 leading-relaxed ${
              e.type==="win"        ? "text-amber-400 font-black" :
              e.type==="lose"       ? "text-red-400 font-black"   :
              e.type==="revive"     ? "text-pink-400 font-black"  :
              e.type==="event_good" ? "text-emerald-300 font-bold":
              e.type==="event_bad"  ? "text-red-300 font-bold"    :
              e.type==="counter"    ? "text-orange-300"            :
              e.type==="total"      ? "text-cyan-300 font-bold"   :
              e.type==="loot"       ? "text-yellow-300 font-black":
              e.type==="hit_organ"  ? "text-purple-300 font-black"  :
              e.type==="hit_crit"   ? "text-orange-300 font-bold"   :
              e.type==="hit"        ? "text-emerald-300"            :
              e.type==="miss"       ? "text-gray-500"               :
              "text-gray-400"
            }`}>{e.text}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    );
  }

  if (phase === "loot") {
    return (
      <div className="p-4 flex flex-col gap-4 items-center">
        <style>{BATTLE_CSS}</style>
        <div className="text-center mt-4">
          <div className="text-amber-400 font-black text-xl mb-1">🏆 擊倒 {monster.name}！</div>
          <div className="text-gray-500 text-sm">第 {round} 回合完成</div>
        </div>

        {/* 戰鬥數據摘要 */}
        <div className="w-full grid grid-cols-3 gap-2">
          {[["⚔️ 總傷害", totalDmgDealt],["🛡️ 承傷", totalDmgRecvd],["💥 爆擊", `${critCount}次`]].map(([lbl,val])=>(
            <div key={lbl} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
              <div className="text-gray-400 text-xs">{lbl}</div>
              <div className="font-black text-gray-800 text-xl">{val}</div>
            </div>
          ))}
        </div>

        {/* 開箱按鈕（不洩漏內容）*/}
        {!lootRevealed ? (
          <button onClick={() => { setLootRevealed(true); setShowLootBox(true); }}
            className="flex flex-col items-center gap-3 active:scale-95 transition-transform"
            style={{ animation:"mb-chest 1.5s ease infinite" }}>
            <div className="text-9xl">📦</div>
            <div className="text-amber-600 font-black text-xl">點擊開箱！</div>
            <div className="text-gray-400 text-sm">裡面有什麼？快來看！</div>
          </button>
        ) : (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="text-5xl">{loot?.icon}</div>
            <div className="font-black text-xl text-gray-800">{loot?.name}</div>
            <div className="text-gray-500 text-sm text-center px-4">{loot?.desc}</div>
            {dailyLeft !== null && dailyLeft <= 0 && (
              <div className="text-red-500 text-xs font-bold text-center">今日次數已用完，明天再來！</div>
            )}
            <button onClick={() => setShowBattleCard(true)}
              className="w-full py-3 rounded-xl font-black text-white"
              style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)" }}>
              📤 產生戰績分享卡
            </button>
            <div className="flex gap-3 w-full">
              <button onClick={() => setPhase("select")} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold">換對手</button>
              {(dailyLeft === null || dailyLeft > 0) && (
                <button onClick={() => setPhase("prebattle")}
                  className="flex-1 py-3 rounded-xl font-black"
                  style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
              )}
            </div>
          </div>
        )}

        <details className="w-full">
          <summary className="text-gray-400 text-xs cursor-pointer text-center">▼ 查看戰鬥記錄</summary>
          <div className="bg-gray-900 rounded-xl p-3 mt-2 max-h-40 overflow-y-auto">
            {log.map((e,i) => <div key={i} className="text-xs text-gray-400 py-0.5">{e.text}</div>)}
          </div>
        </details>

        {/* 開箱動畫 */}
        {showLootBox && loot && (
          <LootBox loot={loot} onDone={() => setShowLootBox(false)} />
        )}

        {showBattleCard && (
          <BattleCard
            onClose={() => setShowBattleCard(false)}
            battleData={{ monster, totalDmg: totalDmgDealt, totalReceived: totalDmgRecvd, critCount, loot, round, mode, battleMode }}
          />
        )}
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <div className="rounded-2xl p-6 text-white text-center" style={{ background:"linear-gradient(135deg,#7f1d1d,#4c1d95)" }}>
          <div className="text-5xl mb-3" style={{ animation:"mb-bounce 1s ease infinite" }}>💀</div>
          <div className="text-2xl font-black mb-1">敗北…</div>
          <div className="text-sm opacity-80 mb-4">被 {monster.name} 擊倒了，{round} 回合</div>
          <div className="flex gap-2">
            <button onClick={() => setPhase("select")} className="flex-1 py-3 rounded-xl bg-white/20 text-white font-bold">換對手</button>
            {(dailyLeft === null || dailyLeft > 0) && (
              <button onClick={() => setPhase("prebattle")}
                className="flex-1 py-3 rounded-xl font-black"
                style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
            )}
          </div>
        </div>
        <details className="w-full">
          <summary className="text-gray-400 text-xs cursor-pointer text-center">▼ 查看戰鬥記錄</summary>
          <div className="bg-gray-900 rounded-xl p-3 mt-2 max-h-40 overflow-y-auto">
            {log.map((e,i) => <div key={i} className="text-xs text-gray-400 py-0.5">{e.text}</div>)}
          </div>
        </details>
      </div>
    );
  }

  if (phase === "history") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => setPhase("select")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="text-gray-800 font-black text-xl">📊 戰績記錄</div>
        {history.length === 0 ? (
          <div className="text-gray-400 text-center py-8">尚無戰績，快去挑戰吧！</div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map(h => {
              const m = MONSTERS.find(m => m.id === h.monsterId);
              return (
                <div key={h.id} className={`rounded-xl p-4 border ${h.result === "win" ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{m?.icon || "👹"}</span>
                      <div>
                        <div className="font-bold text-gray-800 text-sm">{h.monsterName}</div>
                        <div className="text-gray-400 text-xs">
                          {h.mode === "veteran" ? "老手" : "新手"}·{h.battleMode === "zombie" ? "殭屍" : "分數"}　{h.rounds}回合
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-sm ${h.result === "win" ? "text-emerald-600" : "text-gray-400"}`}>
                        {h.result === "win" ? "🏆 勝利" : "💀 落敗"}
                      </div>
                      {h.lootName && <div className="text-xs text-amber-600">{h.lootIcon} {h.lootName}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}
