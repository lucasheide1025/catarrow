// src/components/BadgeSVG.jsx — 成就徽章 SVG 框架
// 使用方式：<BadgeSVG icon="🏹" rarity="rare" size={64} unlocked />

const RARITY_STYLE = {
  common:    { ring:"#6b7280", glow:"#9ca3af", bg:"#1f2937", bg2:"#374151", shape:"circle",  stars:0 },
  uncommon:  { ring:"#16a34a", glow:"#4ade80", bg:"#14532d", bg2:"#166534", shape:"octagon", stars:1 },
  rare:      { ring:"#2563eb", glow:"#60a5fa", bg:"#1e3a8a", bg2:"#1d4ed8", shape:"hexagon", stars:2 },
  epic:      { ring:"#7c3aed", glow:"#a78bfa", bg:"#2e1065", bg2:"#5b21b6", shape:"diamond", stars:3 },
  legendary: { ring:"#b45309", glow:"#fbbf24", bg:"#451a03", bg2:"#92400e", shape:"star",    stars:5 },
};

function Octagon({ r = 44 }) {
  const a = r * 0.4142;
  const p = `${50-r},${50-a} ${50-a},${50-r} ${50+a},${50-r} ${50+r},${50-a} ${50+r},${50+a} ${50+a},${50+r} ${50-a},${50+r} ${50-r},${50+a}`;
  return <polygon points={p}/>;
}

function Hexagon({ r = 44 }) {
  const pts = Array.from({length:6}, (_,i) => {
    const a = (i * 60 - 30) * Math.PI / 180;
    return `${50+r*Math.cos(a)},${50+r*Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts}/>;
}

function Diamond({ r = 44 }) {
  return <polygon points={`50,${50-r} ${50+r},50 50,${50+r} ${50-r},50`}/>;
}

function StarPath({ r = 44, inner = 18 }) {
  const pts = Array.from({length:10}, (_,i) => {
    const a = (i * 36 - 90) * Math.PI / 180;
    const rad = i % 2 === 0 ? r : inner;
    return `${50+rad*Math.cos(a)},${50+rad*Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts}/>;
}

function ShapeClip({ shape, id }) {
  const props = { fill:"white" };
  switch (shape) {
    case "octagon": return <Octagon r={42} {...props}/>;
    case "hexagon": return <Hexagon r={42} {...props}/>;
    case "diamond": return <Diamond r={42} {...props}/>;
    case "star":    return <StarPath r={44} inner={20} {...props}/>;
    default:        return <circle cx="50" cy="50" r="42" fill="white"/>;
  }
}

function ShapeStroke({ shape, r = 44, ...rest }) {
  switch (shape) {
    case "octagon": {
      const a = r * 0.4142;
      const p = `${50-r},${50-a} ${50-a},${50-r} ${50+a},${50-r} ${50+r},${50-a} ${50+r},${50+a} ${50+a},${50+r} ${50-a},${50+r} ${50-r},${50+a}`;
      return <polygon points={p} {...rest}/>;
    }
    case "hexagon": {
      const pts = Array.from({length:6}, (_,i) => {
        const angle = (i * 60 - 30) * Math.PI / 180;
        return `${50+r*Math.cos(angle)},${50+r*Math.sin(angle)}`;
      }).join(" ");
      return <polygon points={pts} {...rest}/>;
    }
    case "diamond":
      return <polygon points={`50,${50-r} ${50+r},50 50,${50+r} ${50-r},50`} {...rest}/>;
    case "star": {
      const inner = Math.round(r * 0.42);
      const pts = Array.from({length:10}, (_,i) => {
        const angle = (i * 36 - 90) * Math.PI / 180;
        const rad = i % 2 === 0 ? r : inner;
        return `${50+rad*Math.cos(angle)},${50+rad*Math.sin(angle)}`;
      }).join(" ");
      return <polygon points={pts} {...rest}/>;
    }
    default:
      return <circle cx="50" cy="50" r={r} {...rest}/>;
  }
}

export default function BadgeSVG({ icon = "🏆", rarity = "common", size = 64, unlocked = true, className = "" }) {
  const s    = RARITY_STYLE[rarity] || RARITY_STYLE.common;
  const uid  = `badge_${rarity}_${Math.random().toString(36).slice(2,7)}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={{ display:"block" }}>
      <defs>
        {/* 背景漸層 */}
        <radialGradient id={`${uid}_bg`} cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor={s.bg2}/>
          <stop offset="100%" stopColor={s.bg}/>
        </radialGradient>
        {/* 光暈濾鏡 */}
        <filter id={`${uid}_glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={unlocked ? "3" : "0"} result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        {/* 裁剪路徑 */}
        <clipPath id={`${uid}_clip`}>
          <ShapeClip shape={s.shape}/>
        </clipPath>
      </defs>

      {/* 外圈光暈（解鎖才有）*/}
      {unlocked && (
        <ShapeStroke shape={s.shape} r={47}
          fill="none" stroke={s.glow} strokeWidth="3" opacity="0.35"
          filter={`url(#${uid}_glow)`}/>
      )}

      {/* 主背景 */}
      <ShapeStroke shape={s.shape} r={43}
        fill={unlocked ? `url(#${uid}_bg)` : "#1c1917"} stroke="none"/>

      {/* 外框 */}
      <ShapeStroke shape={s.shape} r={43}
        fill="none"
        stroke={unlocked ? s.ring : "#4b5563"}
        strokeWidth={rarity === "legendary" ? "3" : "2"}/>

      {/* 內框（高階才有）*/}
      {(rarity === "epic" || rarity === "legendary") && unlocked && (
        <ShapeStroke shape={s.shape} r={39}
          fill="none" stroke={s.glow} strokeWidth="1" opacity="0.5"/>
      )}

      {/* 星星裝飾 */}
      {unlocked && s.stars > 0 && Array.from({length: s.stars}, (_,i) => {
        const angle = (i / s.stars) * 2 * Math.PI - Math.PI / 2;
        const r2 = s.shape === "star" ? 34 : 40;
        const x = 50 + r2 * Math.cos(angle);
        const y = 50 + r2 * Math.sin(angle);
        return (
          <text key={i} x={x} y={y + 3} textAnchor="middle" fontSize="7" fill={s.glow} opacity="0.8">★</text>
        );
      })}

      {/* 圖示 */}
      <text
        x="50" y="58" textAnchor="middle"
        fontSize={unlocked ? "36" : "30"}
        opacity={unlocked ? "1" : "0.3"}
        style={{ userSelect:"none" }}
      >
        {icon}
      </text>

      {/* 未解鎖遮罩 */}
      {!unlocked && (
        <>
          <ShapeStroke shape={s.shape} r={43} fill="rgba(0,0,0,0.55)" stroke="none"/>
          <text x="50" y="58" textAnchor="middle" fontSize="28" opacity="0.6">🔒</text>
        </>
      )}

      {/* Legendary 金色角落裝飾 */}
      {rarity === "legendary" && unlocked && (
        <>
          <circle cx="50" cy="50" r="30" fill="none" stroke={s.glow} strokeWidth="0.8" opacity="0.25" strokeDasharray="3 4"/>
          <text x="50" y="18" textAnchor="middle" fontSize="8" fill={s.glow} opacity="0.7">★★★</text>
          <text x="50" y="90" textAnchor="middle" fontSize="8" fill={s.glow} opacity="0.7">★★★</text>
        </>
      )}
    </svg>
  );
}
