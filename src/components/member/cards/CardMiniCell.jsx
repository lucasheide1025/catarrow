// src/components/member/cards/CardMiniCell.jsx
// 極簡小卡：<button type="button">。已取得→圖片(lazy+fallback鏈,缺圖=SVG佔位);未取得→暗化 SVG 剪影(零請求)。
// 列表只顯示必要資訊（圖/名/星/角標），詳細內容在 CardDetailSheet。

import CardArtImage from "./CardArt";
import { calcCardBonus, getCardStat } from "../../../lib/monsterCards";

const STAT_ICON = { hp: "❤️", atk: "⚔️", def: "🛡️" };

const TIER_COLOR = {
  common: "#94a3b8", rare: "#3b82f6", elite: "#a855f7",
  fierce: "#f97316", boss: "#ef4444", mythic: "#f59e0b", worldboss: "#facc15",
};
const ENC_BADGE = { miniBoss: "👑", boss: "👑", worldboss: "🌟" };

export default function CardMiniCell({ view, isNew = false, onOpen }) {
  const frame = TIER_COLOR[view.tier] || "#94a3b8";
  const owned = view.owned;
  const badge = ENC_BADGE[view.encounter];

  return (
    <button
      type="button"
      onClick={() => onOpen && onOpen(view)}
      className="card-mini"
      aria-label={owned ? `${view.name}${isNew ? "（新卡）" : ""}` : "未取得卡片"}
      style={{
        position: "relative", aspectRatio: "3 / 4", borderRadius: 12,
        border: `2px solid ${view.equipped ? "#34d399" : owned ? frame : "rgba(255,255,255,.12)"}`,
        boxShadow: view.equipped ? "0 0 10px rgba(52,211,153,.45)" : "none",
        overflow: "hidden", background: "#0f172a", padding: 0, cursor: "pointer",
      }}
    >
      {view.equipped && <span aria-hidden style={{ position: "absolute", top: 3, right: 3, zIndex: 1, fontSize: 8, fontWeight: 900, color: "#052e16", background: "#34d399", borderRadius: 6, padding: "1px 4px" }}>裝備中</span>}
      <span style={{ position: "absolute", inset: 0 }} aria-hidden={!owned}>
        <CardArtImage view={view} />
      </span>

      {badge && <span aria-hidden style={{ position: "absolute", top: 3, left: 3, fontSize: 11 }}>{badge}</span>}
      {isNew && (
        <span aria-hidden style={{
          position: "absolute", top: 3, right: 3, width: 9, height: 9, borderRadius: "50%",
          background: "#ef4444", boxShadow: "0 0 0 2px #0f172a",
        }} />
      )}

      <span style={{
        position: "absolute", left: 0, right: 0, bottom: 0, padding: "3px 4px",
        background: "rgba(2,6,23,.82)", display: "block",
      }}>
        <span style={{
          display: "block", fontSize: 10, fontWeight: 800, color: owned ? "#f1f5f9" : "#64748b",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {owned ? view.name : "？？？"}
        </span>
        {owned && <span style={{ display: "block", fontSize: 9, color: "#facc15" }}>{"★".repeat(view.stars || 1)}</span>}
        {owned && (() => {
          const stat = getCardStat(view);
          if (!stat) return <span style={{ display: "block", fontSize: 9, color: "#a5b4fc" }}>待選屬性</span>;
          return <span style={{ display: "block", fontSize: 9, fontWeight: 800, color: "#6ee7b7" }}>{STAT_ICON[stat] || ""} {stat.toUpperCase()} +{calcCardBonus(view.tier, view.stars || 1)}</span>;
        })()}
      </span>
    </button>
  );
}
