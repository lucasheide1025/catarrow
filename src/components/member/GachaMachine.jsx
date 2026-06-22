// src/components/member/GachaMachine.jsx
import { useState } from "react";
import { drawGachaCards } from "../../lib/db";
import { CAT_CARD_MAP, CAT_CARD_CATEGORIES, CAT_CARDS } from "../../lib/catCardData";
import { useAuth } from "../../hooks/useAuth";
import { sfxGachaRoll, sfxGachaReveal } from "../../lib/sound";

const C = {
  brown: "#5C3D2E",
  mid:   "#9B7B6A",
  muted: "#C4A899",
  border:"#E0CDB5",
  card:  "rgba(255,255,255,0.88)",
  sage:  "#6B8E5E",
};

// ── 動畫 keyframes（注入一次） ────────────────────────────────
const STYLE = `
@keyframes gachaShake {
  0%,100% { transform: translateX(0) rotate(0deg); }
  15%      { transform: translateX(-6px) rotate(-3deg); }
  30%      { transform: translateX(6px) rotate(3deg); }
  45%      { transform: translateX(-4px) rotate(-2deg); }
  60%      { transform: translateX(4px) rotate(2deg); }
  75%      { transform: translateX(-2px) rotate(-1deg); }
}
@keyframes ballDrop {
  0%   { transform: translateY(-100px) scale(0.4); opacity: 0; }
  40%  { transform: translateY(10px) scale(1.15); opacity: 1; }
  60%  { transform: translateY(-14px) scale(0.92); }
  80%  { transform: translateY(4px) scale(1.04); }
  100% { transform: translateY(0px) scale(1); opacity: 1; }
}
@keyframes cardReveal {
  0%   { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  60%  { transform: scale(1.08) rotate(2deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}
`;

// ── 機器圖片 ────────────────────────────────────────────────
function MachineBody({ spinning }) {
  return (
    <div style={{ position: "relative", width: 300, height: 300 }}>
      <style>{STYLE}</style>
      <img
        src="/ui/village/gacha-machine.webp"
        alt="扭蛋機"
        style={{
          width: "100%", height: "100%", objectFit: "contain",
          animation: spinning ? "gachaShake 0.45s ease-in-out infinite" : "none",
        }}
        onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
      />
      {/* Fallback */}
      <div style={{
        display: "none", position: "absolute", inset: 0,
        flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
        animation: spinning ? "gachaShake 0.45s ease-in-out infinite" : "none",
      }}>
        <div style={{
          width: 170, height: 170, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, #FFF0D0, #F0C070)",
          border: "5px solid #E0A050",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 80, boxShadow: "0 8px 28px rgba(150,80,30,0.28)",
        }}>
          {spinning ? "🌀" : "🐱"}
        </div>
        <div style={{ width: 130, height: 20, borderRadius: "0 0 14px 14px",
          background: "linear-gradient(to bottom, #D4884A, #B86830)" }} />
        <div style={{ width: 60, height: 24, borderRadius: 12,
          background: "#8B5230", border: "2px solid #6B3A20" }} />
      </div>

      {/* 彈出球動畫 */}
      {spinning && (
        <div style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          width: 60, height: 60, borderRadius: "50%",
          background: "radial-gradient(circle at 38% 32%, #FFE066, #FF6B35, #CC2200)",
          border: "3px solid #FFD080",
          animation: "ballDrop 0.7s ease-out forwards",
          boxShadow: "0 6px 18px rgba(255,80,30,0.55)",
        }} />
      )}
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
        background: card.bg || "#FFF5E8",
        border: isNew ? "2px solid #F5A623" : `2px solid ${C.border}`,
        color: card.color || C.brown,
        animation: `cardReveal 0.4s ease-out both`,
        animationDelay: `${delay}ms`,
        boxShadow: card.special ? "0 0 16px rgba(245,166,35,0.5)" : undefined,
      }}>
      {isNew && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 text-gray-800 text-xs font-black px-2 py-0.5 rounded-full shadow">
          NEW!
        </div>
      )}
      <div className="text-3xl mb-1">{card.emoji}</div>
      <div className="text-xs font-bold text-center leading-tight">{card.name}</div>
      <div className="text-[10px] mt-0.5" style={{ color: C.muted }}>{catInfo.label}</div>
    </div>
  );
}

// ── 抽到結果 Modal ───────────────────────────────────────────
function ResultModal({ results, onClose }) {
  const newCount = results.filter(r => r.isNew).length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(80,50,30,0.65)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl p-5 shadow-2xl"
        style={{ background: "linear-gradient(180deg,#FDF6EC,#F5EBD8)", border: `1px solid ${C.border}` }}
        onClick={e => e.stopPropagation()}>
        <div className="text-center mb-3">
          <div className="text-3xl">{newCount > 0 ? "🎉" : "✨"}</div>
          <div className="font-black text-lg mt-1" style={{ color: C.brown }}>
            {results.length === 1 ? "抽到了！" : `${results.length}連抽結果`}
          </div>
          {newCount > 0 && (
            <div className="text-sm font-bold" style={{ color: "#D4933A" }}>✦ {newCount} 張新卡片！</div>
          )}
        </div>

        <div className={`grid gap-2 mb-4 ${results.length === 1 ? "grid-cols-1 max-w-[120px] mx-auto" : "grid-cols-4"}`}>
          {results.map((r, i) => (
            <CardResult key={i} cardId={r.id} isNew={r.isNew} delay={i * 80} />
          ))}
        </div>

        <button onClick={onClose}
          className="w-full py-3 rounded-2xl font-black text-base active:scale-95"
          style={{ background: C.sage, color: "white", boxShadow: "0 3px 10px rgba(107,142,94,0.35)" }}>
          收下了！
        </button>
      </div>
    </div>
  );
}

// ── 貓貓卡放大 Modal ─────────────────────────────────────────
function CardLightbox({ card, cnt, onClose }) {
  const catInfo = CAT_CARD_CATEGORIES[card.cat] || {};
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(300px, 80vw)",
          borderRadius: 20,
          background: card.bg || "#FFF5E8",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          position: "relative",
        }}>
        {/* 圖片 */}
        <div style={{ width: "100%", aspectRatio: "3/4", position: "relative", background: card.bg || "#FFF5E8" }}>
          <img
            src={`/cat-cards/${card.id}.webp`}
            alt={card.name}
            onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {/* emoji fallback */}
          <div style={{
            display: "none", position: "absolute", inset: 0,
            alignItems: "center", justifyContent: "center",
            fontSize: 80,
          }}>
            {card.emoji}
          </div>
        </div>
        {/* 資訊 */}
        <div style={{ padding: "12px 14px 16px" }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: card.color || "#5C3D2E", marginBottom: 4 }}>
            {card.name}
          </div>
          <div style={{ fontSize: 12, color: "#9B7B6A" }}>
            {catInfo.emoji} {catInfo.label} · #{card.id}
          </div>
          {cnt > 1 && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#d97706", fontWeight: 700 }}>
              擁有 ×{cnt}
            </div>
          )}
        </div>
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 10, right: 10,
            width: 30, height: 30, borderRadius: "50%",
            background: "rgba(0,0,0,0.35)", border: "none", cursor: "pointer",
            color: "white", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ── 卡片圖鑑 ─────────────────────────────────────────────────
function CardDex({ catCards }) {
  const [selCat,    setSelCat]    = useState(null);
  const [lightbox,  setLightbox]  = useState(null); // card object
  const owned = catCards || {};
  const ownedCount = Object.keys(owned).filter(id => (owned[id] || 0) > 0).length;

  const filtered = selCat ? CAT_CARDS.filter(c => c.cat === selCat) : CAT_CARDS;

  return (
    <div>
      {lightbox && (
        <CardLightbox
          card={lightbox}
          cnt={owned[lightbox.id] || 0}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="text-xs mb-2 font-bold" style={{ color: C.mid }}>已收集 {ownedCount} / 100 張</div>

      {/* 類別篩選 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 no-scrollbar">
        <button onClick={() => setSelCat(null)}
          className="shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors"
          style={{
            background: !selCat ? C.brown : "rgba(92,61,46,0.08)",
            color: !selCat ? "white" : C.mid,
          }}>
          全部
        </button>
        {Object.entries(CAT_CARD_CATEGORIES).map(([key, cat]) => (
          <button key={key} onClick={() => setSelCat(selCat === key ? null : key)}
            className="shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors"
            style={{
              background: selCat === key ? C.brown : "rgba(92,61,46,0.08)",
              color: selCat === key ? "white" : C.mid,
            }}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* 卡片格 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {filtered.map(card => {
          const cnt  = owned[card.id] || 0;
          const have = cnt > 0;
          return (
            <div
              key={card.id}
              onClick={() => have && setLightbox(card)}
              style={{
                borderRadius: 10,
                overflow: "hidden",
                background: have ? (card.bg || "#FFF5E8") : "rgba(92,61,46,0.05)",
                border: `1.5px solid ${have ? C.border : "rgba(92,61,46,0.10)"}`,
                cursor: have ? "pointer" : "default",
                filter: have ? undefined : "grayscale(1)",
                opacity: have ? 1 : 0.4,
                position: "relative",
                userSelect: "none",
              }}>
              {/* 圖片區（3:4 比例）*/}
              <div style={{ width: "100%", aspectRatio: "3/4", position: "relative", background: card.bg || "#FFF5E8" }}>
                <img
                  src={`/cat-cards/${card.id}.webp`}
                  alt={have ? card.name : "???"}
                  onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                {/* emoji fallback */}
                <div style={{
                  display: "none", position: "absolute", inset: 0,
                  alignItems: "center", justifyContent: "center",
                  fontSize: 28, flexDirection: "column",
                }}>
                  <span>{have ? card.emoji : "❓"}</span>
                </div>
              </div>
              {/* 名稱 */}
              <div style={{
                padding: "4px 4px 5px",
                fontSize: 9, fontWeight: 800,
                textAlign: "center", lineHeight: 1.2,
                color: have ? (card.color || C.brown) : C.muted,
              }}>
                {have ? card.name : "???"}
              </div>
              {/* 重複數 */}
              {cnt > 1 && (
                <div style={{
                  position: "absolute", top: 4, right: 4,
                  background: "#f59e0b", color: "#422006",
                  fontSize: 9, fontWeight: 900,
                  borderRadius: 99, padding: "1px 5px",
                }}>
                  ×{cnt}
                </div>
              )}
              {/* 點擊放大提示 */}
              {have && (
                <div style={{
                  position: "absolute", bottom: 22, left: 0, right: 0,
                  textAlign: "center", fontSize: 8, color: "rgba(92,61,46,0.35)",
                  pointerEvents: "none",
                }}>
                  點擊放大
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
  const [tab, setTab]           = useState("gacha");

  async function doGacha(type) {
    if (spinning) return;
    sfxGachaRoll();
    setSpinning(true);
    await new Promise(r => setTimeout(r, 900));
    const res = await drawGachaCards(profile.id, type);
    setSpinning(false);
    if (res.ok) {
      const hasNew = res.results.some(r => r.isNew);
      sfxGachaReveal(hasNew);
      setResults(res.results);
      onCoinsUpdated?.();
    } else {
      alert(res.reason || "抽卡失敗");
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 頁籤 */}
      <div className="flex rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.5)" }}>
        {[["gacha","🎰 扭蛋機"],["dex","📖 圖鑑"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-2 text-sm font-black transition-colors"
            style={{
              background: tab === id ? C.brown : "transparent",
              color: tab === id ? "white" : C.muted,
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "gacha" && (
        <div className="flex flex-col items-center gap-4">
          {/* 幣數顯示 */}
          <div className="flex items-center gap-2 rounded-2xl px-5 py-3"
            style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${C.border}` }}>
            <span className="text-2xl">🪙</span>
            <span className="font-black text-xl" style={{ color: C.brown }}>{gachaCoins ?? 0}</span>
            <span className="text-sm" style={{ color: C.mid }}>枚扭蛋幣</span>
          </div>

          <MachineBody spinning={spinning} />

          {/* 按鈕 */}
          <div className="flex gap-3 w-full">
            <button
              disabled={spinning || (gachaCoins ?? 0) < 1}
              onClick={() => doGacha("single")}
              className="flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#F4A261,#E07040)", boxShadow: "0 3px 10px rgba(224,112,64,0.35)" }}>
              單抽<br /><span className="font-normal text-xs">🪙×1</span>
            </button>
            <button
              disabled={spinning || (gachaCoins ?? 0) < 10}
              onClick={() => doGacha("multi")}
              className="flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#9B6BB5,#7A4A9A)", boxShadow: "0 3px 10px rgba(122,74,154,0.35)" }}>
              10連＋1<br /><span className="font-normal text-xs">🪙×10</span>
            </button>
          </div>

          <p className="text-xs text-center" style={{ color: C.muted }}>
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
