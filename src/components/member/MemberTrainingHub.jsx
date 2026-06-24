// src/components/member/MemberTrainingHub.jsx
import { useState } from "react";
import DailyQuest from "./DailyQuest";

const TINT = "linear-gradient(rgba(255,255,255,0.12),rgba(255,255,255,0.12))";

export default function MemberTrainingHub({ onPageChange, onJoinParty }) {
  const [showCheckin, setShowCheckin] = useState(false);

  return (
    <div className="p-4 flex flex-col gap-4" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <h2 className="text-white font-black text-xl drop-shadow">🏹 練箭</h2>

      {/* 每日報到（可展開） */}
      <button onClick={() => setShowCheckin(v => !v)}
        className="w-full rounded-2xl p-4 flex items-center gap-3 active:scale-98 transition-transform relative overflow-hidden text-left"
        style={{ backgroundImage:`url(/ui/cell-checkin.webp), ${TINT}, linear-gradient(135deg,#059669,#0d9488)`, backgroundSize:"cover", backgroundBlendMode:"overlay, normal, normal" }}>
        <span className="text-white font-black text-base relative z-10">📋 每日報到</span>
        <span className="text-white/70 text-sm relative z-10 ml-auto">{showCheckin ? "收起 ▲" : "展開 ▼"}</span>
      </button>
      {showCheckin && <DailyQuest onJoinParty={onJoinParty} />}

      {/* 自主練習 */}
      <button onClick={() => onPageChange("practice")}
        className="w-full rounded-2xl p-4 flex items-center gap-3 active:scale-98 transition-transform"
        style={{ background:"linear-gradient(135deg,#1d4ed8,#1e40af)" }}>
        <span className="text-white font-black text-base">🎯 自主練習</span>
        <span className="text-white/60 text-sm ml-auto">→</span>
      </button>

      {/* 比賽 */}
      <button onClick={() => onPageChange("comps")}
        className="w-full rounded-2xl p-4 flex items-center gap-3 active:scale-98 transition-transform"
        style={{ background:"linear-gradient(135deg,#c026d3,#86198f)" }}>
        <span className="text-white font-black text-base">🏆 比賽 / 檢定</span>
        <span className="text-white/60 text-sm ml-auto">→</span>
      </button>
    </div>
  );
}
