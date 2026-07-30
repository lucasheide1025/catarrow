// src/guild/ui/GuildContractSheet.jsx
// 委託詳情（點小卡才展開）：故事全文、多元種族、**會遇到 T 幾的怪**、可能遭遇清單、獎勵、接受鈕。
// 委託板只放縮圖資訊（一頁能看完 5 張），細節全部收到這裡。
import { contractMonsterPreview, contractRewardPreview } from "../domain/guildContracts";
import { canAcceptDanger, repNeededForDanger } from "../domain/guildRank";
import { sfxPathSelect, sfxClose } from "../../lib/sound";
import { paperBg, MonsterArt } from "./GuildArt";

const chip = { fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "3px 7px", whiteSpace: "nowrap" };

export default function GuildContractSheet({ contract: c, profile, done, onAccept, onTeam, onClose }) {
  const locked = !canAcceptDanger(profile, c.danger);
  const need = repNeededForDanger(profile, c.danger);
  const rw = contractRewardPreview(c);
  const pool = contractMonsterPreview(c);
  const miniLeaders = contractMonsterPreview(c, { encounter: "miniBoss" });
  const bossLeaders = contractMonsterPreview(c, { encounter: "boss" });
  const odds = c.leaderOdds || {};
  const tiers = c.tiers || [];

  return (
    <div className="guild-modal" style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={() => { sfxClose(); onClose(); }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, maxHeight: "92dvh", overflowY: "auto", borderRadius: "18px 18px 0 0",
          color: "#2b1d10", backgroundColor: "#e8d6ae", backgroundImage: `url(${paperBg()})`, backgroundSize: "cover",
          padding: 16, boxShadow: "0 -8px 30px rgba(0,0,0,.6)" }}>

        {/* 抬頭 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#5b4527" }}>{c.client.icon} {c.client.name} 委託</span>
          <button type="button" onClick={() => { sfxClose(); onClose(); }}
            style={{ ...chip, border: "none", background: "rgba(59,42,20,.18)", color: "#3d2c16", cursor: "pointer", padding: "5px 10px" }}>關閉</button>
        </div>

        <div style={{ fontSize: 20, fontWeight: 900, color: "#241809", marginTop: 6, lineHeight: 1.3 }}>{c.title}</div>
        <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
          <span style={{ ...chip, color: "#fff", background: c.danger >= 3 ? "#b91c1c" : c.danger === 2 ? "#b45309" : "#3f6212" }}>{c.skulls} {c.tag}</span>
          <span style={{ ...chip, background: "rgba(59,42,20,.14)", color: "#3d2c16" }}>
            {c.modeMeta?.icon || "⚔️"} {c.modeMeta?.label || "連續進攻"}・
            {c.mode === "assault" ? `${c.waves} 波` : c.mode === "defense" ? "守住據點" : "抵達最終目標"}
          </span>
          {c.modeMeta?.description && <div style={{ width: "100%", marginTop: 6, fontSize: 11, color: "#5b4636" }}>{c.modeMeta.description}</div>}
          <span style={{ ...chip, background: "#7c2d12", color: "#fde68a" }}>
            ⚔️ 小王 {Math.round((odds.miniBoss || 0) * 100)}%・大王 {Math.round((odds.boss || 0) * 100)}%
          </span>
        </div>

        <div style={{ fontSize: 12.5, color: "#4a3a24", lineHeight: 1.8, marginTop: 10 }}>{c.story}</div>
        <div style={{ fontSize: 11, color: "#6b5636", fontStyle: "italic", marginTop: 6 }}>「{c.hint}」</div>

        {/* 討伐目標：多元種族 + T 階 */}
        <div style={{ marginTop: 14, borderTop: "1px solid rgba(59,42,20,.2)", paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#3d2c16" }}>🎯 討伐目標</div>
          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
            {(c.familyTags || []).map(f => (
              <span key={f.id} style={{ ...chip, background: "rgba(59,42,20,.14)", color: "#3d2c16", border: "1px solid rgba(59,42,20,.2)" }}>
                {f.icon} {f.label}
              </span>
            ))}
            {(c.familyTags?.length || 0) > 1 && <span style={{ ...chip, background: "#7c2d12", color: "#fde68a" }}>混族陣容</span>}
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#5b4527", fontWeight: 800 }}>怪物階級</span>
            {tiers.map(t => (
              <span key={t.key} style={{ ...chip, background: t.color, color: "#fff" }}>T{t.tierNo} {t.label}</span>
            ))}
          </div>
        </div>

        {/* 可能遭遇（跟實際抽怪同一份池，預覽不騙人）*/}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#3d2c16", marginBottom: 6 }}>
            👁️ 可能遭遇的雜兵 <span style={{ fontWeight: 700, color: "#6b5636" }}>（{pool.length} 種，實際陣容出發時隨機）</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 6 }}>
            {pool.map(m => (
              <div key={m.id} style={{ background: "rgba(59,42,20,.1)", border: "1px solid rgba(59,42,20,.16)", borderRadius: 8, padding: 6, textAlign: "center" }}>
                <MonsterArt monsterId={m.id} icon={m.icon} size={40} style={{ margin: "0 auto" }} />
                <div style={{ fontSize: 10, fontWeight: 800, color: "#241809", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                <div style={{ fontSize: 9, fontWeight: 900, color: m.tierColor }}>T{m.tierNo} {m.tierLabel}</div>
                <div style={{ fontSize: 8.5, color: "#6b5636" }}>❤️{m.hp} ⚔️{m.atk} 🛡️{m.def}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 壓陣首領 */}
        {(miniLeaders.length > 0 || bossLeaders.length > 0) && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#7f1d1d", marginBottom: 6 }}>
              ☠️ 可能出現的首領
              <span style={{ fontWeight: 700, color: "#6b5636" }}>（出發前不揭露本次結果）</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 6 }}>
              {[...miniLeaders, ...bossLeaders].map(m => (
                <div key={m.id} style={{ background: "rgba(127,29,29,.12)", border: "1px solid rgba(127,29,29,.3)", borderRadius: 8, padding: 6, textAlign: "center" }}>
                  <MonsterArt monsterId={m.id} icon={m.icon} size={40} style={{ margin: "0 auto" }} />
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#241809", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                  <div style={{ fontSize: 8.5, color: "#6b5636" }}>❤️{m.hp} ⚔️{m.atk} 🛡️{m.def}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 報酬 */}
        <div style={{ marginTop: 12, borderTop: "1px solid rgba(59,42,20,.2)", paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#3d2c16", marginBottom: 6 }}>💼 報酬</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[`💰 ${rw.coins}+ 金幣`, `🐾 ${rw.catCoins}+ CAT幣`, `📦 ${rw.materialLabel}`, `🎒 雜貨 ×${rw.junkMax}`, `⭐ 公會裝 ${rw.equipChancePct}%`].map(t => (
              <span key={t} style={{ ...chip, background: "rgba(59,42,20,.14)", color: "#3d2c16" }}>{t}</span>
            ))}
          </div>
        </div>

        <button type="button" disabled={locked || done} onClick={() => { sfxPathSelect(); onAccept(c); }}
          style={{ marginTop: 14, width: "100%", padding: "13px 0", borderRadius: 10, fontWeight: 900, fontSize: 15, color: "#fff", border: "none",
            background: done ? "#57534e" : locked ? "#6b6b6b" : "linear-gradient(135deg,#b45309,#7c2d12)",
            cursor: locked || done ? "not-allowed" : "pointer", boxShadow: locked || done ? "none" : "0 4px 12px rgba(0,0,0,.4)" }}>
          {done ? "✓ 今日已結案" : locked ? (need === "trial" ? "🔒 請先完成晉階試煉" : `🔒 階級不足（還差 ${need} 聲望）`) : "📝 一個人去（單人）"}
        </button>

        {/* 組隊：帶同一張委託開房，最多 4 人。委託額度只算房主這張 */}
        {onTeam && (
          <button type="button" disabled={locked || done} onClick={() => { sfxPathSelect(); onTeam(c); }}
            style={{ marginTop: 8, width: "100%", padding: "12px 0", borderRadius: 10, fontWeight: 900, fontSize: 14, color: "#fff", border: "none",
              background: done ? "#57534e" : locked ? "#6b6b6b" : "linear-gradient(135deg,#15803d,#166534)",
              cursor: locked || done ? "not-allowed" : "pointer", boxShadow: locked || done ? "none" : "0 4px 12px rgba(0,0,0,.4)" }}>
            🤝 揪人一起打（最多 4 人）
          </button>
        )}
      </div>
    </div>
  );
}
