// src/components/member/MemberRecordsHub.jsx
// 2026-07 UI 改版：SectionHeader + HubTile 2 欄格線（CSS 漸層底，不再引用 cell-*.webp）
import { SectionHeader, HubTile } from "../shared/Widgets";

// 入口常數陣列（accent 必須是 hex）
const RECORDS_ITEMS = [
  { page:"performance", icon:"🏹", title:"射手表現", desc:"真實射箭・遊戲戰績", accent:"#14b8a6", badgeKey:"performance" },
  { page:"dex",         icon:"🎖️", title:"成就圖鑑", desc:"我的數位收藏", accent:"#f59e0b", badgeKey:"dex" },
  { page:"leaderboard", icon:"📊",  title:"排行榜",   desc:"全道館排名",   accent:"#3b82f6", badgeKey:"leaderboard" },
];

export default function MemberRecordsHub({ onPageChange, badges = {} }) {
  return (
    <div className="p-4 flex flex-col gap-3" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <SectionHeader icon="🏆" title="我的戰績" />
      <div className="grid grid-cols-2 gap-3">
        {RECORDS_ITEMS.map(item => (
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
