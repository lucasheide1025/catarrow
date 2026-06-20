// src/components/worldboss/WorldBossIntro.jsx — 世界王登場震撼動畫
import { useEffect, useState } from "react";
import WorldBossSVG from "./WorldBossSVG";
import { WORLD_BOSSES } from "../../lib/worldBossData";

const CSS = `
@keyframes wbi-shake {
  0%,100%{transform:translate(0,0) rotate(0)}
  10%{transform:translate(-6px,-4px) rotate(-1deg)}
  20%{transform:translate(6px,4px) rotate(1deg)}
  30%{transform:translate(-5px,3px) rotate(-0.5deg)}
  40%{transform:translate(5px,-3px) rotate(0.5deg)}
  50%{transform:translate(-4px,5px) rotate(-1deg)}
  60%{transform:translate(4px,-5px) rotate(0.5deg)}
  70%{transform:translate(-3px,3px) rotate(0)}
  80%{transform:translate(3px,-3px) rotate(0.5deg)}
  90%{transform:translate(-2px,2px) rotate(-0.5deg)}
}
@keyframes wbi-crack {
  0%{opacity:0;transform:scaleY(0)}
  15%{opacity:1;transform:scaleY(1)}
  80%{opacity:0.7}
  100%{opacity:0}
}
@keyframes wbi-boss-rise {
  0%{opacity:0;transform:scale(0.1) translateY(80px);filter:brightness(5) blur(12px)}
  30%{opacity:1;transform:scale(1.25) translateY(-15px);filter:brightness(3) blur(2px)}
  55%{transform:scale(0.95) translateY(5px);filter:brightness(1.5) blur(0)}
  75%{transform:scale(1.06) translateY(-3px)}
  100%{transform:scale(1) translateY(0);filter:brightness(1)}
}
@keyframes wbi-warning {
  0%,100%{opacity:0}
  10%,90%{opacity:1}
  50%{opacity:0.5}
}
@keyframes wbi-title-in {
  0%{opacity:0;transform:translateY(20px) scale(0.85)}
  60%{transform:translateY(-4px) scale(1.04)}
  100%{opacity:1;transform:translateY(0) scale(1)}
}
@keyframes wbi-pulse-ring {
  0%{transform:scale(0.6);opacity:0.8}
  100%{transform:scale(2.2);opacity:0}
}
@keyframes wbi-lightning {
  0%,100%{opacity:0}
  5%{opacity:0.9}
  10%{opacity:0}
  40%{opacity:0}
  42%{opacity:0.7}
  44%{opacity:0}
}
@keyframes wbi-fade-out {
  from{opacity:1}
  to{opacity:0}
}
`;

export default function WorldBossIntro({ event, onClose }) {
  const boss = WORLD_BOSSES[event?.bossKey];
  const [phase, setPhase] = useState("shake"); // shake → reveal → title → done
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 600);
    const t2 = setTimeout(() => setPhase("title"),  1800);
    const t3 = setTimeout(() => setPhase("done"),   4200);
    const t4 = setTimeout(handleClose,              5200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []); // eslint-disable-line

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, 500);
  }

  const accent = boss?.accent || "#f59e0b";
  const bg     = boss?.bg     || "#0f172a";

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden", cursor: "pointer",
        animation: closing ? "wbi-fade-out 0.5s ease-out forwards" : undefined,
        background: `radial-gradient(ellipse at center, ${bg}dd 0%, #000 100%)`,
      }}
    >
      <style>{CSS}</style>

      {/* 閃電背景 */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse at 50% 40%, ${accent}22 0%, transparent 70%)`,
        animation: "wbi-lightning 3s ease-in-out infinite",
      }} />

      {/* 震動容器 */}
      <div style={{
        width: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 0,
        animation: phase === "shake" ? "wbi-shake 0.6s ease-in-out" : undefined,
      }}>
        {/* ⚠️ 警告條 */}
        <div style={{
          fontSize: 13, fontWeight: 900, letterSpacing: 6,
          color: "#ef4444", textTransform: "uppercase",
          padding: "6px 24px", border: "2px solid #ef4444",
          borderRadius: 4, marginBottom: 24,
          background: "#ef444422",
          animation: phase !== "done" ? "wbi-warning 1.2s ease-in-out infinite" : undefined,
          opacity: phase === "shake" ? 0 : 1,
          transition: "opacity 0.3s",
        }}>
          ⚠️ 世界王 登場 ⚠️
        </div>

        {/* 脈衝光環 */}
        {(phase === "reveal" || phase === "title" || phase === "done") && (
          <div style={{ position: "relative", marginBottom: 8 }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                position: "absolute", inset: -60,
                borderRadius: "50%",
                border: `2px solid ${accent}88`,
                animation: `wbi-pulse-ring 1.8s ${i * 0.9}s ease-out infinite`,
              }} />
            ))}
            {/* Boss 圖 */}
            <div style={{
              animation: phase === "reveal" || phase === "title" || phase === "done"
                ? "wbi-boss-rise 1.2s cubic-bezier(0.34,1.56,0.64,1) both"
                : undefined,
              filter: `drop-shadow(0 0 40px ${accent}) drop-shadow(0 0 80px ${accent}88)`,
            }}>
              <WorldBossSVG bossKey={event?.bossKey} currentHP={boss?.hp} maxHP={boss?.hp} size={180} />
            </div>
          </div>
        )}

        {/* Boss 名稱與稱號 */}
        {(phase === "title" || phase === "done") && (
          <div style={{
            textAlign: "center", marginTop: 32,
            animation: "wbi-title-in 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 4,
              color: accent, textTransform: "uppercase", marginBottom: 6,
            }}>
              {boss?.title || "世界王"}
            </div>
            <div style={{
              fontSize: 36, fontWeight: 900, color: "#fff",
              textShadow: `0 0 24px ${accent}, 0 0 48px ${accent}88`,
              letterSpacing: 3,
            }}>
              {boss?.name || "???"}
            </div>
            <div style={{
              fontSize: 13, color: "#94a3b8", marginTop: 8,
              maxWidth: 280, lineHeight: 1.5,
            }}>
              {boss?.desc}
            </div>
          </div>
        )}
      </div>

      {/* 點擊提示 */}
      {phase === "done" && (
        <div style={{
          position: "absolute", bottom: 48,
          fontSize: 12, color: "#475569", letterSpacing: 2,
          animation: "wbi-warning 1.5s ease-in-out infinite",
        }}>
          點擊任意處關閉
        </div>
      )}
    </div>
  );
}
