// src/guild/ui/GuildLoadout.jsx
// 出發前「備包」畫面：顯示六維、裝備、並在「背包容量」限制下抉擇帶多少食/水。
// 核心張力：裝備佔重、補給也佔重；容量 = 基礎 + VIT 加成。帶太多裝就帶不了糧。
import { useEffect, useRef, useState } from "react";
import { calcGuildExpeditionStats, deriveGuildCombat, STAT_META, BASE_CAPACITY, SUPPLY_WEIGHT } from "../domain/guildStats";
import { GUILD_SLOTS, SLOT_META, GUILD_EQUIP_ARCHETYPES, resolveEquipWeight, equipDisplayName, GRADE_META } from "../data/guildEquipCatalog";
import { equipmentDefinition, resolveEquipmentV2 } from "../domain/guildEquipmentV2";
import { MAX_PARTY_CATS } from "../domain/guildCats";
import { sfxTap, sfxSwitch, sfxCast } from "../../lib/sound";
import { hallBg, bgLayer, CatArt } from "./GuildArt";
import { EXPEDITION_SUPPLY_LOAD, autoFillSupplyLoad, supplyLoadCap, supplyShortage } from "../domain/guildSupplies";
import { GUILD_TARGET_FACE_OPTIONS } from "./guildTargetFace";
import GuildIcon, { GUILD_SLOT_ICON } from "./GuildIcon";
import { GuildEquipmentArt, GuildPlayerAppearance, PLAYER_APPEARANCES } from "./GuildItemArt";

// 負重常數已搬到 domain/guildStats（組隊等待室也要用同一組，見 carryStatus）

export default function GuildLoadout({
  member, expedition, guildEquip, profile, onDepart, onNeedShop,
  onEquip,
  catRoster = [], partyCatIds = [], onToggleCat,
  arrowsPerRound = 3, onChangeArrows,
  appearanceId = "tabby_ranger", onChangeAppearance,
  targetFormat = "full_110", onChangeTargetFormat,
  supplyLoad = EXPEDITION_SUPPLY_LOAD, onChangeSupplyLoad,
}) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const stats = calcGuildExpeditionStats(member, guildEquip);
  const derived = deriveGuildCombat(stats);
  const capacity = Math.round((BASE_CAPACITY + derived.carryBonus) * 10) / 10;
  const gearWeight = Math.round(GUILD_SLOTS.reduce((w, slot) => {
    const it = guildEquip[slot];
    return w + (it && it.archetypeId ? resolveEquipWeight(it.archetypeId, it.grade) : 0);
  }, 0) * 10) / 10;

  const party = partyCatIds; // 已由上層解析成「實際出戰」的 id（空選單時上層會自動填最強的）
  const { food, water } = supplyLoad;
  // 每種補給帶得動的上限＝剩餘負重平分。VIT 越高背得越多，不再硬鎖 10。
  const perKindCap = supplyLoadCap({ capacity, gearWeight, supplyWeight: SUPPLY_WEIGHT });

  // 一進備包就自動補滿（帶得動多少就帶多少，庫存不夠就帶有的）。
  // 只在首次掛載做，之後玩家自己調的數字不會被蓋掉。
  const filledOnce = useRef(false);
  useEffect(() => {
    if (filledOnce.current) return;
    filledOnce.current = true;
    onChangeSupplyLoad?.(autoFillSupplyLoad({ profile, capacity, gearWeight, supplyWeight: SUPPLY_WEIGHT }));
  }, [profile, capacity, gearWeight, onChangeSupplyLoad]);

  // 換上更重的裝備後，補給要跟著壓回上限，否則會卡在「超重不能出發」卻不知道要減哪邊。
  useEffect(() => {
    if (!filledOnce.current) return;
    if (food <= perKindCap && water <= perKindCap) return;
    onChangeSupplyLoad?.({ food: Math.min(food, perKindCap), water: Math.min(water, perKindCap) });
  }, [perKindCap, food, water, onChangeSupplyLoad]);

  const stockOf = key => Math.floor(Number(profile?.supplyStock?.[key]) || 0);
  const missing = supplyShortage(profile, supplyLoad);
  const lacksStock = missing.food > 0 || missing.water > 0;
  const supplyWeight = (food + water) * SUPPLY_WEIGHT;
  const used = Math.round((gearWeight + supplyWeight) * 10) / 10;
  const over = used > capacity;
  const pct = Math.min(100, (used / capacity) * 100);
  const waveCount = Math.max(1, expedition?.totalWaves || expedition?.waves?.length || 1);
  const roundRate = arrowsPerRound === 6 ? 2 : 1;
  const estimatedSupply = {
    min: Math.round((waveCount * roundRate + waveCount * 0.5) * (1 - derived.supplySavePct) * 10) / 10,
    max: Math.round((waveCount * roundRate * 2 + waveCount) * (1 - derived.supplySavePct) * 10) / 10,
  };

  return (
    <div className="guild-panel-page" style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(8,6,3,.74)" }), backgroundAttachment: "fixed", color: "#e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24", display: "flex", alignItems: "center", gap: 7 }}><GuildIcon name="stash" size={38} />出發前備包</div>

      {/* 六維（旁邊放射手本人，出發前看得到自己的角色）*/}
      <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: "0 0 168px", textAlign: "center" }}>
          <div style={{ color: "#fbbf24", fontSize: 11, fontWeight: 900, marginBottom: 5 }}>🎨 玩家棋盤外觀</div>
          <GuildPlayerAppearance appearanceId={appearanceId} size={84} />
          <div role="group" aria-label="選擇冒險者外觀" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, marginTop: 6 }}>
            {PLAYER_APPEARANCES.map(option => {
              const selected = option.id === appearanceId;
              return (
                <button key={option.id} type="button" aria-pressed={selected} title={option.name}
                  onClick={() => onChangeAppearance?.(option.id)}
                  style={{ borderRadius: 7, padding: 3, border: `1px solid ${selected ? "#fbbf24" : "#475569"}`,
                    background: selected ? "rgba(245,158,11,.18)" : "#111827", color: "#e2e8f0", cursor: "pointer" }}>
                  <GuildPlayerAppearance appearanceId={option.id} size={34} />
                  <span style={{ display: "block", fontSize: 8, lineHeight: 1.2 }}>{option.name}</span>
                </button>
              );
            })}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 9, marginTop: 4 }}>點選後自動保存・組隊會讀取此外觀</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>六維（射手Lv{stats._archerLevel} + 貓 + 公會裝）</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {Object.keys(STAT_META).map(k => (
              <div key={k} style={{ fontSize: 12 }}>{STAT_META[k].icon} {STAT_META[k].short} <b>{stats[k]}</b></div>
            ))}
          </div>
        </div>
      </div>

      {/* 裝備 */}
      <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>裝備配置　<span style={{ color: "#64748b" }}>點擊槽位可比較並直接更換</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 7 }}>
          {GUILD_SLOTS.map(slot => {
            const it = guildEquip[slot];
            const def = it?.archetypeId ? equipmentDefinition(it.archetypeId) : null;
            const active = selectedSlot === slot;
            return (
              <button key={slot} type="button" aria-expanded={active} onClick={() => setSelectedSlot(active ? null : slot)}
                style={{ padding: 9, borderRadius: 10, textAlign: "left", color: "#e2e8f0", cursor: "pointer",
                  border: `1px solid ${active ? "#fbbf24" : "rgba(255,255,255,.1)"}`,
                  background: active ? "rgba(245,158,11,.14)" : "rgba(255,255,255,.04)" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
                  {it?.archetypeId ? <GuildEquipmentArt archetypeId={it.archetypeId} grade={it.grade} size={38} /> : <GuildIcon name={GUILD_SLOT_ICON[slot]} size={27} />}
                  {SLOT_META[slot].name}・{def?.role || "未裝備"}
                </div>
                {it?.archetypeId ? <>
                  <div style={{ color: GRADE_META[it.grade]?.color || "#fff", fontSize: 11, fontWeight: 900 }}>{equipDisplayName(it.archetypeId, it.grade, it)}</div>
                  <div style={{ fontSize: 9.5, color: "#cbd5e1", marginTop: 4 }}>{def?.trait?.name}・{resolveEquipWeight(it.archetypeId, it.grade)}kg</div>
                </> : <div style={{ color: "#64748b", fontSize: 11 }}>空槽位</div>}
              </button>
            );
          })}
        </div>
        {selectedSlot && (() => {
          const current = guildEquip[selectedSlot];
          const currentStats = current?.archetypeId ? resolveEquipmentV2(current.archetypeId, current.grade, current).stats : {};
          const candidates = (profile.stash || []).filter(item => GUILD_EQUIP_ARCHETYPES[item.archetypeId]?.slot === selectedSlot);
          return (
            <div style={{ marginTop: 9, borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 9 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#fbbf24", marginBottom: 6 }}>{SLOT_META[selectedSlot].icon} 可替換裝備</div>
              {!candidates.length && <div style={{ fontSize: 10.5, color: "#64748b" }}>倉庫目前沒有這個槽位的其他裝備。</div>}
              <div style={{ display: "grid", gap: 6 }}>
                {candidates.map(item => {
                  const next = resolveEquipmentV2(item.archetypeId, item.grade, item);
                  const stats = Array.from(new Set([...Object.keys(currentStats), ...Object.keys(next.stats)]));
                  const weightDelta = Math.round((resolveEquipWeight(item.archetypeId, item.grade) - (current?.archetypeId ? resolveEquipWeight(current.archetypeId, current.grade) : 0)) * 10) / 10;
                  return (
                    <button key={item.uid} type="button" onClick={() => { onEquip?.(item.uid); setSelectedSlot(null); }}
                      style={{ padding: 8, borderRadius: 9, border: "1px solid rgba(255,255,255,.1)", background: "#111827", color: "#e2e8f0", textAlign: "left", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <GuildEquipmentArt archetypeId={item.archetypeId} grade={item.grade} size={42} />
                        <b style={{ color: GRADE_META[item.grade]?.color || "#fff", fontSize: 11 }}>{equipDisplayName(item.archetypeId, item.grade, item)}</b>
                        <span style={{ color: weightDelta > 0 ? "#fca5a5" : "#6ee7b7", fontSize: 10 }}>{weightDelta > 0 ? "+" : ""}{weightDelta}kg</span>
                      </div>
                      <div style={{ fontSize: 9.5, color: "#cbd5e1", marginTop: 4 }}>{next.definition.trait.name}：{next.definition.trait.description}</div>
                      <div style={{ fontSize: 9.5, color: weightDelta > 0 ? "#fca5a5" : "#6ee7b7", marginTop: 3 }}>
                        補給空間 {weightDelta === 0 ? "不變" : `${weightDelta > 0 ? "-" : "+"}${Math.abs(weightDelta)} 份`}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                        {stats.map(stat => {
                          const delta = (next.stats[stat] || 0) - (currentStats[stat] || 0);
                          return delta ? <span key={stat} style={{ fontSize: 9.5, color: delta > 0 ? "#6ee7b7" : "#fca5a5" }}>{STAT_META[stat]?.short || stat} {delta > 0 ? "+" : ""}{delta}</span> : null;
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
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

      <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>
          本次遠征靶紙
          <span style={{ color: "#fca5a5", fontWeight: 700, marginLeft: 6 }}>（出發後鎖定，途中不能更換）</span>
        </div>
        <select value={targetFormat} onChange={event => { sfxSwitch(); onChangeTargetFormat?.(event.target.value); }}
          style={{ width: "100%", minHeight: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "#1e293b", color: "#f8fafc", padding: "0 10px", fontWeight: 800 }}>
          {GUILD_TARGET_FACE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <div style={{ marginTop: 7, color: "#94a3b8", fontSize: 10.5 }}>
          怪物的指定環數反制會依這張靶紙產生，請在出發前確認。
        </div>
      </div>

      {/* 補給 + 容量 */}
      <div style={{ background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe" }}>補給（戰鬥與地圖移動都會消耗）</div>
          <button type="button"
            onClick={() => { sfxTap(); onChangeSupplyLoad?.(autoFillSupplyLoad({ profile, capacity, gearWeight, supplyWeight: SUPPLY_WEIGHT })); }}
            style={{ fontSize: 10.5, fontWeight: 900, borderRadius: 8, padding: "5px 9px", border: "1px solid #475569",
              background: "#1e293b", color: "#e2e8f0", cursor: "pointer", whiteSpace: "nowrap" }}>🔄 補滿</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { key: "food", icon: "food", label: "食物", value: food },
            { key: "water", icon: "water", label: "飲水", value: water },
          ].map(item => (
            <div key={item.key} style={{ padding: 9, borderRadius: 10, background: "rgba(255,255,255,.05)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}><GuildIcon name={item.icon} size={28} />{item.label}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <button type="button" disabled={item.value <= 1}
                  onClick={() => onChangeSupplyLoad?.({ ...supplyLoad, [item.key]: Math.max(1, item.value - 1) })}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "#334155", color: "#fff", fontWeight: 900 }}>−</button>
                <b style={{ fontSize: 17 }}>{item.value}</b>
                <button type="button" disabled={item.value >= Math.min(perKindCap, stockOf(item.key))}
                  onClick={() => onChangeSupplyLoad?.({ ...supplyLoad, [item.key]: Math.min(perKindCap, item.value + 1) })}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "#92400e", color: "#fff", fontWeight: 900 }}>＋</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
          本次攜帶　🍖 食物 <b>{food}</b>　💧 飲水 <b>{water}</b>　<span style={{ color: "#64748b", fontSize: 10.5 }}>（負重上限各 {perKindCap} 份）</span><br />
          倉庫庫存　🍖 {profile.supplyStock.food}　💧 {profile.supplyStock.water}
        </div>
        {lacksStock && <div style={{ fontSize: 11, color: "#f87171" }}>補給不足：還缺{missing.food ? ` 食物 ${missing.food}` : ""}{missing.water ? ` 飲水 ${missing.water}` : ""}</div>}
        <div style={{ fontSize: 10.5, color: food < estimatedSupply.min || water < estimatedSupply.min ? "#fca5a5" : "#93c5fd" }}>
          預估本趟各消耗 {estimatedSupply.min}～{estimatedSupply.max} 份（事件與實際戰鬥回合會改變結果）
        </div>
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

      <button type="button" disabled={over} onClick={() => { if (lacksStock) { sfxTap(); onNeedShop?.(); } else { sfxCast(); onDepart(supplyLoad); } }}
        style={{ marginTop: "auto", padding: "13px 0", borderRadius: 12, fontWeight: 900, fontSize: 15, color: "#fff", border: "none",
          background: over ? "#475569" : lacksStock ? "linear-gradient(135deg,#7c3aed,#4c1d95)" : "linear-gradient(135deg,#f59e0b,#b45309)", cursor: over ? "not-allowed" : "pointer" }}>
        {over ? "超重，請卸下或更換較輕裝備" : lacksStock ? "🏪 補給不足，前往購買" : "🚩 攜帶補給並出發"}
      </button>
    </div>
  );
}
