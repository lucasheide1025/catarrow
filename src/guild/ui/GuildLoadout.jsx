// src/guild/ui/GuildLoadout.jsx
// 出發前「備包」畫面：顯示六維、裝備、並在「背包容量」限制下抉擇帶多少食/水。
// 核心張力：裝備佔重、補給也佔重；容量 = 基礎 + VIT 加成。帶太多裝就帶不了糧。
import { useState } from "react";
import { calcGuildExpeditionStats, deriveGuildCombat, STAT_META } from "../domain/guildStats";
import { GUILD_SLOTS, SLOT_META, resolveEquipWeight, equipDisplayName, GRADE_META } from "../data/guildEquipCatalog";
import { MAX_PARTY_CATS } from "../domain/guildCats";
import { sfxTap, sfxSwitch, sfxCast } from "../../lib/sound";
import { hallBg, bgLayer, CatArt } from "./GuildArt";

const BASE_CAPACITY = 20;
const SUPPLY_WEIGHT = 1;

function Stepper({ label, icon, value, set, min = 0, max = 20 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{icon} {label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={() => { sfxTap(); set(Math.max(min, value - 1)); }} style={btn}>−</button>
        <span style={{ minWidth: 24, textAlign: "center", fontWeight: 900 }}>{value}</span>
        <button type="button" onClick={() => { sfxTap(); set(Math.min(max, value + 1)); }} style={btn}>＋</button>
      </div>
    </div>
  );
}
const btn = { width: 30, height: 30, borderRadius: 8, border: "none", background: "#334155", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer" };

export default function GuildLoadout({ member, guildEquip, onDepart, catRoster = [], partyCatIds = [], onToggleCat, arrowsPerRound = 3, onChangeArrows }) {
  const stats = calcGuildExpeditionStats(member, guildEquip);
  const derived = deriveGuildCombat(stats);
  const capacity = Math.round((BASE_CAPACITY + derived.carryBonus) * 10) / 10;
  const gearWeight = Math.round(GUILD_SLOTS.reduce((w, slot) => {
    const it = guildEquip[slot];
    return w + (it && it.archetypeId ? resolveEquipWeight(it.archetypeId, it.grade) : 0);
  }, 0) * 10) / 10;

  const party = partyCatIds; // 已由上層解析成「實際出戰」的 id（空選單時上層會自動填最強的）
  const [food, setFood] = useState(6);
  const [water, setWater] = useState(6);
  const supplyWeight = (food + water) * SUPPLY_WEIGHT;
  const used = Math.round((gearWeight + supplyWeight) * 10) / 10;
  const over = used > capacity;
  const pct = Math.min(100, (used / capacity) * 100);

  return (
    <div style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(8,6,3,.74)" }), backgroundAttachment: "fixed", color: "#e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
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

      {/* 出戰貓貓（貓的等級/羈絆/裝備沿用主線養成 → 在貓村養貓會讓遠征變強）*/}
      {catRoster.length > 0 && (
        <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>
            出戰貓貓 {party.length}/{MAX_PARTY_CATS}
            <span style={{ color: "#64748b", fontWeight: 700, marginLeft: 6 }}>（每回合自動助攻，不佔負重）</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {catRoster.map(cat => {
              const on = party.includes(cat.id);
              const blocked = !on && party.length >= MAX_PARTY_CATS;
              return (
                <button key={cat.id} type="button" disabled={blocked && !on} onClick={() => { sfxSwitch(); onToggleCat?.(cat.id); }}
                  style={{ padding: "6px 9px", borderRadius: 9, fontSize: 11, fontWeight: 800, cursor: blocked ? "not-allowed" : "pointer",
                    color: on ? "#0b1220" : blocked ? "#64748b" : "#e2e8f0", border: `1px solid ${on ? "#fbbf24" : "rgba(255,255,255,.1)"}`,
                    background: on ? "linear-gradient(135deg,#fcd34d,#f59e0b)" : "rgba(255,255,255,.04)", textAlign: "left" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <CatArt catId={cat.id} icon={cat.icon} size={26} />
                    <span>{cat.name} <span style={{ opacity: .8 }}>Lv{cat.level}</span></span>
                  </span>
                  <div style={{ fontSize: 10, fontWeight: 700, opacity: .85 }}>{cat.typeLabel}　⚔️{cat.atk} 🛡️{cat.def}</div>
                </button>
              );
            })}
          </div>
          {party.length === 0 && <div style={{ fontSize: 10, color: "#f87171", marginTop: 6 }}>沒帶貓也能出發，但少了每回合助攻會吃力很多。</div>}
        </div>
      )}

      {/* 每回合箭數（3/6）：跟主線地下城同規格。6 箭清場快，但補給消耗加倍＝真的取捨 */}
      <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>
          每回合箭數
          <span style={{ color: "#64748b", fontWeight: 700, marginLeft: 6 }}>（射出的箭都會記進今日／終身箭數）</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[3, 6].map(n => {
            const on = arrowsPerRound === n;
            return (
              <button key={n} type="button" onClick={() => { sfxSwitch(); onChangeArrows?.(n); }}
                style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: "pointer",
                  color: on ? "#0b1220" : "#e2e8f0", border: `1px solid ${on ? "#fbbf24" : "rgba(255,255,255,.12)"}`,
                  background: on ? "linear-gradient(135deg,#fcd34d,#f59e0b)" : "rgba(255,255,255,.04)" }}>
                {n} 箭
                <div style={{ fontSize: 9, fontWeight: 700, opacity: .85 }}>
                  {n === 3 ? "補給省一半" : "清場快一倍・補給加倍"}
                </div>
              </button>
            );
          })}
        </div>
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

      <button type="button" disabled={over} onClick={() => { sfxCast(); onDepart({ food, water }); }}
        style={{ marginTop: "auto", padding: "13px 0", borderRadius: 12, fontWeight: 900, fontSize: 15, color: "#fff", border: "none",
          background: over ? "#475569" : "linear-gradient(135deg,#f59e0b,#b45309)", cursor: over ? "not-allowed" : "pointer" }}>
        {over ? "超重，減少補給或卸裝" : "🚩 出發討伐"}
      </button>
    </div>
  );
}
