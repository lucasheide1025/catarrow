// src/guild/ui/GuildStash.jsx
// 公會倉庫：看 CAT幣/聲望、換裝（倉庫 ↔ 5 槽）、看六維怎麼被裝備改變。
// 純 UI：所有變換走 domain/guildRewards 的純函數，改完把新存檔丟給 onChange 存。
import { calcGuildExpeditionStats, STAT_META } from "../domain/guildStats";
import { equipFromStash, unequipSlot, GUILD_STASH_LIMIT } from "../domain/guildRewards";
import { nextRankInfo } from "../domain/guildRank";
import { sfxSwitch, sfxClose } from "../../lib/sound";
import { GUILD_SLOTS, SLOT_META, GRADE_META, GUILD_EQUIP_ARCHETYPES, equipDisplayName, resolveEquipStats, resolveEquipWeight } from "../data/guildEquipCatalog";

const card = { background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12 };
const title = { fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 };

function StatLine({ stats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {Object.keys(STAT_META).map(k => (
        <div key={k} style={{ fontSize: 12 }}>{STAT_META[k].icon} {STAT_META[k].short} <b>{stats[k]}</b></div>
      ))}
    </div>
  );
}

// 一件裝備的六維摘要文字（例：⚔️+12 💨+5）
function statSummary(archetypeId, grade) {
  const s = resolveEquipStats(archetypeId, grade);
  return Object.keys(STAT_META)
    .filter(k => s[k])
    .map(k => `${STAT_META[k].icon}${s[k] > 0 ? "+" : ""}${s[k]}`)
    .join(" ");
}

export default function GuildStash({ member, profile, onChange, onClose }) {
  const stats = calcGuildExpeditionStats(member, profile.equipped);
  const rankInfo = nextRankInfo(profile.rep);
  const rank = rankInfo.current;

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#0b1220,#1a1207)", color: "#e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>🎒 公會倉庫</div>
        <button type="button" onClick={() => { sfxClose(); onClose(); }} style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: "#334155", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>返回</button>
      </div>

      {/* 冒險者證：階級 + 聲望進度（階級只給解鎖，不給任何戰力） */}
      <div style={{ ...card, border: `1px solid ${rank.color}55` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: rank.color }}>{rank.icon} {rank.name}</span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>可接 ☠️×{rank.maxDanger}　{rank.shopTier} 級貨架</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${rankInfo.progressPct}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
          🏅 聲望 {profile.rep}{rankInfo.next ? ` ／ 距 ${rankInfo.next.name} 還差 ${rankInfo.need}` : "（已達頂階）"}
        </div>
      </div>

      {/* 資產 */}
      <div style={{ ...card, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
        <div><div style={{ fontSize: 18, fontWeight: 900, color: "#f0abfc" }}>🐾 {profile.catCoins}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>CAT幣</div></div>
        <div><div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>🏅 {profile.rep}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>聲望</div></div>
        <div><div style={{ fontSize: 18, fontWeight: 900, color: "#6ee7b7" }}>🚩 {profile.expeditions.won}/{profile.expeditions.total}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>遠征勝/總</div></div>
      </div>

      {/* 六維 */}
      <div style={card}>
        <div style={title}>目前六維（射手Lv{stats._archerLevel} + 公會裝）</div>
        <StatLine stats={stats} />
      </div>

      {/* 裝備中 */}
      <div style={card}>
        <div style={title}>裝備中（點「卸下」放回倉庫）</div>
        {GUILD_SLOTS.map(slot => {
          const it = profile.equipped[slot];
          return (
            <div key={slot} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <span style={{ fontSize: 12, width: 62, flexShrink: 0 }}>{SLOT_META[slot].icon} {SLOT_META[slot].name}</span>
              {it?.archetypeId ? (
                <>
                  <span style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
                    <b style={{ color: GRADE_META[it.grade]?.color || "#fff" }}>{equipDisplayName(it.archetypeId, it.grade)}</b>
                    <span style={{ color: "#94a3b8", marginLeft: 6 }}>{statSummary(it.archetypeId, it.grade)}</span>
                  </span>
                  <button type="button" onClick={() => { sfxSwitch(); onChange(unequipSlot(profile, slot)); }}
                    style={{ padding: "4px 9px", borderRadius: 7, border: "none", background: "#475569", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>卸下</button>
                </>
              ) : <span style={{ flex: 1, fontSize: 12, color: "#64748b" }}>空</span>}
            </div>
          );
        })}
      </div>

      {/* 倉庫 */}
      <div style={card}>
        <div style={title}>倉庫 {profile.stash.length}/{GUILD_STASH_LIMIT}（點「裝備」換上）</div>
        {profile.stash.length === 0 && <div style={{ fontSize: 12, color: "#64748b" }}>還沒有戰利品，去遠征打怪掉裝吧。</div>}
        {profile.stash.map(it => {
          const arch = GUILD_EQUIP_ARCHETYPES[it.archetypeId];
          return (
            <div key={it.uid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
              <span style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
                {SLOT_META[arch.slot].icon} <b style={{ color: GRADE_META[it.grade]?.color || "#fff" }}>{equipDisplayName(it.archetypeId, it.grade)}</b>
                <span style={{ color: "#94a3b8", marginLeft: 6 }}>{statSummary(it.archetypeId, it.grade)}</span>
                <span style={{ color: "#64748b", marginLeft: 6 }}>{resolveEquipWeight(it.archetypeId, it.grade)}kg</span>
              </span>
              <button type="button" onClick={() => { sfxSwitch(); onChange(equipFromStash(profile, it.uid)); }}
                style={{ padding: "4px 9px", borderRadius: 7, border: "none", background: "linear-gradient(135deg,#f59e0b,#b45309)", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>裝備</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
