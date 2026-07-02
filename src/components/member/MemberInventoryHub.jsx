// src/components/member/MemberInventoryHub.jsx
// 2026-07 UI 改版：SectionHeader + HubTile 2 欄格線（CSS 漸層底，不再引用 cell-*.webp）
import { useAuth } from "../../hooks/useAuth";
import { EQUIP_SLOT_DEFS } from "../../lib/constants";
import { SectionHeader, HubTile } from "../shared/Widgets";

// 入口常數陣列（accent 必須是 hex；desc 為 null 者在 render 時動態帶入）
const INVENTORY_ITEMS = [
  { page:"coinshop",  icon:"🪙",  title:"金幣商店", desc:null,             accent:"#f59e0b", badgeKey:"coinshop" },
  { page:"materials", icon:"🎒",  title:"材料背包", desc:"開箱・合成・升級", accent:"#f97316", badgeKey:"materials" },
  { page:"cats",      icon:"🐱",  title:"貓貓陪練", desc:"九隻貓咪夥伴",    accent:"#a855f7", badgeKey:"cats" },
  { page:"story",     icon:"📖",  title:"故事本",   desc:"章節解鎖",        accent:"#6366f1", badgeKey:"story" },
  { page:"equipment", icon:"🛡️", title:"我的裝備", desc:null,             accent:"#64748b", badgeKey:"equipment" },
  { page:"cards",     icon:"🃏",  title:"怪物卡片", desc:"收藏・升星",      accent:"#10b981", badgeKey:"cards" },
  { page:"gacha",     icon:"🏡",  title:"貓貓村",   desc:null,             accent:"#ec4899", badgeKey:"gacha" },
];

export default function MemberInventoryHub({ onPageChange, badges = {} }) {
  const { profile } = useAuth();
  const coins      = profile?.coins || 0;
  const rpgEquip   = profile?.rpgEquip || {};
  const equipCount = EQUIP_SLOT_DEFS.filter(s => rpgEquip[s.id]?.itemId).length;

  // 動態描述（來自既有 profile 資料）
  const dynamicDesc = {
    coinshop:  `🪙 ${coins.toLocaleString()}`,
    equipment: `${equipCount}/10 格`,
    gacha:     `🪙 ${Math.floor(profile?.gachaCoins ?? 0)} 枚扭蛋幣`,
  };

  return (
    <div className="p-4 flex flex-col gap-3" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <SectionHeader icon="🎒" title="背包" />
      <div className="grid grid-cols-2 gap-3">
        {INVENTORY_ITEMS.map(item => (
          <HubTile key={item.page}
            icon={item.icon}
            title={item.title}
            desc={item.desc ?? dynamicDesc[item.page]}
            accent={item.accent}
            badge={badges[item.badgeKey] || 0}
            onClick={() => onPageChange(item.page)} />
        ))}
      </div>
    </div>
  );
}
