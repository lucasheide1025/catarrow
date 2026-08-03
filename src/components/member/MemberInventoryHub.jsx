// src/components/member/MemberInventoryHub.jsx — 持有物分類入口
import { SectionHeader, HubTile } from "../shared/Widgets";
// ⚠️ 相關功能改用純文字按鈕，原本那 5 張 webp（equipment/cards/shop/companions/
//    specialization-runes）不再於此頁載入。圖檔本身留著，其他頁還在用。
import lootImage from "../../assets/hub/loot.webp";
import potionsImage from "../../assets/hub/potions.webp";
import materialsImage from "../../assets/hub/materials.webp";
import fragmentsImage from "../../assets/hub/fragments.webp";
import specialImage from "../../assets/hub/special.webp";

const CATEGORIES = [
  { tab:"chests", title:"戰利品", desc:"寶箱・卡包・未開啟獎勵", accent:"#f59e0b", image:lootImage },
  { tab:"potions", title:"藥水", desc:"攜帶型・投擲型・討伐型", accent:"#22c55e", image:potionsImage },
  { tab:"materials", title:"怪物素材", desc:"裝備強化・素材升級", accent:"#a855f7", image:materialsImage },
  { tab:"fragments", title:"徽章碎片", desc:"收集進度・合成徽章", accent:"#ec4899", image:fragmentsImage },
  { tab:"special", title:"特殊道具", desc:"活動券・任務道具", accent:"#6366f1", image:specialImage },
];

const RELATED = [
  { page:"specialization-runes", icon:"🧬", title:"專精與符文", desc:"戰鬥流派・符文製作", accent:"#8b5cf6" },
  { page:"equipment", icon:"🛡️", title:"我的裝備", desc:"穿戴・強化・外觀", accent:"#64748b" },
  { page:"cards", icon:"🃏", title:"怪物卡片", desc:"收藏・升星・加成", accent:"#8b5cf6" },
  { page:"coinshop", icon:"🪙", title:"金幣商店", desc:"每日精選・每週珍寶", accent:"#f59e0b" },
  { page:"cats", icon:"🐱", title:"貓貓陪練", desc:"九隻貓咪夥伴", accent:"#a855f7" },
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
        只顯示實際持有的物品；製作、裝備與收藏功能位於下方「相關功能」。
      </p>
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(item => (
          <HubTile key={item.tab}
            icon={item.icon} title={item.title} desc={item.desc}
            accent={item.accent} image={item.image} badge={badges[item.tab] || 0}
            onClick={() => openCategory(item.tab)} />
        ))}
      </div>
      {/* ── 相關功能 ──
          ⚠️ 這五個**不是持有物**，是功能入口。原本用跟持有物一樣大的圖磁磚，
             結果「背包」看起來像導覽頁而不是背包——玩家點進來是想看「我有什麼」。
             改成緊湊按鈕：分量降下來、階層清楚，順帶少載 5 張大圖。 */}
      <div className="mt-3 border-t border-white/10 pt-3">
        <div className="mb-2 text-[11px] font-black text-slate-500">相關功能</div>
        <div className="grid grid-cols-2 gap-2">
          {RELATED.map(item => (
            <button key={item.page} type="button" onClick={() => onPageChange(item.page)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-all active:scale-95"
              style={{ borderLeft: `3px solid ${item.accent}` }}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-black text-slate-100">{item.title}</span>
                <span className="block truncate text-[9.5px] text-slate-400">{item.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
