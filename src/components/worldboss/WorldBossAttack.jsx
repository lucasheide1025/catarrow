// src/components/worldboss/WorldBossAttack.jsx — 世界大 Boss 戰鬥室
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { attackWorldBoss, hireWorldBossBot } from "../../lib/worldBossDb";
import { calcArcherStats } from "../../lib/monsterData";
import { calcEquippedBonus } from "../../lib/monsterCards";
import { getParticipantBonus, simulateBotRound } from "../../lib/worldBossData";
import WorldBossSVG from "./WorldBossSVG";

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
    <div className="absolute left-4 right-4 bg-indigo-900/90 border border-indigo-400/50 rounded-2xl px-4 py-2 text-sm text-indigo-100 text-center shadow-xl z-20"
      style={{ bottom: 80 }}>
      {msg}
    </div>
  );
}

// ── 主元件 ──────────────────────────────────────────────────
const TOTAL_ROUNDS = 5;
const ARROWS_PER   = 6;

export default function WorldBossAttack({ event, onBack }) {
  const { profile } = useAuth();

  const _base   = calcArcherStats({ member: profile, certification: null, certRecords: [], dexStats: null });
  const _equip  = calcEquippedBonus([]);
  const baseATK = (_base.atk || 0) + (_equip.atk || 0);
  const baseDEF = (_base.def || 0) + (_equip.def || 0);
  const baseHP  = (_base.hp  || 0) + (_equip.hp  || 0);

  const participantBonus = getParticipantBonus(event.totalParticipants || 0).atkMult;
  const boss             = event.bossData || {};

  // ── 狀態 ───────────────────────────────────────────────────
  const [phase,    setPhase]    = useState("prep");
  // subPhase: shooting | processing | roundResult | bossAttack | done
  const [subPhase, setSubPhase] = useState("shooting");
  const [processingIdx, setProcessingIdx] = useState(-1);

  const [potion,   setPotion]   = useState("none");
  const [bots,     setBots]     = useState([]);
  const [hiring,   setHiring]   = useState(false);
  const [coins,    setCoins]    = useState(profile?.coins || 0);

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
  const processingRef = useRef(false);
  const timerRef      = useRef([]);

  const myId   = profile?.id;
  const myName = profile?.nickname || profile?.name || "射手";
  const weapon = profile?.bowType || "複合弓";
  const potionDef  = POTIONS.find(p => p.id === potion);
  const potionMult = potionDef?.mult || 1;

  // 清理所有 timer（離開時避免洩漏）
  useEffect(() => () => timerRef.current.forEach(clearTimeout), []);

  function addTimer(fn, ms) {
    const t = setTimeout(fn, ms);
    timerRef.current.push(t);
    return t;
  }

  // ── 雇用機器人 ───────────────────────────────────────────
  async function handleHireBot() {
    if (coins < 100 || hiring) return;
    setHiring(true);
    const res = await hireWorldBossBot(event.id, myId);
    if (res.ok) {
      setBots(prev => [...prev, res.bot]);
      setCoins(c => c - 100);
    }
    setHiring(false);
  }

  // ── 輸入分數（只記錄，不計算傷害）──────────────────────
  function handleScore(s) {
    if (arrows.length >= ARROWS_PER || subPhase !== "shooting") return;
    setArrows(prev => [...prev, { label: scoreLabel(s), score: scoreVal(s) }]);
  }

  // ── 回合結算流程（逐箭計算）──────────────────────────────
  async function finishRound(fullArrows) {
    setSubPhase("processing");
    setDmgLog([]);

    let totalDmg = 0;
    let crits = 0;

    // 一箭一箭順序計算，600ms 間隔
    for (let i = 0; i < fullArrows.length; i++) {
      setProcessingIdx(i);
      const a   = fullArrows[i];
      const dmg = Math.round(calcArrowDmg(a.score, baseATK, boss.def, participantBonus) * potionMult);
      const isCrit = a.score >= 10;
      if (isCrit) crits++;
      totalDmg += dmg;

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

      await delay(600);
    }

    setProcessingIdx(-1);

    const roundData  = { arrows: fullArrows, dmg: totalDmg, crits };
    const nextRounds = [...allRounds, roundData];
    setAllRounds(nextRounds);
    setRoundSummary(roundData);
    setSubPhase("roundResult");

    addTimer(() => {
      const cdmg   = calcCounterDmg(boss.atk || 100, baseDEF);
      const isLast = nextRounds.length === TOTAL_ROUNDS;
      const pool   = isLast ? BOSS_FINAL_TAUNTS : BOSS_TAUNTS;
      const [icon, text] = pool[Math.floor(Math.random() * pool.length)];

      setCounterDmg(cdmg);
      setBossAttackIcon(icon);
      setBossAttackText(text);
      setMyHP(h => Math.max(0, h - cdmg));
      setSubPhase("bossAttack");

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
      isGuest:       false,
      potionDmgMult: 1,
      bots,
    });

    setResult(res);
    setSubmitting(false);
    processingRef.current = false;
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

        <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-5 pt-4">
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
                <button key={p.id} onClick={() => setPotion(p.id)}
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

        <div className="shrink-0 absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3"
          style={{ background: "linear-gradient(0deg, #0f172a 80%, transparent)" }}>
          {potionCost > 0 && !canAfford && (
            <div className="text-center text-xs text-rose-400 mb-2">金幣不足，請選擇其他藥水</div>
          )}
          <button
            onClick={async () => {
              if (potionDef?.cost > 0) {
                const { addCoins } = await import("../../lib/db");
                await addCoins(myId, -potionDef.cost).catch(() => {});
                setCoins(c => c - potionDef.cost);
              }
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
  // ── 畫面：戰鬥中 ─────────────────────────────────────────
  if (phase === "battle") {

    // ── 回合結算畫面 ───────────────────────────────────────
    if (subPhase === "roundResult") {
      const isLast = allRounds.length === TOTAL_ROUNDS;
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 text-white px-6 space-y-6">
          {/* 回合徽章 */}
          <div className="text-center space-y-1">
            <div className="text-xs text-slate-500 font-bold tracking-widest uppercase">
              第 {allRounds.length} 回合結算
            </div>
            <div className="text-5xl font-black text-rose-400">
              -{roundSummary?.dmg.toLocaleString()}
            </div>
            <div className="text-xs text-amber-300">
              {roundSummary?.crits > 0 ? `⚡ ${roundSummary.crits} 次暴擊！` : "造成傷害"}
            </div>
          </div>

          {/* 本回合箭矢 */}
          <div className="flex gap-2 justify-center">
            {roundSummary?.arrows.map((a, i) => (
              <div key={i}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black border"
                style={{
                  background: `${scoreColor(a.label)}22`,
                  borderColor: scoreColor(a.label),
                  color: scoreColor(a.label),
                }}>
                {a.label}
              </div>
            ))}
          </div>

          {/* HP 狀態 */}
          <div className="w-full space-y-3">
            <HPBar label={`${boss.name} HP`} current={bossHP} max={event.bossMaxHP} color={boss.accent || "#f59e0b"}/>
            <HPBar label="你的 HP" current={myHP} max={baseHP} color="#22c55e"/>
          </div>

          {/* Boss 蓄力提示 */}
          <div className={`text-sm font-bold animate-pulse ${isLast ? "text-rose-300" : "text-slate-400"}`}>
            {isLast ? "⚠️ Boss 正在集結全力…" : "⚡ Boss 正在蓄力反擊…"}
          </div>

          {/* 回合進度點 */}
          <div className="flex gap-2">
            {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                i < allRounds.length ? "bg-amber-400" : "bg-white/15"
              }`}/>
            ))}
          </div>
        </div>
      );
    }

    // ── Boss 反擊畫面 ───────────────────────────────────────
    if (subPhase === "bossAttack") {
      return (
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-b from-red-950 to-slate-900 text-white px-6 space-y-5">
          {/* Boss 大圖 */}
          <div className="animate-bounce" style={{ animationDuration: "0.6s" }}>
            <WorldBossSVG bossKey={event.bossKey} currentHP={bossHP} maxHP={event.bossMaxHP} size={120}/>
          </div>

          {/* 攻擊台詞 */}
          <div className="text-center space-y-1">
            <div className="text-5xl">{bossAttackIcon}</div>
            <div className="text-xl font-black text-rose-300">{bossAttackText}</div>
          </div>

          {/* 傷害數字 */}
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">你受到傷害</div>
            <div className="text-6xl font-black text-rose-400" style={{ textShadow: "0 0 30px #ef4444" }}>
              -{counterDmg}
            </div>
          </div>

          {/* 玩家 HP */}
          <div className="w-full">
            <HPBar label="你的 HP" current={myHP} max={baseHP} color={myHP / baseHP > 0.3 ? "#22c55e" : "#ef4444"}/>
            {myHP <= 0 && (
              <div className="text-center text-rose-400 text-xs font-bold mt-1 animate-pulse">
                倒下了…但你的傷害已記錄！
              </div>
            )}
          </div>

          {/* 下一步提示 */}
          {allRounds.length < TOTAL_ROUNDS ? (
            <div className="text-slate-500 text-xs animate-pulse">
              準備第 {allRounds.length + 1} 回合…
            </div>
          ) : (
            <div className="text-amber-400 text-xs font-bold animate-pulse">
              戰鬥結束，結算中…
            </div>
          )}
        </div>
      );
    }

    // ── 射擊畫面 ────────────────────────────────────────────
    const isLastRound = roundIdx === TOTAL_ROUNDS - 1;

    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white relative">
        {catMsg && <CatMsg msg={catMsg} onDone={() => setCatMsg(null)}/>}

        {/* Header：Boss 狀態 */}
        <div className="shrink-0 px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 mb-2">
            <WorldBossSVG bossKey={event.bossKey} currentHP={bossHP} maxHP={event.bossMaxHP} size={44}/>
            <div className="flex-1">
              <div className="text-xs font-bold mb-1" style={{ color: boss.accent }}>{boss.name}</div>
              <MiniHP current={bossHP} max={event.bossMaxHP}/>
              <div className="text-xs text-slate-500 font-mono mt-0.5">{bossHP.toLocaleString()} HP</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-slate-500">你的 HP</div>
              <div className={`font-black text-sm ${myHP / baseHP > 0.4 ? "text-emerald-400" : "text-rose-400"}`}>
                {myHP} / {baseHP}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
                i < roundIdx ? "bg-amber-400" : i === roundIdx ? "bg-rose-400 animate-pulse" : "bg-white/10"
              }`}/>
            ))}
          </div>
          <div className="text-center text-xs text-slate-400 mt-1">
            第 {roundIdx + 1} / {TOTAL_ROUNDS} 回合
            {isLastRound && <span className="text-rose-400 font-bold ml-2">⚠️ 最終回合！</span>}
          </div>
        </div>

        {/* 箭矢格 */}
        <div className="shrink-0 px-4 py-2">
          <div className="flex gap-1.5 justify-center">
            {Array.from({ length: ARROWS_PER }).map((_, i) => {
              const a = arrows[i];
              const isActive = subPhase === "processing" && i === processingIdx;
              return (
                <div key={i}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border transition-all ${isActive ? "scale-110" : ""}`}
                  style={{
                    background: a ? `${scoreColor(a.label)}22` : "rgba(255,255,255,0.05)",
                    borderColor: a ? (isActive ? "#fbbf24" : scoreColor(a.label)) : "rgba(255,255,255,0.1)",
                    color: a ? scoreColor(a.label) : "#475569",
                    boxShadow: isActive ? "0 0 12px #fbbf24aa" : undefined,
                  }}>
                  {a ? a.label : i + 1}
                </div>
              );
            })}
          </div>
          <div className="text-center text-xs text-slate-500 mt-1 h-4">
            {subPhase === "shooting"
              ? `${arrows.length} / ${ARROWS_PER} 箭`
              : <span className="text-amber-300 animate-pulse">計算中…</span>}
          </div>
        </div>

        {/* 主內容：三段切換 */}
        <div className="flex-1 flex flex-col px-4 pb-4 overflow-hidden">

          {/* ① 計算中：逐箭傷害紀錄 */}
          {subPhase === "processing" && (
            <div className="flex-1 flex flex-col justify-center gap-1.5">
              {dmgLog.map((l, i) => (
                <div key={i} className={`text-sm text-center font-bold transition-all ${
                  i === dmgLog.length - 1 ? "text-white" : "text-slate-400"
                }`}>{l}</div>
              ))}
            </div>
          )}

          {/* ② 6箭填完：送出按鈕 */}
          {subPhase === "shooting" && arrows.length >= ARROWS_PER && (
            <div className="flex-1 flex flex-col justify-end gap-2">
              <button onClick={() => finishRound(arrows)}
                className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-xl transition-all active:scale-95"
                style={{ background: `linear-gradient(135deg, ${boss.accent || "#f59e0b"}, #ef4444)` }}>
                ⚔️ 送出 {ARROWS_PER} 箭！
              </button>
              <button onClick={() => setArrows(prev => prev.slice(0, -1))}
                className="w-full py-2 rounded-xl text-slate-400 text-xs border border-white/10 active:scale-95">
                ← 取消上一箭
              </button>
            </div>
          )}

          {/* ③ 選箭中：分數按鈕 */}
          {subPhase === "shooting" && arrows.length < ARROWS_PER && (
            <div className="flex-1 flex flex-col justify-end gap-2">
              <div className="grid grid-cols-6 gap-2">
                {SCORE_BTNS.map(s => (
                  <button key={s}
                    onClick={() => handleScore(s)}
                    className="py-3 rounded-xl font-black text-sm border transition-all active:scale-90"
                    style={{
                      color: scoreColor(s),
                      borderColor: `${scoreColor(s)}66`,
                      background: `${scoreColor(s)}11`,
                    }}>
                    {scoreLabel(s)}
                  </button>
                ))}
              </div>
              {arrows.length > 0 && (
                <button onClick={() => setArrows(prev => prev.slice(0, -1))}
                  className="w-full py-2 rounded-xl text-slate-400 text-xs border border-white/10 active:scale-95">
                  ← 取消上一箭
                </button>
              )}
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

        <div className="shrink-0 px-4 pb-6 pt-2">
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
