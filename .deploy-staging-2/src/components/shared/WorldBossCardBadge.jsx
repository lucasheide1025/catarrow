// src/components/shared/WorldBossCardBadge.jsx
// 玩家裝備任一世界王卡時，戰鬥畫面名牌旁顯示的閃亮徽章（純視覺，無機制）

export default function WorldBossCardBadge({ equipped, title, size = "sm" }) {
  const hasWbCard = (equipped || []).some(e =>
    typeof e === "string" ? false : e.source === "wb"
  );
  if (!hasWbCard) return null;

  const fontSize = size === "lg" ? "text-xs" : "text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1 ${fontSize} font-black px-1.5 py-0.5 rounded-full text-amber-100`}
      style={{
        background: "linear-gradient(120deg, #b45309, #f59e0b, #fde68a, #f59e0b)",
        backgroundSize: "300% 300%",
        animation: "wbBadgeGlow 2.5s ease infinite",
        boxShadow: "0 0 6px rgba(251,191,36,0.6)",
      }}
    >
      👑{title ? ` ${title}` : ""}
      <style>{`
        @keyframes wbBadgeGlow {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </span>
  );
}
