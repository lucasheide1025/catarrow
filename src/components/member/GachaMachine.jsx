// src/components/member/GachaMachine.jsx
import { useState, useEffect, useRef } from "react";
import { drawGachaCards } from "../../lib/db";
import { CAT_CARD_MAP, CAT_CARD_CATEGORIES, CAT_CARDS } from "../../lib/catCardData";
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
`;

// ── 機器主體 ────────────────────────────────────────────────
function MachineBody({ spinning, ballPhase }) {
  return (
    <div style={{ position:"relative", width:240, height:240, flexShrink:0 }}>
      <img
        src="/ui/village/gacha-machine.webp"
        alt="扭蛋機"
        style={{
          width:"100%", height:"100%", objectFit:"contain",
          animation: spinning ? "gachaShake 0.45s ease-in-out infinite" : "none",
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
          width:150, height:150, borderRadius:"50%",
          background:"radial-gradient(circle at 35% 35%,#FFF0D0,#F0C070)",
          border:"5px solid #E0A050",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:72, boxShadow:"0 8px 28px rgba(150,80,30,0.28)",
        }}>
          {spinning ? "🌀" : "🐱"}
        </div>
        <div style={{ width:110, height:18, borderRadius:"0 0 12px 12px",
          background:"linear-gradient(to bottom,#D4884A,#B86830)" }} />
        <div style={{ width:50, height:20, borderRadius:10,
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

// ── 逐張揭示 Overlay ─────────────────────────────────────────
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

      {/* 機器（entering 階段） */}
      {(phase === "entering") && (
        <MachineBody spinning={ball==="drop"} ballPhase={ball} />
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
      <div className="text-xs mb-2 font-bold" style={{color:C.mid}}>已收集 {ownedCount} / 200 張</div>

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

// ── 主元件 ───────────────────────────────────────────────────
export default function GachaMachine({ catCards, gachaCoins, onCoinsUpdated }) {
  const { profile }    = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [revealQueue, setRevealQueue] = useState(null); // null = idle, array = revealing
  const [tab, setTab]  = useState("gacha");

  async function doGacha(type) {
    if (spinning || revealQueue) return;
    sfxGachaRoll();
    setSpinning(true);
    const res = await drawGachaCards(profile.id, type);
    setSpinning(false);
    if (!res.ok) { alert(res.reason || "抽卡失敗"); return; }

    let results = res.results;

    // 10連保底：確保最後一張是玩家沒有的卡
    if (type === "multi") {
      const ownedIds = new Set(Object.keys(catCards||{}).filter(id=>(catCards[id]||0)>0));
      const lastIdx  = results.length - 1;
      if (!results[lastIdx].isNew) {
        const newIdx = results.findIndex(r => r.isNew);
        if (newIdx >= 0) {
          // swap 到最後
          [results[newIdx], results[lastIdx]] = [results[lastIdx], results[newIdx]];
        } else {
          // 全都重複 → 客製化保底：隨機選一張玩家未擁有的
          const unowned = CAT_CARDS.filter(c => !ownedIds.has(c.id));
          if (unowned.length > 0) {
            const pick = unowned[Math.floor(Math.random() * unowned.length)];
            results[lastIdx] = { id: pick.id, isNew: true };
          }
        }
      }
    }

    setRevealQueue(results);
    onCoinsUpdated?.();
  }

  function handleRevealDone() {
    setRevealQueue(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <style>{STYLE}</style>

      {/* 頁籤 */}
      <div className="flex rounded-2xl overflow-hidden"
        style={{border:`1px solid ${C.border}`,background:"rgba(255,255,255,0.5)"}}>
        {[["gacha","🎰 扭蛋機"],["dex","📖 圖鑑"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            className="flex-1 py-2 text-sm font-black transition-colors"
            style={{background:tab===id?C.brown:"transparent",color:tab===id?"white":C.muted}}>
            {label}
          </button>
        ))}
      </div>

      {tab === "gacha" && (
        <div className="flex flex-col items-center gap-4">
          {/* 幣數 */}
          <div className="flex items-center gap-2 rounded-2xl px-5 py-3"
            style={{background:"rgba(255,255,255,0.7)",border:`1px solid ${C.border}`}}>
            <span className="text-2xl">🪙</span>
            <span className="font-black text-xl" style={{color:C.brown}}>{gachaCoins??0}</span>
            <span className="text-sm" style={{color:C.mid}}>枚扭蛋幣</span>
          </div>

          <MachineBody spinning={spinning} ballPhase={null} />

          {/* 按鈕 */}
          <div className="flex gap-3 w-full">
            <button
              disabled={spinning || (gachaCoins??0)<1}
              onClick={()=>doGacha("single")}
              className="flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 text-white disabled:opacity-40"
              style={{background:"linear-gradient(135deg,#F4A261,#E07040)",boxShadow:"0 3px 10px rgba(224,112,64,0.35)"}}>
              單抽<br/><span className="font-normal text-xs">🪙×1</span>
            </button>
            <button
              disabled={spinning || (gachaCoins??0)<10}
              onClick={()=>doGacha("multi")}
              className="flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 text-white disabled:opacity-40"
              style={{background:"linear-gradient(135deg,#9B6BB5,#7A4A9A)",boxShadow:"0 3px 10px rgba(122,74,154,0.35)"}}>
              10連＋1<br/><span className="font-normal text-xs">🪙×10</span>
            </button>
          </div>

          <p className="text-xs text-center" style={{color:C.muted}}>
            練習射箭即可獲得扭蛋幣！<br/>
            完成練箭里程碑可獲得更多幣
          </p>
        </div>
      )}

      {tab === "dex" && <CardDex catCards={catCards} />}

      {/* 逐張揭示 Overlay */}
      {revealQueue && (
        <RevealOverlay results={revealQueue} onDone={handleRevealDone} />
      )}
    </div>
  );
}
