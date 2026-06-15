// src/components/cat/CatSVG.jsx
import { useState } from "react";

// ── 真實照片路徑對照 ────────────────────────────────────────
const CAT_IMAGES = {
  daming:   "/cats/daNiang.webp",
  gege:     "/cats/gege.webp",
  meimei:   "/cats/meimei.webp",
  niuniu:   "/cats/niuNiu.webp",
  haji:     "/cats/haji.webp",
  baobao:   "/cats/baobao.webp",
  youyou:   "/cats/youyou.webp",
  xiaoan:   "/cats/xiaoAn.webp",
  diandian: "/cats/dianDian.webp",
};

// ── SVG 像素圖（圖片載入失敗時的 fallback）─────────────────
function Px({ x, y, c, sz = 4 }) {
  return <rect x={x * sz} y={y * sz} width={sz} height={sz} fill={c} />;
}

function CatFace({ b, p, l, sz = 4 }) {
  return (
    <>
      <Px x={2} y={1} c={b} sz={sz}/><Px x={3} y={0} c={b} sz={sz}/>
      <Px x={12} y={1} c={b} sz={sz}/><Px x={11} y={0} c={b} sz={sz}/>
      <Px x={3} y={1} c={l} sz={sz}/><Px x={11} y={1} c={l} sz={sz}/>
      {[4,5,6,7,8,9,10].map(x => <Px key={x} x={x} y={1} c={b} sz={sz}/>)}
      {[2,3,4,5,6,7,8,9,10,11,12].map(x => <Px key={x} x={x} y={2} c={b} sz={sz}/>)}
      {[2,3,4,5,6,7,8,9,10,11,12].map(x => <Px key={x} x={x} y={3} c={b} sz={sz}/>)}
      {[2,3,6,7,8,9,12,13].map(x => <Px key={x} x={x} y={4} c={b} sz={sz}/>)}
      <Px x={4} y={4} c="#1c1917" sz={sz}/><Px x={5} y={4} c="#1c1917" sz={sz}/>
      <Px x={10} y={4} c="#1c1917" sz={sz}/><Px x={11} y={4} c="#1c1917" sz={sz}/>
      <Px x={4} y={4} c="#ffffff" sz={sz/2}/>
      <Px x={10} y={4} c="#ffffff" sz={sz/2}/>
      {[2,3,4,5,6,7,8,9,10,11,12,13].map(x => <Px key={x} x={x} y={5} c={b} sz={sz}/>)}
      <Px x={7} y={5} c="#f9a8d4" sz={sz}/><Px x={8} y={5} c="#f9a8d4" sz={sz}/>
      {[2,3,4,5,6,7,8,9,10,11,12,13].map(x => <Px key={x} x={x} y={6} c={b} sz={sz}/>)}
      <Px x={6} y={6} c="#1c1917" sz={sz}/><Px x={9} y={6} c="#1c1917" sz={sz}/>
      {[2,3,4,5,6,7,8,9,10,11,12,13].map(x => <Px key={x} x={x} y={7} c={b} sz={sz}/>)}
      <Px x={3} y={7} c={l} sz={sz}/><Px x={4} y={7} c={l} sz={sz}/>
      <Px x={11} y={7} c={l} sz={sz}/><Px x={12} y={7} c={l} sz={sz}/>
      {[3,4,5,6,7,8,9,10,11,12].map(x => <Px key={x} x={x} y={8} c={b} sz={sz}/>)}
      {[4,5,6,7,8,9,10,11].map(x => <Px key={x} x={x} y={9} c={b} sz={sz}/>)}
      <Px x={5} y={3} c={p} sz={sz}/><Px x={9} y={3} c={p} sz={sz}/>
      <Px x={3} y={6} c={p} sz={sz}/><Px x={12} y={6} c={p} sz={sz}/>
    </>
  );
}

function CowFace({ sz = 4 }) {
  const b = "#ffffff", patch = "#1c1917";
  return (
    <>
      <Px x={2} y={1} c={patch} sz={sz}/><Px x={3} y={0} c={patch} sz={sz}/>
      <Px x={12} y={1} c={b} sz={sz}/><Px x={11} y={0} c={b} sz={sz}/>
      {[4,5,6,7,8,9,10].map(x => <Px key={x} x={x} y={1} c={b} sz={sz}/>)}
      {[2,3,4,5,6,7,8,9,10,11,12].map(x => <Px key={x} x={x} y={2} c={b} sz={sz}/>)}
      <Px x={2} y={2} c={patch} sz={sz}/><Px x={3} y={2} c={patch} sz={sz}/>
      <Px x={2} y={3} c={patch} sz={sz}/><Px x={3} y={3} c={patch} sz={sz}/><Px x={4} y={3} c={patch} sz={sz}/>
      {[5,6,7,8,9,10,11,12].map(x => <Px key={x} x={x} y={3} c={b} sz={sz}/>)}
      {[2,3,6,7,8,9,12,13].map(x => <Px key={x} x={x} y={4} c={b} sz={sz}/>)}
      <Px x={4} y={4} c="#1c1917" sz={sz}/><Px x={5} y={4} c="#1c1917" sz={sz}/>
      <Px x={10} y={4} c="#1c1917" sz={sz}/><Px x={11} y={4} c="#1c1917" sz={sz}/>
      {[2,3,4,5,6,7,8,9,10,11,12,13].map(x => <Px key={x} x={x} y={5} c={b} sz={sz}/>)}
      <Px x={7} y={5} c="#f9a8d4" sz={sz}/><Px x={8} y={5} c="#f9a8d4" sz={sz}/>
      {[2,3,4,5,6,7,8,9,10,11,12,13].map(x => <Px key={x} x={x} y={6} c={b} sz={sz}/>)}
      <Px x={10} y={6} c={patch} sz={sz}/><Px x={11} y={6} c={patch} sz={sz}/><Px x={12} y={6} c={patch} sz={sz}/>
      {[2,3,4,5,6,7,8,9,10,11,12,13].map(x => <Px key={x} x={x} y={7} c={b} sz={sz}/>)}
      {[3,4,5,6,7,8,9,10,11,12].map(x => <Px key={x} x={x} y={8} c={b} sz={sz}/>)}
    </>
  );
}

const CAT_RENDER = {
  daming:   ({ sz }) => <CatFace b="#d97706" p="#78350f" l="#fef3c7" sz={sz}/>,
  gege:     ({ sz }) => <CatFace b="#f97316" p="#ffffff" l="#fff7ed" sz={sz}/>,
  meimei:   ({ sz }) => <CatFace b="#f97316" p="#fbbf24" l="#fff7ed" sz={sz}/>,
  niuniu:   ({ sz }) => <CowFace sz={sz}/>,
  haji:     ({ sz }) => <CatFace b="#fef9c3" p="#c4a882" l="#fffbeb" sz={sz}/>,
  baobao:   ({ sz }) => <CatFace b="#fb923c" p="#fbbf24" l="#fff7ed" sz={sz}/>,
  youyou:   ({ sz }) => <CatFace b="#ea580c" p="#c2410c" l="#fed7aa" sz={sz}/>,
  xiaoan:   ({ sz }) => <CatFace b="#92400e" p="#d97706" l="#fef3c7" sz={sz}/>,
  diandian: ({ sz }) => <CatFace b="#27272a" p="#52525b" l="#3f3f46" sz={sz}/>,
};

// ── 主元件 ──────────────────────────────────────────────────
export default function CatSVG({ catId, size = 64, deceased = false }) {
  const [imgErr, setImgErr] = useState(false);
  const src = CAT_IMAGES[catId];
  const radius = Math.round(size * 0.22);

  // 真實照片
  if (src && !imgErr) {
    return (
      <div style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        display: "inline-block",
        flexShrink: 0,
      }}>
        <img
          src={src}
          alt={catId}
          loading="lazy"
          onError={() => setImgErr(true)}
          style={{ width: size, height: size, objectFit: "cover", display: "block" }}
        />
        {deceased && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(49,46,129,0.5)",
            display: "flex", alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: Math.round(size * 0.06),
          }}>
            <span style={{
              color: "#818cf8", fontWeight: "bold",
              fontSize: Math.round(size * 0.2),
              fontFamily: "sans-serif",
            }}>天使</span>
          </div>
        )}
      </div>
    );
  }

  // SVG fallback
  const cellSz = size / 16;
  const Render = CAT_RENDER[catId];
  if (!Render) return null;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
      style={{ imageRendering: "pixelated" }}>
      {deceased && <circle cx={size/2} cy={size/2} r={size/2} fill="#312e81" opacity={0.3}/>}
      <Render sz={cellSz}/>
      {deceased && (
        <text x={size/2} y={size * 0.92} textAnchor="middle" fontSize={size * 0.18}
          fill="#818cf8" fontWeight="bold" style={{ fontFamily: "sans-serif" }}>
          天使
        </text>
      )}
    </svg>
  );
}
