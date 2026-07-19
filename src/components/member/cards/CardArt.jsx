// src/components/member/cards/CardArt.jsx
// 卡面圖層：實圖（lazy + fallback 鏈）→ 缺圖時改用「確定性 SVG 佔位卡面」（零網路請求）。
// 依專案慣例（怪物/徽章走 SVG）：族系配色+徽記、Tier 光芒與圓點、小王/大王王冠角標。
// 未取得卡由呼叫端以 dim 呈現（灰暗剪影,不設任何真實圖片 src）。

import { useState } from "react";
import { ownedArtSources } from "./cardCatalog";

const FAMILY_ART = {
  ghost:     { icon: "👻", from: "#312e81", to: "#0f172a", glow: "#818cf8" },
  mountain:  { icon: "🏔️", from: "#14532d", to: "#052e16", glow: "#4ade80" },
  insect:    { icon: "🦂", from: "#713f12", to: "#1c1917", glow: "#facc15" },
  workplace: { icon: "💼", from: "#7f1d1d", to: "#1c1917", glow: "#f87171" },
  exam:      { icon: "📝", from: "#4c1d95", to: "#1e1b4b", glow: "#c084fc" },
  temple:    { icon: "🏰", from: "#7c2d12", to: "#1c1917", glow: "#fb923c" },
  treasure:  { icon: "📦", from: "#78350f", to: "#1c1917", glow: "#fbbf24" },
  worldboss: { icon: "🌟", from: "#78350f", to: "#0f172a", glow: "#facc15" },
};
const TIER_COLOR = {
  common: "#94a3b8", rare: "#3b82f6", elite: "#a855f7",
  fierce: "#f97316", boss: "#ef4444", mythic: "#f59e0b", worldboss: "#facc15",
};

function hashInt(value) {
  let hash = 0;
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

// 確定性 SVG 佔位卡面（同 monsterId 永遠長一樣）
export function CardArtSVG({ view, dim = false }) {
  const fam = FAMILY_ART[view.family] || FAMILY_ART.ghost;
  const frame = TIER_COLOR[view.tier] || "#94a3b8";
  const tierIdx = Math.max(1, Math.min(6, view.tierIndex || 1));
  const isBoss = view.encounter === "boss" || view.encounter === "worldboss";
  const isKing = isBoss || view.encounter === "miniBoss";
  const rays = Math.min(14, 4 + tierIdx * (isBoss ? 2 : 1)); // 階級越高、王越強 → 光芒越多
  const angleSeed = hashInt(view.monsterId) % 360;
  const gid = `cardart-${view.monsterId}`;

  return (
    <svg viewBox="0 0 240 320" width="100%" height="100%" role="img" aria-label={dim ? "未取得卡片" : view.name}
      style={dim ? { filter: "grayscale(1) brightness(.45)", opacity: 0.6 } : undefined}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={fam.from} /><stop offset="100%" stopColor={fam.to} />
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor={fam.glow} stopOpacity=".55" /><stop offset="100%" stopColor={fam.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="320" fill={`url(#${gid})`} />
      <g opacity=".35">
        {Array.from({ length: rays }).map((_, i) => {
          const angle = ((i * 360 / rays) + angleSeed) * Math.PI / 180;
          return <line key={i} x1="120" y1="135" x2={120 + Math.cos(angle) * 135} y2={135 + Math.sin(angle) * 135}
            stroke={fam.glow} strokeWidth={isBoss ? 3 : 1.5} />;
        })}
      </g>
      <circle cx="120" cy="135" r="92" fill={`url(#${gid}-glow)`} />
      <circle cx="120" cy="135" r="64" fill="rgba(2,6,23,.35)" stroke={frame} strokeWidth="3" />
      <text x="120" y="158" textAnchor="middle" fontSize="64">{fam.icon}</text>
      {isKing && <text x="120" y="64" textAnchor="middle" fontSize={isBoss ? 34 : 26}>👑</text>}
      {/* Tier 圓點（T1-T6） */}
      <g>
        {Array.from({ length: tierIdx }).map((_, i) => (
          <circle key={i} cx={120 + (i - (tierIdx - 1) / 2) * 16} cy="258" r="5" fill={frame} />
        ))}
      </g>
    </svg>
  );
}

// 統一卡面：已取得→實圖(lazy+有限fallback,終端=SVG佔位);未取得→暗化 SVG(零請求)
export default function CardArtImage({ view }) {
  const sources = ownedArtSources(view); // 未取得回 []
  const [index, setIndex] = useState(0);
  if (view.owned && index < sources.length) {
    return (
      <img
        src={sources[index]}
        alt={view.name}
        loading="lazy"
        decoding="async"
        draggable="false"
        onError={() => setIndex(n => n + 1)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }
  return <CardArtSVG view={view} dim={!view.owned} />;
}
