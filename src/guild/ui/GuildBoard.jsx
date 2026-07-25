// src/guild/ui/GuildBoard.jsx
// 公會大廳＋委託板：大廳底圖 → 公會長貓（依階級說話）→ 貼在木板上的委託單（羊皮紙卡）。
// 階級不足的委託**照樣顯示但鎖住**（看得到目標才想升階，同商店手法）。
// 已結案的當天不能重接（勝敗都算接過，企劃拍板）。
// 所有圖都有 emoji fallback（見 GuildArt），圖沒生好也不會破版。
import { rankUnlocks, canAcceptDanger, repNeededForDanger, nextRankInfo } from "../domain/guildRank";
import { MASTER_LINES } from "../data/guildContractPool";
import { sfxOpen } from "../../lib/sound";
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

export default function GuildBoard({ profile, contracts, doneIds = [], onOpen, onOpenStash, onOpenShop }) {
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

      {/* 委託小卡：一頁看得完 5 張，細節點進去看（GuildContractSheet）*/}
      {contracts.map(c => {
        const locked = !canAcceptDanger(profile.rep, c.danger);
        const need = repNeededForDanger(profile.rep, c.danger);
        const done = doneIds.includes(c.id);
        const dim = locked || done;
        const tierText = (c.tiers || []).map(t => `T${t.tierNo}`).join("・");
        return (
          <button key={c.id} type="button" onClick={() => { sfxOpen(); onOpen(c); }}
            style={{ ...paperStyle, opacity: dim ? 0.66 : 1, filter: done ? "grayscale(.55)" : "none",
              textAlign: "left", border: "none", cursor: "pointer", padding: "10px 12px", display: "block", width: "100%" }}>
            <div style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", fontSize: 11 }}>📌</div>

            {/* 第一行：標題 + 星等 */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#241809", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.title}
              </span>
              <span style={{ fontSize: 9, fontWeight: 900, padding: "2px 6px", borderRadius: 4, color: "#fff", flexShrink: 0,
                background: c.danger >= 3 ? "#b91c1c" : c.danger === 2 ? "#b45309" : "#3f6212" }}>
                {c.skulls}
              </span>
            </div>

            {/* 第二行：委託人 + 族群（多元種族全列）+ T 階 + 波數 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, fontSize: 10, color: "#5b4527", fontWeight: 700, flexWrap: "wrap" }}>
              <span>{c.client.icon} {c.client.name}</span>
              <span style={{ color: "#8a7350" }}>·</span>
              <span>{(c.familyTags || []).map(f => f.icon).join("")} {c.familyLabel}{(c.familyTags?.length || 0) > 1 ? ` +${c.familyTags.length - 1}` : ""}</span>
              <span style={{ color: "#8a7350" }}>·</span>
              <span style={{ fontWeight: 900, color: "#7c2d12" }}>{tierText}</span>
              <span style={{ color: "#8a7350" }}>·</span>
              <span>⚔️{c.waves}波</span>
            </div>

            {/* 第三行：狀態 */}
            <div style={{ marginTop: 6, fontSize: 10, fontWeight: 900, color: done ? "#57534e" : locked ? "#9a3412" : "#3f6212" }}>
              {done ? "✓ 今日已結案" : locked ? `🔒 階級不足（差 ${need} 聲望）` : "▸ 點開看委託詳情"}
            </div>
          </button>
        );
      })}

      <div style={{ height: 8 }} />
    </div>
  );
}
