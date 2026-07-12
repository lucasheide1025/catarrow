// src/components/dungeon/DungeonTreasureRoom.jsx — 寶箱族獎勵房
// 非戰鬥、純獎勵：打贏 Boss 後的專屬獎勵空間

import { useState, useEffect, useMemo, useRef } from "react";
import { rollBattleLoot } from "../../lib/monsterRegistry";
import { MONSTERS, TIER_ORDER } from "../../lib/monsterData";
import { sfxCoinDrop, sfxGachaReveal } from "../../lib/sound";

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
function LootCard({ item, icon, label, flipped }) {
  return (
    <div style={{
      width:"min(82vw,320px)", minHeight:220, borderRadius:22,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12,
      padding:"24px", textAlign:"center",
      background:flipped
        ? "linear-gradient(145deg,rgba(251,191,36,0.22),rgba(120,53,15,0.55))"
        : "linear-gradient(145deg,#78350f,#451a03)",
      border:"2px solid rgba(251,191,36,0.55)",
      boxShadow:"0 18px 55px rgba(0,0,0,0.45),0 0 35px rgba(251,191,36,0.15)",
      animation:flipped ? "tr-card-flip 0.55s ease both" : "tr-card-in 0.45s ease both",
    }}>
      <span style={{ fontSize:flipped ? 70 : 84, filter:"drop-shadow(0 0 18px rgba(251,191,36,0.45))" }}>
        {flipped ? (icon || item?.icon || "🎁") : "🂠"}
      </span>
      <div style={{ fontSize:20, fontWeight:900, color:flipped ? "#fde68a" : "#fbbf24" }}>
        {flipped ? (label || item?.name || "寶物") : "點擊下方按鈕翻牌"}
      </div>
      {flipped && item?.desc && (
        <div style={{ fontSize:14, lineHeight:1.6, color:"#cbd5e1" }}>{item.desc}</div>
      )}
    </div>
  );
}

// ── 主元件 ───────────────────────────────────────────────
export default function DungeonTreasureRoom({
  onClaim,
  onLoot,               // 選填：獎勵生成後回傳一次（父層可據此實際發放）
  lootOverride = null,  // 組隊模式由房主生成並同步，其他成員只顯示同一份獎勵
  claimDisabled = false,
  claimLabel = "📊 查看遠征報告",
  difficultyTier = 1,
  family = "treasure",
  bossVariant = "boss",
}) {
  const [phase, setPhase] = useState("enter"); // enter → fountain → cards → done
  const [showFountain, setShowFountain] = useState(false);
  const [loot, setLoot] = useState(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const generatedRef = useRef(false);

  // 生成獎勵（一次性）
  useEffect(() => {
    if (generatedRef.current) return;
    generatedRef.current = true;
    if (lootOverride) {
      setLoot(lootOverride);
      return;
    }
    // 用寶箱族最高 tier 的怪來生成獎勵
    const tier = TIER_ORDER[Math.min(5, Math.max(0, difficultyTier - 1))] || "common";
    const treasureMonster = MONSTERS.find(monster =>
      monster.family === "treasure" && monster.tier === tier
    ) || MONSTERS.find(monster => monster.family === "treasure");
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
    if (typeof onLoot === "function") onLoot(result); // 只在生成時呼叫一次
  }, [lootOverride]); // eslint-disable-line

  const cards = useMemo(() => {
    if (!loot) return [];
    return [
      ...(loot.material ? [{ item:loot.material }] : []),
      ...(loot.chest ? [{ icon:"📦", label:"額外材料寶箱 ×2" }] : []),
      ...(loot.goldChest ? [{ icon:"🎁", label:"額外金幣寶箱 ×2" }] : []),
      ...(loot.extraItem ? [{
        item:loot.extraItem,
        icon:"👑",
        label:`珍藏品：${loot.extraItem.name}`,
      }] : []),
      ...(loot.arrowDew > 0 ? [{ icon:"💧", label:`箭露 +${loot.arrowDew}` }] : []),
    ];
  }, [loot]);

  // 金幣噴泉保留自動演出；卡片改由玩家手動推進。
  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase("fountain");
      setShowFountain(true);
      sfxCoinDrop();
    }, 800);
    const t2 = setTimeout(() => {
      setShowFountain(false);
      setPhase("cards");
    }, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function handleCardNext() {
    if (!cardFlipped) {
      sfxGachaReveal(false);
      setCardFlipped(true);
      return;
    }
    if (cardIndex >= cards.length - 1) {
      setPhase("done");
      return;
    }
    setCardIndex(index => index + 1);
    setCardFlipped(false);
  }

  // ── 靜態樣式 ──────────────────────────────────────────
  const styles = `
    @keyframes tr-glow{0%,100%{filter:drop-shadow(0 0 10px rgba(251,191,36,0.4))}50%{filter:drop-shadow(0 0 40px rgba(251,191,36,0.8))}}
    @keyframes tr-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
    @keyframes tr-fade-in{0%{opacity:0;transform:translateY(-20px)}100%{opacity:1;transform:translateY(0)}}
    @keyframes tr-card-in{0%{opacity:0;transform:translateX(-20px) scale(0.9)}100%{opacity:1;transform:translateX(0) scale(1)}}
    @keyframes tr-card-flip{0%{transform:rotateY(90deg) scale(0.9)}100%{transform:rotateY(0) scale(1)}}
    @keyframes tr-scale-in{0%{opacity:0;transform:scale(0)}60%{opacity:1;transform:scale(1.15)}100%{transform:scale(1)}}
    @keyframes tr-bounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-15px)}60%{transform:translateY(-5px)}}
  `;

  return (
    <div className="min-h-full flex flex-col text-white"
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
           phase === "cards" ? `逐張揭曉寶物（${Math.min(cardIndex + 1, cards.length)}/${cards.length}）` :
           phase === "done" ? "所有寶物已完成清點！" : ""}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center px-6 py-8 gap-4">

        {/* 金幣獎勵 */}
        {loot && phase === "fountain" && (
          <div className="text-center" style={{ animation:"tr-scale-in 0.6s ease both" }}>
            <div className="text-5xl mb-1"
              style={{ animation:"tr-bounce 1s ease infinite" }}>💰</div>
            <div className="text-4xl font-black" style={{ color:"#fbbf24" }}>
              +{loot.coins.toLocaleString()}
            </div>
            <div className="text-sm text-amber-600/60 mt-1">金幣</div>
          </div>
        )}

        {phase === "cards" && cards[cardIndex] && (
          <LootCard
            {...cards[cardIndex]}
            flipped={cardFlipped}
          />
        )}

        {/* 全部完成 */}
        {phase === "done" && (
          <div className="text-center" style={{ animation:"tr-fade-in 0.5s ease both", marginTop:8 }}>
            <div className="text-6xl mb-4">🎊</div>
            <div className="text-2xl font-black text-amber-300">寶物清點完成</div>
            <div className="text-sm text-slate-300 mt-2">下一步查看本次遠征完整報告</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 border-t border-amber-700/30">
        {phase === "cards" ? (
          <button onClick={handleCardNext}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg active:scale-[0.98]"
            style={{ background:"linear-gradient(90deg,#f59e0b,#d97706)", color:"white" }}>
            {!cardFlipped
              ? "✨ 翻開卡片"
              : cardIndex >= cards.length - 1
                ? "📊 查看完整結算"
                : "下一張獎勵 →"}
          </button>
        ) : phase === "done" ? (
          <button onClick={onClaim} disabled={claimDisabled}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{
              background:"linear-gradient(90deg,#f59e0b,#d97706)",
              color:"white",
              boxShadow:"0 0 30px rgba(245,158,11,0.3)",
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 50px rgba(245,158,11,0.5)"; e.currentTarget.style.transform = "scale(1.02)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}>
            {claimLabel}
          </button>
        ) : (
          <div className="text-center text-amber-700/60 text-sm py-4">
            {phase === "enter" ? "寶藏正一一浮現…" :
             "金幣還在噴湧…"}
          </div>
        )}
      </div>
    </div>
  );
}
