// src/components/member/MemberAdventureHub.jsx
// 2026-07 UI 改版：SectionHeader + HubTile 2 欄格線（CSS 漸層底，不再引用 cell-*.webp）
import { useAuth } from "../../hooks/useAuth";
import { levelFromXP, rankFromLevel } from "../../lib/adventurerSystem";
import { SectionHeader, HubTile } from "../shared/Widgets";

// 入口常數陣列（accent 必須是 hex，HubTile 內部以 `${accent}26` 疊 15% 透明漸層）
const ADVENTURE_ITEMS = [
  { page:"hunt",      icon:"🧭",  title:"自由狩獵",   desc:"選族・選階・指定討伐", accent:"#7c3aed", badgeKey:"monster", imagePage:"monster" },
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

  // 決鬥入口專屬競技場樣式（黑紫背景 + 藍/紅對抗邊框 + 閃光標題）
  const renderDuelTile = () => {
    const item = ADVENTURE_ITEMS.find(i => i.page === "duel");
    if (!item) return null;
    return (
      <button key="duel" onClick={() => onPageChange("duel")}
        className="relative flex flex-col items-start justify-end gap-1 overflow-hidden p-4 text-left transition-all active:scale-95 w-full"
        style={{
          minHeight: 146, borderRadius: "var(--r-lg)",
          border: "1px solid rgba(167,139,250,.5)",
          backgroundImage: "linear-gradient(135deg, rgba(88,28,135,.55) 0%, rgba(30,27,75,.85) 100%), url(/ui/adventure/duel.webp)",
          backgroundSize: "cover", backgroundPosition: "center",
          boxShadow: "0 14px 28px rgba(88,28,135,.35), inset 0 0 24px rgba(217,70,239,.15)",
        }}>
        {badges[item.badgeKey] > 0 && (
          <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white"
            style={{ background: "#dc2626" }}>
            {badges[item.badgeKey] > 99 ? "99+" : badges[item.badgeKey]}
          </span>
        )}
        <span className="text-2xl leading-none" style={{ animation: "adv-glow 1.8s ease-in-out infinite" }}>🎯</span>
        <span className="text-sm font-black mt-1 text-white drop-shadow-lg">玩家決鬥</span>
        <span className="text-[11px] leading-tight" style={{ color:"#c4b5fd" }}>1v1 對戰</span>
        {/* 藍/紅對抗小標記 */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[8px] font-black px-1.5 py-px rounded-full text-white" style={{ background:"linear-gradient(90deg,#1d4ed8,#3b82f6)" }}>A</span>
          <span className="text-[8px] font-black text-amber-300">VS</span>
          <span className="text-[8px] font-black px-1.5 py-px rounded-full text-white" style={{ background:"linear-gradient(90deg,#dc2626,#ef4444)" }}>B</span>
        </div>
      </button>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-3" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <style>{SHINE_KEYFRAMES}</style>
      <SectionHeader icon="🗺️" title="冒險" />
      <div className="grid grid-cols-2 gap-3">
        {ADVENTURE_ITEMS.map(item => (
          item.page === "duel"
            ? renderDuelTile()
            : <HubTile key={item.page}
                icon={item.icon}
                title={item.title}
                desc={item.page === "guild" ? guildDesc : item.desc}
                accent={item.accent}
                image={`/ui/adventure/${item.imagePage || item.page}.webp`}
                badge={badges[item.badgeKey] || 0}
                onClick={() => onPageChange(item.page)} />
        ))}
      </div>
    </div>
  );
}
