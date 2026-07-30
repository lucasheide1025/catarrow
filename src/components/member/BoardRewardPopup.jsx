// src/components/member/BoardRewardPopup.jsx
// 貓貓村大富翁的獎勵演出（單機版與組隊版共用，不要各寫一份）。
//
// 三段式：前置動畫 →（逐項）顯示取得什麼 → 領取。
// 原本是踩到格子就直接把清單整份攤出來，缺少「開獎」的期待感；使用者要求補上演出。
// 格子類型決定前置動畫的圖示與台詞（素材格是採集、寶箱格是開箱…）。
import { useEffect, useRef, useState } from "react";
import { sfxTap, sfxSuccess, sfxCast } from "../../lib/sound";

// 前置動畫時間。夠長才有期待感，但不能久到讓連續擲骰變拖沓。
const SUSPENSE_MS = 950;

const TILE_INTRO = {
  material: { icon: "📦", verb: "採集中", hint: "翻找素材…" },
  mining:   { icon: "⛏️", verb: "開採中", hint: "敲開礦脈…" },
  monster:  { icon: "👾", verb: "結算中", hint: "清點戰利品…" },
  chest:    { icon: "🎁", verb: "開箱中", hint: "撬開鎖扣…" },
  arrowdew: { icon: "💧", verb: "收集中", hint: "凝聚箭露…" },
  coins:    { icon: "🪙", verb: "清點中", hint: "數錢…" },
  gacha:    { icon: "🎰", verb: "兌換中", hint: "投幣…" },
  potion:   { icon: "🧪", verb: "調製中", hint: "搖晃瓶身…" },
  start:    { icon: "🏁", verb: "繞圈獎勵", hint: "整理收穫…" },
};
const DEFAULT_INTRO = { icon: "🎁", verb: "獲得獎勵", hint: "整理收穫…" };

export default function BoardRewardPopup({ reward, tileType, onClose, zIndex = 140 }) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef(null);

  // 每次換一份獎勵就重播一次演出
  useEffect(() => {
    if (!reward) return undefined;
    setRevealed(false);
    sfxCast();
    timerRef.current = setTimeout(() => { setRevealed(true); sfxSuccess(); }, SUSPENSE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [reward]);

  if (!reward) return null;
  const intro = TILE_INTRO[tileType] || DEFAULT_INTRO;
  const items = Array.isArray(reward.items) ? reward.items : [];

  // 前置動畫期間點背景不關閉，避免手滑跳過演出又看不到拿了什麼
  const handleBackdrop = () => { if (revealed) onClose?.(); };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4"
      style={{ zIndex }} onClick={handleBackdrop}>
      <style>{BOARD_REWARD_CSS}</style>
      <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-5 w-full max-w-xs brp-card"
        onClick={event => event.stopPropagation()}>

        {!revealed ? (
          <div className="py-6 text-center">
            <div className="brp-suspense mx-auto text-6xl leading-none">{intro.icon}</div>
            <div className="mt-4 text-amber-200 font-black">{intro.verb}…</div>
            <div className="mt-1 text-[11px] text-slate-400">{intro.hint}</div>
            <div className="brp-bar mt-4 mx-auto" />
          </div>
        ) : (
          <>
            <div className="text-center text-amber-200 font-black mb-2">
              🎁 獲得獎勵{reward.band ? `・${reward.band} 級` : ""}
            </div>
            {items.length === 0 && (
              <div className="my-3 text-center text-sm text-slate-400">這格沒有掉落物</div>
            )}
            <div className="space-y-1.5 my-2 max-h-[45vh] overflow-y-auto">
              {items.map((item, index) => (
                <div key={`${item.name}-${index}`}
                  className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 brp-item"
                  style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}>
                  <span className="text-sm font-bold text-slate-100">{item.icon} {item.name}</span>
                  <span className="text-amber-300 font-black">×{item.amount}</span>
                </div>
              ))}
            </div>
            <button type="button"
              onClick={() => { sfxTap(); onClose?.(); }}
              className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-900 font-black active:scale-95">
              收下！
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// 動畫尊重 prefers-reduced-motion：關掉位移與循環，只留淡入（全站一致的做法）
const BOARD_REWARD_CSS = `
@keyframes brp-card-in { from { opacity:0; transform:translateY(14px) scale(.96); } to { opacity:1; transform:none; } }
@keyframes brp-shake { 0%,100% { transform:translateY(0) rotate(-4deg); } 50% { transform:translateY(-10px) rotate(4deg); } }
@keyframes brp-item-in { from { opacity:0; transform:translateX(-10px); } to { opacity:1; transform:none; } }
@keyframes brp-bar-run { from { transform:translateX(-100%); } to { transform:translateX(100%); } }
.brp-card { animation: brp-card-in .28s cubic-bezier(.34,1.56,.64,1) both; }
.brp-suspense { animation: brp-shake .5s ease-in-out infinite; display:inline-block; }
.brp-item { animation: brp-item-in .26s ease-out both; }
.brp-bar { width:120px; height:4px; border-radius:999px; background:rgba(251,191,36,.18); overflow:hidden; position:relative; }
.brp-bar::after { content:""; position:absolute; inset:0; border-radius:999px;
  background:linear-gradient(90deg,transparent,#fbbf24,transparent); animation: brp-bar-run .9s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .brp-card, .brp-item { animation-duration:.01s; }
  .brp-suspense, .brp-bar::after { animation:none; }
}
`;
