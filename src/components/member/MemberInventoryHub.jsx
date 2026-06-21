// src/components/member/MemberInventoryHub.jsx
import { useAuth } from "../../hooks/useAuth";
import { EQUIP_SLOT_DEFS } from "../../lib/constants";

const CELL_BG = {
  coinshop:  "/ui/cell-shop.webp",
  materials: "/ui/cell-bag.webp",
  cats:      "/ui/cell-cat.webp",
  story:     "/ui/cell-story.webp",
  equipment: "/ui/cell-equip.webp",
  cards:     "/ui/cell-achieve.webp",
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

export default function MemberInventoryHub({ onPageChange }) {
  const { profile } = useAuth();
  const coins = profile?.coins || 0;
  const rpgEquip = profile?.rpgEquip || {};
  const equipCount = EQUIP_SLOT_DEFS.filter(s => rpgEquip[s.id]?.itemId).length;

  const items = [
    { key:"coinshop",  page:"coinshop",  label:"金幣商店",  sub:`🪙 ${coins.toLocaleString()}`,  gradient:"linear-gradient(135deg,#854d0e,#713f12)" },
    { key:"materials", page:"materials", label:"材料背包",  sub:"開箱・合成・升級",               gradient:"linear-gradient(135deg,#b45309,#92400e)" },
    { key:"cats",      page:"cats",      label:"貓貓陪練",  sub:"九隻貓咪夥伴",                  gradient:"linear-gradient(135deg,#581c87,#1e1b4b)" },
    { key:"story",     page:"story",     label:"故事本",    sub:"章節解鎖",                      gradient:"linear-gradient(135deg,#1e1b4b,#3b0764)" },
    { key:"equipment", page:"equipment", label:"我的裝備",  sub:`${equipCount}/10 格`,           gradient:"linear-gradient(135deg,#312e81,#0f172a)" },
    { key:"cards",     page:"cards",     label:"怪物卡片",  sub:"收藏・升星",                    gradient:"linear-gradient(135deg,#065f46,#14532d)" },
    { key:"gacha",     page:"gacha",     label:"貓貓扭蛋",  sub:`🪙 ${profile?.gachaCoins ?? 0} 枚扭蛋幣`, gradient:"linear-gradient(135deg,#9d174d,#831843)" },
  ];

  return (
    <div className="p-4 flex flex-col gap-4" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <h2 className="text-white font-black text-xl drop-shadow">🎒 背包</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map(item => (
          <button key={item.key} onClick={() => onPageChange(item.page)}
            className="rounded-2xl aspect-square flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform relative overflow-hidden"
            style={cellStyle(item.key, item.gradient)}>
            <span className="text-white font-black text-sm leading-tight text-center relative z-10 px-1">{item.label}</span>
            <span className="text-white/65 font-bold text-[10px] relative z-10">{item.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
