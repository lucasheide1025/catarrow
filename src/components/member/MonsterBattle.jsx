// src/components/member/MonsterBattle.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getCertRecords, getCertification, subscribeDexGrants, getDexConfig,
  createNotification, saveMonsterLog, getMonsterLogs,
  getMonsterDailyConfig, checkMonsterDailyLimit, recordMonsterSession,
  addChests, subscribePotions, usePotions, addFragments,
} from "../../lib/db";
import { makeChests, openChestContents, CHEST_TYPES, getPotion, calcPotionBuffs, MAX_POTIONS_PER_BATTLE } from "../../lib/itemData";
import { computeDexStats } from "../../lib/achievementDex";
import {
  MONSTERS, FAMILIES, TIER_LABEL,
  calcArcherStats, calcArcherPower, drawMatchedMonsters,
  calcDamage, calcCounterDamage, resolveHitPart,
} from "../../lib/monsterData";
import { getLootTable, drawLoot, isRareLoot } from "../../lib/lootTable";
import LootBox from "./LootBox";
import { drawRandomEvent, shouldTriggerEvent } from "../../lib/randomEvents";
import { sfxEpic, sfxSuccess, sfxTap, sfxSoftFail, sfxCast, sfxBuff } from "../../lib/sound";
import BattleCard from "./BattleCard";

const ARROWS_PER_ROUND   = 6;
const ARROWS_PER_COUNTER = 2;
const DISTANCE_START = 15;
const VETERAN_MULT = { hp:1.5, atk:1.5, def:1.3 };

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
@keyframes mb-glow   { 0%,100%{box-shadow:0 0 10px #fbbf2488} 50%{box-shadow:0 0 28px #fbbf24cc} }
@keyframes mb-chest  { 0%,100%{transform:translateY(0) scale(1)} 30%{transform:translateY(-14px) scale(1.12)} 60%{transform:translateY(-4px) scale(1.05)} }
@keyframes mb-tier   { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
`;

const HIT_TEXTS = {
  head:   ["頭骨碎裂！💀","眼冒金星！😵","正中眉心！🎯","爆頭！💥"],
  neck:   ["頸部命中！🎯","咽喉要害！⚡","頸動脈！🩸"],
  chest:  ["胸腔震動！","心跳加速！🫀","正中胸口！💢"],
  belly:  ["腹部重擊！","腸子都出來了！😱","肚子痛！🤢"],
  arm:    ["手臂受傷！","武器打飛！💨","側翼命中！"],
  groin:  ["要害！😱","下三路！⚡","痛到跳腳！🦵"],
  heart:  ["心臟穿透！❤️‍🔥","致命一擊！💔","心跳停止！☠️"],
  kidney: ["腎臟破碎！🫘","內臟劇痛！😭","致命內傷！"],
  lung:   ["肺葉穿透！🫁","呼吸困難！😤","氣胸！🫧"],
  balls:  ["GG了！💥","天下第一痛！😭","後代斷絕！"],
  miss:   ["嗖～沒中","靶紙在哪？😅","差一點！"],
};

function getHitText(partId) {
  const pool = HIT_TEXTS[partId] || HIT_TEXTS.chest;
  return pool[Math.floor(Math.random() * pool.length)];
}
function randDistStep() { return Math.floor(Math.random() * 5) + 1; }

function calcStats(allArrows) {
  if (!allArrows?.length) return null;
  const total  = allArrows.reduce((s,v)=>s+v,0);
  const count  = allArrows.length;
  const avg    = (total/count).toFixed(1);
  const tens   = allArrows.filter(v=>v===10).length;
  const misses = allArrows.filter(v=>v===0).length;
  const dist   = {};
  allArrows.forEach(v=>{ dist[v]=(dist[v]||0)+1; });
  return { total, count, avg, tens, misses, dist };
}

export default function MonsterBattle({ onBack, isGuest = false }) {
  const { profile } = useAuth();
  const [phase, setPhase]           = useState("select");
  const [battleMode, setBattleMode] = useState("score");
  const [mode, setMode]             = useState("novice");
  const [monster, setMonster]       = useState(null);
  const [archerStats, setArcherStats] = useState(null);
  const [certRecords, setCertRecords] = useState([]);
  const [certification, setCertification] = useState(null);
  const [dexGrants, setDexGrants]   = useState([]);
  const [dexConfig, setDexConfig]   = useState({ physicalMax:20, pointMax:20 });
  const [history, setHistory]       = useState([]);
  const [dailyLeft, setDailyLeft]   = useState(null);
  const [dailyMax, setDailyMax]     = useState(5);

  // 匹配怪物（6族各1隻）
  const [matchedMonsters, setMatchedMonsters] = useState([]);
  const [pickedMonster, setPickedMonster]     = useState(null);

  const [archerHP, setArcherHP]         = useState(100);
  const [monsterHP, setMonsterHP]       = useState(0);
  const [archerATKMod, setArcherATKMod] = useState(0);
  const [distance, setDistance]         = useState(DISTANCE_START);
  const [round, setRound]               = useState(1);
  const [log, setLog]                   = useState([]);
  const [battlePhase, setBattlePhase]   = useState("input");
  const [arrows, setArrows]             = useState([]);
  const [allArrows, setAllArrows]       = useState([]);
  const [roundScores, setRoundScores]   = useState([]);
  const [unlockedParts, setUnlockedParts] = useState(new Set());
  const [revived, setRevived]           = useState(false);
  const [loot, setLoot]                 = useState(null);
  const [lootRevealed, setLootRevealed] = useState(false);
  const [showLootBox, setShowLootBox]   = useState(false);
  const [showBattleCard, setShowBattleCard] = useState(false);
  const [droppedMaterials, setDroppedMaterials] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [skipCounter, setSkipCounter]   = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [totalDmgDealt, setTotalDmgDealt] = useState(0);
  const [totalDmgRecvd, setTotalDmgRecvd] = useState(0);
  const [critCount, setCritCount]       = useState(0);
  const [animHit, setAnimHit]           = useState(false);
  const [animCounter, setAnimCounter]   = useState(false);
  // ⚗️ 藥劑與 📦 寶箱
  const [potionInv, setPotionInv]             = useState({});
  const [selectedPotions, setSelectedPotions] = useState([]);
  const [battleStats, setBattleStats]         = useState(null); // 本場有效數值（含藥劑加成）
  const [wonChests, setWonChests]             = useState([]); // 本場掉落的寶箱陣列（含貓貓箱）
  const [skipBigRound, setSkipBigRound]       = useState(false); // 麻痺毒素：跳過整個大回合反擊
  const logEndRef = useRef(null);

  useEffect(() => {
    if (isGuest) { setArcherStats({ hp:100, atk:10, def:10 }); setDailyLeft(null); return; }
    if (!profile?.id) return;
    getCertRecords(profile.id).then(setCertRecords).catch(()=>{});
    getCertification(profile.id).then(setCertification).catch(()=>{});
    getDexConfig().then(setDexConfig).catch(()=>{});
    const unsub = subscribeDexGrants(profile.id, setDexGrants);
    const unsubPotions = subscribePotions(profile.id, setPotionInv);
    getMonsterDailyConfig().then(cfg => {
      setDailyMax(cfg.dailyMax||5);
      checkMonsterDailyLimit(profile.id, cfg.dailyMax||5).then(left=>setDailyLeft(left));
    }).catch(()=>setDailyLeft(5));
    return () => { unsub && unsub(); unsubPotions && unsubPotions(); };
  }, [profile?.id, isGuest]); // eslint-disable-line

  useEffect(() => {
    if (isGuest || !profile || !certRecords) return;
    const ds = computeDexStats({ member:profile, certification, certRecords, checkinCount:profile?.dailyQuestCount||0, granted:dexGrants, physicalMax:dexConfig.physicalMax, pointMax:dexConfig.pointMax });
    const stats = calcArcherStats({ member:profile, certification, certRecords, dexStats:ds });
    setArcherStats(stats);
  }, [profile, certification, certRecords, dexGrants, isGuest]); // eslint-disable-line

  // ✅ 射手數值就緒後，依戰力匹配6隻怪物
  useEffect(() => {
    if (!archerStats) return;
    const power = calcArcherPower(archerStats);
    const matched = drawMatchedMonsters(power);
    setMatchedMonsters(matched);
    setPickedMonster(null);
  }, [archerStats]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior:"smooth" });
  }, [log]);

  function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }
  function addLog(entry) { setLog(l=>[...l,entry]); }

  function rerollMonsters() {
    if (!archerStats) return;
    const power = calcArcherPower(archerStats);
    const matched = drawMatchedMonsters(power);
    setMatchedMonsters(matched);
    setPickedMonster(null);
  }

  function inputArrow(val) {
    if (arrows.length>=ARROWS_PER_ROUND||processing) return;
    sfxTap();
    setArrows(prev=>[...prev,val]);
  }
  function undoArrow() {
    if (!arrows.length||processing) return;
    setArrows(prev=>prev.slice(0,-1));
  }

  async function submitRound() {
    if (arrows.length<ARROWS_PER_ROUND||processing) return;
    setProcessing(true);
    setBattlePhase("processing");
    const bSt = battleStats || archerStats; // 本場有效數值（含藥劑加成）

    let curMonHP    = monsterHP;
    let curArchHP   = archerHP;
    let curUnlocked = new Set(unlockedParts);
    let curDist     = distance;
    let headHitCount = 0;
    let skipCtr     = skipCounter;

    addLog({ type:"system", text:`── 第 ${round} 回合，${mode==="veteran"?`距離 ${distance}米`:"10米"} ──` });
    await delay(400);

    for (let i=0; i<ARROWS_PER_ROUND; i++) {
      // 分數藥水：每箭 +1分，10→X 再+1 = 雙倍爆擊
      const rawScore = arrows[i];
      let score = rawScore;
      const sp = (battleStats?.scorePlus) || 0;
      let forceCrit = false;
      if (sp > 0) {
        score = Math.min(rawScore + sp, 10);
        if (rawScore >= 10) { score = 10; forceCrit = true; }
      }
      const baseCritMult = forceCrit ? 2.0 : 1.0;
      const part = resolveHitPart(score, curUnlocked);
      if (part.id==="chest") curUnlocked=new Set([...curUnlocked,"chest"]);
      if (part.id==="belly") curUnlocked=new Set([...curUnlocked,"belly"]);
      if (part.id==="groin") curUnlocked=new Set([...curUnlocked,"groin"]);
      setUnlockedParts(curUnlocked);

      const effATK = (bSt?.atk||10) + archerATKMod;
      const dmg = calcDamage({ score, archerATK:effATK, monsterDEF:monster.def, partMult:part.mult * baseCritMult });
      if (part.id==="head") headHitCount++;

      const isOrganPart = ["heart","kidney","lung","balls"].includes(part.id);
      const hitText = getHitText(part.id);

      if (part.mult===0) { sfxSoftFail(); addLog({ type:"miss", text:`${i+1}箭　${hitText}　(${score}分)` }); }
      else if (isOrganPart) { sfxEpic(); addLog({ type:"hit_organ", text:`${i+1}箭 ${score}分　${part.icon} ${hitText}　傷害 ${dmg}！` }); }
      else if (part.mult>=1.8||score>=10) { sfxEpic(); addLog({ type:"hit_crit", text:`${i+1}箭 ${score}分　${part.icon} ${hitText}　傷害 ${dmg}💥` }); }
      else if (score>=8) { sfxSuccess(); addLog({ type:"hit", text:`${i+1}箭 ${score}分　${part.icon} ${hitText}　傷害 ${dmg}` }); }
      else { sfxTap(); addLog({ type:"hit", text:`${i+1}箭 ${score}分　${part.icon} ${part.name}　傷害 ${dmg}` }); }

      curMonHP = Math.max(0, curMonHP-dmg);
      setMonsterHP(curMonHP);
      setAnimHit(true);
      setTimeout(()=>setAnimHit(false),600);
      if (dmg>0) setTotalDmgDealt(v=>v+dmg);
      if (score>=10) setCritCount(v=>v+1);
      await delay(1500);

      if (curMonHP<=0) {
        const roundArr=[...arrows];
        setAllArrows(prev=>[...prev,...roundArr]);
        setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundArr.reduce((s,v)=>s+v,0)}]);
        await endBattle("win",curArchHP,curMonHP);
        setProcessing(false); return;
      }

      if ((i+1)%ARROWS_PER_COUNTER===0) {
        if (shouldTriggerEvent()) {
          const ev=drawRandomEvent();
          setCurrentEvent(ev); setBattlePhase("event");
          addLog({ type:ev.type==="buff"?"event_good":"event_bad", text:`✨【${ev.title}】${ev.desc}` });
          sfxCast();
          const ef=ev.effect||{};
          if (ef.healArcher)  curArchHP=Math.min(bSt?.hp||100,curArchHP+ef.healArcher);
          if (ef.archerHP)    curArchHP=Math.max(0,curArchHP+ef.archerHP);
          if (ef.archerATK)   setArcherATKMod(m=>m+ef.archerATK);
          if (ef.monsterHP)   curMonHP=Math.max(0,curMonHP+ef.monsterHP);
          if (ef.skipCounter) skipCtr=true;
          setArcherHP(curArchHP); setMonsterHP(curMonHP);
          await delay(2500);
          if (curMonHP<=0) {
            const roundArr=[...arrows];
            setAllArrows(prev=>[...prev,...roundArr]);
            setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundArr.reduce((s,v)=>s+v,0)}]);
            await endBattle("win",curArchHP,curMonHP);
            setProcessing(false); return;
          }
        }

        if (skipBigRound) {
          addLog({ type:"system", text:"🕸️ 麻痺毒素！怪物本回合完全無法反擊！" });
          setSkipBigRound(false);
        } else if (!skipCtr) {
          setBattlePhase("counter"); setAnimCounter(true);
          setTimeout(()=>setAnimCounter(false),800);
          const critChance=mode==="veteran"?Math.max(0,(DISTANCE_START-curDist)/DISTANCE_START*0.5):0;
          const isCrit=Math.random()<critChance;
          const headStunned=headHitCount>0&&battleMode==="zombie";
          const cdmg=calcCounterDamage({ monsterATK:monster.atk, archerDEF:bSt?.def||10, headStunned, isCrit });
          const counterTxt=isCrit
            ? `${monster.icon} 爆擊！${monster.name} 猛烈反擊！受到 ${cdmg} 傷害（${curDist}米）`
            : headStunned?`${monster.icon} 被打暈，反擊減半，受到 ${cdmg} 傷害`
            : `${monster.icon} ${monster.name} 反擊！受到 ${cdmg} 傷害`;
          if (isCrit) sfxEpic(); else sfxBuff();
          addLog({ type:"counter", text:counterTxt });
          curArchHP=Math.max(0,curArchHP-cdmg);
          setArcherHP(curArchHP);
          if (cdmg>0) setTotalDmgRecvd(v=>v+cdmg);
          await delay(2000);

          if (curArchHP<=0) {
            if (!revived) {
              const reviveHP=Math.ceil((bSt?.hp||100)*0.3);
              setArcherHP(reviveHP); curArchHP=reviveHP; setRevived(true);
              addLog({ type:"revive", text:"💖 教練施展【完全治癒術】！恢復30% HP，最後一條命！" });
              sfxEpic(); await delay(2500);
            } else {
              const roundArr=[...arrows];
              setAllArrows(prev=>[...prev,...roundArr]);
              setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundArr.reduce((s,v)=>s+v,0)}]);
              await endBattle("lose",curArchHP,curMonHP);
              setProcessing(false); return;
            }
          }
        } else {
          addLog({ type:"system", text:"🛡️ 怪物反擊被阻止！" });
          skipCtr=false;
        }
        setSkipCounter(false); setCurrentEvent(null); headHitCount=0;
      }
    }

    if (mode==="veteran") {
      const step=randDistStep();
      const newDist=Math.max(1,curDist-step);
      if (newDist!==curDist) { curDist=newDist; setDistance(curDist); addLog({ type:"event_bad", text:`📍 怪物逼近！請往前移動 ${step}米 → 現在距離 ${curDist}米` }); await delay(600); }
      if (battleMode==="zombie"&&headHitCount>0) {
        const pushBack=Math.min(3,headHitCount);
        curDist=Math.min(DISTANCE_START,curDist+pushBack);
        setDistance(curDist);
        addLog({ type:"event_good", text:`💀 頭部命中！距離延長 ${pushBack}米 → 現在 ${curDist}米` });
        await delay(600);
      }
    }

    const roundTotal=arrows.reduce((s,v)=>s+v,0);
    const roundArr=[...arrows];
    setAllArrows(prev=>[...prev,...roundArr]);
    setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundTotal}]);
    addLog({ type:"total", text:`本回合 ${roundTotal}分　${monster.name} 剩 HP：${curMonHP}` });
    await delay(1500);
    setArrows([]); setArcherATKMod(0); setRound(r=>r+1); setBattlePhase("input"); setProcessing(false);
  }

  async function startBattle() {
    if (profile?.id) { await recordMonsterSession(profile.id).catch(()=>{}); setDailyLeft(l=>Math.max(0,(l||1)-1)); }

    // ⚗️ 戰前喝藥：消耗藥劑、計算本場加成（只影響當場）
    const buffs = calcPotionBuffs(selectedPotions);
    if (selectedPotions.length>0 && profile?.id && !isGuest) {
      await usePotions(profile.id, selectedPotions).catch(()=>{});
    }
    const baseStats = archerStats || { hp:100, atk:10, def:10 };
    const bStats = {
      hp:  Math.round(baseStats.hp  * buffs.hpMult),
      atk: Math.round(baseStats.atk * buffs.atkMult),
      def: baseStats.def,
    };
    setBattleStats(bStats);
    // 投擲型藥劑：立即對怪物扣血＋麻痺效果（開戰前）
    let throwDmgTotal = 0;
    let throwSkip = null;
    buffs.throwEffects.forEach(te => {
      throwDmgTotal += te.dmg || 0;
      if (te.skipRound) throwSkip = te.skipRound;
    });
    if (throwSkip === "big") setSkipBigRound(true);

    const base=pickedMonster;
    const boosted=mode==="veteran"
      ? {...base, hp:Math.round(base.hp*VETERAN_MULT.hp), atk:Math.round(base.atk*VETERAN_MULT.atk), def:Math.round(base.def*VETERAN_MULT.def)}
      : {...base};
    // 敵方削弱藥劑（在老手增幅之後套用）
    const boostedMonster = {
      ...boosted,
      atk: Math.max(1, Math.round(boosted.atk * buffs.monAtkMult)),
      def: Math.max(0, Math.round(boosted.def * buffs.monDefMult)),
    };
    // 投擲型藥劑直接扣怪物 HP（開戰前）
    const monStartHP = Math.max(1, boostedMonster.hp - throwDmgTotal);
    setMonster(boostedMonster);
    setArcherHP(bStats.hp);
    setMonsterHP(monStartHP);
    setRound(1); setDistance(DISTANCE_START);
    setAllArrows([]); setRoundScores([]);
    setLog([
      { type:"system", text:`⚔️ 戰鬥開始！對手：${boostedMonster.icon} ${boostedMonster.name}【${TIER_LABEL[boostedMonster.tier]?.label}】` },
      { type:"system", text:`🎯 ${battleMode==="zombie"?"殭屍靶紙":"分數靶紙"}　${mode==="veteran"?`⚠️ 老手（HP:${boostedMonster.hp} ATK:${boostedMonster.atk} DEF:${boostedMonster.def}）`:"新手"}` },
      ...buffs.used.map(p=>({ type:"event_good", text:`⚗️ 使用 ${p.icon}「${p.name}」：${p.effectText}！` })),
      ...(throwDmgTotal>0?[{type:"event_bad", text:`💥 投擲命中！怪物直接失去 ${throwDmgTotal} HP！`}]:[]),
      ...(mode==="veteran"?[{type:"system",text:"📍 每回合結束後怪物逼近，隨機縮短 1~5 米！"}]:[]),
    ]);
    if (buffs.used.length>0) sfxBuff();
    setSelectedPotions([]);
    setBattlePhase("input"); setArrows([]); setUnlockedParts(new Set());
    setRevived(false); setLoot(null); setLootRevealed(false); setWonChests([]); setSkipBigRound(false);
    setCurrentEvent(null); setSkipCounter(false); setArcherATKMod(0);
    setPhase("battle"); setTotalDmgDealt(0); setTotalDmgRecvd(0); setCritCount(0); setDroppedMaterials([]);
    sfxTap();
  }

  async function endBattle(result, finalArchHP, finalMonHP) {
    if (result==="win") {
      sfxEpic();
      const table=getLootTable({ isGuest, mode, battleMode, tier:monster.tier });
      const lootItem=drawLoot(table, monster.id, monster.tier);
      setLoot(lootItem);

      // 📦 掉落寶箱（依怪物階級，可能額外掉貓貓箱）
      const { mainChest, catChest } = makeChests(monster);
      let mats=[];
      if (isGuest||!profile?.id) {
        // 訪客：當場直接打開主寶箱，材料只顯示不儲存
        const contents=openChestContents(mainChest);
        mats=contents.materials;
        setDroppedMaterials(mats);
        setWonChests([]);
      } else {
        // 射手：寶箱放進背包
        const chestsToAdd = catChest ? [mainChest, catChest] : [mainChest];
        setWonChests(chestsToAdd);
        setDroppedMaterials([]);
        addChests(profile.id, chestsToAdd).catch(()=>{});
      }
      // 打怪同步寫 practiceLogs（帶入射手裝備）
if (profile?.id && !isGuest) {
  const equipment = profile?.equipment || [];
  const bowLabel = Array.isArray(equipment) && equipment[0]?.label
    ? equipment[0].label
    : (typeof equipment === "string" ? equipment : "打怪練習");
  const practiceRounds = roundScores.map(rs => rs.scores || []);
  addPracticeLog(profile.id, {
    date: new Date().toISOString().slice(0, 10),
    source: "monster",
    monsterName: monster.name,
    mode,
    battleMode,
    result,
    equipment: bowLabel,
    rounds: practiceRounds,
    total: practiceRounds.flat().reduce((s, v) => s + v, 0),
  }, profile.id).catch(() => {});
}
      const chestCfg=CHEST_TYPES[mainChest.type]||CHEST_TYPES.wood;
      addLog({ type:"win",    text:`🏆 擊倒 ${monster.name}！勝利！` });
      addLog({ type:"system", text:isGuest?`📦 寶箱當場打開！`:`${chestCfg.icon} 獲得「${chestCfg.name}」！已放進背包` });
      if (catChest) addLog({ type:"event_good", text:`🐱 幸運！額外獲得「貓貓箱」！` });
      if (isRareLoot(lootItem)&&profile?.id) {
        createNotification({ type:"high_score", title:`🎁 ${profile.nickname||profile.name} 獲得稀有掉落！`,
          content:`${profile.nickname||profile.name} 擊倒了 ${monster.name}，獲得稀有道具！`,
          targetMemberId:null, subjectMemberId:profile.id,
          subjectInfo:{ nickname:profile.nickname||profile.name, item:lootItem.name },
        }, profile.id).catch(()=>{});
      }
      if (profile?.id) {
        setRoundScores(rs=>{
          saveMonsterLog(profile.id, {
            monsterName:monster.name, monsterId:monster.id, result:"win", rounds:round,
            lootName:lootItem.name, lootIcon:lootItem.icon, lootType:lootItem.type,
            mode, battleMode, materials:mats.map(m=>m.id), chestType:mainChest.type, catChest:!!catChest, roundScores:rs,
          }).catch(()=>{});
          return rs;
        });
      }
      await delay(1000); setPhase("loot");
    } else {
      sfxSoftFail();
      addLog({ type:"lose", text:`💀 被 ${monster.name} 擊倒…下次再戰！` });
      if (profile?.id) {
        setRoundScores(rs=>{
          saveMonsterLog(profile.id, {
            monsterName:monster.name, monsterId:monster.id, result:"lose", rounds:round,
            mode, battleMode, materials:[], roundScores:rs,
          }).catch(()=>{});
          return rs;
        });
      }
      await delay(1000); setPhase("result");
    }
  }

  // ── 畫面 ─────────────────────────────────────────────────

  if (phase==="select") {
    const power = archerStats ? calcArcherPower(archerStats) : 0;
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <div className="flex items-center justify-between">
          {onBack && <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>}
          {!isGuest && (
            <button onClick={()=>{ getMonsterLogs(profile.id).then(setHistory); setPhase("history"); }}
              className="text-xs text-blue-600 font-bold">📊 戰績記錄</button>
          )}
        </div>

        {/* 射手戰力卡 */}
        <div className="rounded-2xl p-4 text-white" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs tracking-widest text-purple-200 font-black">⚔️ 打怪模式</div>
            <div className="text-xs text-purple-200">戰力 <span className="font-black text-white text-sm">{power}</span></div>
          </div>
          {archerStats && (
            <div className="flex gap-2 text-xs flex-wrap">
              <span className="bg-white/15 px-2 py-0.5 rounded-full">❤️ {archerStats.hp}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">⚔️ {archerStats.atk}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">🛡️ {archerStats.def}</span>
              {!isGuest && dailyLeft!==null && (
                <span className={`px-2 py-0.5 rounded-full font-bold ${dailyLeft>0?"bg-emerald-500/80":"bg-red-500/80"} text-white`}>
                  今日剩 {dailyLeft}/{dailyMax} 次
                </span>
              )}
              {isGuest && <span className="bg-amber-500/80 px-2 py-0.5 rounded-full font-bold text-white">⭐ 體驗</span>}
            </div>
          )}
        </div>

        {!isGuest && dailyLeft===0 ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">😴</div>
            <div className="font-black text-red-700">今日挑戰次數已用完</div>
            <div className="text-gray-500 text-sm mt-1">明天再來挑戰！</div>
          </div>
        ) : (
          <>
            {/* 六族各1隻，依家族排列 */}
            <div className="flex items-center justify-between mb-1">
              <div className="text-gray-600 text-sm font-black">今日對手（六族匹配）</div>
              <button onClick={rerollMonsters} className="text-xs text-purple-600 font-bold bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                🎲 重新抽怪
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {matchedMonsters.map(m => {
                const tier   = TIER_LABEL[m.tier] || {};
                const family = FAMILIES[m.family] || {};
                const isPicked = pickedMonster?.id===m.id;
                return (
                  <button key={m.id} onClick={()=>setPickedMonster(m)}
                    className="rounded-2xl p-4 text-left transition-all active:scale-95 relative overflow-hidden"
                    style={{ background:isPicked?"#ede9fe":"white", border:`2px solid ${isPicked?"#7c3aed":"#e2e8f0"}` }}>
                    {/* 族別標籤 */}
                    <div className="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background:family.color+"22", color:family.color }}>
                      {family.icon} {family.label}
                    </div>
                    <div className="text-3xl mb-2">{m.icon}</div>
                    <div className="font-black text-gray-800 text-sm pr-14">{m.name}</div>
                    <div className="text-xs mt-0.5 font-bold px-1.5 py-0.5 rounded-full inline-block"
                      style={{ background:tier.bg, color:tier.color }}>
                      【{tier.label}】
                    </div>
                    <div className="flex gap-2 mt-1.5 text-xs text-gray-400">
                      <span>❤️{m.hp}</span><span>⚔️{m.atk}</span><span>🛡️{m.def}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {pickedMonster && (
              <button onClick={()=>{ setMonster(pickedMonster); setPhase("mode"); }}
                className="w-full py-4 rounded-2xl font-black text-lg text-white"
                style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)", animation:"mb-glow 2s ease infinite" }}>
                ⚔️ 挑戰 {pickedMonster.name}！
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  if (phase==="mode") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={()=>setPhase("select")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="text-gray-800 font-black text-xl text-center">選擇靶紙模式</div>
        <button onClick={()=>{ setBattleMode("score"); setPhase("difficulty"); }}
          className="rounded-2xl p-5 text-left border-2 border-blue-200 bg-blue-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🎯 分數靶紙模式</div>
          <div className="font-black text-gray-800 mb-1">輸入每箭環數，系統算傷害</div>
          <div className="text-gray-500 text-sm">簡單直接，分數越高傷害越大。</div>
        </button>
        <button onClick={()=>{ setBattleMode("zombie"); setPhase("difficulty"); }}
          className="rounded-2xl p-5 text-left border-2 border-purple-200 bg-purple-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🧟 殭屍靶紙模式</div>
          <div className="font-black text-gray-800 mb-1">分數決定命中部位，觸發部位加成</div>
          <div className="text-gray-500 text-sm">高分命中頭部/心臟，傷害爆表！解鎖器官部位增加趣味。</div>
        </button>
      </div>
    );
  }

  if (phase==="difficulty") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={()=>setPhase("mode")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="text-gray-800 font-black text-xl text-center">選擇難度</div>
        <button onClick={()=>{ setMode("novice"); setPhase("prebattle"); }}
          className="rounded-2xl p-5 text-left border-2 border-green-200 bg-green-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🟢 新手模式</div>
          <div className="font-black text-gray-800 mb-1">固定10米，無爆擊</div>
          <div className="text-gray-500 text-sm">每2箭怪物反擊一次，傷害穩定。</div>
          <div className="text-green-600 text-xs font-bold mt-2">掉寶：紀念徽章 / 成就銀章 / 9折券</div>
        </button>
        <button onClick={()=>{ setMode("veteran"); setPhase("prebattle"); }}
          className="rounded-2xl p-5 text-left border-2 border-orange-200 bg-orange-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🟠 老手模式</div>
          <div className="font-black text-gray-800 mb-1">距離15米起，每回合縮短 1~5 米</div>
          <div className="text-gray-500 text-sm">怪物數值增強，每回合結束需實際移動靶位，距離越近爆擊率越高。</div>
          <div className="text-orange-600 text-xs font-bold mt-2">掉寶更豐富，含5折券</div>
        </button>
      </div>
    );
  }

  if (phase==="prebattle") {
    const tier   = TIER_LABEL[pickedMonster.tier] || {};
    const family = FAMILIES[pickedMonster.family] || {};
    const previewHP  = mode==="veteran"?Math.round(pickedMonster.hp*VETERAN_MULT.hp):pickedMonster.hp;
    const previewATK = mode==="veteran"?Math.round(pickedMonster.atk*VETERAN_MULT.atk):pickedMonster.atk;
    const previewDEF = mode==="veteran"?Math.round(pickedMonster.def*VETERAN_MULT.def):pickedMonster.def;
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={()=>setPhase("difficulty")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="rounded-2xl p-6 text-white text-center" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="text-6xl mb-2" style={{ animation:"mb-bounce 1.5s ease infinite" }}>{pickedMonster.icon}</div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:family.color+"33", color:"#fff" }}>{family.icon} {family.label}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:tier.color+"44", color:"#fff" }}>【{tier.label}】</span>
          </div>
          <div className="text-2xl font-black mb-1">{pickedMonster.name}</div>
          <div className="text-purple-200 text-sm mb-4">{pickedMonster.desc}</div>
          <div className="flex justify-center gap-3 mb-3">
            {[["HP",previewHP],["ATK",previewATK],["DEF",previewDEF]].map(([k,v])=>(
              <div key={k} className="bg-white/15 rounded-xl px-4 py-2">
                <div className="text-purple-200 text-xs">{k}</div>
                <div className="font-black text-xl">{v}</div>
              </div>
            ))}
          </div>
          {mode==="veteran"&&<div className="bg-orange-500/30 text-orange-200 text-xs font-bold px-3 py-1.5 rounded-full mb-3 inline-block">⚠️ 老手：數值增強 + 每回合縮短距離 1~5 米</div>}
          {archerStats&&(
            <div className="bg-white/10 rounded-xl p-3 mb-3">
              <div className="text-purple-200 text-xs mb-2 text-center">你的數值</div>
              <div className="flex justify-around text-sm">
                {[["HP",archerStats.hp],["ATK",archerStats.atk],["DEF",archerStats.def]].map(([k,v])=>(
                  <div key={k} className="text-center"><div className="text-purple-200 text-xs">{k}</div><div className="font-black">{v}</div></div>
                ))}
              </div>
            </div>
          )}
          <div className="text-purple-200 text-xs mb-4">
            {battleMode==="zombie"?"🧟 殭屍靶紙":"🎯 分數靶紙"}　
            {mode==="veteran"?"⚔️ 老手・起始15米":"🟢 新手・固定10米"}　每 {ARROWS_PER_COUNTER} 箭反擊
          </div>

          {/* ⚗️ 戰前喝藥（只影響本場） */}
          {!isGuest && Object.values(potionInv).some(v=>v>0) && (
            <div className="bg-white/10 rounded-xl p-3 mb-4 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-200 text-xs font-black">⚗️ 戰前喝藥（最多 {MAX_POTIONS_PER_BATTLE} 瓶）</span>
                <span className="text-purple-300 text-xs">只影響本場</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(potionInv).filter(([,c])=>c>0).map(([pid,count])=>{
                  const p=getPotion(pid);
                  if (!p) return null;
                  const selected=selectedPotions.includes(pid);
                  return (
                    <button key={pid}
                      onClick={()=>{
                        sfxTap();
                        setSelectedPotions(prev=>
                          prev.includes(pid)
                            ? prev.filter(x=>x!==pid)
                            : prev.length>=MAX_POTIONS_PER_BATTLE ? prev : [...prev,pid]
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border-2
                        ${selected?"bg-amber-400 text-amber-900 border-amber-300":"bg-white/10 text-white border-white/20"}`}>
                      {p.icon} {p.name}{p.kind==="throw"?" 🎯投":""}  ×{count}
                    </button>
                  );
                })}
              </div>
              {selectedPotions.length>0 && (
                <div className="mt-2 text-amber-300 text-xs font-bold">
                  {selectedPotions.map(pid=>getPotion(pid)?.effectText).filter(Boolean).join("、")}
                </div>
              )}
            </div>
          )}

          <button onClick={startBattle} className="w-full py-4 rounded-2xl font-black text-lg"
            style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>
            ⚔️ 開始挑戰！{selectedPotions.length>0?`（帶 ${selectedPotions.length} 瓶藥）`:""}
          </button>
        </div>
      </div>
    );
  }

  if (phase==="battle") {
    const maxHP=(battleStats||archerStats)?.hp||100;
    const archPct=Math.max(0,Math.round(archerHP/maxHP*100));
    const monPct=monster?Math.max(0,Math.round(monsterHP/monster.hp*100)):0;
    const total6=arrows.reduce((s,v)=>s+v,0);
    return (
      <div className="p-4 flex flex-col gap-3">
        <style>{BATTLE_CSS}</style>
        <div className="rounded-2xl p-4" style={{ background:"linear-gradient(135deg,#1e293b,#0e7490)" }}>
          <div className="flex justify-between text-white text-xs font-bold mb-2">
            <span>第 {round} 回合</span>
            {mode==="veteran"&&<span>📍 {distance}米</span>}
            <span>{ARROWS_PER_ROUND}箭/回合</span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-xs text-cyan-200 mb-0.5">
              <span style={animHit?{animation:"mb-shake .5s ease"}:{}}>{monster?.icon} {monster?.name}</span>
              <span>{monsterHP}/{monster?.hp}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width:`${monPct}%`, background:monPct>50?"#ef4444":monPct>25?"#f59e0b":"#dc2626" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-cyan-200 mb-0.5">
              <span>🏹 {profile?.nickname||profile?.name||"射手"}{revived?" 💖":""}</span>
              <span style={animCounter?{animation:"mb-shake .5s ease"}:{}}>{archerHP}/{maxHP}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width:`${archPct}%` }} />
            </div>
          </div>
        </div>

        {battlePhase==="event"&&currentEvent&&(
          <div className={`rounded-2xl p-4 text-center border-2 ${currentEvent.type==="buff"?"bg-emerald-50 border-emerald-300":"bg-red-50 border-red-300"}`}
            style={{ animation:"mb-pop .4s ease" }}>
            <div className="text-3xl mb-1">{currentEvent.icon}</div>
            <div className="font-black text-gray-800">{currentEvent.title}</div>
            <div className="text-gray-500 text-xs mt-1">{currentEvent.desc}</div>
          </div>
        )}
        {battlePhase==="counter"&&(
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 text-center" style={{ animation:"mb-shake .5s ease" }}>
            <div className="text-3xl mb-1">{monster?.icon}</div>
            <div className="text-red-700 font-black text-lg">反擊中！</div>
          </div>
        )}

        {battlePhase==="input"&&(
          <div className="bg-white rounded-2xl p-4">
            <div className="text-gray-700 text-sm font-black mb-2">
              輸入本回合 {ARROWS_PER_ROUND} 箭
              <span className="text-gray-400 font-normal ml-1">（每 {ARROWS_PER_COUNTER} 箭後怪物反擊）</span>
            </div>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {Array.from({length:ARROWS_PER_ROUND}).map((_,i)=>(
                <div key={i} className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black
                  ${i<arrows.length?"bg-blue-600 text-white":i===arrows.length?"bg-blue-100 text-blue-400 ring-2 ring-blue-400":"bg-gray-100 text-gray-300"}`}>
                  {i<arrows.length?(arrows[i]===0?"M":arrows[i]):""}
                </div>
              ))}
              {arrows.length>0&&<button onClick={undoArrow} className="text-xs text-gray-400 underline ml-1 self-center">↩退</button>}
            </div>
            {arrows.length<ARROWS_PER_ROUND&&(
              <div className="text-xs text-center text-blue-500 font-bold mb-2">
                第 {arrows.length+1} 箭
                {arrows.length===1?"　→ 再1箭怪物反擊":arrows.length===3?"　→ 再1箭怪物反擊":arrows.length===5?"　→ 最後一箭！":""}
              </div>
            )}
            {arrows.length<ARROWS_PER_ROUND&&(
              <div className="grid grid-cols-6 gap-1.5">
                {HALF_SCORES.map(s=>(
                  <button key={s.label} onClick={()=>inputArrow(s.val)}
                    className="py-2 rounded-lg font-black text-white text-sm active:scale-90 transition-transform"
                    style={{ background:s.color }}>{s.label}</button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-3 bg-gray-50 rounded-xl px-3 py-2">
              <span className="text-gray-600 text-sm font-bold">本回合總分</span>
              <span className="text-blue-600 font-black text-xl">{total6}<span className="text-xs text-gray-400 ml-1">/ 60</span></span>
            </div>
            {arrows.length>=ARROWS_PER_ROUND&&(
              <button onClick={submitRound} disabled={processing}
                className="w-full mt-3 py-3 rounded-xl font-black text-white disabled:opacity-50"
                style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)" }}>
                {processing?"計算中…":"⚔️ 送出，開始戰鬥！"}
              </button>
            )}
          </div>
        )}

        <div className="bg-gray-900 rounded-2xl p-3 max-h-52 overflow-y-auto">
          {log.map((e,i)=>(
            <div key={i} className={`text-xs py-0.5 leading-relaxed ${
              e.type==="win"?"text-amber-400 font-black":e.type==="lose"?"text-red-400 font-black":
              e.type==="revive"?"text-pink-400 font-black":e.type==="event_good"?"text-emerald-300 font-bold":
              e.type==="event_bad"?"text-red-300 font-bold":e.type==="counter"?"text-orange-300":
              e.type==="total"?"text-cyan-300 font-bold":e.type==="hit_organ"?"text-purple-300 font-black":
              e.type==="hit_crit"?"text-orange-300 font-bold":e.type==="hit"?"text-emerald-300":
              e.type==="miss"?"text-gray-500":"text-gray-400"
            }`}>{e.text}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    );
  }

  if (phase==="loot") {
    const stats=calcStats(allArrows);
    return (
      <div className="p-4 flex flex-col gap-4 items-center">
        <style>{BATTLE_CSS}</style>
        <div className="text-center mt-4">
          <div className="text-amber-400 font-black text-xl mb-1">🏆 擊倒 {monster?.name}！</div>
          <div className="text-gray-500 text-sm">第 {round} 回合完成</div>
        </div>
        <div className="w-full grid grid-cols-3 gap-2">
          {[["⚔️ 總傷害",totalDmgDealt],["🛡️ 承傷",totalDmgRecvd],["💥 爆擊",`${critCount}次`]].map(([lbl,val])=>(
            <div key={lbl} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
              <div className="text-gray-400 text-xs">{lbl}</div>
              <div className="font-black text-gray-800 text-xl">{val}</div>
            </div>
          ))}
        </div>
        {stats&&(
          <div className="w-full bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="text-blue-700 text-xs font-black mb-3">🎯 本場射箭統計（{stats.count} 箭）</div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[["總分",stats.total],["平均",stats.avg],["X/10",stats.tens],["脫靶",stats.misses]].map(([l,v])=>(
                <div key={l} className="bg-white rounded-xl p-2 text-center border border-blue-100">
                  <div className="text-blue-400 text-xs">{l}</div>
                  <div className="font-black text-gray-800 text-lg">{v}</div>
                </div>
              ))}
            </div>
            <div className="text-blue-600 text-xs font-bold mb-1.5">分數分佈</div>
            <div className="flex gap-1 flex-wrap">
              {[10,9,8,7,6,5,4,3,2,1,0].map(s=>{
                const c=stats.dist[s]||0;
                if (!c) return null;
                const col=HALF_SCORES.find(h=>h.val===s)?.color||"#9ca3af";
                return (
                  <div key={s} className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-black text-gray-700">{c}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ background:col }}>{s===0?"M":s===10?"X":s}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {wonChests.length>0 && (
          <div className="w-full flex flex-col gap-2">
            {wonChests.map((ch,idx)=>{
              const cc=CHEST_TYPES[ch.type]||CHEST_TYPES.wood;
              return (
                <div key={idx} className="rounded-xl p-3 border-2 flex items-center gap-3"
                  style={{ background:cc.color+"15", borderColor:cc.color+"66" }}>
                  <div className="text-4xl" style={{ animation:"mb-chest 1.5s ease infinite" }}>{cc.icon}</div>
                  <div className="flex-1">
                    <div className="font-black text-sm" style={{ color:cc.color }}>
                      獲得「{cc.name}」！{ch.type==="cat"?" 🎉 Lucky！":""}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">已放進背包，到「🎒 背包」頁開箱領材料</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {droppedMaterials.length>0&&(
          <div className="w-full bg-purple-50 border border-purple-200 rounded-xl p-3">
            <div className="text-purple-700 text-xs font-bold mb-1">🧪 寶箱開出材料</div>
            <div className="flex gap-2 flex-wrap">
              {droppedMaterials.map((m,i)=>(
                <span key={i} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">{m.icon} {m.name}</span>
              ))}
            </div>
          </div>
        )}
        {!lootRevealed?(
          <button onClick={()=>{ setLootRevealed(true); setShowLootBox(true); }}
            className="flex flex-col items-center gap-3 active:scale-95 transition-transform"
            style={{ animation:"mb-chest 1.5s ease infinite" }}>
            <div className="text-9xl">📦</div>
            <div className="text-amber-600 font-black text-xl">點擊開箱！</div>
          </button>
        ):(
          <div className="w-full flex flex-col items-center gap-3">
            <div className="text-5xl">{loot?.icon}</div>
            <div className="font-black text-xl text-gray-800">{loot?.name}</div>
            <div className="text-gray-500 text-sm text-center px-4">{loot?.desc}</div>
            <button onClick={()=>setShowBattleCard(true)}
              className="w-full py-3 rounded-xl font-black text-white"
              style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)" }}>
              📤 產生戰績分享卡
            </button>
            <div className="flex gap-3 w-full">
              <button onClick={()=>setPhase("select")} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold">換對手</button>
              {(dailyLeft===null||dailyLeft>0)&&(
                <button onClick={()=>{ setMonster(pickedMonster); setPhase("prebattle"); }}
                  className="flex-1 py-3 rounded-xl font-black"
                  style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
              )}
            </div>
          </div>
        )}
        <details className="w-full">
          <summary className="text-gray-400 text-xs cursor-pointer text-center">▼ 查看戰鬥記錄</summary>
          <div className="bg-gray-900 rounded-xl p-3 mt-2 max-h-40 overflow-y-auto">
            {log.map((e,i)=><div key={i} className="text-xs text-gray-400 py-0.5">{e.text}</div>)}
          </div>
        </details>
        {showLootBox&&loot&&<LootBox loot={loot} onDone={()=>setShowLootBox(false)} />}
        {showBattleCard&&(
          <BattleCard onClose={()=>setShowBattleCard(false)}
            battleData={{ monster, totalDmg:totalDmgDealt, totalReceived:totalDmgRecvd, critCount, loot, round, mode, battleMode }} />
        )}
      </div>
    );
  }

  if (phase==="result") {
    const stats=calcStats(allArrows);
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <div className="rounded-2xl p-6 text-white text-center" style={{ background:"linear-gradient(135deg,#7f1d1d,#4c1d95)" }}>
          <div className="text-5xl mb-3" style={{ animation:"mb-bounce 1s ease infinite" }}>💀</div>
          <div className="text-2xl font-black mb-1">敗北…</div>
          <div className="text-sm opacity-80 mb-4">被 {monster?.name} 擊倒了，{round} 回合</div>
          <div className="flex gap-2">
            <button onClick={()=>setPhase("select")} className="flex-1 py-3 rounded-xl bg-white/20 text-white font-bold">換對手</button>
            {(dailyLeft===null||dailyLeft>0)&&(
              <button onClick={()=>{ setMonster(pickedMonster); setPhase("prebattle"); }}
                className="flex-1 py-3 rounded-xl font-black"
                style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
            )}
          </div>
        </div>
        {stats&&(
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="text-blue-700 text-xs font-black mb-3">🎯 本場射箭統計（{stats.count} 箭）</div>
            <div className="grid grid-cols-4 gap-2">
              {[["總分",stats.total],["平均",stats.avg],["X/10",stats.tens],["脫靶",stats.misses]].map(([l,v])=>(
                <div key={l} className="bg-white rounded-xl p-2 text-center border border-blue-100">
                  <div className="text-blue-400 text-xs">{l}</div>
                  <div className="font-black text-gray-800 text-lg">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <details className="w-full">
          <summary className="text-gray-400 text-xs cursor-pointer text-center">▼ 查看戰鬥記錄</summary>
          <div className="bg-gray-900 rounded-xl p-3 mt-2 max-h-40 overflow-y-auto">
            {log.map((e,i)=><div key={i} className="text-xs text-gray-400 py-0.5">{e.text}</div>)}
          </div>
        </details>
      </div>
    );
  }

  if (phase==="history") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={()=>setPhase("select")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="text-gray-800 font-black text-xl">📊 戰績記錄</div>
        {history.length===0?(
          <div className="text-gray-400 text-center py-8">尚無戰績，快去挑戰吧！</div>
        ):(
          <div className="flex flex-col gap-2">
            {history.map(h=>{
              const m=MONSTERS.find(m=>m.id===h.monsterId);
              const family=FAMILIES[m?.family]||{};
              const tier=TIER_LABEL[m?.tier]||{};
              const rs=h.roundScores||[];
              const totalArrows=rs.flatMap(r=>r.scores||[]);
              const stats=calcStats(totalArrows);
              return (
                <div key={h.id} className={`rounded-xl border ${h.result==="win"?"bg-emerald-50 border-emerald-200":"bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{m?.icon||"👹"}</span>
                      <div>
                        <div className="font-bold text-gray-800 text-sm">{h.monsterName}</div>
                        <div className="flex gap-1 mt-0.5">
                          {family.label&&<span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background:family.color+"22", color:family.color }}>{family.icon} {family.label}</span>}
                          {tier.label&&<span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background:tier.bg, color:tier.color }}>【{tier.label}】</span>}
                        </div>
                        <div className="text-gray-400 text-xs mt-0.5">{h.mode==="veteran"?"老手":"新手"}·{h.battleMode==="zombie"?"殭屍":"分數"}　{h.rounds}回合</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-sm ${h.result==="win"?"text-emerald-600":"text-gray-400"}`}>{h.result==="win"?"🏆 勝利":"💀 落敗"}</div>
                      {h.lootName&&<div className="text-xs text-amber-600">{h.lootIcon} {h.lootName}</div>}
                    </div>
                  </div>
                  {stats&&(
                    <div className="px-4 pb-3 border-t border-gray-100 pt-2">
                      <div className="grid grid-cols-4 gap-1.5">
                        {[["總分",stats.total],["平均",stats.avg],["X/10",stats.tens+"箭"],["脫靶",stats.misses+"箭"]].map(([l,v])=>(
                          <div key={l} className="bg-white rounded-lg p-1.5 text-center border border-gray-100">
                            <div className="text-gray-400 text-[10px]">{l}</div>
                            <div className="font-black text-gray-700 text-sm">{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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