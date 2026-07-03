// src/components/dungeon/DungeonTreasureRoom.jsx — 寶箱族獎勵房
// 非戰鬥、純獎勵：打贏 Boss 後的專屬獎勵空間

import { useState, useEffect, useMemo } from "react";
import { rollBattleLoot } from "../../lib/monsterRegistry";

// ── 粒子背景（金色） ────────────────────────────────────
function GoldParticles({ count = 24 }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 5,
      duration: 4 + Math.random() * 6,
      opacity: 0.1 + Math.random() * 0.3,
    })), [count]);

  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:"absolute", left:`${p.x}%`, top:`${p.y}%`,
          width:p.size, height:p.size, borderRadius:"50%",
          background:"rgba(251,191,36,0.6)",
          boxShadow:"0 0 6px rgba(251,191,36,0.4)",
          animation: `tr-particle ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          opacity: p.opacity,
        }} />
      ))}
      <style>{`@keyframes tr-particle{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-60px) scale(1.5)}}`}</style>
    </div>
  );
}

// ── 金幣噴泉 ─────────────────────────────────────────────
function CoinFountain({ count = 20 }) {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:50 }}>
      <style>{`@keyframes tr-coin-fly{0%{opacity:0;transform:translateY(0) scale(0.5)}15%{opacity:1;transform:translateY(-40px) scale(1.2)}100%{opacity:0;transform:translateY(-120px) scale(0.6) translateX(var(--dx))}}`}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position:"absolute", left:"50%", top:"30%",
          fontSize: 14 + Math.random() * 16,
          "--dx": `${-60 + Math.random() * 120}px`,
          animation: `tr-coin-fly ${1.2 + Math.random() * 1}s ease-out ${Math.random() * 0.6}s forwards`,
        }}>
          {["🪙","✨","💰","⭐","👑"][Math.floor(Math.random() * 5)]}
        </div>
      ))}
    </div>
  );
}

// ── 物品卡片 ─────────────────────────────────────────────
function LootCard({ item, icon, label, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"10px 16px", borderRadius:12,
      background:"rgba(255,255,255,0.06)",
      border:"1px solid rgba(251,191,36,0.15)",
      animation:"tr-card-in 0.5s ease both",
      minWidth:160,
    }}>
      <span style={{ fontSize:28, filter:"drop-shadow(0 0 8px rgba(251,191,36,0.3))" }}>{icon || item?.icon || "🎁"}</span>
      <div>
        <div style={{ fontSize:14, fontWeight:900, color:"#fbbf24" }}>{label || item?.name || "寶物"}</div>
        <div style={{ fontSize:10, color:"#94a3b8" }}>{item?.desc || ""}</div>
      </div>
    </div>
  );
}

// ── 主元件 ───────────────────────────────────────────────
export default function DungeonTreasureRoom({
  onClaim,
  difficultyTier = 1,
  family = "treasure",
  bossVariant = "boss",
}) {
  const [phase, setPhase] = useState("enter"); // enter → fountain → loot → done
  const [showFountain, setShowFountain] = useState(false);
  const [loot, setLoot] = useState(null);

  // 生成獎勵（一次性）
  useEffect(() => {
    // 用寶箱族最高 tier 的怪來生成獎勵
    const treasureMonster = {
      id:"treasure_reward",
      family: "treasure",
      tier: ["common","rare","elite","fierce","boss","mythic"][Math.min(5, difficultyTier - 1)] || "common",
    };
    const result = rollBattleLoot(treasureMonster, bossVariant, "veteran");

    // 寶箱族加倍
    result.coins = Math.round(result.coins * 5);
    result.chest = true;
    result.goldChest = Math.random() < 0.5 || result.goldChest;
    // 必掉一個收藏品級物品
    const extraItems = [
      { id:"treasure_gem",  name:"寶藏寶石", icon:"💎", desc:"閃閃發光的巨大寶石" },
      { id:"golden_feather",name:"黃金羽毛", icon:"🪶", desc:"純金打造的羽毛飾品" },
      { id:"crystal_skull", name:"水晶骷髏", icon:"💀", desc:"純淨水晶雕刻的骷髏" },
      { id:"ancient_coin",  name:"古代金幣", icon:"🪙", desc:"遠古文明的金幣" },
      { id:"royal_crown",   name:"王室皇冠", icon:"👑", desc:"鑲滿寶石的王者皇冠" },
    ];
    const extraItem = extraItems[Math.floor(Math.random() * extraItems.length)];
    result.extraItem = extraItem;
    setLoot(result);
  }, []); // eslint-disable-line

  // 自動播放動畫
  useEffect(() => {
    const t1 = setTimeout(() => { setPhase("fountain"); setShowFountain(true); }, 800);
    const t2 = setTimeout(() => { setPhase("loot"); }, 2500);
    const t3 = setTimeout(() => { setPhase("done"); }, 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // ── 靜態樣式 ──────────────────────────────────────────
  const styles = `
    @keyframes tr-glow{0%,100%{filter:drop-shadow(0 0 10px rgba(251,191,36,0.4))}50%{filter:drop-shadow(0 0 40px rgba(251,191,36,0.8))}}
    @keyframes tr-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
    @keyframes tr-fade-in{0%{opacity:0;transform:translateY(-20px)}100%{opacity:1;transform:translateY(0)}}
    @keyframes tr-card-in{0%{opacity:0;transform:translateX(-20px) scale(0.9)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes tr-scale-in{0%{opacity:0;transform:scale(0)}60%{opacity:1;transform:scale(1.15)}100%{transform:scale(1)}}
    @keyframes tr-bounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-15px)}60%{transform:translateY(-5px)}}
  `;

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white"
      style={{
        background:"linear-gradient(160deg,#1a0f00,#2d1a00)",
        position:"relative",
      }}>
      <style>{styles}</style>
      <GoldParticles count={30} />
      {showFountain && <CoinFountain count={24} />}

      {/* Header */}
      <div className="shrink-0 text-center py-6 border-b border-amber-700/30"
        style={{ animation:"tr-fade-in 0.6s ease both" }}>
        <div className="text-5xl mb-2"
          style={{ animation:"tr-glow 2s ease infinite, tr-float 3s ease infinite", display:"inline-block", padding:8 }}>
          📦
        </div>
        <div className="text-2xl font-black" style={{ color:"#fbbf24" }}>寶藏房</div>
        <div className="text-sm mt-1 text-amber-600/80">
          {phase === "enter" ? "寶箱怪讓出一條路，前方金光閃閃…" :
           phase === "fountain" ? "金幣如瀑布般傾瀉而出！" :
           phase === "loot" ? "所有的寶物都在這裡了！" : ""}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 gap-4">

        {/* 金幣獎勵 */}
        {loot && phase !== "enter" && (
          <div className="text-center" style={{ animation:"tr-scale-in 0.6s ease both" }}>
            <div className="text-5xl mb-1"
              style={{ animation:"tr-bounce 1s ease infinite" }}>{phase === "fountain" ? "💰" : "🪙"}</div>
            <div className="text-4xl font-black" style={{ color:"#fbbf24" }}>
              +{loot.coins.toLocaleString()}
            </div>
            <div className="text-sm text-amber-600/60 mt-1">金幣</div>
          </div>
        )}

        {/* 材料掉落 */}
        {loot?.material && phase === "loot" && (
          <LootCard
            item={loot.material}
            delay={200}
          />
        )}

        {/* 寶箱 */}
        {phase === "loot" && (
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
            {loot?.chest && (
              <LootCard
                icon="📦"
                label="普通寶箱 ×1"
                delay={400}
              />
            )}
            {loot?.goldChest && (
              <LootCard
                icon="🎁"
                label="黃金寶箱 ×1"
                delay={600}
              />
            )}
          </div>
        )}

        {/* 卡片 */}
        {loot?.card && phase === "loot" && (
          <LootCard
            icon="🃏"
            label={`卡片：${loot.card.name}`}
            delay={800}
          />
        )}

        {/* 額外收藏品 */}
        {loot?.extraItem && phase === "loot" && (
          <LootCard
            item={loot.extraItem}
            delay={1000}
            icon="👑"
            label={`✨ ${loot.extraItem.name}`}
          />
        )}

        {/* 箭露 */}
        {loot?.arrowDew > 0 && phase === "loot" && (
          <LootCard
            icon="💧"
            label={`箭露 +${loot.arrowDew}`}
            delay={1200}
          />
        )}

        {/* 全部完成 */}
        {phase === "done" && (
          <div className="text-center" style={{ animation:"tr-fade-in 0.5s ease both", marginTop:8 }}>
            <div className="text-lg font-bold text-amber-400">✨ 寶物已全數入袋！</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-8 pt-3 border-t border-amber-700/30">
        {phase === "done" ? (
          <button onClick={onClaim}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg transition-all active:scale-[0.98]"
            style={{
              background:"linear-gradient(90deg,#f59e0b,#d97706)",
              color:"white",
              boxShadow:"0 0 30px rgba(245,158,11,0.3)",
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 50px rgba(245,158,11,0.5)"; e.currentTarget.style.transform = "scale(1.02)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}>
            🎉 領取所有寶物！
          </button>
        ) : (
          <div className="text-center text-amber-700/60 text-sm py-4">
            {phase === "enter" ? "寶藏正一一浮現…" :
             phase === "fountain" ? "金幣還在噴湧…" :
             "獎勵結算中…"}
          </div>
        )}
      </div>
    </div>
  );
}
