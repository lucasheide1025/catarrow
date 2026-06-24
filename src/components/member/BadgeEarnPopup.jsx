// src/components/member/BadgeEarnPopup.jsx
import { useEffect } from "react";
import { sfxVictoryFanfare } from "../../lib/sound";

const CSS = `
@keyframes bep-bg   { 0%{opacity:0} 100%{opacity:1} }
@keyframes bep-badge {
  0%  { transform:scale(0.2) rotate(-25deg); opacity:0; }
  55% { transform:scale(1.18) rotate(6deg);  opacity:1; }
  72% { transform:scale(0.94) rotate(-3deg); }
  85% { transform:scale(1.05) rotate(1deg);  }
  100%{ transform:scale(1)    rotate(0deg);  opacity:1; }
}
@keyframes bep-glow {
  0%,100%{ opacity:0.7; transform:scale(1); }
  50%    { opacity:1;   transform:scale(1.15); }
}
@keyframes bep-particle {
  0%  { transform:translate(0,0) scale(1);   opacity:1; }
  100%{ transform:translate(var(--dx),var(--dy)) scale(0.1); opacity:0; }
}
@keyframes bep-title {
  0%  { opacity:0; transform:translateY(24px) scale(0.9); }
  100%{ opacity:1; transform:translateY(0)    scale(1);   }
}
@keyframes bep-shimmer {
  0%  { background-position:-250% center; }
  100%{ background-position: 250% center; }
}
@keyframes bep-ring {
  0%  { transform:scale(0.4); opacity:0.9; }
  100%{ transform:scale(2.8); opacity:0;   }
}
@keyframes bep-float {
  0%,100%{ transform:translateY(0); }
  50%    { transform:translateY(-10px); }
}
@keyframes bep-star-spin {
  0%  { transform:rotate(0deg)   scale(0); opacity:0; }
  20% { transform:rotate(45deg)  scale(1); opacity:1; }
  100%{ transform:rotate(360deg) scale(0); opacity:0; }
}
`;

const PARTICLES_POS = [
  { dx:"-10px",  dy:"-130px" }, { dx:"75px",   dy:"-105px" },
  { dx:"125px",  dy:"-20px"  }, { dx:"110px",  dy:"80px"  },
  { dx:"20px",   dy:"130px"  }, { dx:"-80px",  dy:"110px" },
  { dx:"-125px", dy:"20px"   }, { dx:"-90px",  dy:"-95px" },
  { dx:"50px",   dy:"-90px"  }, { dx:"-50px",  dy:"90px"  },
];

const BADGE = {
  silver: {
    emoji: "🥈", label: "銀章認證", sub: "你的努力已獲認可",
    bg: "radial-gradient(ellipse at 50% 30%, #1e3a5f 0%, #0f172a 60%, #060d1a 100%)",
    glowColor: "#94a3b8", ringColor: "rgba(148,163,184,0.5)",
    particleColor: "#e2e8f0", shimmerColor: "#94a3b8",
    shimmerBg: "linear-gradient(90deg,#64748b,#e2e8f0,#94a3b8,#e2e8f0,#64748b)",
    titleColor: "#e2e8f0",
    starColors: ["#94a3b8","#cbd5e1","#e2e8f0","#f1f5f9"],
  },
  gold: {
    emoji: "🥇", label: "金章認證", sub: "卓越成就，實至名歸",
    bg: "radial-gradient(ellipse at 50% 30%, #3d2800 0%, #1c1200 60%, #0a0800 100%)",
    glowColor: "#fbbf24", ringColor: "rgba(251,191,36,0.5)",
    particleColor: "#fde68a", shimmerColor: "#fbbf24",
    shimmerBg: "linear-gradient(90deg,#b45309,#fde68a,#fbbf24,#fde68a,#b45309)",
    titleColor: "#fde68a",
    starColors: ["#fbbf24","#fde68a","#f59e0b","#fffbeb"],
  },
  black: {
    emoji: "⬛", label: "黑章傳承", sub: "傳奇的境界，絕世之巔",
    bg: "radial-gradient(ellipse at 50% 25%, #1a0a2e 0%, #0d0618 55%, #030108 100%)",
    glowColor: "#a78bfa", ringColor: "rgba(167,139,250,0.45)",
    particleColor: "#c4b5fd", shimmerColor: "#a78bfa",
    shimmerBg: "linear-gradient(90deg,#3730a3,#a78bfa,#fbbf24,#a78bfa,#3730a3)",
    titleColor: "#e9d5ff",
    starColors: ["#a78bfa","#c4b5fd","#fbbf24","#7c3aed"],
  },
};

export default function BadgeEarnPopup({ badge, onClose }) {
  const cfg = BADGE[badge];
  useEffect(() => {
    sfxVictoryFanfare();
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  if (!cfg) return null;

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:9999,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      background:"rgba(0,0,0,0.88)",
      animation:"bep-bg 0.4s ease forwards",
    }}>
      <style>{CSS}</style>

      {/* 中心輝光 */}
      <div style={{
        position:"absolute", width:240, height:240, borderRadius:"50%",
        background:`radial-gradient(circle, ${cfg.glowColor}33 0%, transparent 70%)`,
        animation:"bep-glow 2s ease-in-out infinite",
      }}/>

      {/* 擴散環 */}
      {[0,1,2].map(i => (
        <div key={i} style={{
          position:"absolute", width:120, height:120, borderRadius:"50%",
          border:`2px solid ${cfg.ringColor}`,
          animation:`bep-ring 2.4s ease-out ${i * 0.7}s infinite`,
          pointerEvents:"none",
        }}/>
      ))}

      {/* 徽章 emoji */}
      <div style={{
        fontSize:96, lineHeight:1,
        animation:"bep-badge 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both, bep-float 3s ease-in-out 1s infinite",
        filter:`drop-shadow(0 0 30px ${cfg.glowColor}) drop-shadow(0 0 60px ${cfg.glowColor}88)`,
        position:"relative", zIndex:10,
      }}>
        {cfg.emoji}
      </div>

      {/* 星形粒子 */}
      {PARTICLES_POS.map((p, i) => (
        <div key={i} style={{
          position:"absolute",
          width: i % 3 === 0 ? 10 : 6,
          height: i % 3 === 0 ? 10 : 6,
          borderRadius: i % 2 === 0 ? "50%" : "2px",
          background: cfg.starColors[i % cfg.starColors.length],
          "--dx": p.dx, "--dy": p.dy,
          animation:`bep-particle 1.2s cubic-bezier(0.25,0.46,0.45,0.94) ${0.15 + i*0.06}s both`,
          boxShadow:`0 0 6px ${cfg.glowColor}`,
        }}/>
      ))}

      {/* 標題 */}
      <div style={{
        marginTop:24, textAlign:"center",
        animation:"bep-title 0.5s ease 0.55s both",
        position:"relative", zIndex:10,
      }}>
        <div style={{
          fontSize:28, fontWeight:900, letterSpacing:2,
          backgroundImage: cfg.shimmerBg,
          backgroundSize:"250% auto",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          backgroundClip:"text",
          animation:"bep-shimmer 2.5s linear 0.8s infinite",
        }}>
          🎖️ {cfg.label}
        </div>
        <div style={{
          fontSize:14, color: cfg.titleColor, opacity:0.75,
          marginTop:6, fontWeight:600, letterSpacing:1,
        }}>
          {cfg.sub}
        </div>
      </div>

      {/* 點擊提示 */}
      <div style={{
        position:"absolute", bottom:48,
        fontSize:12, color:"rgba(255,255,255,0.3)",
        animation:"bep-title 0.5s ease 1.5s both",
        letterSpacing:1,
      }}>
        點擊任意處關閉
      </div>

      {/* black 專屬：背景金粒子 */}
      {badge === "black" && Array.from({length:12}).map((_,i) => (
        <div key={`b${i}`} style={{
          position:"absolute",
          left:`${10 + Math.floor(i*7.5) % 85}%`,
          top:`${5 + Math.floor(i*11) % 85}%`,
          width:3, height:3, borderRadius:"50%",
          background: i%3===0 ? "#fbbf24" : "#a78bfa",
          animation:`bep-star-spin ${1.8 + (i%4)*0.4}s ease-in-out ${i*0.2}s infinite`,
          opacity:0,
        }}/>
      ))}
    </div>
  );
}
