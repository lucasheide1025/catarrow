// src/components/member/MemberAdventureHub.jsx
// 2026-07 UI 改版：SectionHeader + HubTile 2 欄格線（CSS 漸層底，不再引用 cell-*.webp）
import { useAuth } from "../../hooks/useAuth";
import { levelFromXP, rankFromLevel } from "../../lib/adventurerSystem";
import { SectionHeader, HubTile } from "../shared/Widgets";

// 入口常數陣列（accent 必須是 hex，HubTile 內部以 `${accent}26` 疊 15% 透明漸層）
const ADVENTURE_ITEMS = [
  { page:"monster",   icon:"⚔️",  title:"RPG打怪",   desc:"單人冒險",  accent:"#7c3aed", badgeKey:"monster" },
  { page:"party",     icon:"🤝",  title:"組隊打怪",   desc:"合作戰鬥",  accent:"#14b8a6", badgeKey:"party" },
  { page:"dungeon",   icon:"🏰",  title:"地下城",     desc:"副本探索",  accent:"#8b5cf6", badgeKey:"dungeon" },
  { page:"worldboss", icon:"🌍",  title:"世界王",     desc:"全員挑戰",  accent:"#ef4444", badgeKey:"worldboss" },
  { page:"duel",      icon:"🎯",  title:"玩家決鬥",   desc:"1v1 對戰",  accent:"#6366f1", badgeKey:"duel" },
  { page:"guild",     icon:"🏛️", title:"冒險者公會", desc:"",          accent:"#f59e0b", badgeKey:"guild" },
  { page:"handbook",  icon:"📖",  title:"怪物手冊",   desc:"全怪物設定", accent:"#0ea5e9", badgeKey:"handbook" },
];

// 公會 2026-07-25 全新改版上線 → 原本的「🔧 改建中」換成會發光流動的「全新系統」。
// 純 CSS 動畫（背景漸層跑過文字），不用圖片也不吃效能。
const SHINE_KEYFRAMES = `
@keyframes adv-shine { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
@keyframes adv-glow { 0%,100%{filter:drop-shadow(0 0 2px rgba(251,191,36,.6))} 50%{filter:drop-shadow(0 0 7px rgba(253,224,71,.95))} }
`;
const shineStyle = {
  fontWeight: 900,
  backgroundImage: "linear-gradient(100deg,#fbbf24 0%,#fff7cc 25%,#fde047 50%,#fff7cc 75%,#fbbf24 100%)",
  backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  animation: "adv-shine 2.4s linear infinite, adv-glow 1.8s ease-in-out infinite",
};

export default function MemberAdventureHub({ onPageChange, badges = {} }) {
  const { profile } = useAuth();
  const advLv   = levelFromXP(profile?.adventurerXP || 0);
  const advRank = rankFromLevel(advLv);

  // 公會描述：射手看到閃亮亮的「全新系統」，教練（走舊公會）看等級
  const guildDesc = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{ animation: "adv-glow 1.8s ease-in-out infinite" }}>✨</span>
      <span style={shineStyle}>全新系統</span>
    </span>
  );

  return (
    <div className="p-4 flex flex-col gap-3" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <style>{SHINE_KEYFRAMES}</style>
      <SectionHeader icon="🗺️" title="冒險" />
      <div className="grid grid-cols-2 gap-3">
        {ADVENTURE_ITEMS.map(item => (
          <HubTile key={item.page}
            icon={item.icon}
            title={item.title}
            desc={item.page === "guild" ? guildDesc : item.desc}
            accent={item.accent}
            image={`/ui/adventure/${item.page}.webp`}
            badge={badges[item.badgeKey] || 0}
            onClick={() => onPageChange(item.page)} />
        ))}
      </div>
    </div>
  );
}
