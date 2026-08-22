import { useEffect, useMemo, useRef, useState } from "react";
import { getExcavationDifficulty } from "../../lib/dungeonData";

const FAMILY = {
  ghost:{ label:"幽冥系", color:"#c084fc", accent:"#67e8f9", fallback:"/ui/battle-bg/family-ghost.webp", particle:"✦" },
  mountain:{ label:"山嶺系", color:"#34d399", accent:"#fde68a", fallback:"/ui/battle-bg/family-mountain.webp", particle:"◆" },
  insect:{ label:"昆蟲系", color:"#a3e635", accent:"#fbbf24", fallback:"/ui/battle-bg/family-insect.webp", particle:"·" },
  workplace:{ label:"職場系", color:"#7dd3fc", accent:"#fbbf24", fallback:"/ui/battle-bg/family-workplace.webp", particle:"▧" },
  exam:{ label:"考試系", color:"#fb7185", accent:"#fde68a", fallback:"/ui/battle-bg/family-exam.webp", particle:"⌁" },
  temple:{ label:"神廟系", color:"#facc15", accent:"#fda4af", fallback:"/ui/battle-bg/family-temple.webp", particle:"✧" },
  treasure:{ label:"寶箱系", color:"#22d3ee", accent:"#fbbf24", fallback:"/ui/battle-bg/bg_treasure_1.webp", particle:"✦" },
};

const FLOORS = [
  { kicker:"踏入領域", title:"第一層 · 迷霧初探", desc:"大門已經開啟。探索未知房間，找出通往深處的階梯。", action:"展開探索地圖" },
  { kicker:"危機升高", title:"第二層 · 敵影逼近", desc:"越往下層，怪物越強。保持隊伍狀態並突破精英防線。", action:"進入戰鬥區域" },
  { kicker:"命運分岔", title:"第三層 · 王座之路", desc:"Boss 正在深處等待。選擇風險與收益，累積印記改寫最終決戰。", action:"揭露第一組路線" },
];

export function shouldUseShortDungeonIntro(hasSeen, storageSeen) {
  return Boolean(hasSeen || storageSeen);
}

export default function DungeonFloorIntro({ floorIndex=0, difficultyTier=1, family="ghost", introKey="", hasSeen=false, canControl=true, onSeen, onStart }) {
  const normalized = FAMILY[family] ? family : "ghost";
  const theme = FAMILY[normalized];
  const floor = FLOORS[floorIndex] || FLOORS[0];
  const diff = getExcavationDifficulty(difficultyTier);
  const storageKey = introKey ? `dungeon-floor-intro:${introKey}:${floorIndex}` : "";
  const short = useMemo(() => {
    try { return shouldUseShortDungeonIntro(hasSeen, storageKey && sessionStorage.getItem(storageKey)); } catch { return Boolean(hasSeen); }
  }, [hasSeen, storageKey]);
  const [ready,setReady] = useState(short);
  const [src,setSrc] = useState(`/ui/dungeon/floor-panorama/${normalized}.webp`);
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), short ? 350 : 1900);
    if (storageKey) { try { sessionStorage.setItem(storageKey,"1"); } catch {} }
    onSeenRef.current?.(floorIndex);
    return () => clearTimeout(timer);
  }, [floorIndex, short, storageKey]);

  return <div className={`dfi-root dfi-floor-${floorIndex+1} ${short?"dfi-short":""}`} style={{"--dfi-color":theme.color,"--dfi-accent":theme.accent}}>
    <img className="dfi-bg dfi-bg-back" src={src} onError={() => setSrc(theme.fallback)} alt="" />
    <div className="dfi-bg dfi-bg-mid" style={{backgroundImage:`url(${src})`}} />
    <div className="dfi-vignette" />
    <div className="dfi-particles" aria-hidden="true">{Array.from({length:10},(_,i)=><i key={i}>{theme.particle}</i>)}</div>
    {floorIndex === 1 && <div className="dfi-warning" aria-hidden="true" />}
    {floorIndex === 2 && <div className="dfi-boss-shadow" aria-hidden="true">♛</div>}
    <main className="dfi-card">
      <div className="dfi-kicker">{floor.kicker}</div>
      <h1>{floor.title}</h1>
      <p>{floor.desc}</p>
      <div className="dfi-tags"><span>{theme.label}</span><span>{diff?.icon} {diff?.label}</span>{floorIndex===2&&<span>Boss 層</span>}</div>
      {ready && (canControl ? <button type="button" onClick={onStart}>{floor.action}<b>›</b></button> : <div className="dfi-wait">等待隊長開啟道路…</div>)}
    </main>
    <style>{`
.dfi-root{position:relative;height:100dvh;min-height:520px;overflow:hidden;background:#05070b;color:white;isolation:isolate}.dfi-bg{position:absolute;inset:-4%;width:108%;height:108%;object-fit:cover;object-position:center;animation:dfi-push 7s ease-out both}.dfi-bg-mid{background-size:cover;background-position:center;mix-blend-mode:screen;opacity:.14;filter:blur(1px);animation:dfi-drift 6s ease-out both}.dfi-vignette{position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,6,23,.18),rgba(2,6,23,.12) 38%,rgba(2,6,23,.92) 84%),radial-gradient(circle at 50% 35%,transparent 10%,rgba(0,0,0,.45) 100%)}.dfi-card{position:absolute;z-index:3;left:16px;right:16px;bottom:max(24px,env(safe-area-inset-bottom));max-width:560px;margin:auto;padding:18px;border:1px solid color-mix(in srgb,var(--dfi-color) 42%,transparent);border-radius:24px;background:linear-gradient(145deg,rgba(7,10,20,.72),rgba(7,10,20,.9));backdrop-filter:blur(14px);box-shadow:0 20px 70px rgba(0,0,0,.55);animation:dfi-rise .8s .65s ease both}.dfi-kicker{font-size:12px;letter-spacing:.24em;color:var(--dfi-accent);font-weight:900}.dfi-card h1{font-size:clamp(24px,7vw,36px);line-height:1.05;margin:8px 0;font-weight:950;text-shadow:0 3px 18px #000}.dfi-card p{font-size:14px;line-height:1.6;color:#d6deec;margin:0 0 12px}.dfi-tags{display:flex;gap:6px;flex-wrap:wrap}.dfi-tags span{font-size:11px;font-weight:800;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.1)}.dfi-card button{margin-top:15px;width:100%;min-height:52px;border:0;border-radius:16px;color:#061019;font-size:15px;font-weight:950;background:linear-gradient(100deg,var(--dfi-color),var(--dfi-accent));box-shadow:0 8px 28px color-mix(in srgb,var(--dfi-color) 38%,transparent);animation:dfi-button .35s ease both}.dfi-card button b{float:right;font-size:22px}.dfi-wait{margin-top:15px;text-align:center;padding:14px;color:#cbd5e1;font-weight:800}.dfi-particles i{position:absolute;z-index:2;color:var(--dfi-accent);text-shadow:0 0 12px var(--dfi-color);animation:dfi-float 3.5s ease-in-out infinite;left:calc(6% + var(--n,0)*9%);top:calc(10% + var(--n,0)*5%)}.dfi-particles i:nth-child(1){--n:1}.dfi-particles i:nth-child(2){--n:2;animation-delay:-1s}.dfi-particles i:nth-child(3){--n:3;animation-delay:-2s}.dfi-particles i:nth-child(4){--n:4;animation-delay:-.4s}.dfi-particles i:nth-child(5){--n:5;animation-delay:-1.4s}.dfi-particles i:nth-child(6){--n:6;animation-delay:-2.4s}.dfi-particles i:nth-child(7){--n:7;animation-delay:-.7s}.dfi-particles i:nth-child(8){--n:8;animation-delay:-1.7s}.dfi-particles i:nth-child(9){--n:9;animation-delay:-2.7s}.dfi-particles i:nth-child(10){--n:10;animation-delay:-.2s}.dfi-warning{position:absolute;z-index:2;inset:-20%;background:linear-gradient(115deg,transparent 44%,rgba(239,68,68,.24) 49%,transparent 54%);animation:dfi-scan 2s ease-in-out infinite}.dfi-boss-shadow{position:absolute;z-index:2;top:10%;left:50%;font-size:120px;color:rgba(0,0,0,.54);filter:drop-shadow(0 0 30px var(--dfi-color));animation:dfi-boss 2.4s ease-in-out infinite}.dfi-short *{animation-duration:.35s!important;animation-delay:0s!important}@keyframes dfi-push{from{transform:scale(1.12)}to{transform:scale(1)}}@keyframes dfi-drift{from{transform:scale(1.08) translateY(2%)}to{transform:scale(1.02) translateY(-1%)}}@keyframes dfi-rise{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:none}}@keyframes dfi-button{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}@keyframes dfi-float{50%{transform:translateY(-16px) scale(1.4);opacity:.4}}@keyframes dfi-scan{from{transform:translateX(-45%)}to{transform:translateX(45%)}}@keyframes dfi-boss{0%,100%{transform:translateX(-50%) scale(.92);opacity:.3}50%{transform:translateX(-50%) scale(1.05);opacity:.6}}@media(prefers-reduced-motion:reduce){.dfi-root *{animation-duration:.01ms!important;animation-iteration-count:1!important}.dfi-bg{transform:none}.dfi-warning{display:none}}
    `}</style>
  </div>;
}
