// src/components/member/MonsterBattle.jsx
// 打怪模式 — 第二階段：距離變化 + 隨機事件 + 開寶箱動畫 + 戰績記錄
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getCertRecords, getCertification, subscribeDexGrants, getDexConfig,
  createNotification, saveMonsterLog, getMonsterLogs,
} from "../../lib/db";
import { computeDexStats } from "../../lib/achievementDex";
import {
  MONSTERS, BODY_PARTS, TIER_LABEL,
  calcArcherStats, calcDamage, calcCounterDamage, rollDice,
} from "../../lib/monsterData";
import { LOOT_TABLE_NOVICE, drawLoot, isRareLoot } from "../../lib/lootTable";
import { drawRandomEvent, shouldTriggerEvent } from "../../lib/randomEvents";
import { sfxEpic, sfxSuccess, sfxTap, sfxSoftFail, sfxCast } from "../../lib/sound";

const ARROWS_PER_ROUND = 3;
const DISTANCE_START   = 15;   // 老手模式起始距離
const DISTANCE_STEP    = 5;    // 每次被打縮短距離

// ── CSS ──────────────────────────────────────────────────
const BATTLE_CSS = `
@keyframes mb-pop    { 0%{transform:scale(.7);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes mb-shake  { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
@keyframes mb-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes mb-fade   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes mb-glow   { 0%,100%{box-shadow:0 0 10px rgba(251,191,36,.5)} 50%{box-shadow:0 0 24px rgba(251,191,36,.9)} }
@keyframes mb-spin   { to{transform:rotate(360deg)} }
@keyframes mb-chest-bounce { 0%,100%{transform:translateY(0) scale(1)} 30%{transform:translateY(-12px) scale(1.1)} 60%{transform:translateY(-4px) scale(1.05)} }
`;

export default function MonsterBattle({ onBack }) {
  const { profile } = useAuth();
  const [phase, setPhase]     = useState("select");   // select|mode|prebattle|battle|loot|result|history
  const [mode,  setMode]      = useState("novice");   // novice|veteran
  const [monster, setMonster] = useState(null);
  const [archerStats, setArcherStats] = useState(null);
  const [certRecords, setCertRecords] = useState([]);
  const [certification, setCertification] = useState(null);
  const [dexGrants, setDexGrants] = useState([]);
  const [dexConfig,  setDexConfig]  = useState({ physicalMax: 20, pointMax: 20 });
  const [history, setHistory] = useState([]);

  // 戰鬥狀態
  const [archerHP,     setArcherHP]     = useState(100);
  const [monsterHP,    setMonsterHP]    = useState(0);
  const [archerATKMod, setArcherATKMod] = useState(0);  // 本回合 ATK 加成
  const [monsterDEFMod,setMonsterDEFMod]= useState(0);  // 本回合 DEF 加成
  const [distance,     setDistance]     = useState(DISTANCE_START);
  const [round,        setRound]        = useState(1);
  const [log,          setLog]          = useState([]);
  const [battlePhase,  setBattlePhase]  = useState("archer");  // archer|event|counter|roundEnd
  const [arrows,       setArrows]       = useState([]);
  const [unlockedParts,setUnlockedParts]= useState(new Set());
  const [revived,      setRevived]      = useState(false);
  const [loot,         setLoot]         = useState(null);
  const [counterDmg,   setCounterDmg]   = useState(0);
  const [currentEvent, setCurrentEvent] = useState(null);  // 本回合隨機事件
  const [skipCounter,  setSkipCounter]  = useState(false);
  const [counterMult,  setCounterMult]  = useState(1);
  const [showLootAnim, setShowLootAnim] = useState(false);
  const [lootRevealed, setLootRevealed] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (!profile?.id) return;
    getCertRecords(profile.id).then(setCertRecords).catch(() => {});
    getCertification(profile.id).then(setCertification).catch(() => {});
    getDexConfig().then(setDexConfig).catch(() => {});
    const unsub = subscribeDexGrants(profile.id, setDexGrants);
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

  function loadHistory() {
    if (profile?.id) getMonsterLogs(profile.id).then(setHistory);
  }

  function startBattle() {
    const hp = archerStats?.hp || 100;
    setArcherHP(hp);
    setMonsterHP(monster.hp);
    setRound(1);
    setDistance(DISTANCE_START);
    setLog([{ type: "system", text: `⚔️ 戰鬥開始！${monster.name} ${monster.icon} 出現了！` },
             { type: "system", text: mode === "veteran" ? `📍 距離：${DISTANCE_START}米` : "📍 新手模式，距離固定10米" }]);
    setBattlePhase("archer");
    setArrows([]);
    setUnlockedParts(new Set());
    setRevived(false);
    setLoot(null);
    setCurrentEvent(null);
    setSkipCounter(false);
    setCounterMult(1);
    setArcherATKMod(0);
    setMonsterDEFMod(0);
    setPhase("battle");
    sfxTap();
  }

  // 射擊部位
  function shootPart(part) {
    if (arrows.length >= ARROWS_PER_ROUND) return;
    if (part.locked && !unlockedParts.has(part.locked)) return;
    sfxTap();
    const dice = rollDice();
    const effATK = (archerStats?.atk || 10) + archerATKMod;
    const effDEF = monster.def + monsterDEFMod;
    const dmg = calcDamage({ archerATK: effATK, monsterDEF: effDEF, partMult: part.mult, diceResult: dice });
    const newArrows = [...arrows, { part, dmg, dice }];
    setArrows(newArrows);
    const newUnlocked = new Set(unlockedParts);
    if (["chest","belly","groin"].includes(part.id)) newUnlocked.add(part.id);
    setUnlockedParts(newUnlocked);
    const logEntry = part.mult === 0
      ? { type: "miss", text: `💨 第${newArrows.length}箭脫靶！` }
      : { type: "hit",  text: `${part.icon} 命中${part.name}！🎲${dice}，傷害 ${dmg}` };
    setLog(l => [...l, logEntry]);
    if (newArrows.length >= ARROWS_PER_ROUND) {
      setTimeout(() => resolveRound(newArrows, newUnlocked), 300);
    }
  }

  function resolveRound(finalArrows, finalUnlocked) {
    const totalDmg = finalArrows.reduce((s, a) => s + a.dmg, 0);
    const headHit  = finalArrows.some(a => a.part.id === "head");
    const newMonHP = Math.max(0, monsterHP - totalDmg);
    setMonsterHP(newMonHP);
    setLog(l => [...l, { type: "total", text: `本回合傷害 ${totalDmg}，${monster.name} 剩 HP：${newMonHP}` }]);

    // 老手模式：命中頭部延長距離
    if (mode === "veteran" && headHit) {
      const newDist = Math.min(DISTANCE_START, distance + DISTANCE_STEP);
      if (newDist !== distance) {
        setDistance(newDist);
        setLog(l => [...l, { type: "system", text: `💀 頭部命中！怪物後退，距離拉長至 ${newDist}米` }]);
      }
    }

    if (newMonHP <= 0) { setTimeout(() => endBattle("win"), 500); return; }

    // 隨機事件（在反擊之前）
    if (shouldTriggerEvent()) {
      const ev = drawRandomEvent();
      setCurrentEvent(ev);
      setBattlePhase("event");
      applyEvent(ev, headHit, newMonHP);
    } else {
      triggerCounter(headHit, newMonHP);
    }
  }

  function applyEvent(ev, headHit, curMonHP) {
    const ef = ev.effect || {};
    setLog(l => [...l, { type: ev.type === "buff" ? "event_good" : ev.type === "debuff" ? "event_bad" : "event", text: `✨ 隨機事件：【${ev.title}】${ev.desc}` }]);
    sfxCast();

    let newArcherHP = archerHP;
    if (ef.archerHP)   newArcherHP = Math.max(0, archerHP + ef.archerHP);
    if (ef.healArcher) newArcherHP = Math.min(archerStats?.hp || 100, archerHP + ef.healArcher);
    if (newArcherHP !== archerHP) setArcherHP(newArcherHP);
    if (ef.archerATK)    setArcherATKMod(m => m + ef.archerATK);
    if (ef.monsterDEF)   setMonsterDEFMod(m => m + ef.monsterDEF);
    if (ef.bonusDice)    setArcherATKMod(m => m + ef.bonusDice); // 骰子bonus用ATKMod暫代
    if (ef.monsterHP) {
      const newMon = Math.max(0, curMonHP + ef.monsterHP);
      setMonsterHP(newMon);
      if (newMon <= 0) { setTimeout(() => endBattle("win"), 800); return; }
    }
    if (ef.skipCounter)  setSkipCounter(true);
    if (ef.counterMult)  setCounterMult(ef.counterMult);

    setTimeout(() => triggerCounter(headHit, curMonHP, ef), 1200);
  }

  function triggerCounter(headHit, curMonHP, evEffect = {}) {
    const skip = skipCounter || evEffect.skipCounter;
    if (skip) {
      setLog(l => [...l, { type: "system", text: "🛡️ 怪物反擊被阻止！" }]);
      setTimeout(() => nextRound(), 600);
      return;
    }
    setBattlePhase("counter");
    const mult = counterMult * (evEffect.counterMult || 1);
    const cdmg = Math.round(calcCounterDamage({ monsterATK: monster.atk, archerDEF: archerStats?.def || 10, headStunned: headHit }) * mult);
    setCounterDmg(cdmg);
    const txt = headHit
      ? `💫 ${monster.name} 被打暈，反擊減半，受到 ${cdmg} 傷害`
      : `${monster.icon} ${monster.name} 反擊！受到 ${cdmg} 傷害`;
    setLog(l => [...l, { type: "counter", text: txt }]);
    const newArchHP = Math.max(0, archerHP - cdmg);
    setArcherHP(newArchHP);

    // 老手模式：縮短距離
    if (mode === "veteran" && cdmg > 0) {
      const newDist = Math.max(0, distance - DISTANCE_STEP);
      if (newDist !== distance) {
        setDistance(newDist);
        if (newDist === 0) {
          setLog(l => [...l, { type: "event_bad", text: `😱 距離歸零！${monster.name} 衝到面前直接攻擊！` }]);
          setTimeout(() => setDistance(DISTANCE_STEP), 800);
        } else {
          setLog(l => [...l, { type: "system", text: `📍 距離縮短至 ${newDist}米` }]);
        }
      }
    }

    if (newArchHP <= 0) {
      if (!revived) {
        setTimeout(() => {
          const reviveHP = Math.ceil((archerStats?.hp || 100) * 0.3);
          setArcherHP(reviveHP);
          setRevived(true);
          setLog(l => [...l, { type: "revive", text: "💖 教練施展【完全治癒術】！恢復30% HP，最後一條命！" }]);
          sfxEpic();
          nextRound();
        }, 800);
      } else {
        setTimeout(() => endBattle("lose"), 600);
      }
      return;
    }
    setTimeout(() => nextRound(), 1000);
  }

  function nextRound() {
    setBattlePhase("archer");
    setArrows([]);
    setCurrentEvent(null);
    setSkipCounter(false);
    setCounterMult(1);
    setArcherATKMod(0);
    setMonsterDEFMod(0);
    setRound(r => r + 1);
    setLog(l => [...l, { type: "system", text: `── 第 ${round + 1} 回合 ──` }]);
  }

  async function endBattle(result) {
    if (result === "win") {
      sfxEpic();
      const lootItem = drawLoot(LOOT_TABLE_NOVICE);
      setLoot(lootItem);
      setLog(l => [...l, { type: "win",  text: `🏆 擊倒 ${monster.name}！勝利！` }]);
      setLog(l => [...l, { type: "loot", text: `🎁 掉落：${lootItem.icon} ${lootItem.name}` }]);
      if (isRareLoot(lootItem) && profile?.id) {
        createNotification({
          type: "high_score",
          title: `🎁 ${profile.nickname || profile.name} 獲得稀有掉落！`,
          content: `${profile.nickname || profile.name} 擊倒了 ${monster.name}，獲得【${lootItem.name}】！`,
          targetMemberId: null, subjectMemberId: profile.id,
          subjectInfo: { nickname: profile.nickname || profile.name, item: lootItem.name },
        }, profile.id).catch(() => {});
      }
      // 存記錄
      await saveMonsterLog(profile.id, { monsterName: monster.name, monsterId: monster.id, result: "win", rounds: round, lootName: lootItem.name, lootIcon: lootItem.icon, lootType: lootItem.type, mode }).catch(() => {});
      // 顯示開寶箱動畫
      setShowLootAnim(true);
      setLootRevealed(false);
      setPhase("loot");
    } else {
      sfxSoftFail();
      setLog(l => [...l, { type: "lose", text: `💀 被 ${monster.name} 擊倒…下次再戰！` }]);
      await saveMonsterLog(profile.id, { monsterName: monster.name, monsterId: monster.id, result: "lose", rounds: round, mode }).catch(() => {});
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
          <button onClick={() => { loadHistory(); setPhase("history"); }}
            className="text-xs text-blue-600 font-bold">📊 戰績記錄</button>
        </div>
        <div className="rounded-2xl p-5 text-white" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="text-xs tracking-widest text-purple-200 font-black mb-1">⚔️ 打怪模式</div>
          <div className="text-2xl font-black mb-1">選擇你的對手</div>
          {archerStats && (
            <div className="flex gap-3 text-sm mt-2 flex-wrap">
              <span className="bg-white/15 px-2 py-0.5 rounded-full">❤️ HP {archerStats.hp}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">⚔️ ATK {archerStats.atk}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">🛡️ DEF {archerStats.def}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {MONSTERS.map(m => {
            const tier = TIER_LABEL[m.tier];
            return (
              <button key={m.id} onClick={() => { setMonster(m); setPhase("mode"); }}
                className="bg-white border border-gray-200 rounded-2xl p-4 text-left hover:border-purple-300 hover:bg-purple-50 transition-all active:scale-95">
                <div className="text-3xl mb-2">{m.icon}</div>
                <div className="font-black text-gray-800 text-sm">{m.name}</div>
                <div className="text-xs mt-1 font-bold" style={{ color: tier.color }}>【{tier.label}】</div>
                <div className="text-gray-400 text-xs mt-1 leading-tight">{m.desc}</div>
                <div className="flex gap-2 mt-2 text-xs text-gray-500">
                  <span>❤️{m.hp}</span><span>⚔️{m.atk}</span><span>🛡️{m.def}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === "mode") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => setPhase("select")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="text-gray-800 font-black text-xl text-center mb-2">選擇難度模式</div>
        <button onClick={() => { setMode("novice"); setPhase("prebattle"); }}
          className="rounded-2xl p-5 text-left border-2 border-green-200 bg-green-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🟢 新手模式</div>
          <div className="font-black text-gray-800 mb-1">固定10米，輕鬆上手</div>
          <div className="text-gray-500 text-sm">距離固定，無距離變化。適合初次挑戰。</div>
          <div className="text-green-600 text-xs font-bold mt-2">掉寶：紀念徽章 / 成就銀章 / 9折券</div>
        </button>
        <button onClick={() => { setMode("veteran"); setPhase("prebattle"); }}
          className="rounded-2xl p-5 text-left border-2 border-orange-200 bg-orange-50 active:scale-95 transition-transform">
          <div className="text-2xl mb-1">🟠 老手模式</div>
          <div className="font-black text-gray-800 mb-1">距離從15米開始，殭屍會靠近</div>
          <div className="text-gray-500 text-sm">被打中→距離縮短5米，命中頭部→距離延長5米。</div>
          <div className="text-orange-600 text-xs font-bold mt-2">掉寶更豐富，含5折券</div>
        </button>
      </div>
    );
  }

  if (phase === "prebattle") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => setPhase("mode")} className="text-gray-500 text-sm self-start">← 返回</button>
        <div className="rounded-2xl p-6 text-white text-center" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="text-6xl mb-3" style={{ animation:"mb-bounce 1s ease infinite" }}>{monster.icon}</div>
          <div className="text-2xl font-black mb-1">{monster.name}</div>
          <div className="text-purple-200 text-sm mb-4">{monster.desc}</div>
          <div className="flex justify-center gap-3 text-sm mb-4">
            {[["HP",monster.hp],["ATK",monster.atk],["DEF",monster.def]].map(([k,v])=>(
              <div key={k} className="bg-white/15 rounded-xl px-4 py-2">
                <div className="text-purple-200 text-xs">{k}</div>
                <div className="font-black text-xl">{v}</div>
              </div>
            ))}
          </div>
          {archerStats && (
            <div className="bg-white/10 rounded-xl p-3 mb-4">
              <div className="text-purple-200 text-xs mb-2">你的數值</div>
              <div className="flex justify-around text-sm">
                {[["HP",archerStats.hp],["ATK",archerStats.atk],["DEF",archerStats.def]].map(([k,v])=>(
                  <div key={k} className="text-center">
                    <div className="text-purple-200 text-xs">{k}</div>
                    <div className="font-black">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-purple-200 text-xs mb-4">
            {mode === "veteran" ? "⚔️ 老手模式　起始距離 15米" : "🟢 新手模式　固定 10米"}
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
    const maxHP = archerStats?.hp || 100;
    const archPct = Math.max(0, Math.round(archerHP / maxHP * 100));
    const monPct  = Math.max(0, Math.round(monsterHP / monster.hp * 100));
    const availParts = BODY_PARTS.filter(p => !p.locked || unlockedParts.has(p.locked));

    return (
      <div className="p-4 flex flex-col gap-3">
        <style>{BATTLE_CSS}</style>
        {/* HP 條 */}
        <div className="rounded-2xl p-4" style={{ background:"linear-gradient(135deg,#1e293b,#0e7490)" }}>
          <div className="flex justify-between text-white text-xs font-bold mb-2">
            <span>第 {round} 回合</span>
            {mode === "veteran" && <span>📍 {distance}米</span>}
            <span>{ARROWS_PER_ROUND}箭/回合</span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-xs text-cyan-200 mb-0.5">
              <span>{monster.icon} {monster.name}</span><span>{monsterHP}/{monster.hp}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width:`${monPct}%`, background: monPct>50?"#ef4444":monPct>25?"#f59e0b":"#dc2626" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-cyan-200 mb-0.5">
              <span>🏹 {profile?.nickname||profile?.name}{revived?" 💖":""}</span><span>{archerHP}/{maxHP}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width:`${archPct}%` }} />
            </div>
          </div>
        </div>

        {/* 本回合箭數 */}
        <div className="flex gap-2 justify-center">
          {Array.from({ length: ARROWS_PER_ROUND }).map((_,i) => (
            <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
              ${i < arrows.length ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>
              {i < arrows.length ? "🏹" : "○"}
            </div>
          ))}
        </div>

        {/* 隨機事件提示 */}
        {battlePhase === "event" && currentEvent && (
          <div className={`rounded-2xl p-4 text-center border-2 ${currentEvent.type === "buff" ? "bg-emerald-50 border-emerald-300" : currentEvent.type === "debuff" ? "bg-red-50 border-red-300" : "bg-blue-50 border-blue-300"}`}
            style={{ animation:"mb-pop .4s ease" }}>
            <div className="text-3xl mb-1">{currentEvent.icon}</div>
            <div className="font-black text-gray-800">{currentEvent.title}</div>
            <div className="text-gray-500 text-xs mt-1">{currentEvent.desc}</div>
          </div>
        )}

        {/* 反擊提示 */}
        {battlePhase === "counter" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center" style={{ animation:"mb-shake .4s ease" }}>
            <div className="text-3xl mb-1">{monster.icon}</div>
            <div className="text-red-700 font-black">{monster.name} 反擊中…</div>
            <div className="text-red-500 text-sm">受到 {counterDmg} 點傷害</div>
          </div>
        )}

        {/* 部位選擇 */}
        {battlePhase === "archer" && arrows.length < ARROWS_PER_ROUND && (
          <div className="bg-white rounded-2xl p-4">
            <div className="text-gray-700 text-sm font-black mb-3">第 {arrows.length+1} 箭 — 選擇瞄準部位</div>
            <div className="grid grid-cols-3 gap-2">
              {availParts.map(p => (
                <button key={p.id} onClick={() => shootPart(p)}
                  className="rounded-xl py-2 px-1 text-center border transition-all active:scale-95 hover:border-blue-400 hover:bg-blue-50"
                  style={{ borderColor: p.locked ? "#a78bfa" : "#e2e8f0" }}>
                  <div className="text-xl">{p.icon}</div>
                  <div className="text-xs font-bold text-gray-700">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.mult === 0 ? "脫靶" : `×${p.mult.toFixed(1)}`}</div>
                  {p.locked && <div className="text-xs text-purple-500 font-bold">已解鎖</div>}
                </button>
              ))}
            </div>
            {archerATKMod !== 0 && (
              <div className="mt-2 text-center text-xs font-bold text-emerald-600">
                ⚡ 本回合 ATK {archerATKMod > 0 ? "+" : ""}{archerATKMod}
              </div>
            )}
          </div>
        )}

        {/* 戰鬥日誌 */}
        <div className="bg-gray-900 rounded-2xl p-3 max-h-44 overflow-y-auto">
          {log.map((e,i) => (
            <div key={i} className={`text-xs py-0.5 ${
              e.type==="win"        ? "text-amber-400 font-black" :
              e.type==="lose"       ? "text-red-400 font-black" :
              e.type==="revive"     ? "text-pink-400 font-black" :
              e.type==="event_good" ? "text-emerald-300 font-bold" :
              e.type==="event_bad"  ? "text-red-300 font-bold" :
              e.type==="event"      ? "text-blue-300 font-bold" :
              e.type==="counter"    ? "text-orange-300" :
              e.type==="total"      ? "text-cyan-300 font-bold" :
              e.type==="loot"       ? "text-yellow-300 font-black" :
              e.type==="hit"        ? "text-emerald-300" :
              "text-gray-400"
            }`}>{e.text}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    );
  }

  // 開寶箱動畫
  if (phase === "loot") {
    return (
      <div className="p-4 flex flex-col gap-4 items-center">
        <style>{BATTLE_CSS}</style>
        <div className="text-center">
          <div className="text-amber-400 font-black text-lg mb-1">🏆 擊倒 {monster.name}！</div>
          <div className="text-gray-500 text-sm">{round} 回合完成</div>
        </div>
        {!lootRevealed ? (
          <button onClick={() => { setLootRevealed(true); sfxEpic(); }}
            className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
            style={{ animation:"mb-chest-bounce 1.5s ease infinite" }}>
            <div className="text-8xl">📦</div>
            <div className="text-amber-600 font-black text-lg">點擊開箱！</div>
            <div className="text-gray-400 text-xs">寶箱在等你…</div>
          </button>
        ) : (
          <div className="w-full flex flex-col items-center gap-4" style={{ animation:"mb-pop .5s cubic-bezier(.18,.89,.32,1.4)" }}>
            {/* 灑彩帶效果用 CSS */}
            <div className="text-8xl" style={{ filter:"drop-shadow(0 0 20px rgba(251,191,36,.8))", animation:"mb-bounce 1s ease infinite" }}>
              {loot.icon}
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xs font-bold tracking-widest mb-1">🎁 獲得掉落</div>
              <div className="font-black text-2xl text-gray-800 mb-1">{loot.name}</div>
              <div className="text-gray-500 text-sm">{loot.desc}</div>
            </div>
            <div className="flex gap-3 w-full mt-2">
              <button onClick={() => { setPhase("select"); }}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold">換對手</button>
              <button onClick={() => { setPhase("prebattle"); }}
                className="flex-1 py-3 rounded-xl font-black"
                style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
            </div>
          </div>
        )}
        {/* 戰鬥日誌（可收起）*/}
        <details className="w-full">
          <summary className="text-gray-400 text-xs cursor-pointer">▼ 查看戰鬥記錄</summary>
          <div className="bg-gray-900 rounded-xl p-3 mt-2 max-h-40 overflow-y-auto">
            {log.map((e,i) => <div key={i} className="text-xs text-gray-400 py-0.5">{e.text}</div>)}
          </div>
        </details>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <style>{BATTLE_CSS}</style>
        <div className="rounded-2xl p-6 text-white text-center"
          style={{ background:"linear-gradient(135deg,#7f1d1d,#4c1d95)" }}>
          <div className="text-5xl mb-3">💀</div>
          <div className="text-2xl font-black mb-1">敗北…</div>
          <div className="text-sm opacity-80 mb-4">被 {monster.name} 擊倒了</div>
          <div className="flex gap-2">
            <button onClick={() => setPhase("select")}
              className="flex-1 py-3 rounded-xl bg-white/20 text-white font-bold">換對手</button>
            <button onClick={() => setPhase("prebattle")}
              className="flex-1 py-3 rounded-xl font-black"
              style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
          </div>
        </div>
        <details className="w-full">
          <summary className="text-gray-400 text-xs cursor-pointer">▼ 查看戰鬥記錄</summary>
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
                        <div className="text-gray-400 text-xs">{h.mode === "veteran" ? "老手" : "新手"}模式　{h.rounds}回合</div>
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