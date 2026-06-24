// src/components/member/LootBox.jsx
// 開寶箱動畫元件（依稀有度有不同特效）
import { useState, useEffect } from "react";
import { sfxEpic, sfxSuccess, sfxTap, sfxCast } from "../../lib/sound";

// 依稀有度決定特效等級
function getRarityLevel(loot) {
  if (!loot) return "common";
  if (loot.id === "discount_50") return "legendary";
  if (loot.id === "badge_silver") return "rare";
  if (loot.id === "badge_bronze") return "uncommon";
  if (loot.id === "badge_memorial") return "uncommon";
  if (loot.rarity === "legendary") return "legendary";
  if (loot.rarity === "rare") return "rare";
  if (loot.rarity === "uncommon") return "uncommon";
  return "common";
}

const RARITY_STYLE = {
  common:    { bg:"linear-gradient(160deg,#1e293b,#334155)",    glow:"#94a3b8", label:"普通掉落",   chest:"📦" },
  uncommon:  { bg:"linear-gradient(160deg,#052e16,#166534)",    glow:"#4ade80", label:"非凡掉落！", chest:"🟩" },
  rare:      { bg:"linear-gradient(160deg,#1e3a5f,#1d4ed8)",    glow:"#60a5fa", label:"稀有掉落！！", chest:"💎" },
  legendary: { bg:"linear-gradient(160deg,#451a03,#78350f,#b45309)", glow:"#fbbf24", label:"傳說掉落！！！", chest:"🌟" },
};

// 開箱流程：
// phase 0 = 寶箱搖晃等待點擊
// phase 1 = 點擊後光爆（0.3s）
// phase 2 = 物品浮現（1s）
// phase 3 = 完整展示

export default function LootBox({ loot, onDone }) {
  const [phase, setPhase] = useState(0);
  const [shake,  setShake]  = useState(false);
  const rarityLevel = getRarityLevel(loot);
  const style = RARITY_STYLE[rarityLevel];

  // 寶箱一開始就搖晃
  useEffect(() => {
    const t = setInterval(() => setShake(v => !v), 800);
    return () => clearInterval(t);
  }, []);

  function openChest() {
    if (phase > 0) return;
    sfxCast();
    setPhase(1);
    setTimeout(() => {
      if (rarityLevel === "legendary") sfxEpic();
      else if (rarityLevel === "rare") sfxEpic();
      else if (rarityLevel === "uncommon") sfxSuccess();
      else sfxTap();
      setPhase(2);
    }, 400);
    setTimeout(() => setPhase(3), 1400);
  }

  const LOOT_BOX_CSS = `
    @keyframes lb-shake { 0%,100%{transform:rotate(0) scale(1)} 25%{transform:rotate(-8deg) scale(1.05)} 75%{transform:rotate(8deg) scale(1.05)} }
    @keyframes lb-explode { 0%{transform:scale(0);opacity:1} 100%{transform:scale(3);opacity:0} }
    @keyframes lb-pop { 0%{transform:scale(0) rotate(-10deg);opacity:0} 60%{transform:scale(1.2) rotate(3deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
    @keyframes lb-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
    @keyframes lb-glow-pulse { 0%,100%{filter:drop-shadow(0 0 8px ${style.glow})} 50%{filter:drop-shadow(0 0 28px ${style.glow})} }
    @keyframes lb-ray { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
    @keyframes lb-confetti { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(-80px) rotate(720deg);opacity:0} }
    @keyframes lb-bounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-8px) scale(1.05)} }
  `;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(0,0,0,.85)", flexDirection:"column", gap:20 }}
      onClick={phase === 0 ? openChest : undefined}>
      <style>{LOOT_BOX_CSS}</style>

      {/* 光芒放射（rare以上才有）*/}
      {phase >= 1 && (rarityLevel === "rare" || rarityLevel === "legendary") && (
        <div style={{
          position:"absolute", width:400, height:400,
          borderRadius:"50%", opacity:.3,
          background:`conic-gradient(from 0deg,transparent 0 10deg,${style.glow} 10deg 12deg,transparent 12deg 30deg,${style.glow}88 30deg 32deg,transparent 32deg)`,
          animation:"lb-ray 4s linear infinite",
        }}/>
      )}

      {/* Phase 0：寶箱等待點擊 */}
      {phase === 0 && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:90, animation: shake ? "lb-shake .4s ease" : "none", cursor:"pointer" }}>
            📦
          </div>
          <div style={{ color:"white", fontWeight:900, fontSize:18 }}>點擊開箱！</div>
          <div style={{ color:"rgba(255,255,255,.5)", fontSize:12 }}>輕點寶箱打開它…</div>
        </div>
      )}

      {/* Phase 1：爆閃 */}
      {phase === 1 && (
        <div style={{ width:200, height:200, borderRadius:"50%",
          background: style.glow, opacity:.9,
          animation:"lb-explode .4s ease forwards" }}/>
      )}

      {/* Phase 2~3：物品展示 */}
      {phase >= 2 && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16,
          animation: phase === 2 ? "lb-pop .8s cubic-bezier(.18,.89,.32,1.4) forwards" : "none" }}>

          {/* 標題 */}
          <div style={{ fontSize:11, letterSpacing:4, fontWeight:900,
            color: style.glow, textTransform:"uppercase" }}>
            {style.label}
          </div>

          {/* 物品圖示 */}
          <div style={{ fontSize:90, lineHeight:1,
            animation: phase === 3 ? `lb-glow-pulse 2s ease infinite, lb-float 2s ease infinite` : "none",
            filter:`drop-shadow(0 0 20px ${style.glow})` }}>
            {loot?.icon || "🎁"}
          </div>

          {/* 物品名稱 */}
          {phase === 3 && (
            <>
              <div style={{ color:"white", fontWeight:900, fontSize:22, textAlign:"center" }}>
                {loot?.name}
              </div>
              <div style={{ color:"rgba(255,255,255,.6)", fontSize:13, textAlign:"center", maxWidth:260, lineHeight:1.5 }}>
                {loot?.desc}
              </div>

              {/* 稀有度標籤 */}
              <div style={{ padding:"4px 16px", borderRadius:999, fontSize:12, fontWeight:900,
                background:`${style.glow}33`, border:`2px solid ${style.glow}88`, color:style.glow }}>
                {style.label}
              </div>

              <button onClick={onDone}
                style={{ marginTop:8, padding:"12px 32px", borderRadius:16, fontWeight:900, fontSize:15,
                  background:`linear-gradient(90deg,${style.glow},${style.glow}cc)`,
                  color: rarityLevel === "legendary" ? "#7c2d12" : "#fff", border:"none", cursor:"pointer",
                  animation:"lb-bounce 1.5s ease infinite" }}>
                收下！
              </button>
            </>
          )}
        </div>
      )}

      {/* 彩帶效果（rare以上）*/}
      {phase === 3 && (rarityLevel === "rare" || rarityLevel === "legendary") && (
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden" }}>
          {Array.from({length: rarityLevel === "legendary" ? 20 : 10}).map((_,i) => (
            <div key={i} style={{
              position:"absolute",
              left: `${10 + Math.random()*80}%`,
              top: `${50 + Math.random()*30}%`,
              fontSize: 16 + Math.random()*12,
              animation:`lb-confetti ${1+Math.random()}s ease ${Math.random()*0.5}s forwards`,
            }}>
              {["✨","⭐","💫","🌟","🎊","🎉"][Math.floor(Math.random()*6)]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
