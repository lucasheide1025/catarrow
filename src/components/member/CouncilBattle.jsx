// src/components/member/CouncilBattle.jsx — 議會廳戰鬥（射箭輸分系統）
import { useState, useRef, useEffect } from "react";
import { calcDamage, calcCounterDamage } from "../../lib/monsterData";
import { COUNCIL_MONSTERS, TIER_META, LIFE_TIER_STATS, getRaceMaterialId, CLEAR_GACHA_COINS, CLEAR_VILLAGE_MAT_COUNT } from "../../lib/councilMonsters";
import { sfxSuccess, sfxEpic } from "../../lib/sound";

const ARROWS_PER_ROUND = 6;
const DISTANCES = [5, 7, 10, 13.5, 15, 18];
const SCORE_LABELS = ["X","10","9","8","7","6","5","4","3","2","1","0"];

const CSS = `
@keyframes cb-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes cb-pop { 0%{transform:scale(0.7);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
@keyframes cb-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
@keyframes cb-fade-up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
`;

function scoreVal(label) {
  if (label === "X") return 10;
  return parseInt(label, 10) || 0;
}

// 計算村莊 tier（依建築平均等級）
function getVillageTier(village) {
  if (!village?.buildings) return 1;
  const lvs = Object.values(village.buildings);
  const avg = lvs.reduce((a, b) => a + b, 0) / (lvs.length || 1);
  if (avg >= 17) return 5;
  if (avg >= 13) return 4;
  if (avg >= 9)  return 3;
  if (avg >= 5)  return 2;
  return 1;
}

export default function CouncilBattle({ building, availableTiers, archerStats, village, onFinish, onBack }) {
  const { id: bId, name: bName, emoji: bEmoji, race, villageMat, raceLabel } = building;

  // 將 tier 清單組裝成怪物物件（含 HP）
  const monsters = availableTiers.map(tier => ({
    tier,
    ...COUNCIL_MONSTERS[bId][tier],
    ...LIFE_TIER_STATS[tier],
    maxHp: LIFE_TIER_STATS[tier].hp,
  }));

  const [phase,       setPhase]       = useState("distance"); // distance | input | resolving | monster_clear | result
  const [distance,    setDistance]    = useState(18);
  const [mIdx,        setMIdx]        = useState(0);
  const [monsterHp,   setMonsterHp]   = useState(monsters[0]?.hp);
  const [archerHp,    setArcherHp]    = useState(archerStats.hp);
  const [round,       setRound]       = useState(1);
  const [arrows,      setArrows]      = useState([]);
  const [log,         setLog]         = useState([]);
  const [defeated,    setDefeated]    = useState([]); // [{ tier, materialId }]
  const [processing,  setProcessing]  = useState(false);
  const [shaking,     setShaking]     = useState(false);

  const logRef = useRef(null);

  const currentMonster = monsters[mIdx];
  const tierMeta = TIER_META[currentMonster?.tier] || {};
  const isLastMonster = mIdx === monsters.length - 1;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function addLog(text, type = "normal") {
    setLog(prev => [...prev.slice(-40), { text, type }]);
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function inputArrow(label) {
    if (arrows.length >= ARROWS_PER_ROUND || processing) return;
    setArrows(prev => [...prev, label]);
  }

  function undoArrow() {
    if (!arrows.length || processing) return;
    setArrows(prev => prev.slice(0, -1));
  }

  async function submitRound() {
    if (arrows.length < ARROWS_PER_ROUND || processing) return;
    setProcessing(true);
    setPhase("resolving");

    let totalDmg = 0;
    let roundDesc = arrows.join(" ");
    addLog(`📍 第 ${round} 輪（${distance}m）：${roundDesc}`);

    for (const label of arrows) {
      const score = scoreVal(label);
      const dmg   = calcDamage({ score, archerATK: archerStats.atk, monsterDEF: currentMonster.def, partMult: 1.0 });
      totalDmg += dmg;
    }

    await delay(400);
    addLog(`⬡ 總輸出 ${totalDmg} 點傷害！`, "hit");

    const newMHp = Math.max(0, monsterHp - totalDmg);

    if (newMHp <= 0) {
      // 怪物倒地
      setMonsterHp(0);
      await delay(400);
      sfxSuccess();
      addLog(`✅ ${currentMonster.name} 被制服！`, "win");

      const matId = getRaceMaterialId(race, currentMonster.tier);
      const newDefeated = [...defeated, { tier: currentMonster.tier, materialId: matId }];
      setDefeated(newDefeated);

      await delay(600);
      setProcessing(false);

      if (isLastMonster) {
        sfxEpic();
        setPhase("result");
      } else {
        setPhase("monster_clear");
      }
    } else {
      // 怪物存活 → 反擊
      setMonsterHp(newMHp);
      await delay(600);

      const counterDmg = calcCounterDamage({ monsterATK: currentMonster.atk, archerDEF: archerStats.def });
      const newAHp     = Math.max(0, archerHp - counterDmg);
      setArcherHp(newAHp);
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      addLog(`💢 ${currentMonster.name} 反擊！你受到 ${counterDmg} 傷害`, "counter");
      await delay(400);

      if (newAHp <= 0) {
        addLog("💀 你倒下了…帶著已獲得的素材撤退", "system");
        await delay(600);
        setProcessing(false);
        setPhase("result");
      } else {
        addLog(`你的 HP：${newAHp} / ${archerStats.hp}`, "system");
        setRound(r => r + 1);
        setArrows([]);
        setProcessing(false);
        setPhase("input");
      }
    }
  }

  function nextMonster() {
    const next = mIdx + 1;
    setMIdx(next);
    setMonsterHp(monsters[next].hp);
    setRound(1);
    setArrows([]);
    setPhase("input");
    addLog(`--- 下一個：${TIER_META[monsters[next].tier].label} ${monsters[next].name} ---`, "system");
  }

  // 結算資料
  const villageTier  = getVillageTier(village);
  const isFullClear  = defeated.length === monsters.length;
  const raceMaterials = defeated.map(d => ({ id: d.materialId }));
  const villageMatKey = `${villageMat}_t${villageTier}`;

  // ── 選距離 ──────────────────────────────────────────────
  if (phase === "distance") {
    return (
      <div className="flex flex-col bg-slate-900 min-h-screen text-white p-4 gap-4">
        <style>{CSS}</style>
        <button onClick={onBack} className="text-slate-400 text-sm self-start">← 返回</button>
        <div className="rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg,#1e3a5f,#1e1b4b)" }}>
          <div className="text-4xl mb-2" style={{ animation: "cb-bounce 2s ease infinite" }}>{bEmoji}</div>
          <div className="font-black text-xl mb-1">{bName} 採集任務</div>
          <div className="text-sm text-slate-300">{raceLabel} · {monsters.length} 隻障礙</div>
          <div className="mt-3 flex justify-center gap-3 text-xs text-slate-400">
            <span>❤️ {archerStats.hp}</span>
            <span>⚔️ {archerStats.atk}</span>
            <span>🛡️ {archerStats.def}</span>
          </div>
        </div>

        <div className="text-sm font-black text-slate-300">選擇射擊距離</div>
        <div className="grid grid-cols-3 gap-2">
          {DISTANCES.map(d => (
            <button key={d} onClick={() => setDistance(d)}
              className="py-3 rounded-xl font-black text-sm transition-all active:scale-95"
              style={{
                background: distance === d ? "linear-gradient(135deg,#7c3aed,#2563eb)" : "rgba(255,255,255,0.06)",
                border: `2px solid ${distance === d ? "#7c3aed" : "rgba(255,255,255,0.12)"}`,
                color: distance === d ? "white" : "#94a3b8",
              }}>
              {d}m
            </button>
          ))}
        </div>

        {/* 怪物預覽 */}
        <div className="text-sm font-black text-slate-300">本次障礙清單</div>
        <div className="flex flex-col gap-2">
          {monsters.map((m, i) => {
            const tm = TIER_META[m.tier];
            return (
              <div key={m.tier} className="flex items-center gap-3 rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize: 22 }}>{m.emoji}</span>
                <div className="flex-1">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full mr-1.5"
                    style={{ background: tm.color + "33", color: tm.color }}>{tm.label}</span>
                  <span className="font-bold text-sm text-white">{m.name}</span>
                </div>
                <div className="text-xs text-slate-500">❤️{m.hp} ⚔️{m.atk} 🛡️{m.def}</div>
              </div>
            );
          })}
        </div>

        <button onClick={() => { setPhase("input"); addLog(`⚔️ 任務開始！第一個目標：${currentMonster.name}`, "system"); }}
          className="w-full py-4 rounded-2xl font-black text-lg"
          style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>
          ⚔️ 開始任務！
        </button>
      </div>
    );
  }

  // ── 怪物擊倒過場 ──────────────────────────────────────────
  if (phase === "monster_clear") {
    const justDefeated = defeated[defeated.length - 1];
    const next = monsters[mIdx + 1];
    return (
      <div className="flex flex-col items-center justify-center bg-slate-900 min-h-screen text-white p-6 gap-5" style={{ animation: "cb-pop 0.4s ease" }}>
        <style>{CSS}</style>
        <div style={{ fontSize: 64 }}>✅</div>
        <div className="font-black text-2xl">{currentMonster.name} 制服！</div>
        <div className="text-sm text-slate-300">獲得 {raceLabel}·{TIER_META[justDefeated?.tier]?.label} 素材</div>
        <div className="text-slate-400 text-xs">你的 HP：{archerHp} / {archerStats.hp}</div>
        {next && (
          <div className="w-full rounded-xl p-3 text-center"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-slate-400 text-xs mb-1">下一個目標</div>
            <span style={{ fontSize: 24 }}>{next.emoji}</span>
            <div className="font-bold text-sm mt-1">{next.name}</div>
          </div>
        )}
        <button onClick={nextMonster}
          className="w-full py-4 rounded-2xl font-black text-lg"
          style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>
          繼續挑戰！
        </button>
      </div>
    );
  }

  // ── 結算畫面 ──────────────────────────────────────────────
  if (phase === "result") {
    return (
      <div className="flex flex-col bg-slate-900 min-h-screen text-white p-4 gap-4">
        <style>{CSS}</style>
        <div className="rounded-2xl p-5 text-center" style={{ animation: "cb-pop 0.4s ease", background: isFullClear ? "linear-gradient(135deg,#14532d,#166534)" : "linear-gradient(135deg,#7f1d1d,#991b1b)" }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>{isFullClear ? "🏆" : "💀"}</div>
          <div className="font-black text-xl mb-1">{isFullClear ? "全部制服！" : "任務中斷"}</div>
          <div className="text-sm opacity-80">{isFullClear ? "成功清空所有障礙！" : `制服了 ${defeated.length} / ${monsters.length} 隻`}</div>
        </div>

        {/* 素材獎勵 */}
        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="text-xs font-black text-slate-400 mb-3">獲得素材</div>
          {defeated.length === 0
            ? <div className="text-slate-500 text-sm">無</div>
            : <div className="flex flex-col gap-2">
                {defeated.map((d, i) => {
                  const tm = TIER_META[d.tier];
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: tm.color + "33", color: tm.color }}>{tm.label}</span>
                      <span>{raceLabel}素材 ×1</span>
                      <span className="text-slate-500 text-xs">({d.materialId})</span>
                    </div>
                  );
                })}
              </div>
          }
          {isFullClear && (
            <>
              <div className="my-3 h-px bg-white/10" />
              <div className="text-xs font-black text-yellow-400 mb-2">全通關獎勵</div>
              <div className="flex flex-col gap-1 text-sm text-yellow-200">
                <span>🏡 {villageMat} T{villageTier} ×{CLEAR_VILLAGE_MAT_COUNT}</span>
                <span>🪙 扭蛋幣 ×{CLEAR_GACHA_COINS}</span>
              </div>
            </>
          )}
        </div>

        <button onClick={() => onFinish({ raceMaterials, villageMatKey, isFullClear })}
          className="w-full py-4 rounded-2xl font-black text-lg"
          style={{ background: "linear-gradient(90deg,#16a34a,#15803d)" }}>
          領取並離開
        </button>
      </div>
    );
  }

  // ── 輸分 / 戰鬥中 ──────────────────────────────────────────
  const isResolving = phase === "resolving";
  return (
    <div className="flex flex-col bg-slate-900 min-h-screen text-white">
      <style>{CSS}</style>
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* 頂部狀態 */}
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-slate-400 text-sm">← 退出</button>
          <div className="flex-1 text-center text-xs text-slate-400">{bEmoji} {bName} · 第 {mIdx+1}/{monsters.length} 隻 · 回合 {round}</div>
        </div>

        {/* 玩家 HP */}
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
            <span>❤️ 你的 HP</span><span>{archerHp} / {archerStats.hp}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full transition-all" style={{
              width: `${(archerHp / archerStats.hp) * 100}%`,
              background: archerHp / archerStats.hp > 0.4 ? "#22c55e" : "#ef4444",
            }} />
          </div>
        </div>

        {/* 怪物卡 */}
        <div className="rounded-2xl p-4" style={{
          background: currentMonster.bgColor, color: "#1e293b",
          border: `2px solid ${tierMeta.color}44`,
          animation: shaking ? "cb-shake 0.4s ease" : "none",
        }}>
          <div className="flex items-center gap-4 mb-3">
            <span style={{ fontSize: 48 }}>{currentMonster.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-black px-2 py-0.5 rounded-full text-white"
                  style={{ background: tierMeta.color }}>{tierMeta.label}</span>
                <span className="font-black text-base">{currentMonster.name}</span>
              </div>
              <div className="text-xs text-slate-500">行動中：{currentMonster.action}</div>
            </div>
          </div>
          <div className="text-xs text-slate-500 flex justify-between mb-1.5">
            <span>障礙值</span>
            <span>{monsterHp} / {currentMonster.maxHp}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-3 rounded-full transition-all" style={{
              width: `${(monsterHp / currentMonster.maxHp) * 100}%`,
              background: tierMeta.color,
            }} />
          </div>
          <div className="mt-2 flex gap-3 text-xs text-slate-500">
            <span>⚔️{currentMonster.atk}</span>
            <span>🛡️{currentMonster.def}</span>
            <span>📍{distance}m</span>
          </div>
        </div>

        {/* 戰鬥日誌 */}
        <div ref={logRef} className="rounded-xl p-3 text-xs leading-relaxed overflow-y-auto"
          style={{ background: "rgba(255,255,255,0.04)", maxHeight: 120, border: "1px solid rgba(255,255,255,0.08)" }}>
          {log.map((l, i) => (
            <div key={i} style={{
              color: l.type === "win" ? "#4ade80" : l.type === "counter" ? "#f87171" : l.type === "hit" ? "#fbbf24" : "#94a3b8",
              animation: i === log.length - 1 ? "cb-fade-up 0.2s ease" : "none",
            }}>{l.text}</div>
          ))}
          {log.length === 0 && <div className="text-slate-600">輸入本輪得分…</div>}
        </div>
      </div>

      {/* 底部：輸分區 */}
      <div className="shrink-0 px-4 pb-6 pt-3" style={{ background: "linear-gradient(0deg,#0f172a 85%,transparent)" }}>
        {/* 已輸箭 */}
        <div className="flex gap-1.5 mb-3 justify-center">
          {Array.from({ length: ARROWS_PER_ROUND }).map((_, i) => {
            const label = arrows[i];
            return (
              <div key={i} className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
                style={{
                  background: label != null ? (label === "X" || label === "10" ? "#f59e0b" : "#3b82f6") : "rgba(255,255,255,0.06)",
                  border: `2px solid ${label != null ? "transparent" : "rgba(255,255,255,0.12)"}`,
                  color: label != null ? "white" : "#475569",
                }}>
                {label ?? "·"}
              </div>
            );
          })}
        </div>

        {/* 分數按鈕 */}
        <div className="grid grid-cols-6 gap-1.5 mb-2">
          {SCORE_LABELS.map(label => (
            <button key={label} onClick={() => inputArrow(label)}
              disabled={isResolving || arrows.length >= ARROWS_PER_ROUND}
              className="py-2.5 rounded-xl font-black text-sm transition-all active:scale-90 disabled:opacity-30"
              style={{
                background: label === "X" || label === "10" ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.07)",
                border: `1px solid ${label === "X" || label === "10" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.1)"}`,
                color: label === "X" || label === "10" ? "#fbbf24" : "#e2e8f0",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* 確認 / 撤銷 */}
        <div className="flex gap-2">
          <button onClick={undoArrow} disabled={isResolving || !arrows.length}
            className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8" }}>
            ← 撤銷
          </button>
          <button onClick={submitRound}
            disabled={isResolving || arrows.length < ARROWS_PER_ROUND}
            className="flex-[2] py-3 rounded-xl font-black text-base disabled:opacity-40 transition-all active:scale-95"
            style={{
              background: arrows.length >= ARROWS_PER_ROUND ? "linear-gradient(90deg,#7c3aed,#2563eb)" : "rgba(255,255,255,0.06)",
              color: "white",
            }}>
            {isResolving ? "結算中…" : `確認（${arrows.length}/${ARROWS_PER_ROUND}）`}
          </button>
        </div>
      </div>
    </div>
  );
}
