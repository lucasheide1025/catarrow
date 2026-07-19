// src/components/member/MemberInventoryHub.jsx — 持有物分類入口
import { SectionHeader, HubTile } from "../shared/Widgets";
import lootImage from "../../assets/hub/loot.webp";
import potionsImage from "../../assets/hub/potions.webp";
import materialsImage from "../../assets/hub/materials.webp";
import fragmentsImage from "../../assets/hub/fragments.webp";
import specialImage from "../../assets/hub/special.webp";
import equipmentImage from "../../assets/hub/equipment.webp";
import cardsImage from "../../assets/hub/cards.webp";
import shopImage from "../../assets/hub/shop.webp";
import companionsImage from "../../assets/hub/companions.webp";

const CATEGORIES = [
  { tab:"chests", title:"戰利品", desc:"寶箱・卡包・未開啟獎勵", accent:"#f59e0b", image:lootImage },
  { tab:"potions", title:"藥水", desc:"攜帶型・投擲型・討伐型", accent:"#22c55e", image:potionsImage },
  { tab:"materials", title:"怪物素材", desc:"裝備強化・素材升級", accent:"#a855f7", image:materialsImage },
  { tab:"fragments", title:"徽章碎片", desc:"收集進度・合成徽章", accent:"#ec4899", image:fragmentsImage },
  { tab:"special", title:"特殊道具", desc:"活動券・任務道具", accent:"#6366f1", image:specialImage },
];

export default function MemberInventoryHub({ onPageChange, badges = {} }) {
  function openCategory(tab) {
    sessionStorage.setItem("inventory_initial_tab", tab);
    onPageChange("materials");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col gap-3 p-4"
      style={{ backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <SectionHeader icon="🎒" title="我的背包" />
      <p className="text-pretty text-xs leading-relaxed text-slate-400">
        只顯示實際持有的物品；製作、裝備與收藏功能位於各自的功能頁。
      </p>
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(item => (
          <HubTile key={item.tab}
            icon={item.icon} title={item.title} desc={item.desc}
            accent={item.accent} image={item.image} badge={badges[item.tab] || 0}
            onClick={() => openCategory(item.tab)} />
        ))}
      </div>
      <div className="mt-2 border-t border-white/10 pt-4">
        <div className="mb-2 text-xs font-black text-slate-500">相關功能</div>
        <div className="grid grid-cols-2 gap-3">
          <HubTile title="我的裝備" desc="穿戴・強化・更換外觀" image={equipmentImage}
            accent="#64748b" onClick={() => onPageChange("equipment")} />
          <HubTile title="怪物卡片" desc="收藏・升星・裝備加成" image={cardsImage}
            accent="#8b5cf6" onClick={() => onPageChange("cards")} />
          <HubTile title="金幣商店" desc="每日精選・每週珍寶" image={shopImage}
            accent="#f59e0b" onClick={() => onPageChange("coinshop")} />
          <HubTile title="貓貓陪練" desc="九隻貓咪夥伴" image={companionsImage}
            accent="#a855f7" onClick={() => onPageChange("cats")} />
        </div>
      </div>
    </div>
  );
}
