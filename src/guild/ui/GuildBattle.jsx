// src/guild/ui/GuildBattle.jsx
// ─────────────────────────────────────────────────────────────
// 冒險者公會「2.5D 鳥瞰戰鬥」畫面（雛形，emoji + CSS 深度；日後換 ComfyUI sprite）。
// 玩法：選目標 → 射真實的箭（點分數）→ 每回合 3 箭 → 發動 → processRound。
// 怪以「距離」呈現深度：距離大＝上方且較小，距離小＝下方且較大；歸零攻擊。
// 純呈現層：所有規則走 domain/expeditionFlow，本檔只畫狀態 + 收集射擊。
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { createExpeditionState, processRound, aliveTargets } from "../domain/expeditionFlow";

const ARROWS_PER_ROUND = 3;
const SCORE_BUTTONS = [
  { label: "X", score: 11, color: "#fbbf24" },
  { label: "10", score: 10, color: "#ef4444" },
  { label: "9", score: 9, color: "#ef4444" },
  { label: "8", score: 8, color: "#3b82f6" },
  { label: "7", score: 7, color: "#3b82f6" },
  { label: "6", score: 6, color: "#64748b" },
  { label: "M", score: 0, color: "#334155" },
];
const MAX_DIST = 6;

function Bar({ cur, max, color = "#ef4444", h = 5 }) {
  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  return (
    <div style={{ height: h, width: "100%", background: "rgba(0,0,0,.4)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width .3s" }} />
    </div>
  );
}

export default function GuildBattle({ expedition, guildStats, supplies, cats = [], onEnd }) {
  const [state, setState] = useState(() => createExpeditionState(expedition, guildStats, supplies, cats));
  const [target, setTarget] = useState(null);
  const [shots, setShots] = useState([]);
  const [flash, setFlash] = useState(null); // 上一回合摘要

  const targets = aliveTargets(state);

  const shoot = score => {
    if (!target || shots.length >= ARROWS_PER_ROUND || state.status !== "fighting") return;
    if (!targets.find(t => t.instanceId === target)) return;
    setShots(s => [...s, { targetInstanceId: target, score }]);
  };

  const fireRound = () => {
    if (state.status !== "fighting") return;
    const next = processRound(state, shots, {});
    const kills = next.log.filter(l => (l.type === "arrow" || l.type === "catAttack") && l.killed).length;
    const catHit = next.log.some(l => l.type === "catAttack");
    const hit = next.log.find(l => l.type === "monsterAttack");
    setFlash(
      next.status === "won" ? "🎉 討伐成功，凱旋歸來！"
      : next.status === "lost" ? `💀 ${next.lostReason}`
      : `本回合擊殺 ${kills} 隻${catHit ? "（貓貓助攻）" : ""}${hit ? "，你受到攻擊！" : ""}`
    );
    setShots([]);
    setTarget(null);
    setState(next);
    if (next.status !== "fighting") setTimeout(() => onEnd && onEnd(next), 50);
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#0a1a0a,#05100a)", color: "#e2e8f0" }}>
      {/* 頂列：回合 + 玩家狀態 */}
      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,.35)" }}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>第 {state.round} 回合 · 第 {state.waveIndex + 1}/{state.expedition.totalWaves} 波</div>
        <div style={{ fontSize: 11, display: "flex", gap: 10 }}>
          <span>🍖 {state.supplies.food}</span>
          <span>💧 {state.supplies.water}</span>
        </div>
      </div>
      <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.25)" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5", minWidth: 64 }}>❤️ {state.hp}/{state.maxHp}</span>
        <div style={{ flex: 1 }}><Bar cur={state.hp} max={state.maxHp} color="#22c55e" h={7} /></div>
      </div>

      {/* 2.5D 戰場 */}
      <div style={{ position: "relative", flex: 1, minHeight: 340, overflow: "hidden",
        backgroundImage: "repeating-linear-gradient(60deg,rgba(255,255,255,.03) 0 2px,transparent 2px 40px),repeating-linear-gradient(-60deg,rgba(255,255,255,.03) 0 2px,transparent 2px 40px)" }}>
        {targets.map((m, i) => {
          const depth = Math.max(0, Math.min(MAX_DIST, m.distance)) / MAX_DIST; // 1=遠 0=近
          const topPct = 8 + depth * 55;
          const leftPct = targets.length === 1 ? 50 : 12 + (i / (targets.length - 1)) * 76;
          const scale = 0.75 + (1 - depth) * 0.55;
          const isSel = target === m.instanceId;
          return (
            <button key={m.instanceId} type="button" onClick={() => setTarget(m.instanceId)}
              style={{ position: "absolute", top: `${topPct}%`, left: `${leftPct}%`, transform: `translate(-50%,-50%) scale(${scale})`,
                background: "none", border: "none", cursor: "pointer", textAlign: "center", zIndex: Math.round(topPct) }}>
              <div style={{ fontSize: 40, filter: isSel ? "drop-shadow(0 0 6px #f59e0b)" : "none" }}>{m.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#fca5a5", whiteSpace: "nowrap" }}>Lv? {m.name}</div>
              <div style={{ width: 54, margin: "1px auto" }}><Bar cur={m.hp} max={m.maxHp} /></div>
              <div style={{ fontSize: 9, fontWeight: 900, color: m.distance <= 1 ? "#ef4444" : "#fcd34d" }}>
                {m.distance <= 0 ? "⚔️攻擊!" : `距離 ${m.distance}`}
              </div>
              {isSel && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 900 }}>▲鎖定</div>}
            </button>
          );
        })}
        {/* 玩家 + 貓（近端） */}
        <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 14, alignItems: "flex-end" }}>
          <div style={{ fontSize: 30 }}>🐱</div>
          <div style={{ fontSize: 46 }}>🏹</div>
          <div style={{ fontSize: 30 }}>🐱</div>
        </div>
        {flash && <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,.7)", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{flash}</div>}
      </div>

      {/* 操作區 */}
      <div style={{ padding: "10px 12px", background: "rgba(0,0,0,.5)", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
          {state.status !== "fighting" ? "戰鬥結束" : target ? `已鎖定目標 · 已射 ${shots.length}/${ARROWS_PER_ROUND} 箭` : "點怪物選擇目標，再點分數射箭"}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
          {SCORE_BUTTONS.map(b => (
            <button key={b.label} type="button" onClick={() => shoot(b.score)}
              disabled={!target || shots.length >= ARROWS_PER_ROUND || state.status !== "fighting"}
              style={{ flex: 1, minWidth: 40, padding: "8px 0", borderRadius: 8, fontWeight: 900, color: "#fff", border: "none",
                background: b.color, opacity: (!target || shots.length >= ARROWS_PER_ROUND) ? 0.4 : 1, cursor: "pointer" }}>
              {b.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={fireRound} disabled={state.status !== "fighting"}
          style={{ width: "100%", padding: "11px 0", borderRadius: 10, fontWeight: 900, fontSize: 14, color: "#fff", border: "none",
            background: "linear-gradient(135deg,#f59e0b,#b45309)", opacity: state.status !== "fighting" ? 0.5 : 1, cursor: "pointer" }}>
          {shots.length > 0 ? `發動回合（${shots.length} 箭）` : "跳過此回合"}
        </button>
      </div>
    </div>
  );
}
