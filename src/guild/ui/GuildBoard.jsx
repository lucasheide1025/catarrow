// src/guild/ui/GuildBoard.jsx
// 公會大廳＋委託板：大廳底圖 → 公會長貓（依階級說話）→ 貼在木板上的委託單（羊皮紙卡）。
// 階級不足的委託**照樣顯示但鎖住**（看得到目標才想升階，同商店手法）。
// 已結案的當天不能重接（勝敗都算接過，企劃拍板）。
// 所有圖都有 emoji fallback（見 GuildArt），圖沒生好也不會破版。
import { rankUnlocks, canAcceptDanger, repNeededForDanger, nextRankInfo } from "../domain/guildRank";
import { contractRewardPreview } from "../domain/guildContracts";
import { MASTER_LINES } from "../data/guildContractPool";
import { sfxPathSelect, sfxOpen } from "../../lib/sound";
import { hallBg, paperBg, masterArt, rankBadge, bgLayer, ArtOrEmoji } from "./GuildArt";

const iconBtn = { padding: "7px 11px", borderRadius: 10, border: "1px solid rgba(251,191,36,.25)", color: "#fde68a", fontSize: 11, fontWeight: 800, cursor: "pointer" };

// 委託單：羊皮紙底 + 木板釘子。紙圖載不到就退回米色底，字永遠讀得到。
const paperStyle = {
  position: "relative",
  borderRadius: 10,
  padding: "13px 14px 12px",
  color: "#2b1d10",
  backgroundColor: "#e8d6ae",
  backgroundImage: `url(${paperBg()})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  boxShadow: "0 6px 16px rgba(0,0,0,.5)",
};

export default function GuildBoard({ profile, contracts, doneIds = [], onAccept, onOpenStash, onOpenShop }) {
  const rankInfo = nextRankInfo(profile.rep);
  const rank = rankInfo.current;
  const { maxDanger } = rankUnlocks(profile.rep);
  const allDone = contracts.length > 0 && contracts.every(c => doneIds.includes(c.id));
  const lines = MASTER_LINES[rank.id] || MASTER_LINES.apprentice;

  return (
    <div style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(10,7,3,.62)" }), backgroundAttachment: "fixed", color: "#f1e7d5", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>

      {/* 冒險者證：階級徽章 + 聲望進度 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(12,8,4,.72)", border: `1px solid ${rank.color}55`, borderRadius: 14, padding: 10 }}>
        <ArtOrEmoji sources={[rankBadge(rank.id)]} emoji={rank.icon} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: rank.color }}>{rank.name}</div>
          <div style={{ height: 5, background: "rgba(255,255,255,.1)", borderRadius: 3, overflow: "hidden", margin: "4px 0 3px" }}>
            <div style={{ height: "100%", width: `${rankInfo.progressPct}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
          </div>
          <div style={{ fontSize: 10, color: "#c8b89a" }}>
            🏅 {profile.rep}{rankInfo.next ? ` ／ 距 ${rankInfo.next.name} ${rankInfo.need}` : "（頂階）"}　🐾 {profile.catCoins}　可接 ☠️×{maxDanger}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button type="button" onClick={() => { sfxOpen(); onOpenStash(); }} style={{ ...iconBtn, background: "rgba(51,65,85,.85)" }}>🎒 倉庫</button>
          <button type="button" onClick={() => { sfxOpen(); onOpenShop(); }} style={{ ...iconBtn, background: "rgba(76,29,149,.85)" }}>🏪 商店</button>
        </div>
      </div>

      {/* 公會長貓：依階級講話 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <ArtOrEmoji sources={[masterArt()]} emoji="🐈‍⬛" size={78} style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,.7))", flexShrink: 0 }} />
        <div style={{ flex: 1, position: "relative", background: "rgba(12,8,4,.82)", border: "1px solid rgba(251,191,36,.3)", borderRadius: "14px 14px 14px 4px", padding: "9px 12px" }}>
          <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: 900, marginBottom: 2 }}>公會長・老貓</div>
          <div style={{ fontSize: 12, lineHeight: 1.65, color: "#e7dcc6" }}>{allDone ? lines.done : lines.greet}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fbbf24" }}>📜 今日委託板</div>
        <div style={{ fontSize: 9, color: "#a89878" }}>每天換一批・接過的當天不能再接</div>
      </div>

      {contracts.map(c => {
        const locked = !canAcceptDanger(profile.rep, c.danger);
        const need = repNeededForDanger(profile.rep, c.danger);
        const done = doneIds.includes(c.id);
        const rw = contractRewardPreview(c);
        const dim = locked || done;
        return (
          <div key={c.id} style={{ ...paperStyle, opacity: dim ? 0.62 : 1, filter: done ? "grayscale(.5)" : "none" }}>
            {/* 圖釘 */}
            <div style={{ position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)", fontSize: 13 }}>📌</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#5b4527" }}>{c.client.icon} {c.client.name} 委託</span>
              <span style={{ fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 5, color: "#fff",
                background: c.danger >= 3 ? "#b91c1c" : c.danger === 2 ? "#b45309" : "#3f6212" }}>
                {c.skulls} {c.tag}
              </span>
            </div>

            <div style={{ fontSize: 16, fontWeight: 900, marginTop: 5, color: "#241809" }}>{c.title}</div>
            <div style={{ fontSize: 11.5, color: "#4a3a24", lineHeight: 1.7, marginTop: 3 }}>{c.story}</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9, fontSize: 10, fontWeight: 700 }}>
              {[`${c.familyIcon} ${c.familyLabel}`, `⚔️ ${c.waves} 波`, `💰 ${rw.coins}+`, `🐾 ${rw.catCoins}+`, `📦 ${rw.materialLabel}`, `⭐ 裝備 ${rw.equipChancePct}%`].map(t => (
                <span key={t} style={{ background: "rgba(59,42,20,.13)", border: "1px solid rgba(59,42,20,.18)", borderRadius: 5, padding: "3px 7px", color: "#3d2c16" }}>{t}</span>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#6b5636", marginTop: 6, fontStyle: "italic" }}>{c.hint}</div>

            <button type="button" disabled={dim} onClick={() => { sfxPathSelect(); onAccept(c); }}
              style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 8, fontWeight: 900, fontSize: 13, color: "#fff", border: "none",
                background: done ? "#57534e" : locked ? "#6b6b6b" : "linear-gradient(135deg,#b45309,#7c2d12)",
                cursor: dim ? "not-allowed" : "pointer", boxShadow: dim ? "none" : "0 3px 8px rgba(0,0,0,.35)" }}>
              {done ? "✓ 今日已結案" : locked ? `🔒 階級不足（還差 ${need} 聲望）` : "📝 接下委託"}
            </button>
          </div>
        );
      })}

      <div style={{ height: 8 }} />
    </div>
  );
}
