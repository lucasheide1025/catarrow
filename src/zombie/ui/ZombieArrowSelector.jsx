// src/zombie/ui/ZombieArrowSelector.jsx
// ═══════════════════════════════════════════════════════════════
//  🏹 特殊箭矢選擇器 — 玻璃主題版
//  在射擊階段切換箭矢類型，顯示攜帶量限制與效果說明
// ═══════════════════════════════════════════════════════════════

import { SPECIAL_ARROWS } from "../data/itemData";
import { COLORS, ANIM, RADIUS, glassCard, sectionTitle } from "./theme";

/**
 * 箭矢類型選擇器
 * @param {object} props
 * @param {string} props.selected — 當前選中的箭矢類型 ID
 * @param {function} props.onSelect — (arrowTypeId) => void
 * @param {Object<string, number>} props.ammo — 各特殊箭的剩餘數量
 * @param {number} props.normalArrows — 普通箭剩餘數量
 * @param {boolean} props.disabled — 是否禁用
 */
export default function ZombieArrowSelector({
  selected = "normal",
  onSelect,
  ammo = {},
  normalArrows = Infinity,
  disabled = false,
}) {
  const options = [
    {
      id: "normal",
      name: "普通箭",
      icon: "➖",
      color: COLORS.textDim,
      desc: "標準箭矢，無限供應",
      carryLimit: Infinity,
    },
    ...SPECIAL_ARROWS.map(a => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      color: a.color,
      desc: a.desc,
      carryLimit: a.carryLimit,
    })),
  ];

  return (
    <div style={{
      ...glassCard({ padding: "10px 14px" }),
      borderTop: `2px solid ${COLORS.accent}33`,
    }}>
      {/* 標題列 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10,
      }}>
        <span style={{ ...sectionTitle(), color: COLORS.textDim }}>
          🏹 箭矢選擇
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, color: COLORS.textDim,
          padding: "2px 8px", borderRadius: 6,
          background: COLORS.glass,
        }}>
          <span style={{ color: COLORS.text }}>
            {options.find(o => o.id === selected)?.name || "普通箭"}
          </span>
        </span>
      </div>

      {/* 選項網格 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        gap: 6,
      }}>
        {options.map(opt => {
          const isSelected = selected === opt.id;
          const remaining = opt.id === "normal" ? normalArrows : (ammo[opt.id] ?? opt.carryLimit);
          const outOfAmmo = opt.id !== "normal" && remaining <= 0;

          return (
            <button
              key={opt.id}
              onClick={() => !disabled && !outOfAmmo && onSelect?.(opt.id)}
              disabled={disabled || outOfAmmo}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                padding: "8px 6px",
                borderRadius: RADIUS.md,
                fontSize: 10, fontWeight: 600, lineHeight: 1.2,
                border: `1px solid ${
                  isSelected ? opt.color : outOfAmmo ? "transparent" : COLORS.glassBorder
                }`,
                background: isSelected
                  ? `${opt.color}18`
                  : outOfAmmo ? "rgba(255,255,255,0.02)"
                  : COLORS.glass,
                color: isSelected ? opt.color : outOfAmmo ? COLORS.textMuted : COLORS.textDim,
                cursor: disabled || outOfAmmo ? "not-allowed" : "pointer",
                opacity: outOfAmmo ? 0.3 : 1,
                transition: `all ${ANIM.fast}`,
                position: "relative",
              }}
              title={opt.desc}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{opt.icon}</span>
              <span>{opt.name}</span>
              {opt.id !== "normal" && (
                <span style={{
                  fontSize: 8,
                  padding: "1px 5px", borderRadius: 4,
                  background: COLORS.glass,
                  color: remaining <= 1 ? COLORS.red : COLORS.textMuted,
                  fontWeight: 700,
                }}>
                  ×{remaining}
                </span>
              )}
              {isSelected && (
                <span style={{
                  position: "absolute", top: 3, right: 3,
                  width: 6, height: 6, borderRadius: "50%",
                  background: opt.color,
                  boxShadow: `0 0 6px ${opt.color}`,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* 效果提示 */}
      {selected !== "normal" && (
        <div style={{
          marginTop: 8,
          padding: "6px 10px", borderRadius: RADIUS.sm,
          background: COLORS.glass,
          fontSize: 10, color: COLORS.textDim, lineHeight: 1.5,
          borderLeft: `2px solid ${options.find(o => o.id === selected)?.color || COLORS.blue}`,
        }}>
          {options.find(o => o.id === selected)?.desc}
        </div>
      )}
    </div>
  );
}
