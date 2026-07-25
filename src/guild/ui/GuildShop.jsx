// src/guild/ui/GuildShop.jsx
// 公會商店：CAT幣的去處。貨架依階級 shopTier 解鎖，鎖住的仍顯示（給目標感）但不能買。
// 純 UI：買賣邏輯走 db/guildDb.buyGuildShopItem（驗證在 domain 純函數）。
import { useState } from "react";
import { MATERIALS } from "../../lib/monsterMaterials";
import { GUILD_SHOP_ITEMS, SHOP_TIER_META } from "../data/guildShop";
import { GRADE_META, SLOT_META, GUILD_EQUIP_ARCHETYPES, equipDisplayName, resolveEquipStats } from "../data/guildEquipCatalog";
import { rankUnlocks, GUILD_RANKS } from "../domain/guildRank";
import { STAT_META } from "../domain/guildStats";
import { sfxShopBuy, sfxError, sfxClose } from "../../lib/sound";
import { hallBg, bgLayer, rankBadge, ArtOrEmoji } from "./GuildArt";

const card = { background: "rgba(0,0,0,.3)", borderRadius: 12, padding: 12 };

function itemView(item) {
  if (item.kind === "equip") {
    const arch = GUILD_EQUIP_ARCHETYPES[item.archetypeId];
    const s = resolveEquipStats(item.archetypeId, item.grade);
    return {
      icon: SLOT_META[arch.slot].icon,
      name: equipDisplayName(item.archetypeId, item.grade),
      color: GRADE_META[item.grade]?.color || "#fff",
      note: Object.keys(STAT_META).filter(k => s[k]).map(k => `${STAT_META[k].icon}${s[k] > 0 ? "+" : ""}${s[k]}`).join(" "),
    };
  }
  const mat = MATERIALS.find(m => m.id === item.materialId);
  return { icon: mat?.icon || "📦", name: mat?.name || item.materialId, color: "#a7f3d0", note: `打怪/貓村共用材料 ×${item.qty || 1}` };
}

export default function GuildShop({ profile, onBuy, onClose }) {
  const [msg, setMsg] = useState("");
  const { shopTier, rank } = rankUnlocks(profile.rep);

  const buy = async item => {
    const res = await onBuy(item.id);
    if (res.ok) sfxShopBuy(); else sfxError();
    setMsg(res.ok ? `✅ 已購入 ${itemView(item).name}${res.offline ? "（離線試玩，未存檔）" : ""}` : `⚠️ ${res.reason}`);
  };

  return (
    <div style={{ minHeight: "100dvh", ...bgLayer(hallBg(), { overlay: "rgba(8,6,3,.78)" }), backgroundAttachment: "fixed", color: "#e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>🏪 公會商店</div>
        <button type="button" onClick={() => { sfxClose(); onClose(); }} style={{ padding: "7px 14px", borderRadius: 9, border: "none", background: "#334155", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>返回</button>
      </div>

      <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: "#f0abfc" }}>🐾 {profile.catCoins} CAT幣</span>
        <span style={{ fontSize: 12, color: rank.color, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
          <ArtOrEmoji sources={[rankBadge(rank.id)]} emoji={rank.icon} size={26} />
          {rank.name}（{shopTier} 級貨架）
        </span>
      </div>

      {msg && <div style={{ fontSize: 12, color: msg.startsWith("⚠️") ? "#f87171" : "#6ee7b7" }}>{msg}</div>}

      {[1, 2, 3].map(tier => {
        const items = GUILD_SHOP_ITEMS.filter(i => i.tier === tier);
        const locked = tier > shopTier;
        const unlockRank = GUILD_RANKS.find(r => r.shopTier >= tier);
        return (
          <div key={tier} style={{ ...card, opacity: locked ? 0.55 : 1 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>
              {SHOP_TIER_META[tier].label}
              {locked && <span style={{ color: "#f87171", marginLeft: 8 }}>🔒 需 {unlockRank?.icon}{unlockRank?.name}</span>}
            </div>
            {items.map(item => {
              const v = itemView(item);
              const afford = profile.catCoins >= item.costCat;
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                  <span style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
                    {v.icon} <b style={{ color: v.color }}>{v.name}</b>
                    <span style={{ color: "#94a3b8", marginLeft: 6 }}>{v.note}</span>
                  </span>
                  <button type="button" disabled={locked || !afford} onClick={() => buy(item)}
                    style={{ padding: "4px 10px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0,
                      background: locked || !afford ? "#475569" : "linear-gradient(135deg,#a855f7,#6d28d9)", cursor: locked || !afford ? "not-allowed" : "pointer" }}>
                    🐾 {item.costCat}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
