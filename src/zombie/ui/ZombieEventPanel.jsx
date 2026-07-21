// src/zombie/ui/ZombieEventPanel.jsx
// ═══════════════════════════════════════════════════════════════
//  🎲 殭屍生存 — 隨機事件與撤離面板（玻璃主題版）
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback } from "react";
import { generateRandomEvent, EVENT_DEFINITIONS, EXTRACTION_METHODS, checkExtractionRequirements } from "../domain/eventEngine";
import { ZONE_TYPE } from "../domain/types";
import { COLORS, SHADOWS, ANIM, RADIUS, glassCard, sectionTitle } from "./theme";

const ZONE_OPTIONS = [
  { value: ZONE_TYPE.NORMAL, label: "🟡 普通區" },
  { value: ZONE_TYPE.DANGER, label: "🟠 危險區" },
  { value: ZONE_TYPE.HIGH_RISK, label: "🔴 高危區" },
  { value: ZONE_TYPE.RESTRICTED, label: "⚫ 禁區" },
];

function btnStyle(variant) {
  const base = {
    padding: "6px 14px", borderRadius: RADIUS.md,
    fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    cursor: "pointer", transition: `all ${ANIM.fast}`,
  };
  if (variant === "primary") {
    return {
      ...base, background: COLORS.gradientPrimary, border: "none", color: COLORS.textBright,
      boxShadow: SHADOWS.glow(),
    };
  }
  return {
    ...base, background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`,
    color: COLORS.text,
  };
}

export default function ZombieEventPanel() {
  const [zoneType, setZoneType] = useState(ZONE_TYPE.DANGER);
  const [lastEvent, setLastEvent] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const [intel, setIntel] = useState(50);

  const handleGenerateEvent = useCallback(() => {
    const result = generateRandomEvent(zoneType, { intelAccuracy: intel });
    if (!result.event) {
      setEventLog(l => [...l, { text: "❌ 此區域無可用事件", time: Date.now(), color: COLORS.red }]);
      return;
    }
    setLastEvent(result);
    setEventLog(l => [...l, {
      text: `🎲 ${result.event.icon} ${result.event.title}: ${result.outcome?.text || "?"}`,
      time: Date.now(), color: result.event.color,
    }]);
  }, [zoneType, intel]);

  const handleExtractionTest = useCallback((method) => {
    const supplies = { supply_fuel: 1, supply_flare: 1 };
    const state = { npcQuestCompleted: true };
    const check = checkExtractionRequirements(method.type, supplies, state);
    setEventLog(l => [...l, {
      text: `🚁 ${method.icon} ${method.name}: ${check.canExtract ? "✅ 條件滿足" : `❌ 缺少: ${check.missingRequirements.join(", ")}`}`,
      time: Date.now(), color: check.canExtract ? COLORS.green : COLORS.red,
    }]);
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 16 }}>
        🎲 隨機事件與撤離
      </h2>

      {/* 控制列 */}
      <div style={glassCard({
        padding: "14px 16px", marginBottom: 12,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      })}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>🎲 事件生成</span>
        <select value={zoneType} onChange={e => setZoneType(e.target.value)}
          style={{
            padding: "5px 10px", borderRadius: RADIUS.sm,
            fontSize: 11, fontWeight: 600,
            background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`,
            color: COLORS.text, cursor: "pointer",
          }}
        >
          {ZONE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: COLORS.textDim }}>情報率:</span>
          <input type="range" min={0} max={100} value={intel}
            onChange={e => setIntel(parseInt(e.target.value))}
            style={{ width: 80, accentColor: COLORS.blue }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.blue }}>{intel}%</span>
        </div>
        <button onClick={handleGenerateEvent} style={btnStyle("primary")}>
          🎲 生成事件
        </button>
      </div>

      {/* 事件結果 */}
      {lastEvent && (
        <div style={{
          ...glassCard({ padding: "14px 16px", marginBottom: 12 }),
          borderLeft: `3px solid ${lastEvent.event.color}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{lastEvent.event.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: lastEvent.event.color }}>
                {lastEvent.event.title}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim }}>{lastEvent.event.desc}</div>
            </div>
          </div>
          <div style={{
            padding: "8px 12px", borderRadius: RADIUS.sm,
            background: "rgba(0,0,0,0.25)",
            fontSize: 12, fontWeight: 600, color: COLORS.text,
          }}>
            🎯 結果: {lastEvent.outcome?.text || "?"}
          </div>
        </div>
      )}

      {/* 事件類型一覽 */}
      <div style={glassCard({ padding: "14px 16px", marginBottom: 12 })}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>
          📋 6 類隨機事件
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.values(EVENT_DEFINITIONS).map(evt => (
            <div key={evt.type} style={{
              padding: "8px 10px", borderRadius: RADIUS.md,
              background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{evt.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: evt.color }}>{evt.title}</span>
              </div>
              <div style={{ fontSize: 9, color: COLORS.textMuted, lineHeight: 1.5 }}>
                {evt.outcomes.length} 結果 · {evt.zones.length} 區 · 權重 {evt.weight}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 撤離方式 */}
      <div style={glassCard({ padding: "14px 16px", marginBottom: 12 })}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>🚁 5 種撤離方式</span>
          <button onClick={() => setEventLog([])} style={{
            padding: "3px 8px", borderRadius: 4, fontSize: 9,
            background: COLORS.glass, border: "none", color: COLORS.textMuted, cursor: "pointer",
          }}>
            清除日誌
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {EXTRACTION_METHODS.map(method => (
            <div key={method.type} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: RADIUS.md,
              background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{method.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: method.color }}>{method.name}</div>
                  <div style={{ fontSize: 9, color: COLORS.textMuted }}>{method.desc}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 4,
                  background: COLORS.glass,
                  color: method.rewardPct >= 1 ? COLORS.green : COLORS.amber,
                  fontWeight: 700,
                }}>
                  {Math.round(method.rewardPct * 100)}%
                </span>
                <button onClick={() => handleExtractionTest(method)} style={{
                  padding: "3px 8px", borderRadius: 4, fontSize: 9,
                  background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`,
                  color: COLORS.textDim, cursor: "pointer",
                }}>
                  測試
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 日誌 */}
      {eventLog.length > 0 && (
        <div style={glassCard({
          borderRadius: RADIUS.md, maxHeight: 150, overflowY: "auto",
          padding: "6px 10px", fontSize: 10, lineHeight: 1.8,
        })}>
          {eventLog.slice(-15).reverse().map((entry, i) => (
            <div key={i} style={{ color: entry.color || COLORS.textDim }}>
              {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
