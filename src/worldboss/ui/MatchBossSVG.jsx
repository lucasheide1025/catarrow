// src/worldboss/ui/MatchBossSVG.jsx
// 比賽模式的王：**牠自己就是一張靶紙**。
//
// 為什麼是 SVG 而不是生圖：比賽當天要用，不能等生圖流程；而且靶紙王的意義
// 就是「大家一起射的那張紙」，畫成同心圓比任何立繪都直白。
//
// ⚠️ 牠**不會反擊**（作者指定）。所以沒有攻擊動作、沒有受傷閃紅——
//    只有中箭時的震一下與環的脈動，讓分數進來時看得到回饋。
import "./raidFx.css";

// 世界射箭總會的配色（由外而內）
const RINGS = [
  { r: 100, fill: "#f8fafc", stroke: "#94a3b8" },   // 1-2 白
  { r: 80, fill: "#1e293b", stroke: "#0f172a" },    // 3-4 黑
  { r: 60, fill: "#38bdf8", stroke: "#0284c7" },    // 5-6 藍
  { r: 40, fill: "#ef4444", stroke: "#b91c1c" },    // 7-8 紅
  { r: 20, fill: "#fbbf24", stroke: "#d97706" },    // 9-10 金
];

export default function MatchBossSVG({ size = 200, ratio = 1, hit = false, name = "靶紙王" }) {
  // 血越少眼睛越兇——唯一會隨進度變的東西
  const angry = ratio < 0.4;
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}
      className={hit ? "raid-boss-flinch" : "raid-boss-idle"}>
      <svg viewBox="-110 -110 220 220" width={size} height={size} role="img" aria-label={name}>
        <defs>
          <radialGradient id="mb-glow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="rgba(251,191,36,0)" />
            <stop offset="100%" stopColor="rgba(251,191,36,.35)" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="108" fill="url(#mb-glow)" />
        {RINGS.map(ring => (
          <circle key={ring.r} cx="0" cy="0" r={ring.r}
            fill={ring.fill} stroke={ring.stroke} strokeWidth="1.5" />
        ))}
        {/* 十環的中心點 */}
        <circle cx="0" cy="0" r="6" fill="none" stroke="#78350f" strokeWidth="1.2" />

        {/* 臉：畫在靶面上，讓牠變成一隻「王」而不只是一張紙 */}
        <g>
          <ellipse cx="-30" cy="-18" rx="13" ry={angry ? 9 : 13} fill="#0f172a" />
          <ellipse cx="30" cy="-18" rx="13" ry={angry ? 9 : 13} fill="#0f172a" />
          <circle cx="-26" cy="-21" r="4.5" fill="#f8fafc" />
          <circle cx="34" cy="-21" r="4.5" fill="#f8fafc" />
          {angry && (
            <>
              <path d="M-44 -32 L-18 -24" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
              <path d="M44 -32 L18 -24" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
            </>
          )}
          <path d={angry ? "M-20 34 Q0 20 20 34" : "M-20 26 Q0 42 20 26"}
            stroke="#0f172a" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </g>

        {/* 皇冠 */}
        <path d="M-34 -86 L-22 -66 L0 -92 L22 -66 L34 -86 L30 -58 L-30 -58 Z"
          fill="#fbbf24" stroke="#b45309" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
