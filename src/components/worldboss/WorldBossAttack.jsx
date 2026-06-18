// src/components/worldboss/WorldBossAttack.jsx — 世界大 Boss 戰鬥室
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import { attackWorldBoss, hireWorldBossBot } from "../../lib/worldBossDb";
import { addPracticeLog } from "../../lib/db";
import { calcArcherStats } from "../../lib/monsterData";
import { calcEquippedBonus } from "../../lib/monsterCards";
import { getParticipantBonus, simulateBotRound, drawRandomBot } from "../../lib/worldBossData";
import WorldBossSVG from "./WorldBossSVG";
import WorldBossBattleCard from "./WorldBossBattleCard";
import { sfxTap, sfxArrowHit, sfxCritBoom, sfxSoftFail, sfxCounter, sfxCounterCrit, sfxRoundEnd, sfxVictory, sfxSuccess, sfxCast, sfxPotionDrink, vibrate } from "../../lib/sound";

// ── 分數按鈕 ────────────────────────────────────────────────────
const SCORE_BTNS = ["X", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, "M"];
function scoreVal(s) { return s === "X" ? 10 : s === "M" ? 0 : Number(s); }
function scoreLabel(s) { return s === "X" ? "X" : s === "M" ? "M" : String(s); }
function scoreColor(s) {
  if (s === "X" || s === 10) return "#f59e0b";
  if (s === 9 || s === 8)    return "#ef4444";
  if (s === 7 || s === 6)    return "#3b82f6";
  if (s === "M")             return "#475569";
  return "#94a3b8";
}

// ── 計算傷害 ─────────────────────────────────────────────────
function calcArrowDmg(score, myATK, bossDef, participantBonus) {
  if (score === 0) return 0;
  const atkFinal = myATK * participantBonus;
  const base     = 5 + atkFinal * 0.6 + score * 1.5 - bossDef * 0.3;
  const mult     = 0.85 + Math.random() * 0.3;
  return Math.max(1, Math.round(base * mult));
}

function calcCounterDmg(bossAtk, myDEF) {
  const base = bossAtk * 0.4 - myDEF * 0.3;
  const mult = 0.8 + Math.random() * 0.4;
  return Math.max(5, Math.round(base * mult));
}

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
  { id: "none",   label: "不使用",    mult: 1.0, cost: 0,   color: "#475569" },
  { id: "small",  label: "小強心針",  mult: 1.2, cost: 50,  color: "#22c55e" },
  { id: "medium", label: "中強心針",  mult: 1.5, cost: 120, color: "#3b82f6" },
  { id: "large",  label: "大強心針",  mult: 2.0, cost: 250, color: "#f59e0b" },
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

function CatMsg({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position:"absolute", left:12, right:12, bottom:8, zIndex:20,
      background:"rgba(49,46,129,0.92)", border:"1px solid rgba(129,140,248,0.5)",
      borderRadius:14, padding:"5px 12px", fontSize:12, color:"#e0e7ff",
      textAlign:"center", boxShadow:"0 4px 16px rgba(0,0,0,0.6)",
    }}>
      {msg}
    </div>
  );
}

// ── 工具 ────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── 顏色池（隊員頭像）───────────────────────────────────────
const AVATAR_COLORS = ["#f59e0b","#ef4444","#3b82f6","#10b981","#8b5cf6","#ec4899","#f97316","#06b6d4"];
const ARCHER_STYLES = ["baobao","daming","diandian","gege","haji","meimei","niuniu","xiaoan","youyou"];

// ── 主元件 ──────────────────────────────────────────────────
const TOTAL_ROUNDS = 5;
const ARROWS_PER   = 6;

export default function WorldBossAttack({ event, onBack, guestOverride, onComplete }) {
  const { profile } = useAuth();
  const { saveBond } = useCatCompanion();
  const todayStr = new Date().toISOString().slice(0, 10);

  const _base   = calcArcherStats({ member: profile, certification: null, certRecords: [], dexStats: null });
  const _equip  = calcEquippedBonus([]);
  const baseATK = (_base.atk || 0) + (_equip.atk || 0);
  const baseDEF = (_base.def || 0) + (_equip.def || 0);
  const baseHP  = (_base.hp  || 0) + (_equip.hp  || 0);

  const participantBonus = getParticipantBonus(event.totalParticipants || 0).atkMult;
  const boss             = event.bossData || {};

  // ── 狀態 ───────────────────────────────────────────────────
  const [showFullLog, setShowFullLog] = useState(true);

  // 隨機從參戰勇者中取最多 8 位同伴（僅顯示，不影響戰鬥邏輯）
  const [companions] = useState(() => {
    const _selfId = guestOverride?.id || profile?.id;
    const parts = Object.entries(event.participants || {})
      .filter(([id]) => id !== _selfId)
      .map(([id, p]) => {
        const atk = p.atk || 10;
        return { id, name: p.name || "射手", atk, def: Math.round(atk * 0.4), hp: atk * 4 };
      });
    for (let i = parts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [parts[i], parts[j]] = [parts[j], parts[i]];
    }
    return parts.slice(0, 8);
  });

  const [phase,    setPhase]    = useState("prep");
  // subPhase: shooting | processing | roundResult | bossAttack | done
  const [subPhase, setSubPhase] = useState("shooting");
  const [processingIdx, setProcessingIdx] = useState(-1);

  const [potion,   setPotion]   = useState(() =>
    guestOverride ? (sessionStorage.getItem("guest_wb_potion") || "none") : "none"
  );
  const [bots,     setBots]     = useState([]);
  const [hiring,   setHiring]   = useState(false);
  const [coins,    setCoins]    = useState(() =>
    guestOverride
      ? parseInt(sessionStorage.getItem("guest_coins") || "500", 10)
      : (profile?.coins || 0)
  );

  const [roundIdx,     setRoundIdx]     = useState(0);
  const [arrows,       setArrows]       = useState([]);
  const [allRounds,    setAllRounds]    = useState([]);
  const [roundSummary, setRoundSummary] = useState(null);

  const [myHP,       setMyHP]       = useState(baseHP);
  const [bossHP,     setBossHP]     = useState(event.bossCurrentHP);

  // boss 反擊
  const [counterDmg,    setCounterDmg]    = useState(0);
  const [bossAttackIcon, setBossAttackIcon] = useState("⚡");
  const [bossAttackText, setBossAttackText] = useState("");

  const [dmgLog,    setDmgLog]    = useState([]);
  const [catMsg,    setCatMsg]    = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]    = useState(null);
  const [showCard,   setShowCard]  = useState(false);
  const [animBossHit,   setAnimBossHit]   = useState(false);
  const [animCrit,      setAnimCrit]      = useState(false);
  const [animMonsterHit, setAnimMonsterHit] = useState(false);
  const [animBossCharge, setAnimBossCharge] = useState(false);
  const [animPlayerHit,  setAnimPlayerHit]  = useState(false);
  const [archerShoot,    setArcherShoot]    = useState(false);
  const [floatDmg,         setFloatDmg]         = useState(null); // { dmg, isCrit, isMiss }
  const [companionShootIdx, setCompanionShootIdx] = useState(-1);
  const [showExitConfirm,   setShowExitConfirm]   = useState(false);
  const processingRef = useRef(false);
  const timerRef      = useRef([]);

  const myId   = guestOverride?.id   || profile?.id;
  const myName = guestOverride?.name || profile?.nickname || profile?.name || "射手";
  const weapon = profile?.bowType || "複合弓";
  const isGuest = !!guestOverride;
  const potionDef  = POTIONS.find(p => p.id === potion);
  const potionMult = potionDef?.mult || 1;

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
    setTimeout(() => setFloatDmg(null), 1300);
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
      sessionStorage.setItem("guest_coins", String(newC));
      setCoins(newC);
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
  function handleScore(s) {
    if (arrows.length >= ARROWS_PER || subPhase !== "shooting") return;
    sfxTap(); vibrate(10);
    setArrows(prev => [...prev, { label: scoreLabel(s), score: scoreVal(s) }]);
  }

  // ── 回合結算流程（逐箭計算）──────────────────────────────
  async function finishRound(fullArrows) {
    setSubPhase("processing");
    setDmgLog([]);

    let totalDmg = 0;
    let crits = 0;

    // 取出其他隊員列表（所有曾參戰者，不限今日）
    const teammates = Object.values(event.participants || {})
      .filter(p => p.name !== myName);
    const supportChance = Math.min(0.3 + teammates.length * 0.12, 0.85);

    // 一箭一箭順序計算，600ms 間隔
    for (let i = 0; i < fullArrows.length; i++) {
      setProcessingIdx(i);
      const a   = fullArrows[i];
      const dmg = Math.round(calcArrowDmg(a.score, baseATK, boss.def, participantBonus) * potionMult);
      const isCrit = a.score >= 10;
      if (isCrit) crits++;
      totalDmg += dmg;

      if (a.score === 0) { sfxSoftFail(); flashBossHit(false, 0, true); }
      else if (isCrit) { sfxCritBoom(); flashBossHit(true, dmg, false); vibrate(30); }
      else { sfxArrowHit(); flashBossHit(false, dmg, false); vibrate(10); }

      setDmgLog(prev => [...prev,
        isCrit      ? `💥 ${a.label} 暴擊！ -${dmg}`
        : a.score===0 ? `💨 M 飛矢落空`
                      : `🏹 ${a.label}環 -${dmg}`
      ]);
      setBossHP(h => Math.max(0, h - dmg));

      // 貓咪助攻（25%）
      if (profile?.equippedCat && Math.random() < 0.25) {
        const name = profile.equippedCat.name || "貓咪";
        const msgs = [`🐱 ${name} 撲了過去！暴擊加成 ×1.2 ⚡`, `🐱 ${name} 舔了你的傷口，回復 HP 💚`,
                      `🐱 ${name} 偷藏了一枚金幣 💰`, `🐱 ${name} 嚇到 Boss！防禦暫時下降 🐾`];
        setCatMsg(msgs[Math.floor(Math.random() * msgs.length)]);
      }

      // 隊友助攻（隊員越多、觸發率越高）
      if (teammates.length > 0 && Math.random() < supportChance) {
        await delay(300);
        const tm    = teammates[Math.floor(Math.random() * teammates.length)];
        const tmATK = tm.atk || Math.round(baseATK * 0.8);
        const sdmg  = Math.max(1, Math.round(calcArrowDmg(
          6 + Math.floor(Math.random() * 4), tmATK * 0.7, boss.def, participantBonus
        )));
        totalDmg += sdmg;
        const tmMsg = SUPPORT_MSGS[Math.floor(Math.random() * SUPPORT_MSGS.length)](tm.name, sdmg);
        setDmgLog(prev => [...prev, tmMsg]);
        setBossHP(h => Math.max(0, h - sdmg));
        // 找到對應同伴並播放攻擊動畫
        const cIdx = companions.findIndex(c => c.name === tm.name);
        if (cIdx >= 0) {
          setCompanionShootIdx(cIdx);
          setTimeout(() => setCompanionShootIdx(-1), 500);
        }
      }

      await delay(600);
    }

    setProcessingIdx(-1);

    const roundData  = { arrows: fullArrows, dmg: totalDmg, crits };
    const nextRounds = [...allRounds, roundData];
    setAllRounds(nextRounds);
    setRoundSummary(roundData);
    sfxRoundEnd();
    setSubPhase("roundResult");
    setAnimBossCharge(true);

    addTimer(() => {
      setAnimBossCharge(false);
      const cdmg   = calcCounterDmg(boss.atk || 100, baseDEF);
      const isLast = nextRounds.length === TOTAL_ROUNDS;
      const pool   = isLast ? BOSS_FINAL_TAUNTS : BOSS_TAUNTS;
      const [icon, text] = pool[Math.floor(Math.random() * pool.length)];

      setCounterDmg(cdmg);
      setBossAttackIcon(icon);
      setBossAttackText(text);
      setMyHP(h => Math.max(0, h - cdmg));
      if (isLast) { sfxCounterCrit(); vibrate(50); } else { sfxCounter(); vibrate(20); }
      setSubPhase("bossAttack");
      setAnimPlayerHit(true);
      setTimeout(() => setAnimPlayerHit(false), 650);

      addTimer(() => {
        if (!isLast) {
          setArrows([]);
          setRoundIdx(r => r + 1);
          setDmgLog([]);
          setSubPhase("shooting");
        } else {
          setSubPhase("done");
          submitAttack(nextRounds);
        }
      }, 2000);
    }, 2200);
  }

  // ── 送出攻擊 ─────────────────────────────────────────────
  async function submitAttack(rounds) {
    if (processingRef.current) return;
    processingRef.current = true;
    setSubmitting(true);
    setPhase("result");

    const res = await attackWorldBoss({
      eventId:       event.id,
      memberId:      myId,
      memberName:    myName,
      weapon,
      roundResults:  rounds,
      isGuest,
      potionDmgMult: 1,
      bots,
      memberAtk:     baseATK,
    });

    setResult(res);
    setSubmitting(false);
    processingRef.current = false;
    if (res.ok) {
      if (res.defeated) sfxVictory(); else sfxSuccess();
      saveBond("worldboss");
      if (myId && rounds.length > 0) {
        const practiceRounds = rounds.map(r => r.arrows);
        addPracticeLog(myId, {
          date: todayStr, source: "worldboss",
          bossName: event.bossData?.name || "世界王",
          result: res.defeated ? "win" : "lose",
          rounds: practiceRounds,
          total: practiceRounds.flat().reduce((s, v) => s + v, 0),
        }, myId).catch(() => {});
      }
      onComplete?.(res);
    }
  }

  // ════════════════════════════════════════════════════════════
  // ── 畫面：準備 ───────────────────────────────────────────
  if (phase === "prep") {
    const potionCost = potionDef?.cost || 0;
    const canAfford  = coins >= potionCost;

    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white relative">
        <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
          <button onClick={onBack} className="text-slate-400 text-sm font-bold">← 返回</button>
          <span className="font-black text-lg flex-1">⚔️ 出戰準備</span>
          <span className="text-xs text-amber-300 font-mono">💰 {coins}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5 pt-4">
          {/* Boss 預覽 */}
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
            <WorldBossSVG bossKey={event.bossKey} currentHP={event.bossCurrentHP} maxHP={event.bossMaxHP} size={72}/>
            <div className="flex-1 min-w-0">
              <div className="font-black text-base" style={{ color: boss.accent }}>{boss.name}</div>
              <div className="text-xs text-slate-400 mb-2">「{boss.title}」</div>
              <MiniHP current={event.bossCurrentHP} max={event.bossMaxHP}/>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                {event.bossCurrentHP?.toLocaleString()} / {event.bossMaxHP?.toLocaleString()} HP
              </div>
            </div>
          </div>

          {/* 戰鬥說明 */}
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl px-4 py-3 text-xs text-rose-300 space-y-1 leading-relaxed">
            <div className="font-black text-rose-200 mb-1">⚔️ 戰鬥流程</div>
            <div>1. 每回合射 6 箭對 Boss 造成傷害</div>
            <div>2. 每回合結束後 Boss 會進行反擊</div>
            <div>3. 共 5 大回合，最終回合 Boss 全力攻擊</div>
          </div>

          {/* 我的屬性 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold mb-3">你的屬性</div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {[["HP", baseHP, "#22c55e"], ["ATK", baseATK, "#f87171"], ["DEF", baseDEF, "#60a5fa"]].map(([k, v, c]) => (
                <div key={k}>
                  <div className="text-slate-500 text-xs mb-0.5">{k}</div>
                  <div className="font-black" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-center text-xs text-amber-300">
              ⚡ 參戰加成 ×{participantBonus.toFixed(2)} ATK（{event.totalParticipants || 0} 人參戰）
            </div>
          </div>

          {/* 藥水 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold mb-3">💊 攻擊增幅藥水</div>
            <div className="grid grid-cols-2 gap-2">
              {POTIONS.map(p => (
                <button key={p.id} onClick={() => { setPotion(p.id); if (p.id !== "none") sfxPotionDrink(); }}
                  disabled={p.cost > 0 && coins < p.cost}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-30 ${potion === p.id ? "border-amber-400 bg-amber-400/20" : "border-white/10 bg-white/5 text-slate-300"}`}
                  style={{ color: potion === p.id ? p.color : undefined }}>
                  <div>{p.label}</div>
                  <div className="opacity-70">{p.mult > 1 ? `傷害 ×${p.mult}` : "一般傷害"}</div>
                  {p.cost > 0 && <div className="text-amber-300">💰 {p.cost}</div>}
                </button>
              ))}
            </div>
          </div>

          {/* AI 機器人 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold mb-1">🤖 雇用 AI 機器人</div>
            <div className="text-xs text-slate-500 mb-3">每隻 100 金幣，同場一起對 Boss 造成傷害</div>
            {bots.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {bots.map((b, i) => (
                  <span key={i} className="text-xs bg-white/10 rounded-full px-2 py-0.5 text-slate-300">
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            )}
            <button onClick={handleHireBot}
              disabled={coins < 100 || hiring || bots.length >= 5}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-indigo-600/50 border border-indigo-400/40 text-indigo-200 disabled:opacity-30 active:scale-95 transition-all">
              {hiring ? "雇用中…" : bots.length >= 5 ? "已達上限（5隻）" : `🤖 雇用機器人 💰100`}
            </button>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-3"
          style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))", background: "linear-gradient(0deg, #0f172a 80%, transparent)" }}>
          {potionCost > 0 && !canAfford && (
            <div className="text-center text-xs text-rose-400 mb-2">金幣不足，請選擇其他藥水</div>
          )}
          <button
            onClick={async () => {
              sfxCast();
              if (potionDef?.cost > 0) {
                if (isGuest) {
                  const newC = Math.max(0, coins - potionDef.cost);
                  sessionStorage.setItem("guest_coins", String(newC));
                  setCoins(newC);
                } else {
                  const { addCoins } = await import("../../lib/db");
                  await addCoins(myId, -potionDef.cost).catch(() => {});
                  setCoins(c => c - potionDef.cost);
                }
              }
              sessionStorage.removeItem("guest_wb_potion");
              setPhase("battle");
            }}
            disabled={potionCost > 0 && !canAfford}
            className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-xl transition-all active:scale-95 disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${boss.accent || "#f59e0b"}, #ef4444)` }}>
            ⚔️ 開始挑戰（{TOTAL_ROUNDS} 回合 × {ARROWS_PER} 箭）
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ── 畫面：戰鬥中（MonsterBattle 風格）────────────────────
  if (phase === "battle") {
    const totalArchers = companions.length + 1;
    const archerW = Math.min(72, Math.floor((528 - (totalArchers - 1) * 3) / totalArchers));
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
          </div>
        )}

        {/* Boss 反擊 overlay */}
        {subPhase === "bossAttack" && (
          <div style={{ position:"absolute", inset:0, zIndex:40, background:"rgba(0,0,0,0.9)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
            <div style={{ animation:"wbShake 0.5s ease" }}>
              <WorldBossSVG bossKey={event.bossKey} currentHP={bossHP} maxHP={event.bossMaxHP} size={160}/>
            </div>
            <div style={{ fontSize:44 }}>{bossAttackIcon}</div>
            <div style={{ fontSize:18, fontWeight:900, color:"#fca5a5" }}>{bossAttackText}</div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>你受到傷害</div>
              <div style={{ fontSize:52, fontWeight:900, color:"#f87171", textShadow:"0 0 30px #ef4444" }}>-{counterDmg}</div>
            </div>
            <div style={{ width:"66%" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:4 }}>你的 HP</div>
              <div style={{ height:8, background:"rgba(255,255,255,0.1)", borderRadius:4, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.max(0,myHP/baseHP)*100}%`, background: myHP/baseHP > 0.3 ? "#22c55e" : "#ef4444", transition:"width 0.5s" }}/>
              </div>
            </div>
            {allRounds.length < TOTAL_ROUNDS
              ? <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>準備第 {allRounds.length + 1} 回合…</div>
              : <div style={{ fontSize:12, color:"#fbbf24", fontWeight:700 }}>戰鬥結束，結算中…</div>
            }
          </div>
        )}

        {/* ── 頂部資訊列（HP 條 + 名字 + 統計 + 日誌視窗） ── */}
        <div style={{ flexShrink:0, background:"rgba(0,0,0,0.75)", zIndex:2, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          {/* HP 條（最頂部，全寬） */}
          <div style={{ background:"#1e293b", height:22, border:"none", overflow:"hidden", position:"relative", borderBottom:"1.5px solid #7f1d1d" }}>
            <div style={{ width:`${Math.max(0,bossHP/event.bossMaxHP)*100}%`, height:"100%", transition:"width .7s ease",
              background: bossHP/event.bossMaxHP>0.5?"#dc2626":bossHP/event.bossMaxHP>0.25?"#f59e0b":"#7f1d1d" }}/>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:10, fontWeight:900 }}>
              {bossHP.toLocaleString()} / {event.bossMaxHP.toLocaleString()}
            </div>
          </div>

          <div style={{ padding:"3px 10px 4px" }}>
            {/* Boss 名字（血條下方）+ 回合點 + 離開按鈕 */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:13, fontWeight:900, color:boss.accent||"#f59e0b", textShadow:"0 2px 8px #000" }}>{boss.name}</span>
                <div style={{ display:"flex", gap:2 }}>
                  {Array.from({ length: TOTAL_ROUNDS }).map((_,i) => (
                    <div key={i} style={{ width:12, height:3, borderRadius:2, background: i < roundIdx ? "#f59e0b" : i === roundIdx ? "#f87171" : "rgba(255,255,255,0.15)" }}/>
                  ))}
                  {isLastRound && <span style={{ fontSize:9, color:"#fca5a5", marginLeft:2 }}>⚠️</span>}
                </div>
              </div>
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

            {/* 戰鬥日誌小視窗（預設開啟，可收合） */}
            <div style={{ background:"rgba(0,0,0,0.45)", borderRadius:6, border:"1px solid rgba(255,255,255,0.07)", overflow:"hidden" }}>
              <button onClick={() => setShowFullLog(v => !v)}
                style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"2px 8px", background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.4)", fontSize:9 }}>
                <span>📜 戰鬥記錄</span>
                <span>{showFullLog ? "▲" : "▼"}</span>
              </button>
              {showFullLog && (
                <div style={{ maxHeight:52, overflowY:"auto", padding:"0 8px 4px" }}>
                  {dmgLog.length === 0
                    ? <div style={{ fontSize:9, color:"rgba(255,255,255,0.2)", textAlign:"center", paddingBottom:4 }}>戰鬥開始…</div>
                    : [...dmgLog].reverse().slice(0,5).map((l, i) => (
                        <div key={i} style={{ fontSize:9, color: i===0 ? "white" : "rgba(255,255,255,0.4)", marginBottom:2, lineHeight:1.3 }}>{l}</div>
                      ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Boss 圖區（填滿剩餘空間） ── */}
        <div style={{ flex:"1 1 0", position:"relative", minHeight:0, overflow:"hidden", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:6 }}>
          {/* CatMsg 放在 Boss 圖區內，不蓋住底部控制列 */}
          {catMsg && <CatMsg msg={catMsg} onDone={() => setCatMsg(null)}/>}

          <div style={{ animation: animBossCharge ? "mb-charge 0.7s ease infinite" : animMonsterHit ? "mb-monster-hit 0.5s ease" : undefined }}>
            <WorldBossSVG bossKey={event.bossKey} currentHP={bossHP} maxHP={event.bossMaxHP} size={280}/>
          </div>
          {/* 浮動傷害 / MISS */}
          {floatDmg && (
            floatDmg.isMiss
              ? <span style={{ position:"absolute", top:"25%", left:"50%", transform:"translateX(-50%)", fontSize:"1.3rem", fontWeight:900, color:"#94a3b8", textShadow:"0 2px 8px rgba(0,0,0,0.9)", animation:"mb-miss 1.0s ease-out forwards", pointerEvents:"none", whiteSpace:"nowrap" }}>MISS</span>
              : <span style={{ position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)", fontSize: floatDmg.isCrit?"2rem":"1.6rem", fontWeight:900, color: floatDmg.isCrit?"#fbbf24":"#f87171", textShadow:"0 2px 10px rgba(0,0,0,0.9)", animation:"mb-float 1.3s ease-out forwards", pointerEvents:"none", whiteSpace:"nowrap" }}>
                  -{floatDmg.dmg}{floatDmg.isCrit?"💥":""}
                </span>
          )}
        </div>

        {/* ── 弓箭手 + 資訊同框列（深色底板） ── */}
        <div style={{ flexShrink:0, background:"rgba(0,0,0,0.88)", borderTop:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display:"flex", gap:3, padding:"0 6px 6px", justifyContent:"center",
            animation: animPlayerHit ? "mb-screen-shake 0.55s ease" : undefined }}>
            {companions.map((c, idx) => {
              const cStyle = ARCHER_STYLES[idx % ARCHER_STYLES.length];
              return (
                <div key={c.id} style={{ flexShrink:0, width:archerW, display:"flex", flexDirection:"column",
                  border:"1px solid rgba(255,255,255,0.09)", borderRadius:8, overflow:"hidden",
                  background:"rgba(255,255,255,0.04)" }}>
                  {/* 弓箭手圖 */}
                  <div style={{ height:80, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                    <img src={`/cats/archers/${cStyle}.webp`} alt={c.name}
                      style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom",
                        animation: companionShootIdx === idx ? "mb-archer-attack 0.4s ease" : undefined,
                        filter: companionShootIdx === idx ? "drop-shadow(0 0 8px rgba(255,255,255,0.7))" : undefined }}
                      onError={e => { e.target.style.display="none"; }}/>
                  </div>
                  <div style={{ height:1, background:"rgba(255,255,255,0.07)" }}/>
                  {/* 資訊卡（含 HP 條 + ATK + DEF + HP） */}
                  <div style={{ padding:"2px 2px 3px", textAlign:"center" }}>
                    <div style={{ height:4, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:2 }}>
                      <div style={{ height:"100%", borderRadius:3, width:"100%", background:"linear-gradient(90deg,#16a34a,#4ade80)" }}/>
                    </div>
                    <div style={{ fontSize:8, color:"rgba(255,255,255,0.55)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:1 }}>{c.name?.slice(0,5)}</div>
                    <div style={{ fontSize:8, color:"#f87171", marginBottom:1 }}>⚔️ {c.atk}</div>
                    <div style={{ fontSize:8, color:"#60a5fa", marginBottom:1 }}>🛡 {c.def}</div>
                    <div style={{ fontSize:8, color:"#4ade80", fontWeight:700 }}>HP {c.hp}</div>
                  </div>
                </div>
              );
            })}

            {/* 玩家（金框高亮） */}
            <div style={{ flexShrink:0, width:archerW, display:"flex", flexDirection:"column",
              border:"1px solid rgba(251,191,36,0.5)", borderRadius:8, overflow:"hidden",
              background:"rgba(251,191,36,0.06)" }}>
              {/* 弓箭手圖（帶攻擊動畫） */}
              <div style={{ height:80, position:"relative", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                {/* Boss 攻擊時玩家頭上浮出傷害 */}
                {animPlayerHit && (
                  <span style={{ position:"absolute", top:"0%", left:"50%", transform:"translateX(-50%)", zIndex:10, animation:"mb-float 1.0s ease-out forwards", fontWeight:900, fontSize:"0.85rem", color:"#f43f5e", textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap", pointerEvents:"none" }}>
                    💢
                  </span>
                )}
                <img src={`/cats/archers/${(profile || guestOverride)?.archerStyle || "baobao"}.webp`} alt={myName}
                  style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom",
                    filter: archerShoot ? "drop-shadow(0 0 8px rgba(251,191,36,0.8))" : "drop-shadow(0 0 4px rgba(251,191,36,0.35))",
                    animation: archerShoot ? "mb-archer-attack 0.4s ease" : undefined,
                    outline:"2px solid rgba(251,191,36,0.6)", outlineOffset:2, borderRadius:2 }}
                  onError={e => { e.target.style.display="none"; }}/>
              </div>
              <div style={{ height:1, background:"rgba(251,191,36,0.25)" }}/>
              {/* 玩家資訊卡 */}
              <div style={{ padding:"3px 2px 4px", textAlign:"center" }}>
                {/* HP 條 */}
                <div style={{ height:4, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:2 }}>
                  <div style={{ height:"100%", borderRadius:3, transition:"width 0.5s",
                    width:`${Math.max(0,myHP/baseHP)*100}%`,
                    background: myHP/baseHP>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":myHP/baseHP>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)" }}/>
                </div>
                <div style={{ fontSize:9, fontWeight:700, color:"#fbbf24", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{myName?.slice(0,6)}</div>
                <div style={{ fontSize:8, color:"#f87171" }}>⚔{baseATK}</div>
                <div style={{ fontSize:8, color:"#60a5fa" }}>🛡{baseDEF}</div>
                <div style={{ fontSize:8, fontWeight:700, color: myHP/baseHP>0.5?"#4ade80":myHP/baseHP>0.25?"#fbbf24":"#f87171", marginTop:1 }}>HP {myHP}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 輸入區（深色底板，仿 PartyBattleRoom） ── */}
        <div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.82)", padding:"4px 6px", paddingBottom:"max(10px, env(safe-area-inset-bottom))" }}>
          {/* 箭矢格 */}
          <div style={{ display:"flex", gap:3, marginBottom:4, justifyContent:"center", alignItems:"center" }}>
            {Array.from({ length: ARROWS_PER }).map((_, i) => {
              const a = arrows[i];
              const isActive = subPhase === "processing" && i === processingIdx;
              return (
                <div key={i} style={{
                  width:36, height:36, borderRadius:6, flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:900,
                  background: a ? (isActive ? "#1e3a8a" : "#2563eb") : "rgba(255,255,255,0.05)",
                  border:`2px solid ${a ? (isActive ? "#fbbf24" : "#60a5fa") : "rgba(255,255,255,0.1)"}`,
                  color: a ? (isActive ? "#fbbf24" : "white") : "#475569",
                  transform: isActive ? "scale(1.15)" : "scale(1)",
                  boxShadow: isActive ? "0 0 12px #fbbf24aa" : undefined,
                  transition:"transform 0.15s",
                }}>
                  {a ? a.label : ""}
                </div>
              );
            })}
            {arrows.length > 0 && subPhase === "shooting" && (
              <button onClick={() => setArrows(prev => prev.slice(0,-1))} style={{ background:"none", border:"none", color:"#64748b", fontSize:18, cursor:"pointer", paddingLeft:4 }}>↩</button>
            )}
            <span style={{ color:"#f1f5f9", fontWeight:900, fontSize:12, marginLeft:4 }}>
              {subPhase !== "shooting" ? "計算中…" : `${arrows.length}/${ARROWS_PER} 箭`}
            </span>
          </div>

          {/* 分數按鈕（使用 score-btn.webp） */}
          {subPhase === "shooting" && arrows.length < ARROWS_PER && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:4, background:"rgb(20,12,5)", borderRadius:8, padding:"5px", marginBottom:4 }}>
              {SCORE_BTNS.map(s => (
                <button key={s} onClick={() => handleScore(s)}
                  style={{
                    backgroundImage:"url(/ui/score-btn.webp)", backgroundSize:"cover", backgroundPosition:"center",
                    backgroundColor:"rgb(30,16,6)",
                    WebkitAppearance:"none", appearance:"none",
                    border:"none", borderRadius:6, height:44, width:"100%",
                    color: s==="X"?"#fbbf24":s==="M"?"#94a3b8":Number(s)>=9?"#fef3c7":Number(s)>=7?"#bfdbfe":Number(s)>=5?"#d1d5db":"#9ca3af",
                    fontWeight:900, fontSize:15, cursor:"pointer",
                    textShadow:"0 1px 6px #000", padding:"4px 0", lineHeight:1,
                  }}
                  onTouchStart={e => e.currentTarget.style.transform="scale(0.88)"}
                  onTouchEnd={e => e.currentTarget.style.transform="scale(1)"}>
                  {scoreLabel(s)}
                </button>
              ))}
            </div>
          )}

          {/* 送出按鈕 */}
          {subPhase === "shooting" && arrows.length >= ARROWS_PER && (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <button onClick={() => { sfxCast(); finishRound(arrows); }}
                style={{ width:"100%", padding:"12px", background:`linear-gradient(135deg, ${boss.accent||"#f59e0b"}, #ef4444)`, border:"none", borderRadius:12, color:"white", fontSize:16, fontWeight:900, cursor:"pointer", boxShadow:`0 4px 20px ${boss.accent||"#f59e0b"}44` }}>
                ⚔️ 送出 {ARROWS_PER} 箭！
              </button>
              <button onClick={() => setArrows(prev => prev.slice(0,-1))}
                style={{ width:"100%", padding:"5px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"rgba(255,255,255,0.35)", fontSize:11, cursor:"pointer" }}>
                ← 取消上一箭
              </button>
            </div>
          )}

          {subPhase === "processing" && (
            <div style={{ minHeight:44, display:"flex", flexDirection:"column", justifyContent:"center" }}>
              {dmgLog.slice(-3).map((l, i, arr) => (
                <div key={i} style={{ fontSize:11, textAlign:"center", fontWeight:700, color: i===arr.length-1 ? "white" : "rgba(255,255,255,0.4)", marginBottom:2 }}>{l}</div>
              ))}
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

    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
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
              {result.defeated ? (
                <div className="text-center space-y-2">
                  <div className="text-6xl animate-bounce">💥</div>
                  <div className="text-2xl font-black text-amber-300">BOSS 擊殺！</div>
                  <div className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    {event.announcement || "全域廣播：FIRST KILL！"}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="text-5xl">⚔️</div>
                  <div className="text-xl font-black text-white">出戰完成！</div>
                  <div className="text-xs text-slate-400">Boss 剩餘 {result.newHP?.toLocaleString()} HP</div>
                </div>
              )}

              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="text-xs text-slate-400 font-bold mb-2">戰鬥報告</div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">你的總傷害</span>
                  <span className="font-black text-rose-400">{totalPlayerDmg.toLocaleString()}</span>
                </div>
                {bots.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">機器人傷害</span>
                    <span className="font-black text-indigo-400">
                      {(result.dmg - totalPlayerDmg).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                  <span className="text-slate-300">總傷害</span>
                  <span className="font-black text-amber-300">{result.dmg?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">暴擊次數</span>
                  <span className="font-black text-yellow-400">{totalCrits} 次</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Boss 剩餘 HP</span>
                  <span className="font-mono text-slate-300">{result.newHP?.toLocaleString()}</span>
                </div>
              </div>

              <div className="w-full space-y-2">
                {allRounds.map((r, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-12">第{i+1}回合</span>
                    <div className="flex gap-1 flex-1 flex-wrap">
                      {r.arrows.map((a, j) => (
                        <span key={j} className="text-xs font-bold" style={{ color: scoreColor(a.label) }}>{a.label}</span>
                      ))}
                    </div>
                    <span className="text-xs font-black text-rose-400">-{r.dmg.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {result.defeated && (
                <div className="w-full bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4 text-xs text-amber-200 leading-relaxed">
                  🎁 擊殺獎勵已自動發放給所有參戰者！
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
