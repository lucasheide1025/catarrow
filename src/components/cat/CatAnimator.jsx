// src/components/cat/CatAnimator.jsx — 貓貓動畫渲染器
// Phase 1: SVG 模擬（可用 CSS 切換 6+ 種動畫狀態）
// Phase 2: 無痛取代為 Sprite Sheet 版（同 props 介面）
//
// 用法：<CatAnimator catId="haji" animation="happy" size={80} />

import { useMemo } from "react";
import { CATS } from "../../lib/catData";

// ═══════════════════════════════════════════════════════════════
// CSS 動畫（注入一次即可）
// ═══════════════════════════════════════════════════════════════
const ANIM_CSS = `
@keyframes ca-idle-breathe {
  0%, 100% { transform: scaleY(1) translateY(0); }
  50%      { transform: scaleY(1.025) translateY(-2px); }
}
@keyframes ca-idle-blink {
  0%, 94%, 100% { transform: scaleY(1); }
  97%           { transform: scaleY(0.08); }
}
@keyframes ca-idle-tail {
  0%, 100% { transform: rotate(-6deg); }
  50%      { transform: rotate(6deg); }
}
@keyframes ca-happy-bounce {
  0%   { transform: translateY(0) scale(1); }
  20%  { transform: translateY(-18px) scale(1.08) rotate(-4deg); }
  40%  { transform: translateY(-24px) scale(1.12) rotate(3deg); }
  60%  { transform: translateY(-8px) scale(1.06) rotate(-2deg); }
  80%  { transform: translateY(-3px) scale(1.02); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes ca-happy-sparkle {
  0%   { opacity: 0; transform: scale(0) translateY(0); }
  40%  { opacity: 1; transform: scale(1.2) translateY(-16px); }
  100% { opacity: 0; transform: scale(0.5) translateY(-32px); }
}
@keyframes ca-miss-shake {
  0%   { transform: translateX(0) rotate(0); }
  15%  { transform: translateX(-10px) rotate(-6deg); }
  30%  { transform: translateX(9px) rotate(5deg); }
  45%  { transform: translateX(-7px) rotate(-3deg); }
  60%  { transform: translateX(5px) rotate(2deg); }
  80%  { transform: translateX(-2px) rotate(-1deg); }
  100% { transform: translateX(0) rotate(0); }
}
@keyframes ca-miss-star {
  0%   { opacity: 0; transform: scale(0) rotate(0); }
  50%  { opacity: 1; transform: scale(1) rotate(180deg); }
  100% { opacity: 0; transform: scale(0.3) rotate(360deg); }
}
@keyframes ca-attack-pounce {
  0%   { transform: translateX(0) translateY(0) scale(1); }
  20%  { transform: translateX(-5px) translateY(-8px) scale(1.06); }
  40%  { transform: translateX(24px) translateY(4px) scale(1.18); }
  55%  { transform: translateX(28px) translateY(2px) scale(1.14) rotate(-4deg); }
  75%  { transform: translateX(8px) translateY(-2px) scale(1.02); }
  100% { transform: translateX(0) translateY(0) scale(1); }
}
@keyframes ca-attack-paw {
  0%   { opacity: 0; transform: translateX(0) scale(0.5); }
  30%  { opacity: 1; transform: translateX(18px) scale(1.3); }
  55%  { opacity: 1; transform: translateX(22px) scale(1.1) rotate(-10deg); }
  80%  { opacity: 0.6; transform: translateX(5px) scale(0.8); }
  100% { opacity: 0; transform: translateX(0) scale(0.5); }
}
@keyframes ca-victory-jump {
  0%   { transform: translateY(0) scale(1) rotate(0); }
  20%  { transform: translateY(-28px) scale(1.15) rotate(-8deg); }
  35%  { transform: translateY(-34px) scale(1.1) rotate(4deg); }
  55%  { transform: translateY(-14px) scale(1.08) rotate(-3deg); }
  75%  { transform: translateY(-4px) scale(1.04); }
  100% { transform: translateY(0) scale(1) rotate(0); }
}
@keyframes ca-victory-confetti {
  0%   { opacity: 0; transform: translateY(0) scale(0) rotate(0); }
  30%  { opacity: 1; transform: translateY(-10px) scale(1.2) rotate(120deg); }
  70%  { opacity: 0.8; transform: translateY(-22px) scale(0.9) rotate(240deg); }
  100% { opacity: 0; transform: translateY(-34px) scale(0.4) rotate(360deg); }
}
@keyframes ca-sleep-breathe {
  0%, 100% { transform: scaleY(1) translateY(0); }
  50%      { transform: scaleY(1.015) translateY(-1px); }
}
@keyframes ca-sleep-zzz {
  0%   { opacity: 0; transform: translateY(0) scale(0.5); }
  30%  { opacity: 0.8; transform: translateY(-6px) scale(1); }
  70%  { opacity: 0.6; transform: translateY(-14px) scale(0.9); }
  100% { opacity: 0; transform: translateY(-22px) scale(0.6); }
}
@keyframes ca-alert-flinch {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.12); }
  55%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}
@keyframes ca-alert-ear-twitch {
  0%, 100% { transform: rotate(0); }
  15%      { transform: rotate(8deg); }
  30%      { transform: rotate(-5deg); }
  45%      { transform: rotate(6deg); }
}
`;

// ═══════════════════════════════════════════════════════════════
// 九貓專屬特徵（不佔用外部 import，相容離線使用）
// ═══════════════════════════════════════════════════════════════
const CAT_PROFILES = {
  daming:   { earAngle: -2, eyeSize: 1.0, tailCurve: "M54,54 Q64,38 58,28", bodyW: 0.85, bodyH: 0.9 },
  gege:     { earAngle: 0,  eyeSize: 1.1, tailCurve: "M54,54 Q66,34 56,26", bodyW: 0.9,  bodyH: 0.95 },
  meimei:   { earAngle: 4,  eyeSize: 1.2, tailCurve: "M54,54 Q62,30 54,22", bodyW: 0.82, bodyH: 0.88 },
  niuniu:   { earAngle: -4, eyeSize: 0.9, tailCurve: "M54,54 Q60,40 56,30", bodyW: 0.95, bodyH: 1.0 },
  haji:     { earAngle: 6,  eyeSize: 1.3, tailCurve: "M54,54 Q68,36 60,24", bodyW: 0.88, bodyH: 0.92 },
  baobao:   { earAngle: 8,  eyeSize: 1.25, tailCurve: "M54,54 Q64,32 52,20", bodyW: 0.8,  bodyH: 0.85 },
  youyou:   { earAngle: -2, eyeSize: 0.7, tailCurve: "M54,54 Q58,38 54,26", bodyW: 0.92, bodyH: 0.96 },
  xiaoan:   { earAngle: -6, eyeSize: 0.95, tailCurve: "M54,54 Q62,42 58,32", bodyW: 0.87, bodyH: 0.88 },
  diandian: { earAngle: 2,  eyeSize: 1.15, tailCurve: "M54,54 Q66,40 62,28", bodyW: 0.9,  bodyH: 0.93 },
};

// ═══════════════════════════════════════════════════════════════
// 特效協助函數
// ═══════════════════════════════════════════════════════════════
function Sparkles({ count = 2, color = "#fbbf24" }) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const x = 38 + Math.sin(i * 2.1) * 14 + 4;
    const y = 22 + Math.cos(i * 1.7) * 10;
    const delay = i * 0.15;
    const size = 4 + (i % 3) * 2;
    items.push(
      <text key={i} x={x} y={y} fontSize={size} fill={color}
        style={{ animation: `ca-happy-sparkle 0.8s ${delay}s ease-out both` }}>
        ✦
      </text>
    );
  }
  return <g className="ca-sparkles">{items}</g>;
}

function DizzyStars({ count = 3 }) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const x = 26 + i * 16 + Math.sin(i) * 4;
    const y = 14 + Math.cos(i * 1.3) * 6;
    const delay = i * 0.12;
    items.push(
      <text key={i} x={x} y={y} fontSize={10} fill="#94a3b8"
        style={{ animation: `ca-miss-star 0.7s ${delay}s ease-out both` }}>
        ⭐
      </text>
    );
  }
  return <g className="ca-stars">{items}</g>;
}

function ZzzText() {
  return (
    <g className="ca-zzz">
      {[0, 1, 2].map(i => (
        <text key={i} x={62 + i * 6} y={22 - i * 8} fontSize={8 + i * 2}
          fill="rgba(255,255,255,0.5)"
          style={{ animation: `ca-sleep-zzz 2s ${i * 0.6}s ease-out infinite` }}>
          z
        </text>
      ))}
    </g>
  );
}

function AttackPaw({ color = "#fbbf24" }) {
  return (
    <text x={54} y={44} fontSize={16}
      style={{ animation: "ca-attack-paw 0.9s ease-out both" }}
      fill={color}>
      🐾
    </text>
  );
}

function VictoryConfetti() {
  const colors = ["#fbbf24", "#f472b6", "#60a5fa", "#34d399", "#a78bfa"];
  return (
    <g className="ca-confetti">
      {[0, 1, 2, 3, 4].map(i => (
        <text key={i} x={32 + i * 10} y={36} fontSize={8}
          fill={colors[i]} style={{ animation: `ca-victory-confetti 1.2s ${i * 0.1}s ease-out both` }}>
          {["✦", "●", "♥", "▲", "★"][i]}
        </text>
      ))}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════
// 貓貓本體 SVG
// ═══════════════════════════════════════════════════════════════
function CatSvgBody({ palette, profile, animation, noteOpacity }) {
  const b = palette.base;
  const p = palette.patch;
  const l = palette.light;
  const eyeBright = "#1c1917";
  const noseColor = "#f9a8d4";

  // 耳朵是否豎起（alert 時豎更高）
  const earBoost = animation === "alert" ? 1.3 : animation === "happy" || animation === "victory" ? 1.15 : 1;
  const earSkew = animation === "miss" ? 0.85 : 1;

  return (
    <g style={{ transformOrigin: "44px 52px" }}>
      {/* 尾巴 */}
      <path d={profile.tailCurve}
        fill="none" stroke={p} strokeWidth="4" strokeLinecap="round"
        style={{ transformOrigin: "56px 50px", animation: "ca-idle-tail 2.2s ease-in-out infinite" }} />

      {/* 身體 */}
      <ellipse cx="44" cy="52" rx={12 * profile.bodyW} ry={14 * profile.bodyH}
        fill={b} stroke={p} strokeWidth="0.8" />

      {/* 前腳 */}
      <rect x="34" y="60" width="6" height="7" rx="3" fill={p} opacity={noteOpacity} />
      <rect x="46" y="60" width="6" height="7" rx="3" fill={p} opacity={noteOpacity} />

      {/* ═══ 頭 ═══ */}
      <g style={{ transformOrigin: "44px 36px" }}>
        {/* 左耳 */}
        <polygon points={`${28 * earSkew},24 ${22 * earSkew},10 ${34 * earSkew},18`}
          fill={b} stroke={p} strokeWidth="0.8"
          style={{ transformOrigin: "28px 22px", animation: animation === "alert" ? "ca-alert-ear-twitch 0.5s ease-in-out 2" : "none" }} />
        <polygon points={`${29 * earSkew},23 ${24 * earSkew},13 ${33 * earSkew},19`}
          fill={l} />

        {/* 右耳 */}
        <polygon points={`${60 * earSkew},24 ${66 * earSkew},10 ${54 * earSkew},18`}
          fill={b} stroke={p} strokeWidth="0.8"
          style={{ transformOrigin: "60px 22px", animation: animation === "alert" ? "ca-alert-ear-twitch 0.5s 0.1s ease-in-out 2" : "none" }} />
        <polygon points={`${59 * earSkew},23 ${64 * earSkew},13 ${55 * earSkew},19`}
          fill={l} />

        {/* 頭部圓形 */}
        <circle cx="44" cy="36" r={16} fill={b} stroke={p} strokeWidth="0.8" />

        {/* 斑紋 patch */}
        {animation !== "sleep" && (
          <>
            <circle cx="34" cy="31" r={4} fill={p} opacity="0.15" />
            <circle cx="54" cy="33" r={5} fill={p} opacity="0.12" />
          </>
        )}

        {/* 眼睛（idle 時會眨眼，sleep 時閉眼，miss 時驚嚇睜大） */}
        <g className="ca-eyes" style={{ animation: animation === "idle" ? "ca-idle-blink 3.2s ease-in-out infinite" : "none" }}>
          {animation === "sleep" ? (
            // 閉眼（睡眠）
            <>
              <path d="M33,34 Q37,37 41,34" fill="none" stroke={eyeBright} strokeWidth="1.2" strokeLinecap="round" />
              <path d="M47,34 Q51,37 55,34" fill="none" stroke={eyeBright} strokeWidth="1.2" strokeLinecap="round" />
            </>
          ) : animation === "miss" ? (
            // 驚嚇瞪大眼
            <>
              <circle cx="37" cy="35" r={5} fill="white" />
              <circle cx="51" cy="35" r={5} fill="white" />
              <circle cx="37" cy="35" r={2.8} fill={eyeBright} />
              <circle cx="51" cy="35" r={2.8} fill={eyeBright} />
            </>
          ) : animation === "happy" || animation === "victory" ? (
            // 開心瞇瞇眼
            <>
              <path d="M33,36 Q36,33 39,36" fill="none" stroke={eyeBright} strokeWidth="1.5" strokeLinecap="round" />
              <path d="M47,36 Q50,33 53,36" fill="none" stroke={eyeBright} strokeWidth="1.5" strokeLinecap="round" />
            </>
          ) : (
            // 正常眼睛
            <>
              <ellipse cx="36" cy="35" rx={4} ry={4.5 * profile.eyeSize} fill="white" />
              <ellipse cx="50" cy="35" rx={4} ry={4.5 * profile.eyeSize} fill="white" />
              <ellipse cx="36" cy="35" rx={2.2} ry={3} fill={eyeBright} />
              <ellipse cx="50" cy="35" rx={2.2} ry={3} fill={eyeBright} />
              {/* 眼神光 */}
              <circle cx="34.5" cy="33.5" r="1.2" fill="white" opacity="0.8" />
              <circle cx="48.5" cy="33.5" r="1.2" fill="white" opacity="0.8" />
            </>
          )}
        </g>

        {/* 鼻子 */}
        <ellipse cx="43" cy="38.5" rx="1.8" ry="1.2" fill={noseColor} />

        {/* 嘴巴 */}
        <path d="M43,40 Q40,43 39,41" fill="none" stroke={eyeBright} strokeWidth="0.7" strokeLinecap="round" />
        <path d="M43,40 Q46,43 47,41" fill="none" stroke={eyeBright} strokeWidth="0.7" strokeLinecap="round" />

        {/* 鬍鬚 */}
        <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" strokeLinecap="round">
          <line x1="30" y1="37" x2="22" y2="35" />
          <line x1="30" y1="39" x2="21" y2="40" />
          <line x1="30" y1="41" x2="23" y2="44" />
          <line x1="58" y1="37" x2="66" y2="35" />
          <line x1="58" y1="39" x2="67" y2="40" />
          <line x1="58" y1="41" x2="65" y2="44" />
        </g>
      </g>
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════
// 靜態版本（當 enabled=false 時使用，無 CSS 動畫）
// ═══════════════════════════════════════════════════════════════
function StaticCat({ catId, size }) {
  const cat = CATS[catId];
  const palette = cat?.palette || { base: "#fef9c3", patch: "#c4a882", light: "#fffbeb" };
  const profile = CAT_PROFILES[catId] || CAT_PROFILES.haji;
  const deceased = cat?.isDeceased || false;
  const b = palette.base, p = palette.patch, eyeBright = "#1c1917";

  return (
    <svg viewBox="0 0 88 72" width={size} height={Math.round(size * (72 / 88))}
      style={{ display: "block", filter: deceased ? "grayscale(0.6) brightness(0.7)" : "none" }}>
      {deceased && <rect x="0" y="0" width="88" height="72" fill="rgba(49,46,129,0.2)" rx="8" />}
      <path d={profile.tailCurve} fill="none" stroke={p} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="44" cy="52" rx={12 * profile.bodyW} ry={14 * profile.bodyH} fill={b} stroke={p} strokeWidth="0.8" />
      <polygon points="24,24 18,10 30,18" fill={b} stroke={p} strokeWidth="0.8" />
      <polygon points="56,24 62,10 50,18" fill={b} stroke={p} strokeWidth="0.8" />
      <circle cx="44" cy="36" r={16} fill={b} stroke={p} strokeWidth="0.8" />
      <ellipse cx="36" cy="35" rx={3.5} ry={4} fill="white" />
      <ellipse cx="50" cy="35" rx={3.5} ry={4} fill="white" />
      <ellipse cx="36" cy="35" rx={2} ry={2.5} fill={eyeBright} />
      <ellipse cx="50" cy="35" rx={2} ry={2.5} fill={eyeBright} />
      <circle cx="34.5" cy="33.5" r="1.2" fill="white" opacity="0.8" />
      <circle cx="48.5" cy="33.5" r="1.2" fill="white" opacity="0.8" />
      {deceased && (<circle cx="44" cy="10" r="8" fill="none" stroke="rgba(196,181,253,0.5)" strokeWidth="1.5" strokeDasharray="3,2" />)}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// 主元件
// ═══════════════════════════════════════════════════════════════
// Props:
//   catId      - 貓咪 ID（對應 CATS key）
//   animation  - 動畫狀態：idle | happy | miss | attack | victory | sleep | alert
//   size       - 顯示尺寸 px
//   visible    - 是否顯示（預設 true，由 useCatAnimationAccess 控制）
//   enabled    - 是否啟用動畫（預設 true，由 useCatAnimationAccess 控制）
//
//   當 visible=false → 不渲染任何東西
//   當 visible=true & enabled=false → 渲染靜態 SVG（無動畫）
//   當 visible=true & enabled=true → 渲染完整動畫 SVG
export default function CatAnimator({ catId = "haji", animation = "idle", size = 80, visible = true, enabled = true }) {
  // ═══ 權限檢查 ═══
  if (!visible) return null;

  const cat = CATS[catId];
  const palette = cat?.palette || { base: "#fef9c3", patch: "#c4a882", light: "#fffbeb" };
  const profile = CAT_PROFILES[catId] || CAT_PROFILES.haji;
  const deceased = cat?.isDeceased || false;

  // ═══ 動畫關閉 → 靜態版 ═══
  if (!enabled) {
    return <StaticCat catId={catId} size={size} />;
  }

  // ═══ 動畫啟用 → 完整版 ═══
  // 選擇身體動畫
  const bodyAnim = useMemo(() => {
    switch (animation) {
      case "happy":   return "ca-happy-bounce 0.9s cubic-bezier(.34,1.56,.64,1) both";
      case "miss":    return "ca-miss-shake 0.7s ease-out both";
      case "attack":  return "ca-attack-pounce 1s cubic-bezier(.22,.68,.6,1) both";
      case "victory": return "ca-victory-jump 1.1s cubic-bezier(.34,1.56,.64,1) both";
      case "sleep":   return "ca-sleep-breathe 3s ease-in-out infinite";
      case "alert":   return "ca-alert-flinch 0.6s ease-out both";
      default:        return "ca-idle-breathe 2.4s ease-in-out infinite";
    }
  }, [animation]);

  // 呼吸透明度（sleep 時略暗）
  const noteOpacity = animation === "sleep" ? 0.6 : 1;

  return (
    <div style={{
      position: "relative",
      width: size,
      height: size,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      imageRendering: "pixelated",
    }}>
      <style>{ANIM_CSS}</style>

      <svg viewBox="0 0 88 72"
        width={size}
        height={Math.round(size * (72 / 88))}
        style={{
          display: "block",
          overflow: "visible",
          filter: deceased ? "grayscale(0.6) brightness(0.7)" : "none",
        }}>
        {/* 已故貓 overlay */}
        {deceased && (
          <rect x="0" y="0" width="88" height="72" fill="rgba(49,46,129,0.2)" rx="8" />
        )}

        <g style={{ transformOrigin: "44px 52px", animation: bodyAnim }}>
          <CatSvgBody palette={palette} profile={profile} animation={animation} noteOpacity={noteOpacity} />
        </g>

        {/* 特效層 */}
        {animation === "happy"   && <Sparkles count={3} color="#fbbf24" />}
        {animation === "victory" && <Sparkles count={4} color="#f472b6" />}
        {animation === "miss"    && <DizzyStars count={3} />}
        {animation === "attack"  && <AttackPaw color={palette.patch} />}
        {animation === "victory" && <VictoryConfetti />}
        {animation === "sleep"   && <ZzzText />}

        {/* 天使光環 */}
        {deceased && (
          <circle cx="44" cy="10" r="8" fill="none" stroke="rgba(196,181,253,0.5)" strokeWidth="1.5"
            strokeDasharray="3,2" />
        )}
      </svg>

      {/* 動畫狀態標籤（僅開發用，生產時隱藏） */}
      {process.env.NODE_ENV === "development" && (
        <span style={{
          position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
          fontSize: 8, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap",
          pointerEvents: "none",
        }}>
          {animation}
        </span>
      )}
    </div>
  );
}
