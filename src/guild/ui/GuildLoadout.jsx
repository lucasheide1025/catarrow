// src/guild/ui/GuildLoadout.jsx
// 出發前「備包」畫面：顯示六維、裝備、並在「背包容量」限制下抉擇帶多少食/水。
// 核心張力：裝備佔重、補給也佔重；容量 = 基礎 + VIT 加成。帶太多裝就帶不了糧。
import { useState } from "react";
import { calcGuildExpeditionStats, deriveGuildCombat, STAT_META } from "../domain/guildStats";
import { GUILD_SLOTS, SLOT_META, resolveEquipWeight, equipDisplayName, GRADE_META } from "../data/guildEquipCatalog";

const BASE_CAPACITY = 20;
const SUPPLY_WEIGHT = 1;

function Stepper({ label, icon, value, set, min = 0, max = 20 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{icon} {label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={() => set(Math.max(min, value - 1))} style={btn}>−</button>
        <span style={{ minWidth: 24, textAlign: "center", fontWeight: 900 }}>{value}</span>
        <button type="button" onClick={() => set(Math.min(max, value + 1))} style={btn}>＋</button>
      </div>
    </div>
  );
}
const btn = { width: 30, height: 30, borderRadius: 8, border: "none", background: "#334155", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer" };

export default function GuildLoadout({ member, guildEquip, onDepart }) {
  const stats = calcGuildExpeditionStats(member, guildEquip);
  const derived = deriveGuildCombat(stats);
  const capacity = Math.round((BASE_CAPACITY + derived.carryBonus) * 10) / 10;
  const gearWeight = Math.round(GUILD_SLOTS.reduce((w, slot) => {
    const it = guildEquip[slot];
    return w + (it && it.archetypeId ? resolveEquipWeight(it.archetypeId, it.grade) : 0);
  }, 0) * 10) / 10;

  const [food, setFood] = useState(6);
  const [water, setWater] = useState(6);
  const supplyWeight = (food + water) * SUPPLY_WEIGHT;
  const used = Math.round((gearWeight + supplyWeight) * 10) / 10;
  const over = used > capacity;
  const pct = Math.min(100, (used / capacity) * 100);

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#0b1220,#1a1207)", color: "#e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>🎒 出發前備包</div>

      {/* 六維 */}
      <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>六維（射手Lv{stats._archerLevel} + 貓 + 公會裝）</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {Object.keys(STAT_META).map(k => (
            <div key={k} style={{ fontSize: 12 }}>{STAT_META[k].icon} {STAT_META[k].short} <b>{stats[k]}</b></div>
          ))}
        </div>
      </div>

      {/* 裝備 */}
      <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>裝備</div>
        {GUILD_SLOTS.map(slot => {
          const it = guildEquip[slot];
          return (
            <div key={slot} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
              <span>{SLOT_META[slot].icon} {SLOT_META[slot].name}</span>
              {it && it.archetypeId
                ? <span style={{ color: GRADE_META[it.grade]?.color || "#fff", fontWeight: 800 }}>{equipDisplayName(it.archetypeId, it.grade)}（{resolveEquipWeight(it.archetypeId, it.grade)}kg）</span>
                : <span style={{ color: "#64748b" }}>空</span>}
            </div>
          );
        })}
      </div>

      {/* 補給 + 容量 */}
      <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe" }}>補給（每回合消耗，撐不住強迫撤退）</div>
        <Stepper label="食物" icon="🍖" value={food} set={setFood} />
        <Stepper label="飲水" icon="💧" value={water} set={setWater} />
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
            <span>背包負重</span>
            <span style={{ color: over ? "#f87171" : "#6ee7b7", fontWeight: 900 }}>{used} / {capacity} kg{over ? "（超重！）" : ""}</span>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: over ? "#ef4444" : "linear-gradient(90deg,#34d399,#22d3ee)" }} />
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>裝備 {gearWeight}kg + 補給 {supplyWeight}kg（VIT 提升容量：+{derived.carryBonus}）</div>
        </div>
      </div>

      <button type="button" disabled={over} onClick={() => onDepart({ food, water })}
        style={{ marginTop: "auto", padding: "13px 0", borderRadius: 12, fontWeight: 900, fontSize: 15, color: "#fff", border: "none",
          background: over ? "#475569" : "linear-gradient(135deg,#f59e0b,#b45309)", cursor: over ? "not-allowed" : "pointer" }}>
        {over ? "超重，減少補給或卸裝" : "🚩 出發討伐"}
      </button>
    </div>
  );
}
