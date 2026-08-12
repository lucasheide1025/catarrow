// src/components/member/EventScene.jsx
// 🎴 命運/機會事件卡片（08-08 v2）：踩到事件格 → 翻開一張「事件卡」——
// 卡面＝3:4 直立插畫（public/assets/board/event_<scene>.webp，依效果類型）＋牌堆色框，
// 風格與抽卡房怪物卡一致。命運＝紫金框、機會＝青金框；缺圖時退回 emoji 卡背。
import { eventSceneOf } from "../../lib/boardEvents";

const ASSET = "/assets/board";

const DECK_STYLE = {
  fate: {
    frame: "border-purple-400/60",
    cardBorder: "rgba(192,132,252,.85)",
    glow: "0 0 44px rgba(192,132,252,.45)",
    chip: "bg-purple-500/25 text-purple-100 border-purple-400/40",
    btn: "bg-gradient-to-r from-purple-300 to-fuchsia-400",
  },
  opp: {
    frame: "border-cyan-400/60",
    cardBorder: "rgba(34,211,238,.85)",
    glow: "0 0 44px rgba(34,211,238,.45)",
    chip: "bg-cyan-500/25 text-cyan-100 border-cyan-400/40",
    btn: "bg-gradient-to-r from-cyan-300 to-sky-400",
  },
};

export default function EventScene({ event, deck = "fate", detail, onClose, zIndex = 139 }) {
  const st = DECK_STYLE[deck] || DECK_STYLE.fate;
  const scene = eventSceneOf(event?.effect);
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex, background: "rgba(8,5,2,0.9)" }}>
      <div className={`w-full max-w-sm rounded-3xl border-2 ${st.frame} bg-gradient-to-b from-slate-950/95 to-[#180d06] p-5 animate-[fx-pop-in_0.35s_cubic-bezier(.34,1.56,.64,1)]`}
        style={{ boxShadow: st.glow }}>
        {/* 頂列：牌堆標籤 + 關閉 */}
        <div className="flex items-center justify-between mb-3">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${st.chip}`}>
            {deck === "fate" ? "🎴 命運" : "🎴 機會"}
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 text-amber-200 font-black active:scale-95">×</button>
        </div>
        {/* 事件卡面（3:4 直立插畫 ＋ 牌堆色框，與抽卡房怪物卡同風格；缺圖退回 emoji 卡背） */}
        <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-gradient-to-b from-slate-950 to-slate-900"
          style={{ border: `2px solid ${st.cardBorder}`, boxShadow: `inset 0 0 0 4px rgba(0,0,0,.45), 0 0 26px ${st.cardBorder}33` }}>
          <img src={`${ASSET}/event_${scene}.webp`} alt=""
            className="absolute inset-0 w-full h-full object-cover board-card-fly-in"
            onError={e => { e.currentTarget.style.display = "none"; }} />
          <span className="absolute inset-0 grid place-items-center text-6xl opacity-15 pointer-events-none">
            {deck === "fate" ? "🎴" : "🎴"}
          </span>
          {/* 角落牌堆標記（左上） */}
          <span className={`absolute top-2 left-2 rounded-full border px-2 py-0.5 text-[9px] font-black ${st.chip}`}>
            {deck === "fate" ? "✦ 命運" : "✦ 機會"}
          </span>
        </div>
        {/* 事件文案 */}
        <div className="mt-3 text-sm font-black text-amber-50 leading-relaxed">
          {event?.text || "神秘的事件發生了…"}
        </div>
        {/* 效果摘要 */}
        {detail && (
          <div className="mt-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-black text-amber-200">
            {detail}
          </div>
        )}
        <button onClick={onClose}
          className={`mt-4 w-full py-3 rounded-2xl font-black text-slate-900 active:scale-95 ${st.btn}`}>
          知道了
        </button>
      </div>
    </div>
  );
}
