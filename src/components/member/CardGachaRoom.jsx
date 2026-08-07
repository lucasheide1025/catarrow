// src/components/member/CardGachaRoom.jsx
// 探索地圖「抽卡房」格子（08-08）：踩到後開的抽卡介面。
// 免費抽 1 張（不花錢）／付費抽 3 張（金幣 CARD_GACHA_PAID_PRICE）——池＝該 T 階級普通怪卡。
// 演出（08-08 玩家要求）：**一張一張翻開**——先全體卡背出場，逐張 3D 翻成正面；
// 只有 1 張時「高量翻轉」：整張放大＋金色光暈 pulse＋翻開瞬間高亮閃光。
// 單人/組隊共用：onFree / onPaid 由呼叫端完成「抽卡＋入帳」（回傳抽到的卡面 view 陣列），
// 本元件只負責演出。付費失敗（金幣不足）由呼叫端回 null，UI 顯示錯誤。
import { useState, useEffect, useRef } from "react";
import { cardToView, CARD_GACHA_PAID_PRICE, cardGachaPool } from "../../lib/boardCardGacha";
import { sfxTap, sfxGachaRoll, sfxGachaReveal } from "../../lib/sound";
import CardArtImage from "./cards/CardArt";

const TIER_COLOR = {
  common: "#94a3b8", rare: "#3b82f6", elite: "#a855f7",
  fierce: "#f97316", boss: "#ef4444", mythic: "#f59e0b",
};

// 單張卡（含翻轉狀態）；single＝高量模式
function GachaCard({ entry, flipped, single = false, index = 0 }) {
  const frame = TIER_COLOR[entry.tier] || "#94a3b8";
  const cardW = single ? 168 : 100;
  return (
    <div className={`card-gacha-scene ${single ? "gacha-single-glow" : ""} ${flipped ? "gacha-reveal-flash" : ""}`}
      style={{ width: cardW, aspectRatio: "3/4", borderRadius: 14 }}>
      <div className={`card-gacha-inner ${flipped ? "flipped" : ""}`}>
        {/* 卡背（front face） */}
        <div className="card-gacha-face card-gacha-back">
          <span className="text-3xl" style={{ opacity: .85 }}>🃏</span>
          {single && !flipped && <span className="absolute inset-1.5 rounded-xl border-2 border-dashed" style={{ borderColor: "rgba(250,204,21,.45)" }} />}
        </div>
        {/* 卡面（back face，rotateY 180） */}
        <div className="card-gacha-face card-gacha-face-back"
          style={{ border: `2px solid ${frame}`, background: "#0f172a", boxShadow: `0 0 18px ${frame}55` }}>
          <div className="w-full h-full relative">
            <CardArtImage view={cardToView(entry, true)} />
            <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-1">
              <div className={`${single ? "text-[11px]" : "text-[10px]"} font-black text-white truncate`}>{entry.name}</div>
              <div className="text-[8px] font-bold" style={{ color: frame }}>T{entry.tierIndex}・{entry.family}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CardGachaRoom({ meta, tier, freeLeft = 1, busy = false, onFree, onPaid, onClose, zIndex = 138 }) {
  const [phase, setPhase] = useState("choose");     // choose → rolling（卡背出場）→ flipping（逐張翻）→ result
  const [results, setResults] = useState([]);       // 抽到的卡面 entry 陣列
  const [flipCount, setFlipCount] = useState(0);    // 已翻開張數
  const [paidUsed, setPaidUsed] = useState(false);  // 付費已用過（一次格子限一次）
  const [error, setError] = useState(null);
  const timersRef = useRef([]);
  const freeUsed = freeLeft <= 0;
  const poolSize = cardGachaPool(tier).length;
  const single = results.length === 1;

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // 逐張翻開：每 700ms 翻一張；全翻完 700ms 後進 result
  useEffect(() => {
    if (phase !== "flipping" || results.length === 0) return undefined;
    if (flipCount >= results.length) {
      const t = setTimeout(() => setPhase("result"), 700);
      timersRef.current.push(t);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      sfxGachaReveal(true);
      setFlipCount(c => c + 1);
    }, 700);
    timersRef.current.push(t);
    return () => clearTimeout(t);
  }, [phase, flipCount, results.length]);

  // 演出：呼叫端算好結果後我們播翻轉（結果非同步回傳，先播 rolling 再逐張翻）
  const doRoll = async (count, isPaid) => {
    if (busy || phase !== "choose") return;
    setPhase("rolling");
    setError(null);
    sfxGachaRoll();
    // 等呼叫端完成 DB 動作（免費入帳／付費扣錢+入帳）→ 回傳卡面 entry 陣列（null＝失敗）。
    // ⚠️ try/catch 防呆：呼叫端若 reject，也要回到 choose（不能卡死在 rolling）。
    let drawn = null;
    try {
      drawn = isPaid ? await onPaid() : await onFree();
    } catch (e) { drawn = null; }
    if (!drawn || drawn.length === 0) {
      sfxGachaReveal(false);
      setPhase("choose");
      if (isPaid) setError("付費失敗（金幣不足或已用過）");
      else setError("免費次數已用完");
      return;
    }
    setResults(drawn);
    setFlipCount(0);
    // 卡背出場演出 → 開始逐張翻
    const t = setTimeout(() => setPhase("flipping"), 650);
    timersRef.current.push(t);
    if (isPaid) setPaidUsed(true);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4" style={{ zIndex }}>
      <div className="w-full max-w-sm rounded-3xl border-2 bg-slate-900 p-5 text-center animate-[fx-pop-in_0.3s_cubic-bezier(.34,1.56,.64,1)]"
        style={{ borderColor: "rgba(232,121,249,.45)" }}>
        <div className="text-[10px] font-black tracking-[.25em] text-fuchsia-300/80 mb-1">🃏 抽卡房</div>
        <div className="text-fuchsia-100 font-black text-lg">{meta?.familyName || ""} T{tier}・卡片抽抽</div>
        <div className="text-[10px] font-bold text-slate-400 mt-1 mb-4">
          只抽得到 T{tier} 普通怪卡（{poolSize} 種）・小王/大王/世界王不進池
        </div>

        {error && <div className="mb-3 rounded-xl bg-rose-500/15 border border-rose-400/40 px-3 py-2 text-rose-200 text-xs font-bold">{error}</div>}

        {phase === "choose" && (
          <div className="space-y-2">
            <button disabled={freeUsed || busy} onClick={() => doRoll(1, false)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-fuchsia-400 to-purple-500 text-white font-black text-sm shadow-lg active:scale-95 transition-transform disabled:opacity-40">
              🆓 免費抽 1 張{freeUsed ? "（本格已用）" : ""}
            </button>
            <button disabled={paidUsed || busy} onClick={() => doRoll(3, true)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-sm shadow-lg active:scale-95 transition-transform disabled:opacity-40">
              💰 付費抽 3 張（{CARD_GACHA_PAID_PRICE} 金幣）{paidUsed ? "・本格已用" : ""}
            </button>
            <div className="text-[10px] font-bold text-slate-500">每踩到一次：免費 1 次＋付費 1 次，抽完可離開</div>
            <button onClick={() => { sfxTap(); onClose(); }}
              className="w-full mt-1 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-bold active:scale-95">返回地圖（不抽）</button>
          </div>
        )}

        {(phase === "rolling" || phase === "flipping") && (
          <div className="py-3">
            {/* 卡背出場：rolling＝全卡背；flipping＝逐張翻開 */}
            <div className="flex items-center justify-center gap-3" style={{ minHeight: 200 }}>
              {results.length > 0 ? results.map((entry, i) => (
                <GachaCard key={`${entry.monsterId}-${i}`} entry={entry}
                  flipped={phase === "flipping" && i < flipCount} single={single} index={i} />
              )) : (
                <div className="w-24 h-32 rounded-2xl card-gacha-back flex items-center justify-center">
                  <span className="text-3xl">🃏</span>
                </div>
              )}
            </div>
            <div className="mt-3 text-fuchsia-200/80 text-sm font-black">
              {phase === "rolling" ? (single ? "✨ 稀有卡片降臨…" : "卡牌出場…") : `翻開第 ${Math.min(flipCount + 1, results.length)} 張…`}
            </div>
          </div>
        )}

        {phase === "result" && (
          <div>
            <div className="flex items-center justify-center gap-3">
              {results.map((entry, i) => (
                <GachaCard key={`${entry.monsterId}-${i}`} entry={entry} flipped single={single} index={i} />
              ))}
            </div>
            <div className="mt-2 text-[10px] font-bold text-slate-400">
              {results.length ? `抽到 ${results.length} 張卡片，已存入卡片收集（重複自動累計升星）` : "此階級暫時沒有可抽的卡片"}
            </div>
            <button onClick={() => { sfxTap(); onClose(); }}
              className="w-full mt-3 py-2.5 rounded-xl bg-fuchsia-400 text-slate-900 font-black active:scale-95">收下卡片・離開</button>
          </div>
        )}
      </div>
    </div>
  );
}
