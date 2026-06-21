// src/components/member/GachaMachine.jsx
import { useState } from "react";
import { drawGachaCards } from "../../lib/db";
import { CAT_CARD_MAP, CAT_CARD_CATEGORIES, CAT_CARDS } from "../../lib/catCardData";
import { useAuth } from "../../hooks/useAuth";

// ── 機器 SVG ────────────────────────────────────────────────
function MachineBody({ spinning }) {
  return (
    <div className="relative flex flex-col items-center select-none">
      {/* 球體容器 */}
      <div className="relative w-44 h-44 rounded-full border-4 border-white/30 flex items-center justify-center"
        style={{ background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.3), rgba(100,150,255,0.15))", boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 2px 8px rgba(255,255,255,0.2)" }}>
        <div className={`text-7xl transition-transform duration-300 ${spinning ? "animate-spin" : ""}`}>
          {spinning ? "🌀" : "🐱"}
        </div>
      </div>
      {/* 底座 */}
      <div className="w-40 h-6 rounded-t-none rounded-b-xl mt-1"
        style={{ background: "linear-gradient(to bottom, #e53e3e, #c53030)" }} />
      <div className="w-36 h-4 rounded-b-xl"
        style={{ background: "linear-gradient(to bottom, #c53030, #9b2c2c)" }} />
      {/* 出口 */}
      <div className="w-16 h-6 rounded-xl mt-1 border-2 border-white/30"
        style={{ background: "#1a1a2e" }} />
    </div>
  );
}

// ── 單張卡片展示 ─────────────────────────────────────────────
function CardResult({ cardId, isNew, delay = 0 }) {
  const card = CAT_CARD_MAP[cardId];
  if (!card) return null;
  const catInfo = CAT_CARD_CATEGORIES[card.cat] || {};

  return (
    <div
      className="flex flex-col items-center rounded-2xl p-3 relative"
      style={{
        background: card.bg || "#f3e5f5",
        border: isNew ? "2px solid #fbbf24" : "2px solid rgba(255,255,255,0.2)",
        color: card.color || "#333",
        animationDelay: `${delay}ms`,
        boxShadow: card.special ? "0 0 20px rgba(255,215,0,0.5)" : undefined,
      }}>
      {isNew && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-gray-800 text-xs font-black px-2 py-0.5 rounded-full">
          NEW!
        </div>
      )}
      <div className="text-3xl mb-1">{card.emoji}</div>
      <div className="text-xs font-bold text-center leading-tight">{card.name}</div>
      <div className="text-[10px] opacity-60 mt-0.5">{catInfo.label}</div>
    </div>
  );
}

// ── 抽到結果 Modal ───────────────────────────────────────────
function ResultModal({ results, onClose }) {
  const newCount = results.filter(r => r.isNew).length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm bg-gray-900 rounded-3xl p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="text-center mb-3">
          <div className="text-3xl">{newCount > 0 ? "🎉" : "✨"}</div>
          <div className="text-white font-black text-lg mt-1">
            {results.length === 1 ? "抽到了！" : `${results.length}連抽結果`}
          </div>
          {newCount > 0 && (
            <div className="text-yellow-400 text-sm">✦ {newCount} 張新卡片！</div>
          )}
        </div>

        {/* 卡片格 */}
        <div className={`grid gap-2 mb-4 ${results.length === 1 ? "grid-cols-1 max-w-[120px] mx-auto" : "grid-cols-4"}`}>
          {results.map((r, i) => (
            <CardResult key={i} cardId={r.id} isNew={r.isNew} delay={i * 80} />
          ))}
        </div>

        <button onClick={onClose}
          className="w-full py-3 rounded-2xl bg-white text-gray-800 font-black text-base active:scale-95">
          收下了！
        </button>
      </div>
    </div>
  );
}

// ── 卡片圖鑑 ─────────────────────────────────────────────────
function CardDex({ catCards }) {
  const [selCat, setSelCat] = useState(null);
  const owned = catCards || {};
  const ownedCount = Object.keys(owned).filter(id => (owned[id] || 0) > 0).length;

  const filtered = selCat ? CAT_CARDS.filter(c => c.cat === selCat) : CAT_CARDS;

  return (
    <div>
      <div className="text-white/70 text-xs mb-2">已收集 {ownedCount} / 100 張</div>

      {/* 分類篩選 */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-3 no-scrollbar">
        <button onClick={() => setSelCat(null)}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors
            ${!selCat ? "bg-white text-gray-800" : "bg-white/10 text-white/60"}`}>
          全部
        </button>
        {Object.entries(CAT_CARD_CATEGORIES).map(([key, cat]) => (
          <button key={key} onClick={() => setSelCat(selCat === key ? null : key)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors
              ${selCat === key ? "bg-white text-gray-800" : "bg-white/10 text-white/60"}`}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* 卡片格 */}
      <div className="grid grid-cols-4 gap-2">
        {filtered.map(card => {
          const cnt = owned[card.id] || 0;
          const have = cnt > 0;
          return (
            <div key={card.id}
              className="flex flex-col items-center rounded-xl p-2 relative"
              style={{
                background: have ? (card.bg || "#f3e5f5") : "rgba(255,255,255,0.05)",
                border: have ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
                color: have ? (card.color || "#333") : undefined,
                filter: have ? undefined : "grayscale(1)",
                opacity: have ? 1 : 0.4,
              }}>
              <div className="text-xl">{card.emoji}</div>
              <div className="text-[9px] font-bold text-center leading-tight mt-0.5">
                {have ? card.name : "???"}
              </div>
              {cnt > 1 && (
                <div className="absolute -top-1 -right-1 bg-yellow-400 text-gray-800 text-[9px] font-black px-1 rounded-full">
                  ×{cnt}
                </div>
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
  const { profile } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [results, setResults]   = useState(null);
  const [tab, setTab]           = useState("gacha"); // gacha | dex

  async function doGacha(type) {
    if (spinning) return;
    setSpinning(true);
    await new Promise(r => setTimeout(r, 800));
    const res = await drawGachaCards(profile.id, type);
    setSpinning(false);
    if (res.ok) {
      setResults(res.results);
      onCoinsUpdated?.();
    } else {
      alert(res.reason || "抽卡失敗");
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 頁籤 */}
      <div className="flex rounded-xl overflow-hidden border border-white/10">
        {[["gacha","🎰 扭蛋機"],["dex","📖 圖鑑"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`flex-1 py-2 text-sm font-bold transition-colors
              ${tab===id?"bg-white/15 text-white":"text-white/40"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "gacha" && (
        <div className="flex flex-col items-center gap-4">
          {/* 幣數顯示 */}
          <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-400/30 rounded-2xl px-5 py-3">
            <span className="text-2xl">🪙</span>
            <span className="text-white font-black text-xl">{gachaCoins ?? 0}</span>
            <span className="text-yellow-300 text-sm">枚扭蛋幣</span>
          </div>

          {/* 扭蛋機 */}
          <MachineBody spinning={spinning} />

          {/* 按鈕 */}
          <div className="flex gap-3 w-full">
            <button
              disabled={spinning || (gachaCoins ?? 0) < 1}
              onClick={() => doGacha("single")}
              className="flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95
                bg-gradient-to-r from-pink-500 to-rose-500 text-white
                disabled:opacity-40 disabled:cursor-not-allowed">
              單抽<br /><span className="font-normal text-xs">🪙×1</span>
            </button>
            <button
              disabled={spinning || (gachaCoins ?? 0) < 10}
              onClick={() => doGacha("multi")}
              className="flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95
                bg-gradient-to-r from-violet-500 to-purple-600 text-white
                disabled:opacity-40 disabled:cursor-not-allowed">
              10連＋1<br /><span className="font-normal text-xs">🪙×10</span>
            </button>
          </div>

          <p className="text-white/40 text-xs text-center">
            練習射箭即可獲得扭蛋幣！<br />
            完成練箭里程碑可獲得更多幣
          </p>
        </div>
      )}

      {tab === "dex" && <CardDex catCards={catCards} />}

      {results && (
        <ResultModal results={results} onClose={() => setResults(null)} />
      )}
    </div>
  );
}
