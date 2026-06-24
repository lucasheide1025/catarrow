// src/components/worldboss/WorldBossSVG.jsx — 世界王圖（先嘗試 webp，失敗回退像素 SVG）
import { useState } from "react";
import { getBossPhase } from "../../lib/worldBossData";

// 像素格輔助：sz=格子大小，x/y=起始格
function Px({ x, y, c, sz = 6 }) {
  return <rect x={x * sz} y={y * sz} width={sz} height={sz} fill={c} />;
}

// 裂縫覆蓋（階段 2/3/4 疊加）
function Cracks({ phase, accent }) {
  if (phase >= 4) return null;
  const opacity = phase === 3 ? 0.4 : phase === 2 ? 0.65 : 0.85;
  return (
    <g opacity={opacity} stroke={phase === 1 ? "#ef4444" : "#fbbf24"} strokeWidth="1.5" fill="none">
      <line x1="30" y1="10" x2="50" y2="35"/>
      <line x1="50" y1="35" x2="40" y2="55"/>
      {phase <= 2 && <line x1="15" y1="40" x2="35" y2="65"/>}
      {phase <= 2 && <line x1="60" y1="20" x2="75" y2="50"/>}
      {phase <= 1 && <line x1="20" y1="70" x2="55" y2="90"/>}
      {phase <= 1 && <line x1="70" y1="60" x2="80" y2="85"/>}
    </g>
  );
}

// 瀕死閃爍效果
function DyingGlow({ accent }) {
  return (
    <g>
      <circle cx="48" cy="48" r="42" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.5">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="0.8s" repeatCount="indefinite"/>
      </circle>
    </g>
  );
}

// ── 各 Boss 像素圖（viewBox 96×96，格子 6px，16×16 格）────────

function HeadCoachPixel({ phase }) {
  const h = "#f59e0b"; const b = "#1e40af"; const s = "#e2e8f0"; const d = "#1e293b"; const r = "#7f1d1d";
  return (
    <g>
      {/* 背景光暈 */}
      <circle cx="48" cy="48" r="44" fill="#0f172a"/>
      <circle cx="48" cy="48" r="36" fill="#1e3a8a" opacity="0.5"/>
      {/* 身體 */}
      {[5,6,7,8,9].map(y=>[5,6,7,8,9,10].map(x=><Px key={`${x}${y}`} x={x} y={y} c={b}/>))}
      {/* 頭 */}
      {[2,3,4].map(y=>[5,6,7,8,9].map(x=><Px key={`h${x}${y}`} x={x} y={y} c={s}/>))}
      {/* 眼睛 */}
      <Px x={5} y={3} c="#1e40af"/><Px x={8} y={3} c="#1e40af"/>
      {/* 弓 */}
      <Px x={11} y={3} c={h}/><Px x={11} y={4} c={h}/><Px x={11} y={5} c={h}/>
      <Px x={11} y={6} c={h}/><Px x={11} y={7} c={h}/>
      {/* 箭 */}
      <Px x={3} y={5} c={r}/><Px x={4} y={5} c={r}/><Px x={12} y={5} c={r}/>
      {/* 金色頭冠 */}
      <Px x={5} y={1} c={h}/><Px x={6} y={0} c={h}/><Px x={7} y={1} c={h}/>
      <Px x={8} y={0} c={h}/><Px x={9} y={1} c={h}/>
      {/* 披風 */}
      {[8,9,10].map(y=><Px key={`c${y}`} x={4} y={y} c={h}/>)}
      {[8,9,10].map(y=><Px key={`c2${y}`} x={11} y={y} c={h}/>)}
    </g>
  );
}

function WifePixel({ phase }) {
  const p = "#f0abfc"; const d = "#4a044e"; const g = "#fce7f3"; const r = "#e879f9";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill={d}/>
      <circle cx="48" cy="48" r="34" fill="#7e22ce" opacity="0.4"/>
      {/* 裙擺 */}
      {[9,10,11,12].map(y=>[3,4,5,6,7,8,9,10,11,12].map(x=><Px key={`s${x}${y}`} x={x} y={y} c={p}/>))}
      {/* 身體 */}
      {[6,7,8].map(y=>[5,6,7,8,9].map(x=><Px key={`b${x}${y}`} x={x} y={y} c={r}/>))}
      {/* 頭 */}
      {[3,4,5].map(y=>[5,6,7,8,9].map(x=><Px key={`h${x}${y}`} x={x} y={y} c={g}/>))}
      {/* 眼睛 */}
      <Px x={6} y={4} c={r}/><Px x={8} y={4} c={r}/>
      {/* 髮型 */}
      {[0,1,2].map(y=>[4,5,6,7,8,9,10].map(x=><Px key={`hair${x}${y}`} x={x} y={y} c={r}/>))}
      {/* 弓 */}
      <Px x={2} y={4} c={p}/><Px x={2} y={5} c={p}/><Px x={2} y={6} c={p}/>
      <Px x={2} y={7} c={p}/><Px x={2} y={8} c={p}/>
      <Px x={3} y={6} c="#fbbf24"/>
    </g>
  );
}

function YumiPixel({ phase }) {
  const g = "#6ee7b7"; const d = "#064e3b"; const s = "#d1fae5";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill={d}/>
      <circle cx="48" cy="48" r="32" fill="#065f46" opacity="0.6"/>
      {/* 動感身形 */}
      {[5,6,7,8,9].map(y=>[6,7,8,9].map(x=><Px key={`b${x}${y}`} x={x} y={y} c={g}/>))}
      {/* 頭 */}
      {[2,3,4].map(y=>[5,6,7,8,9].map(x=><Px key={`h${x}${y}`} x={x} y={y} c={s}/>))}
      <Px x={5} y={3} c={g}/><Px x={9} y={3} c={g}/>
      {/* 快速弓（斜線）*/}
      {[2,3,4,5,6,7,8].map((y,i)=><Px key={`bow${y}`} x={12-i} y={y} c={g}/>)}
      {/* 多箭 */}
      {[4,5,6].map(y=><Px key={`a${y}`} x={3} y={y} c="#fbbf24"/>)}
    </g>
  );
}

function CatOrangePixel({ phase }) {
  const o = "#f97316"; const d = "#431407"; const w = "#fef3c7"; const bl = "#0f172a";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill={d}/>
      {/* 頭部 */}
      {[3,4,5,6,7,8,9].map(y=>[3,4,5,6,7,8,9,10,11,12].map(x=><Px key={`h${x}${y}`} x={x} y={y} c={o}/>))}
      {/* 耳朵 */}
      <Px x={3} y={1} c={o}/><Px x={3} y={2} c={o}/><Px x={4} y={2} c={o}/>
      <Px x={11} y={1} c={o}/><Px x={11} y={2} c={o}/><Px x={12} y={2} c={o}/>
      <Px x={4} y={1} c="#fcd34d"/><Px x={12} y={1} c="#fcd34d"/>
      {/* 臉紋 */}
      {[4,5,6].map(x=><Px key={`f1${x}`} x={x} y={5} c={w}/>)}
      {[9,10,11].map(x=><Px key={`f2${x}`} x={x} y={5} c={w}/>)}
      {/* 眼睛 */}
      <Px x={5} y={5} c={bl}/><Px x={10} y={5} c={bl}/>
      {/* 鼻子嘴巴 */}
      <Px x={7} y={7} c="#f43f5e"/><Px x={8} y={7} c="#f43f5e"/>
      {/* 鬍鬚 */}
      <Px x={2} y={6} c={w}/><Px x={1} y={7} c={w}/>
      <Px x={13} y={6} c={w}/><Px x={14} y={7} c={w}/>
      {/* 皇冠 */}
      <Px x={5} y={1} c="#fbbf24"/><Px x={6} y={0} c="#fbbf24"/>
      <Px x={7} y={1} c="#fbbf24"/><Px x={8} y={0} c="#fbbf24"/><Px x={9} y={1} c="#fbbf24"/>
    </g>
  );
}

function CatBlackPixel({ phase }) {
  const bl = "#1c1917"; const gl = "#a8a29e"; const ey = "#7c3aed";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill="#0c0a09"/>
      <circle cx="48" cy="48" r="38" fill="#1c1917" opacity="0.8"/>
      {[3,4,5,6,7,8,9].map(y=>[3,4,5,6,7,8,9,10,11,12].map(x=><Px key={`h${x}${y}`} x={x} y={y} c={bl}/>))}
      <Px x={3} y={1} c={bl}/><Px x={4} y={2} c={bl}/><Px x={3} y={2} c={bl}/>
      <Px x={11} y={1} c={bl}/><Px x={12} y={2} c={bl}/><Px x={11} y={2} c={bl}/>
      {/* 發光眼睛 */}
      <Px x={5} y={5} c={ey}/><Px x={6} y={5} c={ey}/>
      <Px x={9} y={5} c={ey}/><Px x={10} y={5} c={ey}/>
      <circle cx={33} cy={33} r={4} fill={ey} opacity="0.6"/>
      <circle cx={63} cy={33} r={4} fill={ey} opacity="0.6"/>
      {/* 輪廓高光 */}
      {[3,4,5,6].map(y=><Px key={`gl${y}`} x={3} y={y} c={gl}/>)}
      <Px x={5} y={7} c={gl}/><Px x={6} y={7} c={gl}/>
    </g>
  );
}

function CatWhitePixel({ phase }) {
  const w = "#f1f5f9"; const b = "#bfdbfe"; const p = "#fda4af"; const gy = "#94a3b8";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill="#1e3a5f"/>
      {[3,4,5,6,7,8,9].map(y=>[3,4,5,6,7,8,9,10,11,12].map(x=><Px key={`h${x}${y}`} x={x} y={y} c={w}/>))}
      <Px x={3} y={1} c={w}/><Px x={4} y={1} c={w}/><Px x={4} y={2} c={w}/>
      <Px x={11} y={1} c={w}/><Px x={12} y={1} c={w}/><Px x={11} y={2} c={w}/>
      <Px x={4} y={1} c={p}/><Px x={12} y={1} c={p}/>
      <Px x={5} y={5} c={b}/><Px x={6} y={5} c={b}/>
      <Px x={9} y={5} c={b}/><Px x={10} y={5} c={b}/>
      <Px x={7} y={7} c={p}/><Px x={8} y={7} c={p}/>
      <Px x={2} y={6} c={gy}/><Px x={1} y={6} c={gy}/>
      <Px x={13} y={6} c={gy}/><Px x={14} y={6} c={gy}/>
      {/* 光環 */}
      <circle cx="48" cy="12" r="10" fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.7"/>
    </g>
  );
}

function GhostBossPixel({ phase }) {
  const v = "#818cf8"; const d = "#1e1b4b"; const w = "#c7d2fe"; const g = "#312e81";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill={d}/>
      {/* 主體 */}
      {[4,5,6,7,8,9,10].map(y=>{
        const w2 = y < 8 ? [4,5,6,7,8,9,10,11] : [3,4,5,6,7,8,9,10,11,12];
        return w2.map(x=><Px key={`${x}${y}`} x={x} y={y} c={v}/>);
      })}
      {/* 底部鋸齒 */}
      {[11,12].map(y=>[4,6,8,10,12].map(x=><Px key={`j${x}${y}`} x={x} y={y} c={v}/>))}
      {/* 眼睛（空洞）*/}
      <Px x={6} y={6} c={d}/><Px x={7} y={6} c={d}/>
      <Px x={9} y={6} c={d}/><Px x={10} y={6} c={d}/>
      <Px x={6} y={7} c={d}/><Px x={7} y={7} c={d}/>
      <Px x={9} y={7} c={d}/><Px x={10} y={7} c={d}/>
      {/* 嘴 */}
      {[7,8,9].map(x=><Px key={`m${x}`} x={x} y={9} c={d}/>)}
      {/* 光效 */}
      <circle cx="48" cy="48" r="38" fill="none" stroke={v} strokeWidth="1.5" opacity="0.3">
        <animate attributeName="r" values="36;40;36" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite"/>
      </circle>
    </g>
  );
}

function ForestBossPixel({ phase }) {
  const g = "#86efac"; const d = "#14532d"; const br = "#92400e"; const y = "#fde047";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill={d}/>
      {/* 樹幹 */}
      {[8,9,10,11,12].map(y=>[6,7,8,9].map(x=><Px key={`t${x}${y}`} x={x} y={y} c={br}/>))}
      {/* 葉冠 */}
      {[1,2,3].map(y=>[4,5,6,7,8,9,10,11].map(x=><Px key={`l1${x}${y}`} x={x} y={y} c={g}/>))}
      {[4,5,6,7].map(y=>[3,4,5,6,7,8,9,10,11,12].map(x=><Px key={`l2${x}${y}`} x={x} y={y} c={g}/>))}
      {/* 眼睛 */}
      <Px x={5} y={4} c={y}/><Px x={6} y={4} c={y}/>
      <Px x={9} y={4} c={y}/><Px x={10} y={4} c={y}/>
      {/* 嘴 */}
      {[5,6,7,8,9,10].map(x=><Px key={`m${x}`} x={x} y={6} c={br}/>)}
      <Px x={6} y={7} c={br}/><Px x={9} y={7} c={br}/>
    </g>
  );
}

function PoisonBossPixel({ phase }) {
  const y = "#fcd34d"; const g = "#4ade80"; const d = "#451a03"; const p = "#a3e635";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill={d}/>
      {/* 蟲身 */}
      {[3,4,5,6,7,8,9,10].map(y=>[4,5,6,7,8,9,10,11].map(x=><Px key={`b${x}${y}`} x={x} y={y} c={y}/>))}
      {/* 條紋 */}
      {[4,6,8,10].map(y=>[4,5,6,7,8,9,10,11].map(x=><Px key={`s${x}${y}`} x={x} y={y} c={g}/>))}
      {/* 觸角 */}
      <Px x={4} y={1} c={p}/><Px x={3} y={0} c={p}/>
      <Px x={11} y={1} c={p}/><Px x={12} y={0} c={p}/>
      {/* 眼睛 */}
      <Px x={5} y={4} c="#0f172a"/><Px x={10} y={4} c="#0f172a"/>
      {/* 毒液 */}
      <Px x={7} y={11} c={g}/><Px x={8} y={11} c={g}/>
      <Px x={7} y={12} c={g}/><Px x={8} y={12} c={g}/>
    </g>
  );
}

function OfficeBossPixel({ phase }) {
  const r = "#fca5a5"; const d = "#450a0a"; const gr = "#6b7280"; const w = "#f1f5f9";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill={d}/>
      {/* 西裝 */}
      {[5,6,7,8,9,10].map(y=>[4,5,6,7,8,9,10,11].map(x=><Px key={`s${x}${y}`} x={x} y={y} c={gr}/>))}
      {/* 白襯衫 */}
      {[5,6,7].map(y=>[7,8].map(x=><Px key={`w${x}${y}`} x={x} y={y} c={w}/>))}
      {/* 頭 */}
      {[2,3,4].map(y=>[5,6,7,8,9,10].map(x=><Px key={`h${x}${y}`} x={x} y={y} c={r}/>))}
      {/* 眼睛（憤怒）*/}
      <Px x={6} y={3} c="#1e293b"/><Px x={9} y={3} c="#1e293b"/>
      <Px x={5} y={2} c="#1e293b"/><Px x={10} y={2} c="#1e293b"/>
      {/* 眉毛（皺眉）*/}
      <Px x={5} y={2} c="#1e293b"/><Px x={6} y={1} c="#1e293b"/>
      <Px x={9} y={2} c="#1e293b"/><Px x={10} y={1} c="#1e293b"/>
      {/* 公事包 */}
      {[8,9].map(y=>[11,12,13].map(x=><Px key={`b${x}${y}`} x={x} y={y} c="#d97706"/>))}
    </g>
  );
}

function ExamBossPixel({ phase }) {
  const p = "#c4b5fd"; const d = "#2e1065"; const w = "#ede9fe"; const b = "#0f172a";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill={d}/>
      {/* 長袍 */}
      {[5,6,7,8,9,10,11,12].map(y=>[3,4,5,6,7,8,9,10,11,12].map(x=><Px key={`r${x}${y}`} x={x} y={y} c={p}/>))}
      {/* 頭 */}
      {[2,3,4].map(y=>[5,6,7,8,9,10].map(x=><Px key={`h${x}${y}`} x={x} y={y} c={w}/>))}
      {/* 試卷圖案 */}
      {[6,7,8].map(y=>[5,6,7,8].map(x=><Px key={`p${x}${y}`} x={x} y={y} c={w}/>))}
      {[6,7,8].map(y=><Px key={`l${y}`} x={5} y={y} c={b}/>)}
      {/* 眼睛 */}
      <Px x={6} y={3} c={d}/><Px x={9} y={3} c={d}/>
      {/* 漩渦眼 */}
      <circle cx={39} cy={21} r={4} fill={d} opacity="0.8"/>
      <circle cx={57} cy={21} r={4} fill={d} opacity="0.8"/>
      {/* 帽子 */}
      {[0,1].map(y=>[4,5,6,7,8,9,10,11].map(x=><Px key={`cap${x}${y}`} x={x} y={y} c={b}/>))}
    </g>
  );
}

function WesternBossPixel({ phase }) {
  const g = "#4ade80"; const d = "#0c1a0c"; const dr = "#15803d"; const gold = "#fbbf24";
  return (
    <g>
      <circle cx="48" cy="48" r="44" fill={d}/>
      <circle cx="48" cy="48" r="38" fill="#14532d" opacity="0.5"/>
      {/* 龍身 */}
      {[4,5,6,7,8,9,10].map(y=>[3,4,5,6,7,8,9,10,11,12].map(x=><Px key={`b${x}${y}`} x={x} y={y} c={dr}/>))}
      {/* 鱗片高光 */}
      {[4,6,8].map(y=>[4,6,8,10].map(x=><Px key={`sc${x}${y}`} x={x} y={y} c={g}/>))}
      {/* 頭 */}
      {[1,2,3].map(y=>[5,6,7,8,9].map(x=><Px key={`h${x}${y}`} x={x} y={y} c={dr}/>))}
      {/* 角 */}
      <Px x={5} y={0} c={gold}/><Px x={4} y={1} c={gold}/>
      <Px x={9} y={0} c={gold}/><Px x={10} y={1} c={gold}/>
      {/* 眼睛（紅色威脅）*/}
      <Px x={6} y={2} c="#ef4444"/><Px x={8} y={2} c="#ef4444"/>
      {/* 翅膀 */}
      {[3,4,5].map(y=><Px key={`w1${y}`} x={2} y={y} c={g}/>)}
      {[3,4,5].map(y=><Px key={`w2${y}`} x={13} y={y} c={g}/>)}
      <Px x={1} y={5} c={g}/><Px x={14} y={5} c={g}/>
      {/* 火焰 */}
      <Px x={7} y={11} c="#f97316"/><Px x={8} y={11} c="#f97316"/>
      <Px x={7} y={12} c="#fbbf24"/><Px x={8} y={12} c="#fbbf24"/>
    </g>
  );
}

// ── 像素圖查表 ────────────────────────────────────────────────
const PIXEL_MAP = {
  head_coach:   HeadCoachPixel,
  wife:         WifePixel,
  yumi:         YumiPixel,
  cat_orange:   CatOrangePixel,
  cat_black:    CatBlackPixel,
  cat_white:    CatWhitePixel,
  ghost_boss:   GhostBossPixel,
  forest_boss:  ForestBossPixel,
  poison_boss:  PoisonBossPixel,
  office_boss:  OfficeBossPixel,
  exam_boss:    ExamBossPixel,
  western_boss: WesternBossPixel,
};

// ── 主元件 ────────────────────────────────────────────────────
export default function WorldBossSVG({ bossKey, currentHP, maxHP, size = 120 }) {
  const [imgErr, setImgErr] = useState(false);
  const phase   = getBossPhase(currentHP ?? maxHP, maxHP || 1);
  const PixelFn = PIXEL_MAP[bossKey] || HeadCoachPixel;

  // 優先顯示真實圖片
  if (bossKey && !imgErr) {
    return (
      <img
        src={`/worldboss/${bossKey}.webp`}
        alt={bossKey}
        onError={() => setImgErr(true)}
        style={{
          width: size, height: size, objectFit:"contain", display:"block",
          filter: phase === 1 ? "brightness(0.6) saturate(0.4)" : undefined,
        }}
      />
    );
  }

  // fallback：像素 SVG
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" style={{ display:"block", imageRendering:"pixelated" }}>
      <PixelFn phase={phase}/>
      <Cracks phase={phase}/>
      {phase === 1 && <DyingGlow/>}
    </svg>
  );
}
