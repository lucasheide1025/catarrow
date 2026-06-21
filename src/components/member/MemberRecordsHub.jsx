// src/components/member/MemberRecordsHub.jsx

const TINT = "linear-gradient(rgba(255,255,255,0.12),rgba(255,255,255,0.12))";

export default function MemberRecordsHub({ onPageChange }) {
  return (
    <div className="p-4 flex flex-col gap-4" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <h2 className="text-white font-black text-xl drop-shadow">🏆 我的戰績</h2>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onPageChange("dex")}
          className="rounded-2xl aspect-video flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform relative overflow-hidden"
          style={{ backgroundImage:`url(/ui/cell-achieve.webp), ${TINT}, linear-gradient(135deg,#92400e,#78350f)`, backgroundSize:"cover", backgroundBlendMode:"overlay, normal, normal" }}>
          <span className="text-2xl relative z-10">🎖️</span>
          <span className="text-white font-black text-sm relative z-10">成就圖鑑</span>
          <span className="text-white/65 text-xs relative z-10">我的數位收藏</span>
        </button>
        <button onClick={() => onPageChange("leaderboard")}
          className="rounded-2xl aspect-video flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background:"linear-gradient(135deg,#1d4ed8,#1e3a8a)" }}>
          <span className="text-2xl">📊</span>
          <span className="text-white font-black text-sm">排行榜</span>
          <span className="text-white/65 text-xs">全道館排名</span>
        </button>
      </div>
    </div>
  );
}
