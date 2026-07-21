// src/zombie/ui/ZombieInventoryPanel.jsx
// ═══════════════════════════════════════════════════════════════
//  🛡️ 殭屍生存 — 防具/醫療/配件面板（玻璃主題版）
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { getAllArmor, getArmor, MEDICAL_ITEMS, ACCESSORY_ITEMS } from "../data/itemData";
import { ARMOR_SLOT } from "../domain/types";
import { COLORS, ANIM, RADIUS, glassCard, sectionTitle } from "./theme";

const SLOT_LABELS = {
  [ARMOR_SLOT.HELMET]: "頭盔",
  [ARMOR_SLOT.CHESTPLATE]: "胸甲",
  [ARMOR_SLOT.GAUNTLETS]: "護手",
  [ARMOR_SLOT.BOOTS]: "護足",
};

const SLOT_ICONS = {
  [ARMOR_SLOT.HELMET]: "⛑️",
  [ARMOR_SLOT.CHESTPLATE]: "🦺",
  [ARMOR_SLOT.GAUNTLETS]: "🧤",
  [ARMOR_SLOT.BOOTS]: "🥾",
};

function tierColor(tier) {
  return { 1: COLORS.textDim, 2: COLORS.green, 3: COLORS.blue, 4: COLORS.purple, 5: COLORS.amber }[tier] || COLORS.textDim;
}

function tierLabel(tier) {
  return { 1: "普通", 2: "精良", 3: "稀有", 4: "史詩", 5: "傳說" }[tier] || `T${tier}`;
}

/** 耐久條元件 */
function DurabilityBar({ current, max }) {
  const pct = current / max;
  const barColor = pct > 0.5 ? COLORS.green : pct > 0.25 ? COLORS.amber : COLORS.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: COLORS.textMuted }}>
      <div style={{
        width: 40, height: 4, borderRadius: 2,
        background: COLORS.glass, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct * 100}%`, height: "100%",
          borderRadius: 2,
          background: barColor,
          transition: `width ${ANIM.normal}`,
        }} />
      </div>
      <span>{current}/{max}</span>
    </div>
  );
}

/**
 * 防具面板
 */
export function ZombieArmorPanel({ armor = {}, onEquipArmor, onUnequipArmor, minTier = 1 }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showBrowser, setShowBrowser] = useState(false);

  const allArmor = useMemo(() => getAllArmor().filter(a => a.tier >= minTier), [minTier]);

  const equippedArmor = useMemo(() => {
    const result = {};
    for (const [slot, piece] of Object.entries(armor)) {
      const details = getArmor(piece.itemId);
      if (details) {
        result[slot] = { ...details, durability: piece.durability, maxDurability: details.durability };
      }
    }
    return result;
  }, [armor]);

  const armorBySlot = useMemo(() => {
    const grouped = {};
    for (const a of allArmor) {
      if (!grouped[a.slot]) grouped[a.slot] = [];
      grouped[a.slot].push(a);
    }
    return grouped;
  }, [allArmor]);

  return (
    <div style={glassCard({ padding: "12px 14px" })}>
      {/* 標題 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>
          🛡️ 防具裝備
        </span>
        <button
          onClick={() => setShowBrowser(!showBrowser)}
          style={{
            padding: "4px 10px", borderRadius: RADIUS.sm,
            fontSize: 10, fontWeight: 600,
            background: showBrowser ? `${COLORS.blue}18` : COLORS.glass,
            border: `1px solid ${showBrowser ? `${COLORS.blue}44` : COLORS.glassBorder}`,
            color: showBrowser ? COLORS.blue : COLORS.textDim,
            cursor: "pointer",
            transition: `all ${ANIM.fast}`,
          }}
        >
          {showBrowser ? "✕ 關閉" : "📦 裝備庫"}
        </button>
      </div>

      {/* 插槽網格 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {Object.values(ARMOR_SLOT).map(slot => {
          const equipped = equippedArmor[slot];
          return (
            <div key={slot}
              onClick={() => {
                setSelectedSlot(slot);
                if (equipped) { onUnequipArmor?.(slot); }
                else { setShowBrowser(true); }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: RADIUS.md,
                background: equipped ? COLORS.glass : "rgba(255,255,255,0.02)",
                border: `1px solid ${
                  selectedSlot === slot ? `${COLORS.blue}44` :
                  equipped ? `${COLORS.blue}22` : COLORS.glassBorder
                }`,
                cursor: "pointer",
                transition: `all ${ANIM.fast}`,
              }}
              onMouseOver={e => { e.currentTarget.style.background = COLORS.glassHover; }}
              onMouseOut={e => { e.currentTarget.style.background = equipped ? COLORS.glass : "rgba(255,255,255,0.02)"; }}
            >
              <span style={{ fontSize: 16 }}>{equipped?.icon || SLOT_ICONS[slot]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: equipped ? tierColor(equipped.tier) : COLORS.textMuted }}>
                  {equipped?.name || SLOT_LABELS[slot]}
                </div>
                {equipped && (
                  <DurabilityBar current={equipped.durability} max={equipped.maxDurability} />
                )}
              </div>
              {equipped && (
                <div style={{
                  width: 4, height: 28, borderRadius: 2,
                  background: `linear-gradient(to top, ${
                    equipped.durability / equipped.maxDurability > 0.5 ? COLORS.green :
                    equipped.durability / equipped.maxDurability > 0.25 ? COLORS.amber : COLORS.red
                  }, transparent)`,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* 裝備瀏覽器 */}
      {showBrowser && selectedSlot && armorBySlot[selectedSlot] && (
        <div style={{
          marginTop: 10, maxHeight: 200, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 4,
          padding: "4px 0",
          scrollbarWidth: "thin",
        }}>
          {armorBySlot[selectedSlot].map(a => {
            const isEquipped = armor[a.slot]?.itemId === a.id;
            return (
              <button key={a.id}
                onClick={() => { onEquipArmor?.(a.slot, a.id); setShowBrowser(false); }}
                disabled={isEquipped}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", borderRadius: RADIUS.sm,
                  fontSize: 11,
                  border: `1px solid ${isEquipped ? `${COLORS.green}33` : "transparent"}`,
                  background: isEquipped ? `${COLORS.green}0a` : COLORS.glass,
                  color: isEquipped ? COLORS.green : COLORS.textDim,
                  cursor: isEquipped ? "default" : "pointer",
                  transition: `all ${ANIM.fast}`,
                }}
                onMouseOver={e => { if (!isEquipped) e.currentTarget.style.background = COLORS.glassHover; }}
                onMouseOut={e => { if (!isEquipped) e.currentTarget.style.background = COLORS.glass; }}
              >
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <span style={{ fontWeight: 600, color: tierColor(a.tier) }}>
                    {tierLabel(a.tier)}
                  </span>
                  <span style={{ marginLeft: 4 }}>{a.name}</span>
                </div>
                <span style={{ fontSize: 9, color: COLORS.textMuted }}>
                  {Math.round(a.blockRate * 100)}%
                </span>
                <span style={{ fontSize: 9, color: COLORS.textMuted }}>
                  ♾{a.durability}
                </span>
                {isEquipped && <span style={{ fontSize: 10, color: COLORS.green }}>✅</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 醫療品面板
 */
export function ZombieMedicalPanel({ onUseMedical, supplies = {} }) {
  return (
    <div style={glassCard({ padding: "12px 14px" })}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>
        💊 醫療用品
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {MEDICAL_ITEMS.map(item => {
          const count = supplies[item.id] || 0;
          return (
            <button key={item.id}
              onClick={() => count > 0 && onUseMedical?.(item.id)}
              disabled={count <= 0}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 8px", borderRadius: RADIUS.md,
                fontSize: 10, fontWeight: 600,
                border: `1px solid ${count > 0 ? `${item.color}33` : "transparent"}`,
                background: count > 0 ? COLORS.glass : "rgba(255,255,255,0.02)",
                color: count > 0 ? item.color : COLORS.textMuted,
                cursor: count > 0 ? "pointer" : "default",
                opacity: count > 0 ? 1 : 0.4,
                transition: `all ${ANIM.fast}`,
                textAlign: "left",
              }}
              title={item.desc}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10 }}>{item.name}</div>
                <div style={{ fontSize: 9, color: COLORS.textMuted }}>×{count}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 配件面板
 */
export function ZombieAccessoryPanel({ accessories = [], accessoryUses = {}, onUseAccessory }) {
  return (
    <div style={glassCard({ padding: "12px 14px" })}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>
        ⚙️ 配件
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ACCESSORY_ITEMS.filter(a => accessories.includes(a.id)).map(item => {
          const usesLeft = accessoryUses[item.id] ?? item.maxUsesPerExpedition;
          const empty = usesLeft <= 0;
          return (
            <button key={item.id}
              onClick={() => !empty && onUseAccessory?.(item.id)}
              disabled={empty}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 10px", borderRadius: RADIUS.md,
                fontSize: 10, fontWeight: 600,
                border: `1px solid ${empty ? "transparent" : COLORS.glassBorder}`,
                background: empty ? "rgba(255,255,255,0.02)" : COLORS.glass,
                color: empty ? COLORS.textMuted : item.color,
                cursor: empty ? "default" : "pointer",
                opacity: empty ? 0.4 : 1,
                transition: `all ${ANIM.fast}`,
              }}
              title={item.desc}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
              <span style={{
                fontSize: 9, padding: "1px 5px", borderRadius: 4,
                background: COLORS.glass, fontWeight: 700,
                color: usesLeft <= 1 ? COLORS.red : COLORS.textMuted,
              }}>
                ×{usesLeft}
              </span>
            </button>
          );
        })}
        {accessories.length === 0 && (
          <div style={{ fontSize: 10, color: COLORS.textMuted, padding: "4px 0" }}>
            尚未裝備配件
          </div>
        )}
      </div>
    </div>
  );
}
