// src/zombie/ui/ZombieBackpackPanel.jsx
// ═══════════════════════════════════════════════════════════════
//  🎒 殭屍生存 — 背包/補給管理 UI（玻璃主題版）
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { calculateBackpackWeight, isOverweight, createBackpack, getArrowInfo, consumeNodeSupplies, addItem } from "../domain/backpackEngine";
import { INITIAL_BACKPACK_CAPACITY } from "../domain/types";
import { COLORS, SHADOWS, ANIM, RADIUS, glassCard, sectionTitle } from "./theme";

const ITEM_META = {
  supply_food: { icon: "🍖", name: "食物", color: "#f59e0b", cat: "補給" },
  supply_water: { icon: "💧", name: "飲水", color: "#60a5fa", cat: "補給" },
  supply_medical_kit: { icon: "🩹", name: "醫療包", color: "#34d399", cat: "補給" },
  supply_map: { icon: "🗺️", name: "地圖", color: "#a855f7", cat: "工具" },
  supply_tool_kit: { icon: "🔧", name: "工具組", color: "#6b7280", cat: "工具" },
  supply_lockpick: { icon: "🗝️", name: "開鎖工具", color: "#fbbf24", cat: "工具" },
  supply_flare: { icon: "🎆", name: "信號彈", color: "#ef4444", cat: "工具" },
  supply_battery: { icon: "🔋", name: "電池組", color: "#22c55e", cat: "工具" },
  supply_fuel: { icon: "⛽", name: "燃料罐", color: "#f97316", cat: "工具" },
  med_immunization: { icon: "💉", name: "免疫針", color: "#34d399", cat: "醫療" },
  med_suppressant: { icon: "💊", name: "抑制劑", color: "#60a5fa", cat: "醫療" },
  med_strong_suppressant: { icon: "💊", name: "強效抑制劑", color: "#a855f7", cat: "醫療" },
  med_experimental_serum: { icon: "🧪", name: "實驗血清", color: "#f59e0b", cat: "醫療" },
};

// ── 共用按鈕 ───────────────────────────────────────────────
function btnStyle(variant) {
  const base = {
    padding: "7px 14px", borderRadius: RADIUS.md,
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

export default function ZombieBackpackPanel() {
  const [inventory, setInventory] = useState(null);
  const [capacity] = useState(INITIAL_BACKPACK_CAPACITY);
  const [log, setLog] = useState([]);

  const weightInfo = useMemo(() => inventory ? calculateBackpackWeight(inventory) : null, [inventory]);
  const overInfo = useMemo(() => weightInfo ? isOverweight(weightInfo.totalWeight, capacity) : null, [weightInfo, capacity]);
  const arrowInfo = useMemo(() => inventory ? getArrowInfo(inventory) : null, [inventory]);

  const itemGroups = useMemo(() => {
    if (!inventory) return { supplies: [], medical: [], tools: [] };
    const groups = { supplies: [], medical: [], tools: [] };
    const allItems = { ...inventory.supplies, ...inventory.medical };
    for (const [id, qty] of Object.entries(allItems)) {
      if (qty <= 0) continue;
      const meta = ITEM_META[id] || { icon: "📦", name: id, color: COLORS.textDim, cat: "其他" };
      const group = meta.cat === "醫療" ? "medical" : meta.cat === "工具" ? "tools" : "supplies";
      groups[group].push({ id, qty, ...meta });
    }
    return groups;
  }, [inventory]);

  const handleStart = () => {
    const bp = createBackpack({ food: 4, water: 4, normalArrows: 30 });
    setInventory(bp);
    setLog([{ type: "system", text: "🎒 背包初始化（食物×4、飲水×4、普通箭×30）", time: Date.now() }]);
  };

  const handleConsumeNode = () => {
    if (!inventory) return;
    const result = consumeNodeSupplies(inventory, { hasFought: false });
    setInventory(result.inventory);
    const newLog = [...log];
    if (result.foodShortage) newLog.push({ type: "warning", text: "⚠️ 食物短缺！箭數降為 2", time: Date.now() });
    if (result.waterShortage) newLog.push({ type: "warning", text: "⚠️ 飲水短缺！箭數降為 2", time: Date.now() });
    if (!result.foodShortage && !result.waterShortage) newLog.push({ type: "consume", text: "✅ 消耗補給通過節點", time: Date.now() });
    setLog(newLog);
  };

  const handleAddItem = (itemId, qty = 1) => {
    if (!inventory) return;
    const result = addItem(inventory, itemId, qty);
    setInventory(result.inventory);
    const meta = ITEM_META[itemId] || { icon: "📦", name: itemId };
    setLog(l => [...l, { type: "add", text: `📦 獲得 ${meta.icon} ×${qty}`, time: Date.now() }]);
  };

  const handleReset = () => { setInventory(null); setLog([]); };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* 頂部 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, flexWrap: "wrap", gap: 8,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: COLORS.text }}>🎒 背包管理</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {!inventory && <button onClick={handleStart} style={btnStyle("primary")}>🎒 初始化</button>}
          {inventory && (
            <>
              <button onClick={handleConsumeNode} style={btnStyle("secondary")}>🚶 消耗節點</button>
              <button onClick={() => handleAddItem("supply_food", 1)} style={btnStyle("secondary")}>+🍖</button>
              <button onClick={() => handleAddItem("supply_water", 1)} style={btnStyle("secondary")}>+💧</button>
              <button onClick={handleReset} style={btnStyle("secondary")}>🔄</button>
            </>
          )}
        </div>
      </div>

      {inventory ? (
        <>
          {/* 重量條 */}
          <div style={glassCard({ padding: "12px 14px", marginBottom: 10 })}>
            <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 6 }}>
              背包重量
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                flex: 1, height: 8, borderRadius: 4,
                background: COLORS.glass, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  width: `${Math.min(100, (weightInfo.totalWeight / capacity) * 100)}%`,
                  background: overInfo.overweight
                    ? `linear-gradient(90deg, ${COLORS.amber}, ${COLORS.red})`
                    : `linear-gradient(90deg, ${COLORS.green}, ${COLORS.blue})`,
                  transition: `width ${ANIM.slow}`,
                  boxShadow: SHADOWS.glow(overInfo.overweight ? COLORS.redGlow : COLORS.blueGlow),
                }} />
              </div>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: overInfo.overweight ? COLORS.red : COLORS.text,
                whiteSpace: "nowrap",
              }}>
                {weightInfo.totalWeight} / {capacity} kg
              </span>
            </div>
            {overInfo.overweight && (
              <div style={{ fontSize: 10, color: COLORS.red, marginTop: 4, fontWeight: 600 }}>
                ⚠️ 超重 {overInfo.overBy}kg — 移動消耗加倍
              </div>
            )}
            {/* 重量明細 */}
            <div style={{
              display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap",
              fontSize: 9, color: COLORS.textMuted,
            }}>
              {Object.entries(weightInfo.details).map(([key, val]) => (
                <span key={key} style={{
                  padding: "2px 6px", borderRadius: 4,
                  background: COLORS.glass,
                }}>
                  {key}: {val}kg
                </span>
              ))}
            </div>
          </div>

          {/* 箭矢資訊 */}
          <div style={glassCard({
            padding: "10px 14px", marginBottom: 10,
            display: "flex", justifyContent: "space-between",
            fontSize: 11,
          })}>
            <span>🏹 普通箭: <strong style={{ color: COLORS.text }}>{arrowInfo?.normalArrows || 0}</strong></span>
            <span>🎯 每回合: <strong style={{
              color: (arrowInfo?.maxPerRound || 3) < 3 ? COLORS.red : COLORS.green,
            }}>
              {arrowInfo?.maxPerRound || 3} 箭
            </strong></span>
            <span>⚡ 特殊箭: <strong style={{ color: COLORS.text }}>
              {Object.values(arrowInfo?.specialArrows || {}).reduce((a, b) => a + b, 0)}
            </strong></span>
          </div>

          {/* 物品分組 */}
          {Object.entries(itemGroups).filter(([, items]) => items.length > 0).map(([group, items]) => (
            <div key={group} style={glassCard({ padding: "10px 14px", marginBottom: 8 })}>
              <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 6 }}>
                {group === "supplies" ? "🎒 補給品" : group === "medical" ? "💊 醫療品" : "🔧 工具"}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {items.map(item => (
                  <span key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 8px", borderRadius: RADIUS.sm,
                    background: COLORS.glass,
                    border: `1px solid ${COLORS.glassBorder}`,
                    fontSize: 10, fontWeight: 600,
                    color: item.color,
                    transition: `all ${ANIM.fast}`,
                  }}>
                    {item.icon} {item.name} <span style={{ color: COLORS.textMuted, fontWeight: 700 }}>×{item.qty}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div style={{
          ...glassCard({ padding: "50px 20px", textAlign: "center" }),
          borderStyle: "dashed",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🎒</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textDim, marginBottom: 6 }}>
            按下「初始化」建立背包
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {INITIAL_BACKPACK_CAPACITY}kg 容量 · 補給消耗 · 超重系統
          </div>
        </div>
      )}

      {/* 日誌 */}
      {log.length > 0 && (
        <div style={glassCard({
          borderRadius: RADIUS.md, maxHeight: 120, overflowY: "auto",
          padding: "8px 12px", fontSize: 10, lineHeight: 1.8,
          marginTop: 8,
        })}>
          <div style={{ ...sectionTitle(), color: COLORS.textMuted, marginBottom: 4 }}>
            📜 背包日誌
          </div>
          {log.slice(-10).reverse().map((entry, i) => (
            <div key={i} style={{
              color: entry.type === "warning" ? COLORS.amber :
                     entry.type === "add" ? COLORS.green : COLORS.textDim,
            }}>
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
