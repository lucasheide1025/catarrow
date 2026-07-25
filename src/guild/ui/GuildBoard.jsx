// src/guild/ui/GuildBoard.jsx
// 公會委託板：每日 5 張委託單（委託人＋故事＋族群＋星等＋獎勵預覽）。
// 階級不足的委託**照樣顯示但鎖住**（看得到目標才想升階，同商店手法）。
// 已結案的當天不能重接（勝敗都算接過，企劃拍板）。
import { rankUnlocks, canAcceptDanger, repNeededForDanger, nextRankInfo } from "../domain/guildRank";
import { sfxPathSelect, sfxOpen } from "../../lib/sound";
import { contractRewardPreview } from "../domain/guildContracts";

const card = { background: "rgba(0,0,0,.34)", borderRadius: 14, padding: 12 };

export default function GuildBoard({ profile, contracts, doneIds = [], onAccept, onOpenStash, onOpenShop }) {
  const rankInfo = nextRankInfo(profile.rep);
  const rank = rankInfo.current;
  const { maxDanger } = rankUnlocks(profile.rep);

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#0b1220,#1a1207)", color: "#e2e8f0", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 冒險者證摘要 */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: rank.color }}>{rank.icon} {rank.name}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            🏅 {profile.rep}　🐾 {profile.catCoins}　可接 ☠️×{maxDanger}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => { sfxOpen(); onOpenStash(); }} style={{ padding: "6px 10px", borderRadius: 9, border: "none", background: "#334155", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🎒 倉庫</button>
          <button type="button" onClick={() => { sfxOpen(); onOpenShop(); }} style={{ padding: "6px 10px", borderRadius: 9, border: "none", background: "#4c1d95", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🏪 商店</button>
        </div>
      </div>

      <div style={{ fontSize: 17, fontWeight: 900, color: "#fbbf24" }}>📜 今日委託板</div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: -6 }}>每天換一批（同一天重整不會變）。接過的當天不能再接。</div>

      {contracts.map(c => {
        const locked = !canAcceptDanger(profile.rep, c.danger);
        const need = repNeededForDanger(profile.rep, c.danger);
        const done = doneIds.includes(c.id);
        const rw = contractRewardPreview(c);
        const dim = locked || done;
        return (
          <div key={c.id} style={{ ...card, opacity: dim ? 0.6 : 1, border: `1px solid ${done ? "rgba(148,163,184,.25)" : locked ? "rgba(248,113,113,.25)" : "rgba(251,191,36,.3)"}` }}>
            {/* 委託人 + 星等 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#c7d2fe", fontWeight: 800 }}>
                {c.client.icon} {c.client.name} 的委託
              </span>
              <span style={{ fontSize: 11, fontWeight: 900, color: c.danger >= 3 ? "#f87171" : c.danger === 2 ? "#fbbf24" : "#6ee7b7" }}>
                {c.skulls} {c.tag}
              </span>
            </div>

            {/* 標題 + 故事 */}
            <div style={{ fontSize: 15, fontWeight: 900, marginTop: 6 }}>{c.title}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6, marginTop: 3 }}>{c.story}</div>

            {/* 目標與獎勵預覽 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, fontSize: 10 }}>
              <span style={{ background: "rgba(255,255,255,.06)", borderRadius: 6, padding: "3px 7px" }}>{c.familyIcon} {c.familyLabel}</span>
              <span style={{ background: "rgba(255,255,255,.06)", borderRadius: 6, padding: "3px 7px" }}>⚔️ {c.waves} 波</span>
              <span style={{ background: "rgba(255,255,255,.06)", borderRadius: 6, padding: "3px 7px" }}>💰 {rw.coins}+</span>
              <span style={{ background: "rgba(255,255,255,.06)", borderRadius: 6, padding: "3px 7px" }}>🐾 {rw.catCoins}+</span>
              <span style={{ background: "rgba(255,255,255,.06)", borderRadius: 6, padding: "3px 7px" }}>📦 {rw.materialLabel}</span>
              <span style={{ background: "rgba(255,255,255,.06)", borderRadius: 6, padding: "3px 7px" }}>⭐ 裝備 {rw.equipChancePct}%</span>
            </div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 5 }}>{c.hint}</div>

            <button type="button" disabled={dim} onClick={() => { sfxPathSelect(); onAccept(c); }}
              style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10, fontWeight: 900, fontSize: 13, color: "#fff", border: "none",
                background: done ? "#334155" : locked ? "#475569" : "linear-gradient(135deg,#f59e0b,#b45309)", cursor: dim ? "not-allowed" : "pointer" }}>
              {done ? "✓ 今日已結案" : locked ? `🔒 階級不足（還差 ${need} 聲望）` : "📝 接下委託"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
