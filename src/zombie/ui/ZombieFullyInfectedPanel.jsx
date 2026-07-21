// src/zombie/ui/ZombieFullyInfectedPanel.jsx
// ═══════════════════════════════════════════════════════════════
//  ☠️ 殭屍生存 — 完全感染弱點標記測試 UI（玻璃主題版）
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from "react";
import {
  createFullyInfectedSupport,
  applyWeakPointMark,
  processMarkDurations,
  useInterference,
  addInterferenceScore,
  getMarkedZombies,
  getDamageBoost,
  getHalvedThreshold,
  MARK_DEFAULT_DURATION,
  MARK_DEFAULT_BOOST,
} from "../domain/fullyInfectedSupportEngine";
import { COLORS, SHADOWS, ANIM, RADIUS, glassCard, sectionTitle } from "./theme";

function btnStyle(variant) {
  const base = {
    padding: "6px 12px", borderRadius: RADIUS.md,
    fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
    cursor: "pointer", transition: `all ${ANIM.fast}`,
  };
  if (variant === "primary") {
    return { ...base, background: COLORS.gradientPrimary, border: "none", color: COLORS.textBright, boxShadow: SHADOWS.glow() };
  }
  if (variant === "danger") {
    return { ...base, background: COLORS.gradientDanger, border: "none", color: COLORS.textBright };
  }
  return { ...base, background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`, color: COLORS.text };
}

export default function ZombieFullyInfectedPanel() {
  const [supportState, setSupportState] = useState(() => createFullyInfectedSupport());
  const [log, setLog] = useState([]);
  const [selectedZombie, setSelectedZombie] = useState("zombie_A");

  // 模擬的殭屍清單
  const mockZombies = [
    { id: "zombie_A", name: "普通殭屍 A", icon: "🧟" },
    { id: "zombie_B", name: "疾行殭屍 B", icon: "💨" },
    { id: "zombie_C", name: "重裝殭屍 C", icon: "🛡️" },
    { id: "zombie_D", name: "遠程殭屍 D", icon: "🎯" },
  ];

  const markedIds = useMemo(() => getMarkedZombies(supportState), [supportState]);
  const markedCount = markedIds.length;

  const handleMark = useCallback((hitPart) => {
    const result = applyWeakPointMark(supportState, selectedZombie, hitPart);
    setSupportState(result.state);
    const now = Date.now();
    setLog(l => [...l, {
      type: result.events[0]?.type || "mark",
      text: `🎯 弱點標記 → ${getZombieName(selectedZombie)} (${hitPart}, +${Math.round(MARK_DEFAULT_BOOST * 100)}% R${MARK_DEFAULT_DURATION})`,
      time: now, color: COLORS.amber,
    }]);
  }, [supportState, selectedZombie]);

  const handleAdvanceRound = useCallback(() => {
    const result = processMarkDurations(supportState);
    setSupportState(result.state);
    const now = Date.now();
    for (const evt of result.events) {
      setLog(l => [...l, {
        type: evt.type,
        text: evt.type.includes("expired")
          ? `⏳ 標記消失: ${getZombieName(evt.payload?.zombieId || "")}`
          : `⏹️ 回合推進 — 標記持續時間更新`,
        time: now, color: COLORS.textDim,
      }]);
    }
  }, [supportState]);

  const handleInterference = useCallback(() => {
    const result = useInterference(supportState, selectedZombie);
    setSupportState(result.state);
    const now = Date.now();
    const text = result.success
      ? `⚡ 干擾成功 → ${getZombieName(selectedZombie)}！剩餘 ${result.state?.interferenceUses || 0} 次`
      : `⛔ 干擾失敗: ${result.events[0]?.payload?.reason || "?"}`;
    setLog(l => [...l, {
      type: "interference", text, time: now,
      color: result.success ? COLORS.purple : COLORS.red,
    }]);
  }, [supportState, selectedZombie]);

  const handleAddScore = useCallback(() => {
    const result = addInterferenceScore(supportState);
    setSupportState(result.state);
    setLog(l => [...l, {
      type: "score",
      text: `🏹 命中 +1 分 (累計 ${result.state?.interferenceScore || 0})`,
      time: Date.now(), color: COLORS.green,
    }]);
  }, [supportState]);

  const handleReset = useCallback(() => {
    setSupportState(createFullyInfectedSupport());
    setLog([{ type: "system", text: "🔄 支援狀態已重置", time: Date.now(), color: COLORS.textDim }]);
  }, []);

  const halvedThreshold = getHalvedThreshold({ head: 1, torso: 3 });

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      {/* 頂部 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, flexWrap: "wrap", gap: 8,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: COLORS.text }}>
          ☠️ 完全感染支援
        </h2>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleReset} style={btnStyle("secondary")}>🔄 重置</button>
        </div>
      </div>

      {/* 狀態面板 */}
      <div style={glassCard({
        padding: "14px 16px", marginBottom: 12,
        borderLeft: `3px solid ${COLORS.red}`,
        background: `${COLORS.red}06`,
      })}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 24 }}>☠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.red }}>
              完全感染 — 殘存意識輔助角色
            </div>
            <div style={{ fontSize: 10, color: COLORS.textDim }}>
              無法射擊 · 部位效果減半 · 弱點標記 · 干擾能力
            </div>
          </div>
        </div>

        {/* 狀態列 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <StatChip icon="🎯" label="標記" value={`${markedCount}/${getMaxMarks()}`} color={COLORS.amber} />
          <StatChip icon="⚡" label="干擾" value={`${supportState.interferenceUses}`} color={COLORS.purple} />
          <StatChip icon="📊" label="分數" value={`${supportState.interferenceScore}`} color={COLORS.green} />
          <StatChip icon="❄️" label="冷卻" value={supportState.interferenceCooldown > 0 ? `${supportState.interferenceCooldown}R` : "就緒"} color={supportState.interferenceCooldown > 0 ? COLORS.red : COLORS.green} />
        </div>

        {/* 弱點標記清單 */}
        {markedCount > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 4 }}>
              🎯 當前標記
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {markedIds.map(id => {
                const mark = supportState.markedZombies[id];
                const boost = getDamageBoost(supportState, id);
                return (
                  <span key={id} style={{
                    padding: "3px 8px", borderRadius: RADIUS.sm,
                    background: `${COLORS.amber}14`,
                    border: `1px solid ${COLORS.amber}33`,
                    fontSize: 10, fontWeight: 600,
                    color: COLORS.amber,
                  }}>
                    {getZombieName(id)} +{Math.round((boost - 1) * 100)}% R{mark.duration}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 效果減半說明 */}
      <div style={glassCard({ padding: "10px 14px", marginBottom: 12 })}>
        <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 6 }}>
          🛡️ 完全感染者部位效果減半
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 10, flexWrap: "wrap" }}>
          <span style={{ padding: "3px 8px", borderRadius: RADIUS.sm, background: COLORS.glass, color: COLORS.textDim }}>
            頭部: 需 {halvedThreshold.head} 箭（原 1 箭）
          </span>
          <span style={{ padding: "3px 8px", borderRadius: RADIUS.sm, background: COLORS.glass, color: COLORS.textDim }}>
            軀幹: 需 {halvedThreshold.torso} 箭（原 3 箭）
          </span>
        </div>
      </div>

      {/* 控制區 */}
      <div style={glassCard({ padding: "14px 16px", marginBottom: 12 })}>
        <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 8 }}>
          🎮 模擬操作
        </div>

        {/* 選擇目標 */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: COLORS.textDim, padding: "4px 0" }}>選擇殭屍:</span>
          {mockZombies.map(z => (
            <button key={z.id} onClick={() => setSelectedZombie(z.id)}
              style={{
                padding: "4px 10px", borderRadius: RADIUS.sm,
                fontSize: 10, fontWeight: 600,
                background: selectedZombie === z.id ? `${COLORS.amber}18` : COLORS.glass,
                border: `1px solid ${selectedZombie === z.id ? `${COLORS.amber}44` : COLORS.glassBorder}`,
                color: selectedZombie === z.id ? COLORS.amber : COLORS.textDim,
                cursor: "pointer",
                transition: `all ${ANIM.fast}`,
              }}
            >
              {z.icon} {z.name}
            </button>
          ))}
        </div>

        {/* 操作按鈕 */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => handleMark("chest")} style={btnStyle("primary")}>
            🎯 標記（胸腔）
          </button>
          <button onClick={() => handleMark("head")} style={btnStyle("primary")}>
            🎯 標記（頭部）
          </button>
          <button onClick={() => handleMark("groin")} style={btnStyle("primary")}>
            🎯 標記（鼠蹊）
          </button>
          <button onClick={handleAddScore} style={btnStyle("secondary")}>
            🏹 +1 命中分數
          </button>
          <button onClick={handleAdvanceRound} style={btnStyle("secondary")}>
            ⏹️ 推進回合
          </button>
          <button onClick={handleInterference} disabled={supportState.interferenceUses <= 0}
            style={{
              ...btnStyle("danger"),
              opacity: supportState.interferenceUses <= 0 ? 0.35 : 1,
            }}
          >
            ⚡ 干擾（{supportState.interferenceUses}次）
          </button>
        </div>
      </div>

      {/* 日誌 */}
      {log.length > 0 && (
        <div style={glassCard({
          borderRadius: RADIUS.md, maxHeight: 180, overflowY: "auto",
          padding: "8px 12px", fontSize: 10, lineHeight: 1.8,
        })}>
          <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 4 }}>
            📜 支援日誌
          </div>
          {log.slice(-20).reverse().map((entry, i) => (
            <div key={i} style={{ color: entry.color || COLORS.textDim }}>
              <span style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
                [{new Date(entry.time).toLocaleTimeString()}]
              </span> {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatChip({ icon, label, value, color }) {
  return (
    <div style={{
      padding: "4px 10px", borderRadius: RADIUS.sm,
      background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`,
      fontSize: 10, fontWeight: 600,
      display: "flex", alignItems: "center", gap: 4,
    }}>
      <span>{icon}</span>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function getZombieName(id) {
  const names = {
    zombie_A: "普通殭屍 A",
    zombie_B: "疾行殭屍 B",
    zombie_C: "重裝殭屍 C",
    zombie_D: "遠程殭屍 D",
  };
  return names[id] || id;
}

function getMaxMarks() { return 3; }
