// src/zombie/ui/ZombieBasePanel.jsx
// ═══════════════════════════════════════════════════════════════
//  🏠 殭屍生存 — 基地管理 UI（玻璃主題版）
//  建築升級、材料管理、基地效果展示
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from "react";
import {
  BUILDINGS,
  getBuilding,
  getBuildingEffectDesc,
  getUpgradeCost,
} from "../data/baseData";
import {
  createBaseState,
  upgradeBuilding,
  getBaseLevel,
  getBaseStats,
  calculateBaseEffects,
  addResource,
  getBaseCompletion,
} from "../domain/baseEngine";
import { COLORS, SHADOWS, ANIM, RADIUS, glassCard, sectionTitle } from "./theme";

/** 材料顏色對照 */
const MATERIAL_COLORS = {
  ore: "#9ca3af", melon: "#4ade80", fish: "#60a5fa", meat: "#f87171",
  driedfish: "#fbbf24", can: "#f472b6", potion: "#a78bfa",
  fur: "#d4a574", archer: "#22d3ee",
};

/** 材料圖示 */
const MATERIAL_ICONS = {
  ore: "⛏️", melon: "🍈", fish: "🐟", meat: "🥩",
  driedfish: "🐠", can: "🥫", potion: "🧪",
  fur: "🪶", archer: "🏹",
};

/** 材料中文名 */
const MATERIAL_NAMES = {
  ore: "礦物", melon: "瓜瓜", fish: "鮮魚", meat: "動物肉",
  driedfish: "小魚乾", can: "貓罐頭", potion: "貓薄荷藥水",
  fur: "貓毛", archer: "貓貓射手",
};

// ── 共用按鈕 ───────────────────────────────────────────────
function btnStyle(variant) {
  const base = {
    padding: "6px 12px", borderRadius: RADIUS.md,
    fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
    cursor: "pointer", transition: `all ${ANIM.fast}`,
  };
  if (variant === "primary") {
    return {
      ...base, background: COLORS.gradientPrimary, border: "none", color: COLORS.textBright,
      boxShadow: SHADOWS.glow(),
    };
  }
  if (variant === "danger") {
    return {
      ...base, background: COLORS.gradientDanger, border: "none", color: COLORS.textBright,
    };
  }
  return {
    ...base, background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`,
    color: COLORS.text,
  };
}

// ── 等級徽章 ───────────────────────────────────────────────
function LevelBadge({ level, maxLevel, color }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: RADIUS.sm,
      background: `${color}18`, color,
      fontSize: 10, fontWeight: 700,
      border: `1px solid ${color}44`,
    }}>
      Lv.{level}/{maxLevel}
    </span>
  );
}

// ── 主元件 ──────────────────────────────────────────────────
export default function ZombieBasePanel() {
  const [baseState, setBaseState] = useState(() => createBaseState());
  const [log, setLog] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [showMaterials, setShowMaterials] = useState(false);

  const stats = useMemo(() => getBaseStats(baseState.buildings), [baseState.buildings]);
  const effects = useMemo(() => calculateBaseEffects(baseState.buildings), [baseState.buildings]);
  const completion = useMemo(() => getBaseCompletion(baseState.buildings), [baseState.buildings]);
  const baseLevel = useMemo(() => getBaseLevel(baseState.buildings), [baseState.buildings]);

  // 按分類分組建築
  const buildingGroups = useMemo(() => {
    const groups = {};
    for (const b of BUILDINGS) {
      if (!groups[b.category]) groups[b.category] = [];
      groups[b.category].push(b);
    }
    return groups;
  }, []);

  const handleUpgrade = useCallback((buildingId) => {
    const result = upgradeBuilding(baseState, buildingId);
    setBaseState(result.state);
    const now = Date.now();
    if (result.ok) {
      const ev = result.events[0];
      setLog(l => [...l, {
        type: "upgrade",
        text: `⬆️ ${getBuilding(buildingId)?.icon || ""} ${getBuilding(buildingId)?.name || buildingId} Lv.${ev.payload.fromLevel} → Lv.${ev.payload.toLevel}`,
        time: now,
        color: COLORS.green,
      }]);
    } else {
      setLog(l => [...l, {
        type: "error",
        text: `⛔ ${getBuilding(buildingId)?.name || buildingId}: ${result.reason}`,
        time: now,
        color: COLORS.amber,
      }]);
    }
  }, [baseState]);

  const handleAddResource = useCallback((resKey, amount) => {
    const newState = addResource(baseState, resKey, amount);
    setBaseState(newState);
    // Parse material info from key like "ore_t1" or "arrowdew"
    const [matId, tier] = resKey.split("_t");
    const label = tier ? `${MATERIAL_NAMES[matId] || matId} T${tier}` : matId;
    setLog(l => [...l, {
      type: "resource",
      text: `📦 獲得 ${MATERIAL_ICONS[matId] || "📦"} ${label} ×${amount}`,
      time: Date.now(),
      color: COLORS.blue,
    }]);
  }, [baseState]);

  const handleReset = useCallback(() => {
    setBaseState(createBaseState());
    setLog([{ type: "system", text: "🔄 基地已重置", time: Date.now(), color: COLORS.textDim }]);
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* 頂部狀態列 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: COLORS.text }}>
            🏠 基地管理
          </h2>
          <span style={{
            padding: "4px 12px", borderRadius: RADIUS.sm,
            background: `${COLORS.purple}18`, color: COLORS.purple,
            fontSize: 12, fontWeight: 700,
            border: `1px solid ${COLORS.purple}44`,
          }}>
            🏠 Lv.{baseLevel}/10
          </span>
          <span style={{
            padding: "3px 8px", borderRadius: RADIUS.sm,
            fontSize: 10, fontWeight: 600,
            background: `${COLORS.green}12`, color: COLORS.green,
          }}>
            {completion}% 完成度
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowMaterials(!showMaterials)} style={btnStyle("secondary")}>
            📦 材料庫 {showMaterials ? "▲" : "▼"}
          </button>
          <button onClick={handleReset} style={btnStyle("secondary")}>
            🔄 重置
          </button>
        </div>
      </div>

      {/* 基地效果列 */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap",
        fontSize: 10, fontWeight: 600,
      }}>
        {[
          { icon: "🍖", label: `食物 -${Math.round(effects.foodSaving * 10) / 10}`, color: COLORS.green },
          { icon: "💧", label: `飲水 -${Math.round(effects.waterSaving * 10) / 10}`, color: COLORS.blue },
          { icon: "🧠", label: `情報 +${effects.intelBonus}%`, color: COLORS.blue },
          { icon: "🛡️", label: `修復 -${Math.round(effects.repairDiscount * 100)}%`, color: COLORS.purple },
          { icon: "💀", label: `找回 ${effects.recoveryRate}%`, color: COLORS.red },
          { icon: "🔗", label: `配件 ${stats.accessorySlots} 槽`, color: COLORS.amber },
          { icon: "🎒", label: `背包 +${stats.backpackBonus}kg`, color: COLORS.amber },
          { icon: "🗺️", label: `揭示 Lv.${effects.revealDepth}`, color: COLORS.green },
          { icon: "⚙️", label: `配件T${effects.maxAccessoryLevel}`, color: COLORS.pink },
        ].map((item, i) => (
          <span key={i} style={{
            padding: "3px 8px", borderRadius: RADIUS.sm,
            background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`,
            color: item.color,
          }}>
            {item.icon} {item.label}
          </span>
        ))}
      </div>

      {/* 材料庫面板 */}
      {showMaterials && (
        <div style={glassCard({ padding: "12px 14px", marginBottom: 12 })}>
          <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 8 }}>
            📦 材料庫
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 4, marginBottom: 8,
          }}>
            {/* 箭露 */}
            <div style={{
              padding: "4px 8px", borderRadius: RADIUS.sm,
              background: COLORS.glass, fontSize: 10,
              display: "flex", justifyContent: "space-between",
              color: COLORS.text,
            }}>
              <span>💎 箭露</span>
              <span style={{ fontWeight: 700, color: COLORS.amber }}>
                {baseState.resources.arrowdew}
              </span>
            </div>
            {/* 9 種材料 × T1-3 */}
            {["ore","melon","fish","meat","driedfish","can","potion","fur","archer"].map(matId => {
              const color = MATERIAL_COLORS[matId] || COLORS.textDim;
              const icon = MATERIAL_ICONS[matId] || "📦";
              return [1, 2, 3].map(tier => {
                const key = `${matId}_t${tier}`;
                const count = baseState.resources[key] || 0;
                return (
                  <div key={key} style={{
                    padding: "3px 6px", borderRadius: 4,
                    background: COLORS.glass, fontSize: 9,
                    display: "flex", justifyContent: "space-between",
                    color: count > 0 ? color : COLORS.textMuted,
                    opacity: count > 0 ? 1 : 0.4,
                  }}>
                    <span>{icon} {MATERIAL_NAMES[matId]} T{tier}</span>
                    <span style={{ fontWeight: 700 }}>{count}</span>
                  </div>
                );
              });
            })}
          </div>
          {/* 調試：增加資源 */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => handleAddResource("arrowdew", 500)} style={btnStyle("secondary")}>
              💎 +500
            </button>
            {["ore_t1","melon_t1","fish_t1","meat_t1"].map(key => (
              <button key={key} onClick={() => handleAddResource(key, 30)} style={btnStyle("secondary")}>
                📦 +{key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 建築群 */}
      {Object.entries(buildingGroups).map(([category, buildings]) => (
        <div key={category} style={{ marginBottom: 12 }}>
          <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 6, marginLeft: 4 }}>
            {category === "supply" ? "🌾 補給" : category === "logistics" ? "🚚 後勤" :
             category === "medical" ? "🏥 醫療" : category === "crafting" ? "🔧 製作" :
             category === "repair" ? "🛡️ 修復" : category === "intel" ? "📡 情報" :
             category === "recovery" ? "🚁 救援" : "📦 其他"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {buildings.map(b => {
              const level = baseState.buildings[b.id] || 1;
              const cost = getUpgradeCost(b.id, level + 1);
              const canUpgrade = level < b.maxLevel;
              const isSelected = selectedBuilding === b.id;
              const effectDesc = getBuildingEffectDesc(b.id, level);

              return (
                <div key={b.id}
                  style={glassCard({
                    padding: "12px 14px",
                    borderLeft: `3px solid ${b.color}`,
                    cursor: "pointer",
                  })}
                  onMouseOver={e => e.currentTarget.style.background = COLORS.glassHover}
                  onMouseOut={e => e.currentTarget.style.background = COLORS.glass}
                  onClick={() => setSelectedBuilding(isSelected ? null : b.id)}
                >
                  {/* 頭部 */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 6,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 18 }}>{b.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>
                        {b.name}
                      </span>
                    </div>
                    <LevelBadge level={level} maxLevel={b.maxLevel} color={canUpgrade ? b.color : COLORS.textDim} />
                  </div>

                  {/* 描述 */}
                  <div style={{
                    fontSize: 10, color: COLORS.textDim, lineHeight: 1.4, marginBottom: 6,
                  }}>
                    {b.desc}
                  </div>

                  {/* 效果 */}
                  <div style={{
                    fontSize: 10, fontWeight: 600, color: b.color,
                    marginBottom: canUpgrade ? 8 : 0,
                  }}>
                    {effectDesc}
                  </div>

                  {/* 升級區塊 */}
                  {isSelected && canUpgrade && (
                    <div style={{
                      marginTop: 8, paddingTop: 8,
                      borderTop: `1px solid ${COLORS.glassBorder}`,
                    }}>
                      {/* 費用 */}
                      {cost && (
                        <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 700, color: COLORS.amber }}>
                            💎 {cost.arrowdew}
                          </span>
                          {cost.materials.map(mat => {
                            const key = `${mat.id}_t${mat.tier}`;
                            const have = baseState.resources[key] || 0;
                            const enough = have >= mat.count;
                            return (
                              <span key={key} style={{ marginLeft: 8, color: enough ? COLORS.textDim : COLORS.red }}>
                                {MATERIAL_ICONS[mat.id] || "📦"} {MATERIAL_NAMES[mat.id] || mat.id} ×{mat.count}
                              </span>
                            );
                          })}
                          <span style={{ marginLeft: 8 }}>
                            → Lv.{level + 1}
                          </span>
                        </div>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleUpgrade(b.id); }}
                        style={btnStyle("primary")}
                      >
                        ⬆️ 升級
                      </button>
                    </div>
                  )}

                  {/* 已達最高等級 */}
                  {isSelected && !canUpgrade && (
                    <div style={{
                      marginTop: 4, fontSize: 10, color: COLORS.textMuted,
                      textAlign: "center", padding: "4px 0",
                    }}>
                      ✅ 已達最高等級
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* 日誌 */}
      {log.length > 0 && (
        <div style={glassCard({
          borderRadius: RADIUS.md, maxHeight: 150, overflowY: "auto",
          padding: "8px 12px", fontSize: 10, lineHeight: 1.8,
          marginTop: 12,
        })}>
          <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 4 }}>
            📜 基地日誌
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
