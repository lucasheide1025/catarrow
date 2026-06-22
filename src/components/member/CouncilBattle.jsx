// src/components/member/CouncilBattle.jsx — 議會廳採集任務（RPG射箭系統）
import { useState, useRef, useEffect } from "react";
import { calcDamage } from "../../lib/monsterData";
import {
  COUNCIL_MONSTERS, TIER_META, LIFE_TIER_STATS,
  getRaceMaterialId, CLEAR_GACHA_COINS, CLEAR_VILLAGE_MAT_COUNT,
  BUILDING_PAIN_MSGS,
} from "../../lib/councilMonsters";
import {
  sfxTap, sfxArrowHit, sfxCritBoom, sfxSoftFail,
  sfxSuccess, sfxEpic, sfxRoundEnd, sfxMonsterDead,
} from "../../lib/sound";

const ARROWS_PER_ROUND = 6;
const DISTANCES = [5, 7, 10, 13.5, 15, 18];

const TARGET_OPTIONS = [
  { id: "standard", label: "全靶",   icon: "🎯", scores: ["X","10","9","8","7","6","5","4","3","2","1","0"] },
  { id: "half",     label: "半靶",   icon: "◑",  scores: ["X","10","9","8","7","6","5","4","3","2","1","0"] },
  { id: "field_16", label: "原野靶", icon: "🌿", scores: ["6","5","4","3","2","1","0"] },
];

const CSS = `
@keyframes cb-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
@keyframes cb-pop   { 0%{transform:scale(0.8);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
@keyframes cb-fade-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes cb-bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
`;

function scoreVal(label) {
  if (label === "X") return 10;
  return parseInt(label, 10) || 0;
}

function getPartMult(label, targetFmt) {
  if (label === "0") return 0;
  if (targetFmt === "field_16") {
    const v = parseInt(label);
    if (v === 6) return 2.0;
    if (v === 5) return 1.5;
    if (v >= 3)  return 1.2;
    return 1.0;
  }
  if (label === "X")              return 2.0;
  const v = parseInt(label);
  if (v === 10)                   return 1.5;
  if (v >= 8)                     return 1.2;
  return 1.0;
}

function getMappedScore(label, targetFmt) {
  if (label === "X") return 10;
  const v = parseInt(label) || 0;
  if (targetFmt === "field_16" && v > 0) return Math.min(v + 5, 10);
  return v;
}

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

  const monsters = availableTiers.map(tier => ({
    tier,
    ...COUNCIL_MONSTERS[bId][tier],
    ...LIFE_TIER_STATS[tier],
    maxHp: LIFE_TIER_STATS[tier].hp,
  }));

  const [phase,      setPhase]      = useState("setup");
  const [distance,   setDistance]   = useState(18);
  const [targetFmt,  setTargetFmt]  = useState("standard");
  const [mIdx,       setMIdx]       = useState(0);
  const [monsterHp,  setMonsterHp]  = useState(monsters[0]?.hp);
  const [archerHp,   setArcherHp]   = useState(archerStats.hp);
  const [round,      setRound]      = useState(1);
  const [arrows,     setArrows]     = useState([]);
  const [log,        setLog]        = useState([]);
  const [defeated,   setDefeated]   = useState([]);
  const [processing, setProcessing] = useState(false);
  const [shaking,    setShaking]    = useState(false);
  const [painEvent,  setPainEvent]  = useState(null);

  const logRef = useRef(null);

  const currentMonster  = monsters[mIdx];
  const tierMeta        = TIER_META[currentMonster?.tier] || {};
  const isLastMonster   = mIdx === monsters.length - 1;
  const scoreLabels     = TARGET_OPTIONS.find(t => t.id === targetFmt)?.scores || TARGET_OPTIONS[0].scores;
  const isResolving     = phase === "resolving";
  const villageTier     = getVillageTier(village);
  const isFullClear     = defeated.length === monsters.length;
  const raceMaterials   = defeated.map(d => ({ id: d.materialId }));
  const villageMatKey   = `${villageMat}_t${villageTier}`;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function addLog(text, type = "normal") {
    setLog(prev => [...prev.slice(-50), { text, type }]);
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

    let curMonHp  = monsterHp;
    let curArchHp = archerHp;

    addLog(`⚔️ 第 ${round} 輪（${distance}m · ${TARGET_OPTIONS.find(t=>t.id===targetFmt)?.label}）`, "system");

    for (let i = 0; i < ARROWS_PER_ROUND; i++) {
      const label    = arrows[i];
      const partMult = getPartMult(label, targetFmt);
      const score    = getMappedScore(label, targetFmt);
      const dmg      = calcDamage({ score, archerATK: archerStats.atk, monsterDEF: currentMonster.def, partMult });

      if (partMult === 0) {
        sfxSoftFail();
        addLog(`第${i+1}箭 ${label} — 失誤！沒有效果`, "miss");
      } else if (partMult >= 2.0) {
        sfxCritBoom();
        addLog(`第${i+1}箭 ${label} — 爆擊！傷害 ${dmg} 💥`, "crit");
        setShaking(true); setTimeout(() => setShaking(false), 380);
      } else if (partMult >= 1.5) {
        sfxArrowHit();
        addLog(`第${i+1}箭 ${label} — 重擊！傷害 ${dmg}`, "hit");
        setShaking(true); setTimeout(() => setShaking(false), 300);
      } else {
        sfxTap();
        addLog(`第${i+1}箭 ${label} — 命中 ${dmg}`, "normal");
      }

      curMonHp = Math.max(0, curMonHp - dmg);
      setMonsterHp(curMonHp);
      await delay(1100);

      if (curMonHp <= 0) break;
    }

    // ── 障礙擊破 ──────────────────────────────────────────────
    if (curMonHp <= 0) {
      sfxMonsterDead();
      setTimeout(() => sfxSuccess(), 500);
      addLog(`✅ ${currentMonster.name} 解決了！任務完成！`, "win");
      const matId       = getRaceMaterialId(race, currentMonster.tier);
      const newDefeated = [...defeated, { tier: currentMonster.tier, materialId: matId }];
      setDefeated(newDefeated);
      await delay(700);
      setProcessing(false);
      if (isLastMonster) { sfxEpic(); setPhase("result"); }
      else setPhase("obstacle_clear");
      return;
    }

    // ── 回合結算 ──────────────────────────────────────────────
    sfxRoundEnd();
    const roundTotal = arrows.reduce((s, l) => s + scoreVal(l), 0);
    const hpPct      = Math.round(curMonHp / currentMonster.maxHp * 100);
    const statusTag  = hpPct <= 15 ? "⚠️ 快解決了！" : hpPct <= 35 ? "💪 繼續加油！" : "";
    addLog(`回合 ${round} 結算：${roundTotal}分　抵抗值剩 ${curMonHp} ${statusTag}`, "total");
    await delay(700);

    // ── 每 2 回合：疲勞自扣血 ──────────────────────────────────
    if (round % 2 === 0) {
      const msgs    = BUILDING_PAIN_MSGS[bId] || ["工作太辛苦，受傷了！"];
      const msg     = msgs[Math.floor(Math.random() * msgs.length)];
      const selfDmg = Math.max(5, Math.floor(archerStats.hp * 0.08));
      curArchHp     = Math.max(0, curArchHp - selfDmg);
      setArcherHp(curArchHp);
      setPainEvent({ msg, dmg: selfDmg });
      addLog(`😰 ${msg}（疲勞傷害 -${selfDmg}）`, "counter");
      await delay(1800);
      setPainEvent(null);

      if (curArchHp <= 0) {
        addLog("💀 精疲力竭…帶著已完成的任務先撤退！", "system");
        await delay(600);
        setProcessing(false);
        setPhase("result");
        return;
      }
    }

    setRound(r => r + 1);
    setArrows([]);
    setProcessing(false);
    setPhase("input");
  }

  function nextObstacle() {
    const next = mIdx + 1;
    setMIdx(next);
    setMonsterHp(monsters[next].hp);
    setRound(1);
    setArrows([]);
    setPhase("input");
    addLog(`--- 下一個任務：${monsters[next].name} ---`, "system");
  }

  // ═══════════════════════════════════════════════════════════
  // ── 選擇靶面與距離 ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  if (phase === "setup") {
    return (
      <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#1c1008,#2d1a0a,#1a1208)", color:"white", padding:"16px 12px 80px" }}>
        <style>{CSS}</style>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#92400e", fontSize:14, cursor:"pointer", marginBottom:12 }}>← 返回</button>

        {/* 建築標頭 */}
        <div style={{ background:"linear-gradient(135deg,rgba(245,158,11,0.12),rgba(180,83,9,0.18))", borderRadius:18, padding:"16px 14px", border:"1px solid rgba(245,158,11,0.22)", marginBottom:16, textAlign:"center" }}>
          <div style={{ fontSize:52, marginBottom:6, animation:"cb-bounce 2s ease infinite" }}>{bEmoji}</div>
          <div style={{ fontWeight:900, fontSize:18, color:"#fbbf24" }}>{bName} 採集任務</div>
          <div style={{ fontSize:12, color:"#92400e", marginTop:3 }}>{raceLabel} · {monsters.length} 個障礙</div>
          <div style={{ display:"flex", justifyContent:"center", gap:16, marginTop:8, fontSize:12, color:"#b45309" }}>
            <span>❤️ {archerStats.hp}</span>
            <span>⚔️ {archerStats.atk}</span>
            <span>🛡️ {archerStats.def}</span>
          </div>
        </div>

        {/* 靶面選擇 */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontWeight:900, fontSize:13, color:"#b45309", marginBottom:8 }}>靶面</div>
          <div style={{ display:"flex", gap:8 }}>
            {TARGET_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setTargetFmt(t.id)} style={{
                flex:1, padding:"10px 4px", borderRadius:12, fontWeight:800, fontSize:13, cursor:"pointer",
                background: targetFmt===t.id ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(245,158,11,0.08)",
                border:`2px solid ${targetFmt===t.id ? "#f59e0b" : "rgba(245,158,11,0.2)"}`,
                color: targetFmt===t.id ? "#1c1008" : "#92400e",
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>

        {/* 距離選擇 */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontWeight:900, fontSize:13, color:"#b45309", marginBottom:8 }}>射擊距離</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {DISTANCES.map(d => (
              <button key={d} onClick={() => setDistance(d)} style={{
                padding:"10px 0", borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer",
                background: distance===d ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(245,158,11,0.08)",
                border:`2px solid ${distance===d ? "#f59e0b" : "rgba(245,158,11,0.2)"}`,
                color: distance===d ? "#1c1008" : "#92400e",
              }}>{d}m</button>
            ))}
          </div>
        </div>

        {/* 障礙清單預覽 */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontWeight:900, fontSize:13, color:"#b45309", marginBottom:8 }}>本次任務清單</div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {monsters.map(m => {
              const tm = TIER_META[m.tier];
              return (
                <div key={m.tier} style={{ display:"flex", alignItems:"center", gap:10, borderRadius:12, padding:"10px 12px", background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.12)" }}>
                  <span style={{ fontSize:24 }}>{m.emoji}</span>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:10, fontWeight:800, padding:"2px 6px", borderRadius:20, background:tm.color+"33", color:tm.color, marginRight:6 }}>{tm.label}</span>
                    <span style={{ fontWeight:800, fontSize:13, color:"#fef3c7" }}>{m.name}</span>
                    <div style={{ fontSize:11, color:"#92400e", marginTop:1 }}>{m.action}</div>
                  </div>
                  <div style={{ fontSize:10, color:"#78350f" }}>❤️{m.hp}</div>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={() => { setPhase("input"); addLog(`🌟 任務開始！第一個目標：${currentMonster.name}`, "system"); }} style={{
          width:"100%", padding:"15px 0", borderRadius:16, fontWeight:900, fontSize:17, cursor:"pointer",
          background:"linear-gradient(90deg,#f59e0b,#d97706)", color:"#1c1008", border:"none",
        }}>🌟 開始採集任務！</button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ── 障礙擊破過場 ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  if (phase === "obstacle_clear") {
    const justDefeated = defeated[defeated.length - 1];
    const next         = monsters[mIdx + 1];
    return (
      <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#1c1008,#2d1a0a)", color:"white", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:18 }}>
        <style>{CSS}</style>
        <div style={{ fontSize:72, animation:"cb-pop 0.4s ease" }}>✅</div>
        <div style={{ fontWeight:900, fontSize:22, color:"#fbbf24" }}>{currentMonster.name} 解決了！</div>
        <div style={{ fontSize:13, color:"#92400e" }}>獲得 {raceLabel}·{TIER_META[justDefeated?.tier]?.label} 素材 ×1</div>
        <div style={{ fontSize:12, color:"#78350f" }}>體力：{archerHp} / {archerStats.hp}</div>
        {next && (
          <div style={{ width:"100%", maxWidth:320, borderRadius:16, padding:14, textAlign:"center", background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.18)" }}>
            <div style={{ fontSize:11, color:"#92400e", marginBottom:6 }}>下一個任務</div>
            <span style={{ fontSize:36 }}>{next.emoji}</span>
            <div style={{ fontWeight:800, fontSize:14, color:"#fef3c7", marginTop:4 }}>{next.name}</div>
            <div style={{ fontSize:11, color:"#92400e", marginTop:2 }}>{next.action}</div>
          </div>
        )}
        <button onClick={nextObstacle} style={{
          width:"100%", maxWidth:320, padding:"14px 0", borderRadius:16, fontWeight:900, fontSize:16, cursor:"pointer",
          background:"linear-gradient(90deg,#f59e0b,#d97706)", color:"#1c1008", border:"none",
        }}>繼續任務！</button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ── 結算畫面 ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  if (phase === "result") {
    return (
      <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#1c1008,#2d1a0a)", color:"white", padding:"16px 12px 80px" }}>
        <style>{CSS}</style>
        <div style={{ borderRadius:20, padding:"20px 16px", textAlign:"center", marginBottom:16, animation:"cb-pop 0.4s ease", background: isFullClear ? "linear-gradient(135deg,#14532d,#166534)" : "linear-gradient(135deg,#78350f,#92400e)" }}>
          <div style={{ fontSize:56, marginBottom:8 }}>{isFullClear ? "🏆" : "💪"}</div>
          <div style={{ fontWeight:900, fontSize:20, marginBottom:4 }}>{isFullClear ? "任務全部完成！" : "本次到此為止"}</div>
          <div style={{ fontSize:13, opacity:0.8 }}>{isFullClear ? "所有採集障礙都解決了！" : `完成了 ${defeated.length} / ${monsters.length} 個任務`}</div>
        </div>

        <div style={{ borderRadius:16, padding:16, background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.14)", marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:900, color:"#92400e", marginBottom:10 }}>獲得素材</div>
          {defeated.length === 0
            ? <div style={{ color:"#78350f", fontSize:13 }}>未獲得素材</div>
            : defeated.map((d, i) => {
                const tm = TIER_META[d.tier];
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, fontSize:13 }}>
                    <span style={{ fontSize:10, fontWeight:800, padding:"2px 6px", borderRadius:20, background:tm.color+"33", color:tm.color }}>{tm.label}</span>
                    <span style={{ color:"#fef3c7" }}>{raceLabel}素材 ×1</span>
                    <span style={{ color:"#78350f", fontSize:10 }}>({d.materialId})</span>
                  </div>
                );
              })
          }
          {isFullClear && (
            <>
              <div style={{ height:1, background:"rgba(245,158,11,0.14)", margin:"10px 0" }} />
              <div style={{ fontSize:12, fontWeight:900, color:"#fbbf24", marginBottom:6 }}>全通關獎勵</div>
              <div style={{ fontSize:13, color:"#fef3c7", lineHeight:2.2 }}>
                <div>🏡 {villageMat} T{villageTier} ×{CLEAR_VILLAGE_MAT_COUNT}</div>
                <div>🪙 扭蛋幣 ×{CLEAR_GACHA_COINS}</div>
              </div>
            </>
          )}
        </div>

        <button onClick={() => onFinish({ raceMaterials, villageMatKey, isFullClear })} style={{
          width:"100%", padding:"15px 0", borderRadius:16, fontWeight:900, fontSize:17, cursor:"pointer",
          background:"linear-gradient(90deg,#16a34a,#15803d)", color:"white", border:"none",
        }}>領取並離開</button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ── 戰鬥中（input / resolving）────────────────────────────
  // ═══════════════════════════════════════════════════════════
  const gridCols = scoreLabels.length > 7 ? 6 : scoreLabels.length;

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#1c1008,#2d1a0a,#1a1208)", color:"white", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>

      {/* 頂部狀態列 */}
      <div style={{ padding:"10px 12px 0", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#92400e", fontSize:13, cursor:"pointer" }}>← 退出</button>
        <div style={{ flex:1, textAlign:"center", fontSize:11, color:"#78350f" }}>
          {bEmoji} {bName} · 第{mIdx+1}/{monsters.length}個 · 回合{round} · {distance}m
        </div>
      </div>

      {/* 玩家體力條 */}
      <div style={{ padding:"8px 12px 0", flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#92400e", marginBottom:3 }}>
          <span>🏃 體力</span><span>{archerHp} / {archerStats.hp}</span>
        </div>
        <div style={{ height:6, borderRadius:99, background:"rgba(255,255,255,0.1)" }}>
          <div style={{ height:6, borderRadius:99, transition:"width 0.4s", width:`${(archerHp/archerStats.hp)*100}%`, background: archerHp/archerStats.hp > 0.4 ? "#22c55e" : "#ef4444" }} />
        </div>
      </div>

      {/* 中間：障礙卡 + 戰鬥日誌 */}
      <div style={{ flex:1, padding:"10px 12px 0", display:"flex", flexDirection:"column", gap:8, overflow:"hidden" }}>
        {/* 障礙卡 */}
        <div style={{
          borderRadius:18, padding:"14px",
          border:`2px solid ${tierMeta.color}55`,
          background:`linear-gradient(135deg,${currentMonster?.bgColor || "#fef9f0"},#fffdf8)`,
          animation: shaking ? "cb-shake 0.4s ease" : "none",
          flexShrink:0,
        }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
            <span style={{ fontSize:52, lineHeight:1, flexShrink:0 }}>{currentMonster?.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <span style={{ fontSize:10, fontWeight:800, padding:"2px 6px", borderRadius:20, background:tierMeta.color, color:"white" }}>{tierMeta.label}</span>
                <span style={{ fontWeight:900, fontSize:15, color:"#1c1008" }}>{currentMonster?.name}</span>
              </div>
              <div style={{ fontSize:11, color:"#78350f", marginBottom:6 }}>{currentMonster?.action}</div>
              <div style={{ fontSize:11, color:"#92400e", display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span>障礙抵抗值</span>
                <span style={{ fontWeight:800 }}>{monsterHp} / {currentMonster?.maxHp}</span>
              </div>
              <div style={{ height:8, borderRadius:99, background:"rgba(0,0,0,0.1)", overflow:"hidden" }}>
                <div style={{ height:8, borderRadius:99, transition:"width 0.5s", width:`${(monsterHp/(currentMonster?.maxHp||1))*100}%`, background:tierMeta.color }} />
              </div>
            </div>
          </div>
          {/* 疲勞事件提示 */}
          {painEvent && (
            <div style={{ marginTop:8, borderRadius:10, padding:"8px 12px", background:"rgba(239,68,68,0.13)", border:"1px solid rgba(239,68,68,0.28)", fontSize:12, color:"#dc2626", fontWeight:700, animation:"cb-fade-up 0.3s ease" }}>
              😰 {painEvent.msg}　<span style={{ color:"#b91c1c" }}>（-{painEvent.dmg} 體力）</span>
            </div>
          )}
        </div>

        {/* 戰鬥日誌 */}
        <div ref={logRef} style={{ flex:1, overflowY:"auto", borderRadius:12, padding:"8px 10px", background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.1)", fontSize:11, lineHeight:1.8, minHeight:80 }}>
          {log.map((l, i) => (
            <div key={i} style={{
              color: l.type==="win"     ? "#4ade80"
                   : l.type==="crit"   ? "#fbbf24"
                   : l.type==="hit"    ? "#f97316"
                   : l.type==="counter"? "#f87171"
                   : l.type==="total"  ? "#a3e635"
                   : l.type==="miss"   ? "#64748b"
                   : l.type==="system" ? "#78350f"
                   : "#b45309",
              animation: i===log.length-1 ? "cb-fade-up 0.2s ease" : "none",
            }}>{l.text}</div>
          ))}
          {log.length === 0 && <div style={{ color:"#78350f" }}>選好靶面與距離後，開始輸入得分…</div>}
        </div>
      </div>

      {/* 底部輸分區 */}
      <div style={{ flexShrink:0, padding:"6px 12px 20px", background:"linear-gradient(0deg,#1c1008 85%,transparent)" }}>
        {/* 已輸箭格 */}
        <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:8 }}>
          {Array.from({ length: ARROWS_PER_ROUND }).map((_, i) => {
            const label = arrows[i];
            const isFilled = label != null;
            const isGold   = label === "X" || label === "10" || label === "6";
            return (
              <div key={i} style={{
                width:40, height:40, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13,
                background: isFilled ? (isGold ? "rgba(245,158,11,0.85)" : "rgba(180,83,9,0.65)") : "rgba(255,255,255,0.05)",
                border:`2px solid ${isFilled ? "transparent" : "rgba(245,158,11,0.15)"}`,
                color: isFilled ? "#1c1008" : "#78350f",
              }}>{label ?? "·"}</div>
            );
          })}
        </div>

        {/* 分數按鈕 */}
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${gridCols},1fr)`, gap:5, marginBottom:6 }}>
          {scoreLabels.map(label => {
            const isGold = label === "X" || label === "10" || label === "6";
            return (
              <button key={label} onClick={() => inputArrow(label)}
                disabled={isResolving || arrows.length >= ARROWS_PER_ROUND}
                style={{
                  padding:"10px 0", borderRadius:12, fontWeight:900, fontSize:13, cursor:"pointer",
                  background: isGold ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.07)",
                  border:`1px solid ${isGold ? "rgba(245,158,11,0.5)" : "rgba(245,158,11,0.15)"}`,
                  color: isGold ? "#fbbf24" : "#d97706",
                  opacity: isResolving || arrows.length >= ARROWS_PER_ROUND ? 0.3 : 1,
                }}>{label}</button>
            );
          })}
        </div>

        {/* 確認 / 撤銷 */}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={undoArrow} disabled={isResolving || !arrows.length}
            style={{ flex:1, padding:"12px 0", borderRadius:14, fontWeight:700, fontSize:13, cursor:"pointer", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(245,158,11,0.2)", color:"#92400e", opacity: isResolving||!arrows.length ? 0.3 : 1 }}>
            ← 撤銷
          </button>
          <button onClick={submitRound} disabled={isResolving || arrows.length < ARROWS_PER_ROUND}
            style={{
              flex:2, padding:"12px 0", borderRadius:14, fontWeight:900, fontSize:15, cursor:"pointer", border:"none",
              background: arrows.length >= ARROWS_PER_ROUND ? "linear-gradient(90deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.05)",
              color: arrows.length >= ARROWS_PER_ROUND ? "#1c1008" : "#78350f",
              opacity: isResolving ? 0.5 : 1,
            }}>
            {isResolving ? "結算中…" : `確認（${arrows.length}/${ARROWS_PER_ROUND}）`}
          </button>
        </div>
      </div>
    </div>
  );
}
