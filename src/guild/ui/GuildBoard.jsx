// src/guild/ui/GuildBoard.jsx
// 公會大廳＋委託板：大廳底圖 → 公會長貓（依階級說話）→ 委託小卡格狀牆（一排三張）。
// 18 張／天（6 危險度 × 3）；**不做折疊分組**，卡片自己標 ☠️ 與 T 階就夠了（作者拍板 2026-07-25）。
// 階級不足的委託照樣顯示但鎖住（看得到目標才想升階，同商店手法）；已結案的當天不能重接。
// 所有圖都有 emoji fallback（見 GuildArt），圖沒生好也不會破版。
import { rankUnlocks, canAcceptDanger, repNeededForDanger, nextRankInfo } from "../domain/guildRank";
import { MASTER_LINES } from "../data/guildContractPool";
import { currentTitle } from "../domain/guildTitles";
import { sfxOpen } from "../../lib/sound";
import { hallBg, paperBg, masterArt, rankBadge, bgLayer, ArtOrEmoji } from "./GuildArt";

const iconBtn = { padding: "7px 11px", borderRadius: 10, border: "1px solid rgba(251,191,36,.25)", color: "#fde68a", fontSize: 11, fontWeight: 800, cursor: "pointer" };

// 委託單：羊皮紙底。紙圖載不到就退回米色底，字永遠讀得到。
const paperStyle = {
  position: "relative",
  borderRadius: 9,
  color: "#2b1d10",
  backgroundColor: "#e8d6ae",
  backgroundImage: `url(${paperBg()})`,
  backgroundSize: "cover",
  backgroundPosition: "center",
  boxShadow: "0 4px 12px rgba(0,0,0,.45)",
};
const dangerColor = d => (d >= 5 ? "#7f1d1d" : d >= 3 ? "#b45309" : "#3f6212");

export default function GuildBoard({ profile, contracts, doneIds = [], onOpen, onOpenStash, onOpenShop, onOpenVault, onOpenLicense, onBack, onLegacy }) {
  const rankInfo = nextRankInfo(profile.rep);
  const rank = rankInfo.current;
  const { maxDanger } = rankUnlocks(profile.rep);
  // 「全清」只看接得到的那些——鎖住的委託不該讓公會長一直說「還沒做完」
  const openable = contracts.filter(c => canAcceptDanger(profile.rep, c.danger));
  const allDone = openable.length > 0 && openable.every(c => doneIds.includes(c.id));
  const lines = MASTER_LINES[rank.id] || MASTER_LINES.apprentice;
  const junkCount = Object.values(profile.junkStock || {}).reduce((s, n) => s + n, 0);
  const worn = currentTitle(profile);   // 配戴中的稱號（純名譽）

  return (
    <div style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(10,7,3,.62)" }), backgroundAttachment: "fixed", color: "#f1e7d5", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>

      {(onBack || onLegacy) && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {onBack && (
            <button type="button" onClick={() => { sfxOpen(); onBack(); }}
              style={{ padding: "6px 12px", borderRadius: 9, border: "1px solid rgba(251,191,36,.25)", background: "rgba(12,8,4,.72)", color: "#fde68a", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              ← 返回冒險
            </button>
          )}
          {/* 教練專用：舊公會的懸賞任務後台還在運作，留一顆切換鍵 */}
          {onLegacy && (
            <button type="button" onClick={() => { sfxOpen(); onLegacy(); }}
              style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 9, border: "1px solid rgba(148,163,184,.3)", background: "rgba(30,41,59,.8)", color: "#cbd5e1", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
              🗂️ 舊公會（懸賞）
            </button>
          )}
        </div>
      )}

      {/* 冒險者證：階級徽章 + 稱號 + 聲望進度（點整張進冒險者證）*/}
      <div onClick={() => { sfxOpen(); onOpenLicense?.(); }}
        style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(12,8,4,.72)", border: `1px solid ${rank.color}55`, borderRadius: 14, padding: 10, cursor: onOpenLicense ? "pointer" : "default" }}>
        <ArtOrEmoji sources={[rankBadge(rank.id)]} emoji={rank.icon} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: rank.color }}>
            {rank.name}
            {worn && <span style={{ color: "#fcd34d", fontSize: 12 }}>・{worn.icon}{worn.name}</span>}
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,.1)", borderRadius: 3, overflow: "hidden", margin: "4px 0 3px" }}>
            <div style={{ height: "100%", width: `${rankInfo.progressPct}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
          </div>
          <div style={{ fontSize: 10, color: "#c8b89a" }}>
            🏅 {profile.rep}{rankInfo.next ? ` ／ 距 ${rankInfo.next.name} ${rankInfo.need}` : "（頂階）"}　🐾 {profile.catCoins}　可接 T1~T{maxDanger}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }} onClick={e => e.stopPropagation()}>
          <button type="button" onClick={() => { sfxOpen(); onOpenStash(); }} style={{ ...iconBtn, background: "rgba(51,65,85,.85)" }}>🎒 倉庫</button>
          <button type="button" onClick={() => { sfxOpen(); onOpenShop(); }} style={{ ...iconBtn, background: "rgba(76,29,149,.85)" }}>🏪 商店</button>
          <button type="button" onClick={() => { sfxOpen(); onOpenVault?.(); }} style={{ ...iconBtn, background: "rgba(120,53,15,.85)" }}>
            🧺 雜貨{junkCount > 0 ? `（${junkCount}）` : ""}
          </button>
          <button type="button" onClick={() => { sfxOpen(); onOpenLicense?.(); }} style={{ ...iconBtn, background: "rgba(30,58,95,.85)" }}>
            🎫 冒險者證
          </button>
        </div>
      </div>

      {/* 公會長貓：依階級講話 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <ArtOrEmoji sources={[masterArt()]} emoji="🐈‍⬛" size={72} style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,.7))", flexShrink: 0 }} />
        <div style={{ flex: 1, background: "rgba(12,8,4,.82)", border: "1px solid rgba(251,191,36,.3)", borderRadius: "14px 14px 14px 4px", padding: "9px 12px" }}>
          <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: 900, marginBottom: 2 }}>公會長・老貓</div>
          <div style={{ fontSize: 12, lineHeight: 1.65, color: "#e7dcc6" }}>{allDone ? lines.done : lines.greet}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fbbf24" }}>📜 今日委託板</div>
        <div style={{ fontSize: 9, color: "#a89878" }}>{contracts.length} 張・每天換一批</div>
      </div>

      {/* 委託牆：一排三張，點卡片看詳情（危險度不折疊，卡上標 ☠️/T 階就夠） */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7 }}>
        {contracts.map(c => {
          const locked = !canAcceptDanger(profile.rep, c.danger);
          const need = repNeededForDanger(profile.rep, c.danger);
          const done = doneIds.includes(c.id);
          const dim = locked || done;
          const tier = c.tiers?.[0];
          return (
            <button key={c.id} type="button" onClick={() => { sfxOpen(); onOpen(c); }}
              style={{ ...paperStyle, opacity: dim ? 0.62 : 1, filter: done ? "grayscale(.6)" : "none",
                border: "none", cursor: "pointer", padding: "7px 8px 6px", textAlign: "left",
                display: "flex", flexDirection: "column", gap: 4, minHeight: 108 }}>

              {/* 危險度 + T 階 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 3 }}>
                <span style={{ fontSize: 8.5, fontWeight: 900, color: "#fff", background: dangerColor(c.danger), borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap" }}>
                  {c.skulls}
                </span>
                <span style={{ fontSize: 9.5, fontWeight: 900, color: tier?.color || "#5b4527" }}>T{tier?.tierNo}</span>
              </div>

              {/* 標題（最多兩行）*/}
              <div style={{ fontSize: 11.5, fontWeight: 900, color: "#241809", lineHeight: 1.35,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {c.title}
              </div>

              {/* 族群（混族全列）＋ 波數＋首領 */}
              <div style={{ fontSize: 9, color: "#5b4527", fontWeight: 700, marginTop: "auto" }}>
                {(c.familyTags || []).map(f => f.icon).join("")} ⚔️{c.waves}波
                {c.leader && <span style={{ color: "#7f1d1d", fontWeight: 900 }}>{c.leader === "boss" ? " ☠️首領" : " ⚔小首領"}</span>}
              </div>

              {/* 狀態 */}
              <div style={{ fontSize: 8.5, fontWeight: 900, color: done ? "#57534e" : locked ? "#9a3412" : "#3f6212" }}>
                {done ? "✓ 已結案" : locked ? `🔒 差${need}聲望` : "▸ 查看詳情"}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}
