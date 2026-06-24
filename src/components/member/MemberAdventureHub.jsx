// src/components/member/MemberAdventureHub.jsx
import { useAuth } from "../../hooks/useAuth";
import { levelFromXP, rankFromLevel } from "../../lib/adventurerSystem";

const CELL_BG = {
  monster:   "/ui/cell-monster.webp",
  duel:      "/ui/cell-duel.webp",
  party:     "/ui/cell-party.webp",
  dungeon:   "/ui/cell-dungeon.webp",
  worldboss: "/ui/cell-worldboss.webp",
  guild:     "/ui/guild.webp",
};

const TINT = "linear-gradient(rgba(255,255,255,0.12),rgba(255,255,255,0.12))";
function cellStyle(key, gradient) {
  const img = CELL_BG[key];
  if (img) return {
    backgroundImage: `url(${img}), ${TINT}, ${gradient}`,
    backgroundSize: "cover, cover, cover",
    backgroundBlendMode: "overlay, normal, normal",
  };
  return { backgroundImage: `${TINT}, ${gradient}`, backgroundSize: "cover, cover", backgroundBlendMode: "normal, normal" };
}

export default function MemberAdventureHub({ onPageChange }) {
  const { profile } = useAuth();
  const advLv   = levelFromXP(profile?.adventurerXP || 0);
  const advRank = rankFromLevel(advLv);

  const items = [
    { key:"monster",   page:"monster",   label:"RPG打怪",   sub:"單人冒險",         gradient:"linear-gradient(135deg,#7c3aed,#1e3a8a)" },
    { key:"party",     page:"party",     label:"組隊打怪",   sub:"合作戰鬥",         gradient:"linear-gradient(135deg,#0f766e,#134e4a)" },
    { key:"dungeon",   page:"dungeon",   label:"地下城",     sub:"副本探索",         gradient:"linear-gradient(135deg,#4c1d95,#2e1065)" },
    { key:"worldboss", page:"worldboss", label:"世界王",     sub:"全員挑戰",         gradient:"linear-gradient(135deg,#7f1d1d,#0f172a)" },
    { key:"duel",      page:"duel",      label:"玩家決鬥",   sub:"1v1 對戰",         gradient:"linear-gradient(135deg,#1e1b4b,#4338ca)" },
    { key:"guild",     page:"guild",     label:"冒險者公會", sub:`Lv.${advLv} ${advRank.icon}`, gradient:"linear-gradient(135deg,#78350f,#1c1410)", subColor: advRank.color },
  ];

  return (
    <div className="p-4 flex flex-col gap-4" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <h2 className="text-white font-black text-xl drop-shadow">🗺️ 冒險</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map(item => (
          <button key={item.key} onClick={() => onPageChange(item.page)}
            className="rounded-2xl aspect-square flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform relative overflow-hidden"
            style={cellStyle(item.key, item.gradient)}>
            <span className="text-white font-black text-sm leading-tight text-center relative z-10 px-1">{item.label}</span>
            <span className="font-bold text-[10px] relative z-10" style={{ color: item.subColor || "rgba(255,255,255,0.65)" }}>{item.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
