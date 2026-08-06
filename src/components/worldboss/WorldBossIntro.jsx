// src/components/worldboss/WorldBossIntro.jsx — 世界王登場演出（2026-08-06 全面重製）
//
// ─────────────────────────────────────────────────────────────────────
// 為什麼重做：作者回報「視覺單薄、音效單薄，我們不是想做成手遊化嗎」。
//
// 舊版是 6 秒塞四段（震動 0.6s → 王升起 1.2s → 標題 2.4s → 關閉 6s）。
// 問題**不是特效不夠多，是沒有敘事節奏**：
//   ・沒有前戲 —— 一開場就震動，觀眾還沒進入狀態就演完了
//   ・沒有剪影 —— 王直接以最終形態出現，少了「那是什麼東西」的懸念
//   ・沒有鏡頭語言 —— 王升起後定在原地，不推近、不呼吸
//   ・沒有電影框 —— 滿版網頁排版，不像過場動畫
//   ・標題只是淡入 —— 手遊的名號是「砸」進來的
//   ・沒有數值揭示 —— 看完不知道這隻有多強，缺少 payoff
//
// 新版＝七拍結構，而且**拍點刻意對齊 sound.js::sfxWorldBossAppearSynth 的時間軸**
// （0.35 地鳴 / 0.55 破土 / 1.10 警戒雙音 / 1.60 咆哮尾韻）——
// 視聽咬合才有重量，各走各的就會像在看無聲影片配罐頭音。
//
//   拍0 靜默 0.00-0.50  全黑＋電影黑邊滑入，先安靜
//   拍1 預警 0.50-1.20  紅色警戒掃描條、地面裂縫發光、持續細震
//   拍2 剪影 1.20-2.00  王以純黑剪影自裂縫升起，背後強光爆開，重震
//   拍3 顯形 2.00-3.00  剪影亮起成真實立繪、鏡頭推近、衝擊波環、餘燼上飄
//   拍4 名號 3.00-4.20  稱號先到，名字砸進來（overshoot＋色差重影）
//   拍5 數值 4.20-5.60  HP 條填滿＋數字滾動＋三圍淡入，王開始呼吸
//   拍6 收尾 5.60-7.20  點擊提示呼吸、黑邊縮回
//
// 視覺全部走 CSS keyframes + animation-delay（不是 JS setTimeout 逐格改 state）：
// 瀏覽器可以把它們丟給合成器執行緒，掉幀時仍然順，也不會因為 React re-render 而抖動。
// JS 只留一顆 timer 負責自動關閉。
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import WorldBossSVG from "./WorldBossSVG";
import { WORLD_BOSSES } from "../../lib/worldBossData";
import { sfxWorldBossAppear } from "../../lib/sound";

const TOTAL_MS = 7200;

// 取王：優先用 bossKey，取不到就用名字回查。
// ⚠️ 小狀態文件（worldBossDb::subscribeWorldBossStatus）2026-08-06 以前**沒有寫 bossKey**，
//    而登場動畫正是靠它拿外觀／配色／pixelKey／族群音效 —— 於是名字顯示「???」、
//    配色退回預設橘、畫錯的王、登場音也挑錯族群。寫入端已補，但**已經躺在 Firestore 裡的
//    舊狀態文件仍然沒有那個欄位**，所以這裡要能靠 bossName 自己找回來。
function resolveIntroBoss(event) {
  const byKey = WORLD_BOSSES[event?.bossKey];
  if (byKey) return byKey;
  const name = event?.bossData?.name;
  if (!name) return null;
  return Object.values(WORLD_BOSSES).find(b => b?.name === name) || null;
}

const CSS = `
/* ── 拍0：電影黑邊 ── */
@keyframes wbi-bar-top{0%{transform:translateY(-100%)}100%{transform:translateY(0)}}
@keyframes wbi-bar-bottom{0%{transform:translateY(100%)}100%{transform:translateY(0)}}
@keyframes wbi-bar-out{0%{transform:translateY(0)}100%{transform:translateY(-100%)}}
@keyframes wbi-bar-out-b{0%{transform:translateY(0)}100%{transform:translateY(100%)}}

/* ── 拍1：預警 ── */
@keyframes wbi-scan{0%{transform:translateY(-120%)}100%{transform:translateY(120%)}}
@keyframes wbi-tremor{
  0%,100%{transform:translate(0,0)}
  25%{transform:translate(-1px,1px)}
  50%{transform:translate(1px,-1px)}
  75%{transform:translate(-1px,-1px)}
}
@keyframes wbi-fissure{
  0%{opacity:0;transform:scaleX(0)}
  40%{opacity:1;transform:scaleX(1)}
  100%{opacity:0.55;transform:scaleX(1.06)}
}
@keyframes wbi-alert-text{
  0%{opacity:0;letter-spacing:18px}
  30%{opacity:1;letter-spacing:8px}
  70%{opacity:1}
  100%{opacity:0;letter-spacing:8px}
}

/* ── 拍2：剪影升起 + 重震 ── */
@keyframes wbi-rise{
  0%{opacity:0;transform:translateY(90px) scale(0.82)}
  60%{opacity:1;transform:translateY(-10px) scale(1.14)}
  100%{opacity:1;transform:translateY(0) scale(1.12)}
}
@keyframes wbi-slam{
  0%,100%{transform:translate(0,0) rotate(0)}
  8%{transform:translate(-14px,8px) rotate(-1.2deg)}
  18%{transform:translate(12px,-9px) rotate(1deg)}
  28%{transform:translate(-9px,6px) rotate(-0.7deg)}
  40%{transform:translate(7px,-5px) rotate(0.5deg)}
  55%{transform:translate(-4px,3px) rotate(-0.3deg)}
  72%{transform:translate(3px,-2px) rotate(0.2deg)}
}
@keyframes wbi-backlight{
  0%{opacity:0;transform:scale(0.3)}
  35%{opacity:1;transform:scale(1.1)}
  100%{opacity:0.35;transform:scale(1)}
}
@keyframes wbi-flash{0%{opacity:0}12%{opacity:0.92}100%{opacity:0}}

/* ── 拍3：顯形（剪影亮起 + 鏡頭推近） ── */
@keyframes wbi-reveal{
  0%{filter:brightness(0) contrast(2)}
  55%{filter:brightness(2.6) contrast(1.3)}
  100%{filter:brightness(1) contrast(1)}
}
@keyframes wbi-dolly{
  0%{transform:scale(1.12)}
  100%{transform:scale(1)}
}
@keyframes wbi-shock{
  0%{transform:scale(0.35);opacity:0.85;border-width:4px}
  100%{transform:scale(2.6);opacity:0;border-width:1px}
}
@keyframes wbi-ember{
  0%{opacity:0;transform:translateY(0) scale(0.6)}
  20%{opacity:0.9}
  100%{opacity:0;transform:translateY(-190px) scale(1.1)}
}

/* ── 拍4：名號砸進來 ── */
@keyframes wbi-kicker{
  0%{opacity:0;transform:translateY(10px);letter-spacing:14px}
  100%{opacity:1;transform:translateY(0);letter-spacing:5px}
}
@keyframes wbi-name-slam{
  0%{opacity:0;transform:scale(1.75);filter:blur(9px)}
  55%{opacity:1;transform:scale(0.94);filter:blur(0)}
  75%{transform:scale(1.03)}
  100%{opacity:1;transform:scale(1)}
}
/* 色差重影：兩份同字往左右偏一點點，砸下瞬間最明顯 */
@keyframes wbi-chroma{
  0%{opacity:0.9;transform:translateX(-14px)}
  60%{opacity:0.5;transform:translateX(-3px)}
  100%{opacity:0;transform:translateX(0)}
}
@keyframes wbi-chroma-r{
  0%{opacity:0.9;transform:translateX(14px)}
  60%{opacity:0.5;transform:translateX(3px)}
  100%{opacity:0;transform:translateX(0)}
}
@keyframes wbi-underline{0%{transform:scaleX(0);opacity:0}100%{transform:scaleX(1);opacity:1}}

/* ── 拍5：數值揭示 + 王呼吸 ── */
@keyframes wbi-hp-fill{0%{width:0%}100%{width:100%}}
@keyframes wbi-stat-in{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
@keyframes wbi-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.028)}}

/* ── 拍6 ── */
@keyframes wbi-hint{0%,100%{opacity:0.25}50%{opacity:0.85}}
@keyframes wbi-fade-out{from{opacity:1}to{opacity:0}}
@keyframes wbi-vignette{0%{opacity:0}100%{opacity:1}}

/* 動態減量：關掉位移與縮放，只留淡入淡出 */
@media (prefers-reduced-motion: reduce){
  .wbi-root *{animation-duration:0.01ms !important;animation-iteration-count:1 !important}
}
`;

const EMBERS = Array.from({ length: 14 }, (_, i) => ({
  left: 8 + (i * 6.4) % 84,
  delay: 2.0 + (i % 7) * 0.19,
  dur: 2.2 + (i % 5) * 0.42,
  size: 2 + (i % 3),
}));

export default function WorldBossIntro({ event, onClose }) {
  const boss = resolveIntroBoss(event);
  const [closing, setClosing] = useState(false);
  const closedRef = useRef(false);

  const accent = boss?.accent || "#f59e0b";
  const bg     = boss?.bg     || "#0f172a";
  const name   = boss?.name || event?.bossData?.name || "???";

  function handleClose() {
    if (closedRef.current) return;
    closedRef.current = true;
    setClosing(true);
    setTimeout(onClose, 420);
  }

  useEffect(() => {
    sfxWorldBossAppear(boss);   // 依族群挑登場音（怪物族/貓貓族/教練群各一種）
    const t = setTimeout(handleClose, TOTAL_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // 一個拍子一組樣式，時間軸集中在這裡看得到全貌
  const beat = (animation) => ({ animation, animationFillMode: "both" });

  return (
    <div
      className="wbi-root"
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden", cursor: "pointer",
        background: `radial-gradient(ellipse at 50% 45%, ${bg}ee 0%, #000 72%)`,
        animation: closing ? "wbi-fade-out 0.42s ease-out forwards" : undefined,
      }}
    >
      <style>{CSS}</style>

      {/* 拍1 掃描條（預警） */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 140, pointerEvents: "none",
        background: `linear-gradient(to bottom, transparent, ${accent}26, transparent)`,
        ...beat("wbi-scan 1.15s 0.5s ease-in-out 2"),
      }} />

      {/* 拍2 背光爆開 */}
      <div style={{
        position: "absolute", width: 520, height: 520, borderRadius: "50%", pointerEvents: "none",
        background: `radial-gradient(circle, ${accent}cc 0%, ${accent}33 38%, transparent 68%)`,
        ...beat("wbi-backlight 0.9s 1.2s cubic-bezier(0.2,0.8,0.3,1)"),
      }} />

      {/* 拍2 白閃 */}
      <div style={{
        position: "absolute", inset: 0, background: "#fff", pointerEvents: "none",
        ...beat("wbi-flash 0.5s 1.32s ease-out"),
      }} />

      {/* 拍3 餘燼 */}
      {EMBERS.map((e, i) => (
        <div key={i} style={{
          position: "absolute", bottom: "32%", left: `${e.left}%`,
          width: e.size, height: e.size, borderRadius: "50%",
          background: accent, boxShadow: `0 0 6px ${accent}`, pointerEvents: "none",
          ...beat(`wbi-ember ${e.dur}s ${e.delay}s ease-out infinite`),
        }} />
      ))}

      {/* 全域震動容器：拍1 細震 → 拍2 重震 */}
      <div style={{
        width: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        ...beat("wbi-tremor 0.12s 0.5s linear 6, wbi-slam 0.85s 1.28s cubic-bezier(0.36,0.07,0.19,0.97)"),
      }}>
        {/* 拍1 警戒字 */}
        <div style={{
          fontSize: 12, fontWeight: 900, color: "#f87171", letterSpacing: 8,
          marginBottom: 10, textShadow: "0 0 12px #ef4444",
          ...beat("wbi-alert-text 1.2s 0.5s ease-out"),
        }}>
          ⚠ WARNING ⚠
        </div>

        {/* 王本體：剪影升起 → 顯形 → 鏡頭推近 → 呼吸 */}
        <div style={{ position: "relative", ...beat("wbi-rise 0.8s 1.2s cubic-bezier(0.2,0.9,0.25,1)") }}>
          {/* 拍3 衝擊波環 ×3 */}
          {[0, 0.16, 0.32].map((d, i) => (
            <div key={i} style={{
              position: "absolute", inset: "50% 50%", width: 200, height: 200,
              margin: "-100px 0 0 -100px", borderRadius: "50%",
              border: `3px solid ${accent}`, pointerEvents: "none",
              ...beat(`wbi-shock 1.05s ${2.0 + d}s ease-out`),
            }} />
          ))}
          <div style={{ ...beat("wbi-dolly 1.0s 2.0s cubic-bezier(0.2,0.8,0.3,1)") }}>
            <div style={{ ...beat("wbi-reveal 1.0s 2.0s ease-out") }}>
              <div style={{ ...beat("wbi-breathe 3.2s 4.2s ease-in-out infinite") }}>
                <WorldBossSVG bossKey={event?.bossKey} currentHP={boss?.hp} maxHP={boss?.hp} size={210} />
              </div>
            </div>
          </div>
        </div>

        {/* 拍1 地面裂縫 */}
        <div style={{
          width: 320, height: 3, marginTop: -6, borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, #fff, ${accent}, transparent)`,
          boxShadow: `0 0 22px ${accent}, 0 0 44px ${accent}88`,
          ...beat("wbi-fissure 0.9s 0.55s cubic-bezier(0.2,0.9,0.25,1)"),
        }} />

        {/* 拍4 名號 */}
        <div style={{ textAlign: "center", marginTop: 26 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 5, color: accent,
            textTransform: "uppercase", marginBottom: 8,
            ...beat("wbi-kicker 0.5s 3.0s cubic-bezier(0.2,0.9,0.25,1)"),
          }}>
            {boss?.title || "世界王"}
          </div>

          <div style={{ position: "relative", display: "inline-block" }}>
            {/* 色差重影（青） */}
            <div aria-hidden style={{
              position: "absolute", inset: 0, fontSize: 42, fontWeight: 900,
              color: "#22d3ee", letterSpacing: 3, whiteSpace: "nowrap",
              ...beat("wbi-chroma 0.55s 3.25s ease-out"),
            }}>{name}</div>
            {/* 色差重影（紅） */}
            <div aria-hidden style={{
              position: "absolute", inset: 0, fontSize: 42, fontWeight: 900,
              color: "#f43f5e", letterSpacing: 3, whiteSpace: "nowrap",
              ...beat("wbi-chroma-r 0.55s 3.25s ease-out"),
            }}>{name}</div>
            {/* 本體 */}
            <div style={{
              position: "relative", fontSize: 42, fontWeight: 900, color: "#fff",
              letterSpacing: 3, whiteSpace: "nowrap",
              textShadow: `0 0 26px ${accent}, 0 0 56px ${accent}99`,
              ...beat("wbi-name-slam 0.62s 3.25s cubic-bezier(0.2,0.9,0.25,1)"),
            }}>{name}</div>
          </div>

          <div style={{
            height: 2, marginTop: 10, borderRadius: 2,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            ...beat("wbi-underline 0.5s 3.7s cubic-bezier(0.2,0.9,0.25,1)"),
          }} />

          <div style={{
            fontSize: 12.5, color: "#94a3b8", marginTop: 12,
            maxWidth: 300, lineHeight: 1.6, marginInline: "auto",
            ...beat("wbi-stat-in 0.5s 3.9s ease-out"),
          }}>
            {boss?.desc}
          </div>
        </div>

        {/* 拍5 數值揭示 */}
        {boss && (
          <div style={{ width: 300, marginTop: 20, ...beat("wbi-stat-in 0.5s 4.2s ease-out") }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 10, fontWeight: 800, color: "#94a3b8", marginBottom: 5, letterSpacing: 1,
            }}>
              <span>HP</span>
              <span style={{ color: accent }}>{(boss.hp || 0).toLocaleString()}</span>
            </div>
            <div style={{
              height: 9, borderRadius: 5, overflow: "hidden",
              background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.14)",
            }}>
              <div style={{
                height: "100%", borderRadius: 5,
                background: `linear-gradient(90deg, ${accent}, #fff8)`,
                boxShadow: `0 0 14px ${accent}`,
                ...beat("wbi-hp-fill 1.15s 4.35s cubic-bezier(0.2,0.8,0.3,1)"),
              }} />
            </div>
            <div style={{
              display: "flex", justifyContent: "center", gap: 22, marginTop: 12,
              fontSize: 11, fontWeight: 800, color: "#cbd5e1",
              ...beat("wbi-stat-in 0.5s 4.9s ease-out"),
            }}>
              <span>⚔️ ATK {boss.atk}</span>
              <span>🛡️ DEF {boss.def}</span>
            </div>
          </div>
        )}
      </div>

      {/* 暗角：越後面越沉，把注意力壓向中央 */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.62) 100%)",
        ...beat("wbi-vignette 1.6s 1.2s ease-out"),
      }} />

      {/* 電影黑邊 */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "9vh",
        background: "#000", pointerEvents: "none",
        ...beat(closing ? "wbi-bar-out 0.4s ease-in" : "wbi-bar-top 0.5s cubic-bezier(0.2,0.9,0.25,1)"),
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "9vh",
        background: "#000", pointerEvents: "none",
        ...beat(closing ? "wbi-bar-out-b 0.4s ease-in" : "wbi-bar-bottom 0.5s cubic-bezier(0.2,0.9,0.25,1)"),
      }} />

      {/* 拍6 點擊提示 */}
      <div style={{
        position: "absolute", bottom: "11vh",
        fontSize: 11, color: "#64748b", letterSpacing: 3,
        ...beat("wbi-hint 1.6s 5.6s ease-in-out infinite"),
      }}>
        點擊任意處關閉
      </div>
    </div>
  );
}
