// src/worldboss/ui/MatchBossArt.jsx
// 比賽模式的王：**靶紙王**（作者 2026-08-01 提供的立繪，去背 WebP）。
//
// 取代原本手繪的 SVG 同心圓——那只是趕工的替代品。
//
// ⚠️ 牠**不會反擊**，所以沒有攻擊動作、沒有受傷閃紅：
//    只有中箭時震一下，以及血量低時整體轉暗紅，讓分數進來時看得到回饋。
// ⚠️ 圖檔載不到時要有 fallback：比賽當天現場網路不穩，
//    王消失會讓玩家以為畫面壞了。
import { useState } from "react";
import "./raidFx.css";

export const MATCH_BOSS_ART = "/assets/raid/match_boss.webp";

export default function MatchBossArt({ size = 200, ratio = 1, hit = false, name = "靶紙王" }) {
  const [failed, setFailed] = useState(false);
  const wounded = ratio < 0.4;

  if (failed) {
    // 圖載不到就退回一個看得懂的圓靶，不要讓王直接消失
    return (
      <div style={{ width: size, height: size, display: "grid", placeItems: "center" }}>
        <div style={{
          width: size * 0.8, height: size * 0.8, borderRadius: "50%",
          background: "radial-gradient(circle,#fbbf24 0 12%,#ef4444 12% 26%,#38bdf8 26% 40%,#1e293b 40% 54%,#f8fafc 54% 68%,transparent 68%)",
        }} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}
      className={hit ? "raid-boss-flinch" : "raid-boss-idle"}>
      {/* 王座光暈：血越少越紅 */}
      <div style={{
        position: "absolute", inset: "-8%", borderRadius: "50%",
        background: wounded
          ? "radial-gradient(circle, rgba(239,68,68,.34), transparent 62%)"
          : "radial-gradient(circle, rgba(251,191,36,.26), transparent 62%)",
        transition: "background .6s",
      }} />
      <img
        src={MATCH_BOSS_ART} alt={name}
        onError={() => setFailed(true)}
        style={{
          position: "relative", width: "100%", height: "100%", objectFit: "contain",
          filter: wounded
            ? "drop-shadow(0 0 14px rgba(239,68,68,.7)) saturate(.75) brightness(.82)"
            : "drop-shadow(0 6px 16px rgba(0,0,0,.75))",
          transition: "filter .6s",
        }}
      />
    </div>
  );
}
