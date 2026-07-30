// src/guild/ui/GuildLicense.jsx
// 冒險者證：階級 × 稱號 × 戰績 × 雜貨圖鑑收集度，一頁看完「我在公會做到了什麼」。
// 稱號可以切換（只有已解鎖的能選），純名譽零戰力加成。
// 分享＝產生一張精美 PNG（GuildLicenseCard + html2canvas），作者要求要能直接貼圖分享。
import { useState } from "react";
import { nextRankInfo } from "../domain/guildRank";
import { evaluateTitles, setGuildTitle, currentTitle, buildTitleStats } from "../domain/guildTitles";
import { TITLE_CATEGORIES } from "../data/guildTitles";
import { GUILD_JUNK, JUNK_RARITY } from "../data/guildJunkCatalog";
import { sfxClose, sfxTap, sfxLevelUp, sfxError } from "../../lib/sound";
import { hallBg, bgLayer, rankBadge, junkArt, ArtOrEmoji } from "./GuildArt";
import GuildLicenseCard from "./GuildLicenseCard";
import { GuildJunkArt } from "./GuildItemArt";

const card = { background: "rgba(12,8,4,.75)", borderRadius: 14, padding: 12, border: "1px solid rgba(251,191,36,.18)" };

export default function GuildLicense({ profile, memberName, onChange, onClose }) {
  const [tab, setTab] = useState("titles");   // titles | dex
  const [showCard, setShowCard] = useState(false);   // 分享圖（html2canvas 產 PNG）
  const [msg, setMsg] = useState("");
  const rankInfo = nextRankInfo(profile);
  const rank = rankInfo.current;
  const titles = evaluateTitles(profile);
  const worn = currentTitle(profile);
  const stats = buildTitleStats(profile);
  const unlockedCount = titles.filter(t => t.unlocked).length;

  const wear = id => {
    const next = setGuildTitle(profile, id);
    // ⚠️ setGuildTitle 回傳的是「正規化後的副本」，不能用 next === profile 判斷失敗
    if (next.title !== (id ?? null)) { sfxError(); setMsg("⚠️ 這個稱號還沒解鎖"); return; }
    sfxLevelUp();
    setMsg(id ? "✅ 已配戴稱號" : "已取下稱號");
    onChange(next);
  };

  return (
    <div className="guild-panel-page" style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(8,6,3,.8)" }), backgroundAttachment: "fixed", color: "#f1e7d5", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>🎫 冒險者證</div>
        <button type="button" onClick={() => { sfxClose(); onClose(); }} style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: "#334155", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>返回</button>
      </div>

      {/* 證件本體 */}
      <div style={{ ...card, borderColor: `${rank.color}66` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ArtOrEmoji sources={[rankBadge(rank.id)]} emoji={rank.icon} size={58} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{memberName || "冒險者"}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: rank.color }}>
              {rank.name}{worn ? <span style={{ color: "#fcd34d" }}>・{worn.icon}{worn.name}</span> : null}
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,.1)", borderRadius: 3, overflow: "hidden", margin: "5px 0 3px" }}>
              <div style={{ height: "100%", width: `${rankInfo.progressPct}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
            </div>
            <div style={{ fontSize: 10, color: "#c8b89a" }}>
              🏅 {profile.rep}{rankInfo.next ? ` ／ 距 ${rankInfo.next.name} ${rankInfo.need}` : "（頂階）"}
            </div>
          </div>
        </div>

        {/* 戰績 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 10, textAlign: "center" }}>
          {[
            ["🚩", `${stats.won}/${stats.total}`, "遠征勝/總"],
            ["☠️", `${stats.hardWon}`, "☠️×3+ 完成"],
            ["🗡️", `${stats.mythicWon}`, "☠️×6 完成"],
            ["🧺", `${stats.junkSeen}/${stats.junkTotal}`, "雜貨圖鑑"],
            ["⚒️", `+${stats.maxPlus}`, "最高強化"],
            ["🎖️", `${unlockedCount}/${titles.length}`, "稱號"],
          ].map(([icon, val, label]) => (
            <div key={label} style={{ background: "rgba(0,0,0,.3)", borderRadius: 9, padding: "6px 4px" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fde68a" }}>{icon} {val}</div>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>{label}</div>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => { sfxTap(); setShowCard(true); }}
          style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10, border: "none", fontWeight: 900, fontSize: 13, color: "#0b1220",
            background: "linear-gradient(135deg,#fcd34d,#f59e0b)", cursor: "pointer" }}>
          🖼️ 產生分享圖片
        </button>
      </div>

      {msg && <div style={{ fontSize: 12, color: msg.startsWith("⚠️") ? "#f87171" : "#6ee7b7" }}>{msg}</div>}

      {/* 分頁 */}
      <div style={{ display: "flex", gap: 6 }}>
        {[["titles", `🎖️ 稱號 ${unlockedCount}/${titles.length}`], ["dex", `🧺 雜貨圖鑑 ${stats.junkSeen}/${stats.junkTotal}`]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => { sfxTap(); setTab(k); }}
            style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12, fontWeight: 900, cursor: "pointer",
              color: tab === k ? "#0b1220" : "#e2e8f0", border: "none",
              background: tab === k ? "linear-gradient(135deg,#fcd34d,#f59e0b)" : "rgba(0,0,0,.35)" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "titles" && (
        <>
          {worn && (
            <button type="button" onClick={() => wear(null)}
              style={{ padding: "7px 0", borderRadius: 9, border: "1px solid rgba(148,163,184,.3)", background: "rgba(15,23,42,.7)", color: "#cbd5e1", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
              取下目前稱號
            </button>
          )}
          {TITLE_CATEGORIES.map(cat => {
            const group = titles.filter(t => t.cat === cat);
            return (
              <div key={cat} style={card}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 7 }}>{cat}</div>
                {group.map(t => {
                  const isWorn = worn?.id === t.id;
                  return (
                    <button key={t.id} type="button" disabled={!t.unlocked} onClick={() => wear(t.id)}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", marginBottom: 5,
                        padding: "7px 9px", borderRadius: 9, cursor: t.unlocked ? "pointer" : "not-allowed",
                        border: `1px solid ${isWorn ? "#fbbf24" : "rgba(255,255,255,.08)"}`,
                        background: isWorn ? "rgba(251,191,36,.18)" : "rgba(0,0,0,.28)",
                        opacity: t.unlocked ? 1 : 0.55 }}>
                      <span style={{ fontSize: 20, filter: t.unlocked ? "none" : "grayscale(1)" }}>{t.icon}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: t.unlocked ? "#fde68a" : "#94a3b8" }}>
                          {t.name}{isWorn ? "（配戴中）" : ""}
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{t.desc}</div>
                        {!t.unlocked && (
                          <div style={{ height: 4, background: "rgba(255,255,255,.1)", borderRadius: 2, overflow: "hidden", marginTop: 3 }}>
                            <div style={{ height: "100%", width: `${t.progressPct}%`, background: "#64748b" }} />
                          </div>
                        )}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 900, color: t.unlocked ? "#6ee7b7" : "#94a3b8", flexShrink: 0 }}>
                        {t.unlocked ? "已解鎖" : `${t.have}/${t.need}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </>
      )}

      {tab === "dex" && (
        <div style={card}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
            撈到過的雜貨會永久記錄在這裡（賣掉也不會消失）。族群雜貨只有在該族委託才撈得到。
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(74px,1fr))", gap: 6 }}>
            {GUILD_JUNK.map(j => {
              const seen = (profile.junkSeen || {})[j.id] || 0;
              const meta = JUNK_RARITY[j.rarity] || JUNK_RARITY.common;
              return (
                <div key={j.id} title={seen ? `${j.name}：${j.desc}` : "尚未發現"}
                  style={{ background: "rgba(0,0,0,.3)", border: `1px solid ${seen ? `${meta.color}55` : "rgba(255,255,255,.06)"}`,
                    borderRadius: 9, padding: 6, textAlign: "center", opacity: seen ? 1 : 0.35 }}>
                  <div style={{ filter: seen ? "none" : "grayscale(1) brightness(.5)" }}>
                    {seen ? <GuildJunkArt junkId={j.id} size={34} style={{ margin: "0 auto" }} /> : <span style={{ fontSize: 30 }}>❓</span>}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, marginTop: 3, color: seen ? "#e2e8f0" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {seen ? j.name : "？？？"}
                  </div>
                  <div style={{ fontSize: 8.5, color: meta.color }}>{seen ? `${meta.label}・×${seen}` : meta.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ height: 8 }} />

      {showCard && (
        <GuildLicenseCard profile={profile} memberName={memberName} onClose={() => setShowCard(false)} />
      )}
    </div>
  );
}
