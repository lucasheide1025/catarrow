// src/components/member/MemberTrainingHub.jsx
// 2026-07 UI 改版：SectionHeader + HubTile 2 欄格線（每日報到保留可展開區塊）
import { useState } from "react";
import DailyQuest from "./DailyQuest";
import { SectionHeader, HubTile } from "../shared/Widgets";

// 入口常數陣列（accent 必須是 hex）
const TRAINING_ITEMS = [
  { page:"performance", icon:"🏹", title:"射手表現", desc:"真實射箭・進步分析", accent:"#14b8a6", badgeKey:"performance" },
  { page:"practice", icon:"🎯", title:"自主練習",   desc:"記錄每一箭",     accent:"#3b82f6", badgeKey:"practice" },
  { page:"comps",    icon:"🏆", title:"比賽 / 檢定", desc:"賽事與升級檢定", accent:"#d946ef", badgeKey:"comps" },
];

export default function MemberTrainingHub({ onPageChange, onJoinParty, badges = {}, showPerformance = true }) {
  const [showCheckin, setShowCheckin] = useState(true);

  return (
    <div className="p-4 flex flex-col gap-3" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <SectionHeader icon="🏹" title="練箭" />

      {/* 每日報到（可展開）*/}
      <button onClick={() => setShowCheckin(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left active:scale-98 transition-transform"
        style={{
          borderRadius:"var(--r-lg)",
          border:"1px solid var(--glass-border)",
          background:"linear-gradient(135deg, #05966926 0%, var(--glass-bg) 55%)",
          boxShadow:"var(--shadow-card)",
        }}>
        <span className="text-xl leading-none">📋</span>
        <span className="font-black text-sm" style={{ color:"var(--text-primary)" }}>每日報到</span>
        <span className="text-xs ml-auto" style={{ color:"var(--text-secondary)" }}>{showCheckin ? "收起 ▲" : "展開 ▼"}</span>
      </button>
      {showCheckin && <DailyQuest onJoinParty={onJoinParty} />}

      <div className="grid grid-cols-2 gap-3">
        {TRAINING_ITEMS.filter(item => showPerformance || item.page !== "performance").map(item => (
          <HubTile key={item.page}
            icon={item.icon}
            title={item.title}
            desc={item.desc}
            accent={item.accent}
            badge={badges[item.badgeKey] || 0}
            onClick={() => onPageChange(item.page)} />
        ))}
      </div>
    </div>
  );
}
