// src/components/member/GachaMachine.jsx
import { useState, useEffect, useRef } from "react";
import { drawGachaCards, upgradeCatCard } from "../../lib/db";
import { CAT_CARD_MAP, CAT_CARD_CATEGORIES, CAT_CARDS } from "../../lib/catCardData";
import {
  ALBUM_CARD_IDS, VILLAGE_ALBUM_IDS, VILLAGE_ALBUM_META, albumXpFromCards,
  catCardUpgradeCost, villageAlbumBonusPct, villageAlbumLevel, villageAlbumThreshold,
} from "../../lib/catVillageAlbums";
import CatVillageNavArt from "./CatVillageNavArt";
import { useAuth } from "../../hooks/useAuth";
import { sfxGachaRoll, sfxGachaReveal } from "../../lib/sound";
import Confetti from "../shared/Confetti";

const C = {
  brown: "#5C3D2E",
  mid:   "#9B7B6A",
  muted: "#C4A899",
  border:"#E0CDB5",
  card:  "rgba(255,255,255,0.88)",
  sage:  "#6B8E5E",
};

const STYLE = `
@keyframes gachaShake {
  0%,100% { transform: translateX(0) rotate(0deg); }
  15%     { transform: translateX(-6px) rotate(-3deg); }
  30%     { transform: translateX(6px) rotate(3deg); }
  45%     { transform: translateX(-4px) rotate(-2deg); }
  60%     { transform: translateX(4px) rotate(2deg); }
  75%     { transform: translateX(-2px) rotate(-1deg); }
}
@keyframes ballDrop {
  0%   { transform: translateX(-50%) translateY(-120px) scale(0.4); opacity:0; }
  40%  { transform: translateX(-50%) translateY(12px) scale(1.18); opacity:1; }
  60%  { transform: translateX(-50%) translateY(-16px) scale(0.9); }
  80%  { transform: translateX(-50%) translateY(5px) scale(1.05); }
  100% { transform: translateX(-50%) translateY(0) scale(1); opacity:1; }
}
@keyframes ballGlow {
  0%,100% { box-shadow:0 0 24px 8px rgba(255,200,50,0.65); transform:translateX(-50%) scale(1); }
  50%     { box-shadow:0 0 60px 28px rgba(255,240,80,0.9); transform:translateX(-50%) scale(1.18); }
}
@keyframes cardFlipIn {
  0%   { transform:perspective(800px) rotateY(90deg) scale(0.75); opacity:0; }
  55%  { transform:perspective(800px) rotateY(-5deg) scale(1.04); opacity:1; }
  100% { transform:perspective(800px) rotateY(0deg) scale(1); opacity:1; }
}
@keyframes cardCollect {
  0%   { transform:scale(1) translate(0,0); opacity:1; }
  100% { transform:scale(0.06) translate(140px,-380px); opacity:0; }
}
@keyframes gachaRays {
  0%   { opacity:0; transform:translate(-50%,-50%) scale(0.5) rotate(0deg); }
  15%  { opacity:0.85; }
  100% { opacity:0; transform:translate(-50%,-50%) scale(2.8) rotate(30deg); }
}
@keyframes timerDrain {
  from { width:100%; }
  to   { width:0%; }
}
@keyframes newBadgePop {
  0%   { transform:scale(0) rotate(-20deg); opacity:0; }
  60%  { transform:scale(1.25) rotate(6deg); opacity:1; }
  100% { transform:scale(1) rotate(0deg); opacity:1; }
}
@keyframes cardReveal {
  0%   { opacity:0; transform:scale(0.6) rotate(-8deg); }
  60%  { transform:scale(1.08) rotate(2deg); }
  100% { opacity:1; transform:scale(1) rotate(0deg); }
}
@keyframes multiCardIn {
  0%   { opacity:0; transform:translateY(26px) scale(0.82) rotate(-3deg); }
  70%  { opacity:1; transform:translateY(-3px) scale(1.03) rotate(1deg); }
  100% { opacity:1; transform:translateY(0) scale(1) rotate(0deg); }
}
@keyframes machineGlow {
  0%,100% { opacity:0.5; transform:scale(1); }
  50%     { opacity:0.9; transform:scale(1.06); }
}
@keyframes softHalo {
  0%,100% { opacity:0.72; transform:translate(-50%,-52%) scale(1); }
  50%     { opacity:1;    transform:translate(-50%,-52%) scale(1.05); }
}
@keyframes haloCharge {
  0%,100% { opacity:0.85; transform:translate(-50%,-52%) scale(1); }
  50%     { opacity:1;    transform:translate(-50%,-52%) scale(1.14); }
}
@keyframes haloMulti {
  0%,100% { opacity:0.9;  transform:translate(-50%,-52%) scale(1.08); }
  50%     { opacity:1;    transform:translate(-50%,-52%) scale(1.26); }
}
@keyframes haloRing {
  0%   { opacity:0.75; transform:translate(-50%,-50%) scale(0.55); }
  100% { opacity:0;   transform:translate(-50%,-50%) scale(1.45); }
}
@keyframes bonusRibbonIn {
  0%   { opacity:0; transform:translateX(-50%) scale(0.6); }
  60%  { opacity:1; transform:translateX(-50%) scale(1.15); }
  100% { opacity:1; transform:translateX(-50%) scale(1); }
}
`;

// ── 機器主體 ────────────────────────────────────────────────
function MachineBody({ spinning, ballPhase, size = 240 }) {
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      {/* 背景光暈 */}
      <div style={{
        position:"absolute", inset:-18, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(255,200,80,0.28) 0%, rgba(255,200,80,0) 70%)",
        animation: spinning ? "machineGlow 0.6s ease-in-out infinite" : "machineGlow 2.6s ease-in-out infinite",
        pointerEvents:"none",
      }} />
      <img
        src="/ui/village/gacha-machine.webp"
        alt="扭蛋機"
        style={{
          position:"relative", width:"100%", height:"100%", objectFit:"contain",
          animation: spinning ? "gachaShake 0.45s ease-in-out infinite" : "none",
          filter: "drop-shadow(0 14px 26px rgba(140,70,25,0.28))",
        }}
        onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }}
      />
      {/* Fallback */}
      <div style={{
        display:"none", position:"absolute", inset:0,
        flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4,
        animation: spinning ? "gachaShake 0.45s ease-in-out infinite" : "none",
      }}>
        <div style={{
          width:size*0.62, height:size*0.62, borderRadius:"50%",
          background:"radial-gradient(circle at 35% 35%,#FFF0D0,#F0C070)",
          border:"5px solid #E0A050",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:size*0.3, boxShadow:"0 8px 28px rgba(150,80,30,0.28)",
        }}>
          {spinning ? "🌀" : "🐱"}
        </div>
        <div style={{ width:size*0.46, height:size*0.075, borderRadius:"0 0 12px 12px",
          background:"linear-gradient(to bottom,#D4884A,#B86830)" }} />
        <div style={{ width:size*0.21, height:size*0.083, borderRadius:10,
          background:"#8B5230", border:"2px solid #6B3A20" }} />
      </div>

      {/* 彈出球 */}
      {ballPhase === "drop" && (
        <div style={{
          position:"absolute", bottom:14, left:"50%",
          width:56, height:56, borderRadius:"50%",
          background:"radial-gradient(circle at 38% 32%,#FFE066,#FF6B35,#CC2200)",
          border:"3px solid #FFD080",
          animation:"ballDrop 0.65s ease-out forwards",
          boxShadow:"0 6px 18px rgba(255,80,30,0.55)",
        }} />
      )}
      {ballPhase === "glow" && (
        <div style={{
          position:"absolute", bottom:14, left:"50%",
          width:56, height:56, borderRadius:"50%",
          background:"radial-gradient(circle at 38% 32%,#FFE066,#FF6B35,#CC2200)",
          border:"3px solid #FFD080",
          animation:"ballGlow 0.5s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}

// ── 機器舞台：柔和背景光（抽卡時變亮變動，單抽/十連不同光效）──
function MachineStage({ spinning = false, mode = null, children }) {
  return (
    <div className="relative w-full" style={{ display:"flex", justifyContent:"center", paddingTop: 6 }}>
      {/* 大面積柔和光暈（主角光環） */}
      <div aria-hidden style={{
        position:"absolute", zIndex:0,
        width:"min(600px, 125vw)", height:"min(420px, 92vw)",
        top:"50%", left:"50%",
        background: mode === "multi"
          ? "radial-gradient(ellipse at 50% 55%, rgba(167,139,250,0.42) 0%, rgba(124,58,237,0.22) 45%, rgba(124,58,237,0) 72%)"
          : mode === "single"
            ? "radial-gradient(ellipse at 50% 55%, rgba(255,150,60,0.5) 0%, rgba(255,120,40,0.24) 45%, rgba(255,120,40,0) 72%)"
            : "radial-gradient(ellipse at 50% 55%, rgba(255,186,73,0.32) 0%, rgba(255,166,50,0.15) 45%, rgba(255,150,40,0) 72%)",
        animation: spinning && mode === "multi" ? "haloMulti 0.7s ease-in-out infinite"
                  : spinning && mode === "single" ? "haloCharge 0.55s ease-in-out infinite"
                  : "softHalo 3.6s ease-in-out infinite",
        transition:"background 0.5s ease",
        pointerEvents:"none",
      }} />

      {/* 十連能量環（抽卡時向外擴散） */}
      {spinning && mode === "multi" && (
        <div aria-hidden style={{
          position:"absolute", zIndex:0,
          top:"50%", left:"50%",
          width:"min(340px, 78vw)", height:"min(340px, 78vw)",
          borderRadius:"50%",
          border:"3px solid rgba(167,139,250,0.55)",
          boxShadow:"0 0 30px rgba(124,58,237,0.4)",
          animation:"haloRing 0.8s ease-out infinite",
          pointerEvents:"none",
        }} />
      )}

      {/* 地板反光 */}
      <div aria-hidden style={{
        position:"absolute", zIndex:0,
        width:"min(400px, 88vw)", height:26,
        bottom:22, left:"50%", transform:"translateX(-50%)",
        background: mode === "multi"
          ? "radial-gradient(ellipse at 50% 50%, rgba(167,139,250,0.32) 0%, transparent 70%)"
          : mode === "single"
            ? "radial-gradient(ellipse at 50% 50%, rgba(255,160,80,0.36) 0%, transparent 70%)"
            : "radial-gradient(ellipse at 50% 50%, rgba(255,200,90,0.26) 0%, transparent 70%)",
        filter:"blur(3px)",
        pointerEvents:"none",
      }} />
      {children}
    </div>
  );
}

// ── 逐張揭示 Overlay（單抽用）────────────────────────────────
// phases per card: "entering"(機器) → "showing"(卡片) → "leaving"(飛走)
function RevealOverlay({ results, onDone }) {
  const [idx,   setIdx]   = useState(0);
  const [phase, setPhase] = useState("entering"); // entering | showing | leaving
  const [ball,  setBall]  = useState("drop");     // drop | glow (sub-phase of entering)
  const timerKey = useRef(0);

  const result = results[idx];
  const card   = CAT_CARD_MAP[result?.id];
  const isNew  = result?.isNew;
  const total  = results.length;

  // entering phase: drop 600ms → glow 500ms → showing (每張播音效)
  useEffect(() => {
    if (phase !== "entering") return;
    setBall("drop");
    const t1 = setTimeout(() => setBall("glow"), 600);
    const t2 = setTimeout(() => {
      sfxGachaReveal(isNew);
      setPhase("showing");
    }, 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, idx]); // eslint-disable-line

  // showing phase: auto-advance after 5s
  useEffect(() => {
    if (phase !== "showing") return;
    timerKey.current += 1;
    const t = setTimeout(advance, 5000);
    return () => clearTimeout(t);
  }, [phase, idx]); // eslint-disable-line

  function advance() {
    if (phase !== "showing") return;
    setPhase("leaving");
    setTimeout(() => {
      if (idx >= total - 1) {
        onDone();
      } else {
        setIdx(i => i + 1);
        setPhase("entering");
      }
    }, 380);
  }

  const bgColor = card?.bg || "#FFF5E8";
  const overlayBg = phase === "showing" || phase === "leaving"
    ? `radial-gradient(ellipse at 50% 38%, ${bgColor} 0%, rgba(20,12,6,0.97) 65%)`
    : "rgba(22,12,6,0.96)";

  return (
    <div
      onClick={phase === "showing" ? advance : undefined}
      style={{
        position:"fixed", inset:0, zIndex:300,
        background:overlayBg,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        transition:"background 0.5s ease",
        cursor: phase==="showing" ? "pointer" : "default",
      }}>
      <style>{STYLE}</style>

      {/* 新卡揭曉彩帶（key 換 idx 讓每張新卡重播一次）*/}
      {phase === "showing" && isNew && <Confetti key={`confetti-${idx}`} pieces={90} duration={2000} />}

      {/* 進度點 */}
      <div style={{
        position:"absolute", top:20, left:"50%", transform:"translateX(-50%)",
        display:"flex", gap:5,
      }}>
        {results.map((_, i) => (
          <div key={i} style={{
            width: i===idx ? 16 : 6, height:6, borderRadius:99,
            background: i < idx ? "rgba(255,255,255,0.55)"
                       : i===idx ? "white"
                       : "rgba(255,255,255,0.2)",
            transition:"all 0.2s",
          }} />
        ))}
      </div>

      {/* 機器（entering 階段，暖橙充能光） */}
      {(phase === "entering") && (
        <MachineStage spinning={ball==="drop"} mode="single">
          <MachineBody spinning={ball==="drop"} ballPhase={ball} />
        </MachineStage>
      )}

      {/* 卡片（showing / leaving 階段） */}
      {(phase === "showing" || phase === "leaving") && card && (
        <>
          {/* NEW 光芒 */}
          {phase === "showing" && isNew && (
            <div style={{
              position:"absolute", top:"38%", left:"50%",
              width:480, height:480,
              backgroundImage:"conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.18) 18deg, transparent 36deg)",
              borderRadius:"50%",
              animation:"gachaRays 1.5s ease-out both",
              pointerEvents:"none",
            }} />
          )}

          {/* 卡片本體 */}
          <div style={{
            animation: phase==="showing"
              ? "cardFlipIn 0.5s cubic-bezier(0.4,0,0.2,1) both"
              : "cardCollect 0.38s ease-in both",
            display:"flex", flexDirection:"column", alignItems:"center", gap:14,
            transformOrigin:"center center",
          }}>
            <div style={{
              width:"min(260px,72vw)", aspectRatio:"3/4", borderRadius:18,
              background: bgColor,
              border: isNew ? "3px solid #fbbf24" : `2px solid ${C.border}`,
              overflow:"hidden", position:"relative",
              boxShadow: isNew
                ? "0 0 48px rgba(251,191,36,0.65), 0 24px 64px rgba(0,0,0,0.55)"
                : "0 24px 64px rgba(0,0,0,0.55)",
            }}>
              <img
                src={`/cats/cat-cards/${card.id}.webp`}
                alt={card.name}
                onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}
                style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
              />
              <div style={{
                display:"none", position:"absolute", inset:0,
                alignItems:"center", justifyContent:"center", fontSize:88,
              }}>{card.emoji}</div>
              {isNew && (
                <div style={{
                  position:"absolute", top:10, left:10,
                  background:"#fbbf24", color:"#422006",
                  fontWeight:900, fontSize:13, padding:"3px 11px", borderRadius:99,
                  boxShadow:"0 2px 8px rgba(251,191,36,0.55)",
                  animation:"newBadgePop 0.4s cubic-bezier(0.4,0,0.2,1) 0.35s both",
                }}>✦ NEW!</div>
              )}
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontWeight:900, fontSize:17, color:"white",
                textShadow:"0 2px 8px rgba(0,0,0,0.55)" }}>{card.name}</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:3 }}>
                {CAT_CARD_CATEGORIES[card.cat]?.emoji} {CAT_CARD_CATEGORIES[card.cat]?.label}
                {isNew && <span style={{color:"#fbbf24",marginLeft:6,fontWeight:800}}>新收藏！</span>}
              </div>
              {result.albumId && <div style={{ fontSize: 11, color: "#fde68a", marginTop: 6, fontWeight: 800 }}>
                {VILLAGE_ALBUM_META[result.albumId]?.icon} {VILLAGE_ALBUM_META[result.albumId]?.name} EXP +{result.albumXpGain || 1}
              </div>}
            </div>
          </div>

          {/* 提示 + 計時條 */}
          {phase === "showing" && (
            <>
              <div style={{
                position:"absolute", bottom:52, left:"50%", transform:"translateX(-50%)",
                fontSize:11, color:"rgba(255,255,255,0.35)", whiteSpace:"nowrap",
              }}>點擊繼續　{idx+1} / {total}</div>
              <div style={{
                position:"absolute", bottom:38, left:32, right:32,
                height:3, borderRadius:99, background:"rgba(255,255,255,0.1)", overflow:"hidden",
              }}>
                <div key={`${idx}-${timerKey.current}`} style={{
                  height:"100%", borderRadius:99,
                  background: isNew ? "#fbbf24" : "rgba(255,255,255,0.4)",
                  animation:"timerDrain 5s linear forwards",
                }} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── 十連抽直接展示 Overlay ───────────────────────────────────
// 機器搖一下 → 全部 11 張同時交錯翻出（直接看全部，不用一張張等）
function MultiResultOverlay({ results, onDone }) {
  const [phase, setPhase] = useState("machine"); // machine → grid
  const newCount = results.filter(r => r.isNew).length;
  const dupCount = results.length - newCount;

  // 機器搖 1.4s → 翻牌
  useEffect(() => {
    const t = setTimeout(() => {
      sfxGachaReveal(newCount > 0);
      setPhase("grid");
    }, 1400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // 相冊 EXP 摘要（同 albumId 合併）
  const albumMap = {};
  results.forEach(r => {
    if (!r.albumId || !r.albumXpGain) return;
    albumMap[r.albumId] = (albumMap[r.albumId] || 0) + r.albumXpGain;
  });
  const albumEntries = Object.entries(albumMap);

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:300,
      background:"radial-gradient(ellipse at 50% 20%, #3a2413 0%, rgba(15,8,4,0.98) 70%)",
      display:"flex", flexDirection:"column", alignItems:"center",
      overflowY:"auto", padding:"24px 16px 32px",
    }}>
      <style>{STYLE}</style>

      {phase === "grid" && newCount > 0 && <Confetti pieces={120} duration={2500} />}

      {/* 標頭 */}
      <div className="w-full max-w-md text-center" style={{ marginBottom:14 }}>
        <div className="text-[10px] font-black tracking-[.3em] text-amber-200/60">GACHA RESULT</div>
        <div className="text-2xl font-black text-white drop-shadow">十連抽結果</div>
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background:"rgba(251,191,36,0.2)", color:"#fde68a", border:"1px solid rgba(251,191,36,0.35)" }}>
            ✦ NEW ×{newCount}
          </span>
          <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", border:"1px solid rgba(255,255,255,0.15)" }}>
            重複 ×{dupCount}
          </span>
        </div>
      </div>

      {/* 機器搖晃（machine 階段，紫色能量光＋擴散環） */}
      {phase === "machine" && (
        <div className="flex flex-col items-center" style={{ paddingTop:60 }}>
          <MachineStage spinning mode="multi">
            <MachineBody spinning ballPhase={null} size={200} />
          </MachineStage>
          <div className="mt-4 text-sm font-black tracking-widest text-amber-200" style={{ animation:"ballGlow 0.5s ease-in-out infinite" }}>
            轉動中…
          </div>
        </div>
      )}

      {/* 全部卡片（grid 階段） */}
      {phase === "grid" && (
        <>
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))",
            gap:10, width:"100%", maxWidth:420,
          }}>
            {results.map((r, i) => {
              const card = CAT_CARD_MAP[r.id];
              if (!card) return null;
              const isBonus = i === results.length - 1 && results.length > 1;
              return (
                <div key={`${r.id}-${i}`} style={{
                  position:"relative", borderRadius:13, overflow:"hidden",
                  background: card.bg || "#FFF5E8",
                  border: r.isNew ? "2.5px solid #fbbf24" : isBonus ? "2.5px solid #c084fc" : `1.5px solid ${C.border}`,
                  boxShadow: r.isNew
                    ? "0 0 22px rgba(251,191,36,0.55), 0 6px 16px rgba(0,0,0,0.35)"
                    : "0 6px 16px rgba(0,0,0,0.35)",
                  animation:`multiCardIn 0.5s cubic-bezier(0.34,1.2,0.64,1) ${0.15 + i * 0.09}s both`,
                  transformOrigin:"center center",
                }}>
                  <div style={{ width:"100%", aspectRatio:"3/4", position:"relative", background:card.bg||"#FFF5E8" }}>
                    <img src={`/cats/cat-cards/${card.id}.webp`} alt={card.name} loading="lazy" decoding="async"
                      onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}
                      style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                    <div style={{ display:"none", position:"absolute", inset:0,
                      alignItems:"center", justifyContent:"center", fontSize:34 }}>
                      {card.emoji}
                    </div>
                    {r.isNew && (
                      <div style={{
                        position:"absolute", top:4, left:4,
                        background:"#fbbf24", color:"#422006",
                        fontWeight:900, fontSize:8, padding:"2px 7px", borderRadius:99,
                        animation:"newBadgePop 0.4s cubic-bezier(0.4,0,0.2,1) 0.45s both",
                      }}>NEW!</div>
                    )}
                  </div>
                  <div style={{
                    padding:"4px 3px 6px", textAlign:"center",
                    fontSize:10, fontWeight:800, lineHeight:1.25,
                    color: card.color || C.brown,
                  }}>{card.name}</div>
                  {isBonus && (
                    <div style={{
                      position:"absolute", top:-1, left:"50%",
                      transform:"translateX(-50%)",
                      background:"linear-gradient(135deg,#a78bfa,#7c3aed)",
                      color:"white", fontSize:8, fontWeight:900,
                      padding:"2px 9px", borderRadius:"0 0 8px 8px",
                      boxShadow:"0 2px 8px rgba(124,58,237,0.5)",
                      animation:"bonusRibbonIn 0.4s ease-out 1s both",
                      whiteSpace:"nowrap",
                    }}>＋1 BONUS</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 相冊 EXP 摘要 */}
          {albumEntries.length > 0 && (
            <div className="mt-4 w-full max-w-[420px] rounded-2xl p-3"
              style={{ background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)" }}>
              <div className="mb-2 text-[10px] font-black tracking-[.2em] text-amber-200/70">相冊 EXP</div>
              <div className="flex flex-wrap gap-2">
                {albumEntries.map(([albumId, gain]) => (
                  <span key={albumId} className="rounded-full px-3 py-1 text-xs font-black"
                    style={{ background:"rgba(253,230,138,0.15)", color:"#fde68a", border:"1px solid rgba(253,230,138,0.3)" }}>
                    {VILLAGE_ALBUM_META[albumId]?.icon} {VILLAGE_ALBUM_META[albumId]?.name} +{gain}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 完成 */}
          <button onClick={onDone}
            className="mt-5 w-full max-w-[420px] rounded-2xl py-3.5 font-black text-white transition-all active:scale-95"
            style={{
              background:"linear-gradient(135deg,#7c3aed,#a78bfa)",
              boxShadow:"0 6px 20px rgba(124,58,237,0.4)",
              fontSize:15,
            }}>
            完成 ✨
          </button>
        </>
      )}
    </div>
  );
}

// ── 單張卡片（圖鑑格）────────────────────────────────────────
function CardResult({ cardId, isNew, delay = 0 }) {
  const card = CAT_CARD_MAP[cardId];
  if (!card) return null;
  const catInfo = CAT_CARD_CATEGORIES[card.cat] || {};
  return (
    <div className="flex flex-col items-center rounded-2xl p-3 relative" style={{
      background: card.bg || "#FFF5E8",
      border: isNew ? "2px solid #F5A623" : `2px solid ${C.border}`,
      color: card.color || C.brown,
      animation:`cardReveal 0.4s ease-out both`,
      animationDelay:`${delay}ms`,
      boxShadow: card.special ? "0 0 16px rgba(245,166,35,0.5)" : undefined,
    }}>
      {isNew && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-gray-800 text-xs font-black px-2 py-0.5 rounded-full shadow">
          NEW!
        </div>
      )}
      <div className="text-3xl mb-1">{card.emoji}</div>
      <div className="text-xs font-bold text-center leading-tight">{card.name}</div>
      <div className="text-[10px] mt-0.5" style={{color:C.muted}}>{catInfo.label}</div>
    </div>
  );
}

// ── 貓貓卡放大 Modal ─────────────────────────────────────────
function CardLightbox({ card, cnt, onClose }) {
  const catInfo = CAT_CARD_CATEGORIES[card.cat] || {};
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(0,0,0,0.75)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:24,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"min(300px,80vw)", borderRadius:20,
        background: card.bg || "#FFF5E8",
        overflow:"hidden", boxShadow:"0 24px 60px rgba(0,0,0,0.5)",
        position:"relative",
      }}>
        <div style={{ width:"100%", aspectRatio:"3/4", position:"relative", background:card.bg||"#FFF5E8" }}>
          <img src={`/cats/cat-cards/${card.id}.webp`} alt={card.name}
            onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}
            style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          <div style={{ display:"none", position:"absolute", inset:0,
            alignItems:"center", justifyContent:"center", fontSize:80 }}>{card.emoji}</div>
        </div>
        <div style={{padding:"12px 14px 16px"}}>
          <div style={{fontWeight:900,fontSize:17,color:card.color||"#5C3D2E",marginBottom:4}}>{card.name}</div>
          <div style={{fontSize:12,color:"#9B7B6A"}}>{catInfo.emoji} {catInfo.label} · #{card.id}</div>
          {cnt > 1 && <div style={{marginTop:6,fontSize:12,color:"#d97706",fontWeight:700}}>擁有 ×{cnt}</div>}
        </div>
        <button onClick={onClose} style={{
          position:"absolute", top:10, right:10,
          width:30, height:30, borderRadius:"50%",
          background:"rgba(0,0,0,0.35)", border:"none", cursor:"pointer",
          color:"white", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center",
        }}>✕</button>
      </div>
    </div>
  );
}

// ── 卡片圖鑑 ─────────────────────────────────────────────────
function CardDex({ catCards }) {
  const [selCat,   setSelCat]   = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const owned = catCards || {};
  const ownedCount = Object.keys(owned).filter(id => (owned[id]||0) > 0).length;
  const filtered = selCat ? CAT_CARDS.filter(c => c.cat === selCat) : CAT_CARDS;

  return (
    <div>
      {lightbox && <CardLightbox card={lightbox} cnt={owned[lightbox.id]||0} onClose={()=>setLightbox(null)} />}
      <div className="text-xs mb-2 font-bold" style={{color:C.mid}}>已收集 {ownedCount} / {CAT_CARDS.length} 張</div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 no-scrollbar">
        <button onClick={()=>setSelCat(null)}
          className="shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors"
          style={{background:!selCat?C.brown:"rgba(92,61,46,0.08)",color:!selCat?"white":C.mid}}>
          全部
        </button>
        {Object.entries(CAT_CARD_CATEGORIES).map(([key,cat])=>(
          <button key={key} onClick={()=>setSelCat(selCat===key?null:key)}
            className="shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors"
            style={{background:selCat===key?C.brown:"rgba(92,61,46,0.08)",color:selCat===key?"white":C.mid}}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {filtered.map(card => {
          const cnt  = owned[card.id] || 0;
          const have = cnt > 0;
          return (
            <div key={card.id} onClick={()=>have&&setLightbox(card)} style={{
              borderRadius:10, overflow:"hidden",
              background: have ? (card.bg||"#FFF5E8") : "rgba(92,61,46,0.05)",
              border:`1.5px solid ${have ? C.border : "rgba(92,61,46,0.10)"}`,
              cursor: have ? "pointer" : "default",
              filter: have ? undefined : "grayscale(1)",
              opacity: have ? 1 : 0.4,
              position:"relative", userSelect:"none",
            }}>
              <div style={{width:"100%",aspectRatio:"3/4",position:"relative",background:card.bg||"#FFF5E8"}}>
                <img src={`/cats/cat-cards/${card.id}.webp`} alt={have?card.name:"???"}
                  onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}
                  style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                <div style={{display:"none",position:"absolute",inset:0,
                  alignItems:"center",justifyContent:"center",fontSize:28,flexDirection:"column"}}>
                  <span>{have?card.emoji:"❓"}</span>
                </div>
              </div>
              <div style={{
                padding:"4px 4px 5px", fontSize:9, fontWeight:800,
                textAlign:"center", lineHeight:1.2,
                color: have?(card.color||C.brown):C.muted,
              }}>{have?card.name:"???"}</div>
              {cnt>1 && (
                <div style={{
                  position:"absolute",top:4,right:4,
                  background:"#f59e0b",color:"#422006",
                  fontSize:9,fontWeight:900,borderRadius:99,padding:"1px 5px",
                }}>×{cnt}</div>
              )}
              {have && (
                <div style={{
                  position:"absolute",bottom:22,left:0,right:0,
                  textAlign:"center",fontSize:8,color:"rgba(92,61,46,0.35)",
                  pointerEvents:"none",
                }}>點擊放大</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VillageAlbums({ catCards, catCardStars = {}, savedAlbums, onChanged }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState("");
  const owned = catCards || {};
  const xp = savedAlbums?.version === 1 ? (savedAlbums.xp || {}) : albumXpFromCards(owned);

  const upgrade = async cardId => {
    setBusy(cardId); setMessage("");
    const result = await upgradeCatCard(profile.id, cardId);
    setBusy(null);
    setMessage(result.ok ? `升星成功：${"★".repeat(result.stars)}` : result.reason);
    if (result.ok) onChanged?.();
  };

  if (selected) {
    const meta = VILLAGE_ALBUM_META[selected];
    const cards = ALBUM_CARD_IDS[selected].map(id => CAT_CARD_MAP[id]);
    const level = villageAlbumLevel(xp[selected]);
    return <div>
      <button onClick={() => { setSelected(null); setMessage(""); }} className="mb-3 rounded-xl px-3 py-2 text-xs font-black"
        style={{ background: "rgba(92,61,46,.1)", color: C.brown }}>← 返回九冊</button>
      <div className="mb-3 rounded-2xl p-3" style={{ background: "rgba(255,255,255,.72)", border: `1px solid ${C.border}` }}>
        <div className="text-lg font-black" style={{ color: C.brown }}>{meta.icon} {meta.name}</div>
        <div className="mt-1 text-xs font-bold" style={{ color: C.mid }}>
          Lv.{level}/20 ・產量 +{villageAlbumBonusPct(xp[selected]).toFixed(2)}% ・EXP {xp[selected] || 0}/{villageAlbumThreshold(Math.min(20, level + 1))}
        </div>
        {message && <div className="mt-2 text-xs font-bold text-amber-700">{message}</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
        {cards.map(card => {
          const count = Number(owned[card.id]) || 0;
          const stars = count > 0 ? Math.max(1, Number(catCardStars[card.id]) || 1) : 0;
          const cost = catCardUpgradeCost(stars);
          const canUpgrade = count > 0 && cost && count - 1 >= cost;
          return <div key={card.id} style={{ borderRadius: 11, padding: 6, background: count ? (card.bg || "#fff5e8") : "rgba(92,61,46,.05)", opacity: count ? 1 : .42, border: `1px solid ${C.border}` }}>
            <img loading="lazy" decoding="async" src={`/cats/cat-cards/${card.id}.webp`} alt={count ? card.name : "未取得卡片"}
              style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 7, filter: count ? "none" : "grayscale(1)" }} />
            <div className="mt-1 truncate text-center text-[9px] font-black" style={{ color: C.brown }}>{count ? card.name : "???"}</div>
            {count > 0 && <>
              <div className="text-center text-[9px] text-amber-600">{"★".repeat(stars)}　×{count}</div>
              {stars < 5 && <button disabled={!canUpgrade || busy === card.id} onClick={() => upgrade(card.id)}
                className="mt-1 w-full rounded-lg py-1 text-[9px] font-black text-white disabled:opacity-40" style={{ background: C.sage }}>
                {busy === card.id ? "升星中…" : `升星 ${count - 1}/${cost}`}
              </button>}
            </>}
          </div>;
        })}
      </div>
    </div>;
  }

  return <div>
    <div className="mb-3 text-xs font-bold" style={{ color: C.mid }}>九冊各自累積，升級後永久增加對應建築產量。</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
      {VILLAGE_ALBUM_IDS.map(albumId => {
        const meta = VILLAGE_ALBUM_META[albumId];
        const value = xp[albumId] || 0;
        const level = villageAlbumLevel(value);
        const next = villageAlbumThreshold(Math.min(20, level + 1));
        const current = villageAlbumThreshold(level);
        const pct = level >= 20 ? 100 : Math.max(0, Math.min(100, ((value - current) / Math.max(1, next - current)) * 100));
        const collected = ALBUM_CARD_IDS[albumId].filter(id => (owned[id] || 0) > 0).length;
        return <button key={albumId} onClick={() => setSelected(albumId)} className="rounded-2xl p-3 text-left"
          style={{ background: "rgba(255,255,255,.78)", border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
          <div className="text-sm font-black" style={{ color: C.brown }}>{meta.icon} {meta.name}</div>
          <div className="mt-1 text-xs font-black text-amber-700">Lv.{level}/20　+{villageAlbumBonusPct(value).toFixed(2)}%</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} /></div>
          <div className="mt-1 text-[9px]" style={{ color: C.muted }}>{level >= 20 ? "已滿級" : `${value}/${next} EXP`}　收集 {collected}/{ALBUM_CARD_IDS[albumId].length}</div>
        </button>;
      })}
    </div>
  </div>;
}

// ── 主元件 ───────────────────────────────────────────────────
export default function GachaMachine({ catCards, gachaCoins, onCoinsUpdated }) {
  const { profile }    = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [drawMode, setDrawMode] = useState(null); // null | single | multi — 舞台光效
  const [revealQueue, setRevealQueue] = useState(null); // null = idle, array = revealing (單抽)
  const [multiResult, setMultiResult] = useState(null); // null = idle, array = 十連直接展示
  const [tab, setTab]  = useState("gacha");

  const ownedCount = Object.keys(catCards || {}).filter(id => (catCards[id]||0) > 0).length;

  async function doGacha(type) {
    if (spinning || revealQueue || multiResult) return;
    sfxGachaRoll();
    setSpinning(true);
    setDrawMode(type);
    const res = await drawGachaCards(profile.id, type);
    setSpinning(false);
    if (!res.ok) { alert(res.reason || "抽卡失敗"); return; }

    onCoinsUpdated?.();
    if (type === "multi") {
      setMultiResult(res.results);   // 十連：直接展示全部
    } else {
      setRevealQueue(res.results);   // 單抽：逐張揭示
    }
  }

  function handleRevealDone() {
    setRevealQueue(null);
    setDrawMode(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <style>{STYLE}</style>

      {/* 頁籤 */}
      <div className="flex rounded-2xl overflow-hidden"
        style={{border:`1px solid ${C.border}`,background:"rgba(255,255,255,0.5)"}}>
        {[["gacha","扭蛋"],["albums","九冊"],["dex","全圖鑑"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            className="flex min-h-16 flex-1 items-center justify-center gap-1 py-2 text-xs font-black transition-colors sm:text-sm"
            style={{background:tab===id?C.brown:"transparent",color:tab===id?"white":C.muted}}>
            <CatVillageNavArt name={id} size={38} style={{ filter: tab===id ? "drop-shadow(0 3px 5px rgba(0,0,0,.5))" : undefined }} />{label}
          </button>
        ))}
      </div>

      {tab === "gacha" && (
        <div className="flex flex-col items-center gap-4">
          {/* 標頭（純文字，不套大色塊） */}
          <div className="w-full text-center" style={{ paddingTop: 2 }}>
            <div className="text-[10px] font-black tracking-[.34em]" style={{ color: C.mid }}>CAT VILLAGE</div>
            <div className="mt-1 text-2xl font-black" style={{ color: C.brown }}>🐱 貓咪扭蛋機</div>
            <div className="mt-1 text-xs font-bold" style={{ color: C.muted }}>收集 200 張貓貓卡片・稀有卡 0.6%</div>
          </div>

          {/* 幣數 */}
          <div className="flex items-center gap-2.5 rounded-2xl px-6 py-3"
            style={{background:"rgba(255,255,255,0.78)",border:`1px solid ${C.border}`,boxShadow:"0 4px 14px rgba(92,61,46,0.12)"}}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-xl"
              style={{background:"radial-gradient(circle at 35% 30%,#FFE9A8,#F5A623)",boxShadow:"0 2px 6px rgba(245,166,35,0.5)"}}>🪙</span>
            <span className="font-black text-2xl" style={{color:C.brown}}>{gachaCoins??0}</span>
            <span className="text-sm font-bold" style={{color:C.mid}}>扭蛋幣</span>
            <span className="ml-1 rounded-full px-2.5 py-0.5 text-[10px] font-black" style={{background:"rgba(92,61,46,0.08)",color:C.mid}}>
              已收集 {ownedCount}/200
            </span>
          </div>

          {/* 機器舞台：放大＋柔和背景光（抽卡時變亮變動） */}
          <MachineStage spinning={spinning} mode={drawMode}>
            <MachineBody spinning={spinning} ballPhase={null} size={300} />
          </MachineStage>

          {/* 按鈕 */}
          <div className="flex w-full gap-3">
            <button
              disabled={spinning || (gachaCoins??0)<1}
              onClick={()=>doGacha("single")}
              className="flex-1 rounded-2xl py-3.5 font-black text-sm transition-all active:scale-95 text-white disabled:opacity-40"
              style={{background:"linear-gradient(135deg,#F4A261,#E07040)",boxShadow:"0 4px 12px rgba(224,112,64,0.4)"}}>
              單抽<br/><span className="font-normal text-xs opacity-90">🪙×1</span>
            </button>
            <button
              disabled={spinning || (gachaCoins??0)<10}
              onClick={()=>doGacha("multi")}
              className="flex-[1.3] rounded-2xl py-3.5 font-black text-sm transition-all active:scale-95 text-white disabled:opacity-40"
              style={{background:"linear-gradient(135deg,#7A4A9A,#9B6BB5)",boxShadow:"0 4px 12px rgba(122,74,154,0.45)",border:"1px solid rgba(255,255,255,0.25)"}}>
              十連抽　一次看全部<br/><span className="font-normal text-xs opacity-90">🪙×10・11 張卡片</span>
            </button>
          </div>

          {/* 說明 */}
          <div className="w-full rounded-2xl p-3.5 text-center"
            style={{background:"rgba(255,255,255,0.55)",border:`1px solid ${C.border}`}}>
            <p className="text-xs font-bold leading-relaxed" style={{color:C.mid}}>
              ✦ 稀有卡（傳說第100貓・終極收藏貓）機率合計 0.6%<br/>
              ✦ 十連抽額外 +1 張，且保底不會全部重複<br/>
              ✦ 練習射箭即可獲得扭蛋幣！完成練箭里程碑可獲得更多
            </p>
          </div>
        </div>
      )}

      {tab === "dex" && <CardDex catCards={catCards} />}
      {tab === "albums" && <VillageAlbums catCards={catCards} catCardStars={profile?.catCardStars}
        savedAlbums={profile?.villageCardAlbums} onChanged={onCoinsUpdated} />}

      {/* 單抽：逐張揭示 Overlay */}
      {revealQueue && (
        <RevealOverlay results={revealQueue} onDone={handleRevealDone} />
      )}

      {/* 十連：直接展示全部 */}
      {multiResult && (
        <MultiResultOverlay results={multiResult} onDone={() => { setMultiResult(null); setDrawMode(null); }} />
      )}
    </div>
  );
}
