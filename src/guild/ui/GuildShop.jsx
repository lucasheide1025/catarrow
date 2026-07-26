// src/guild/ui/GuildShop.jsx
// 公會商店：CAT幣的去處。貨架依階級 shopTier 解鎖，鎖住的仍顯示（給目標感）但不能買。
// 純 UI：買賣邏輯走 db/guildDb.buyGuildShopItem（驗證在 domain 純函數）。
import { useState } from "react";
import { MATERIALS } from "../../lib/monsterMaterials";
import { GUILD_SHOP_ITEMS, SHOP_TIER_META, SHOP_SECTIONS, SHOP_MATERIAL_BY_ID, MAT_FAMILIES, MAT_FAMILY_META } from "../data/guildShop";
import { GRADE_META, SLOT_META, GUILD_EQUIP_ARCHETYPES, equipDisplayName, resolveEquipStats } from "../data/guildEquipCatalog";
import { rankUnlocks, GUILD_RANKS } from "../domain/guildRank";
import { STAT_META } from "../domain/guildStats";
import { sfxShopBuy, sfxError, sfxClose, sfxSwitch } from "../../lib/sound";
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
  // 擴充材料沒有 icon 欄位（只有 id/name），退回族別圖示；舊六族鏈才有自己的 emoji
  const mat = SHOP_MATERIAL_BY_ID[item.materialId] || MATERIALS.find(m => m.id === item.materialId);
  const icon = mat?.icon || MAT_FAMILY_META[item.family]?.icon || "📦";
  return {
    icon,
    name: mat?.name || item.materialId,
    color: "#a7f3d0",
    note: item.bundle ? `5 入包（打 8 折）` : `打怪/貓村共用材料`,
  };
}

export default function GuildShop({ profile, onBuy, onClose }) {
  const [msg, setMsg] = useState("");
  const [section, setSection] = useState("weapon");
  const [matFamily, setMatFamily] = useState("ghost");
  const [matTier, setMatTier] = useState(1);
  const { shopTier, rank } = rankUnlocks(profile.rep);

  // 材料商店：族 × 階 篩出來的貨（單買在前、5 入包在後）
  const matItems = GUILD_SHOP_ITEMS.filter(i => i.kind === "material" && i.family === matFamily && i.matTier === matTier);

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

      {/* 分店切換：商品太多，一條長列表捲不完 */}
      <div style={{ display: "flex", gap: 6 }}>
        {SHOP_SECTIONS.map(s => (
          <button key={s.id} type="button" onClick={() => { sfxSwitch(); setSection(s.id); setMsg(""); }}
            style={{ flex: 1, padding: "8px 6px", borderRadius: 10, fontSize: 12, fontWeight: 900, cursor: "pointer",
              border: `1px solid ${section === s.id ? "#fbbf24" : "rgba(255,255,255,.12)"}`,
              background: section === s.id ? "rgba(251,191,36,.18)" : "rgba(0,0,0,.32)",
              color: section === s.id ? "#fde68a" : "#94a3b8" }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: -6 }}>{SHOP_SECTIONS.find(s => s.id === section)?.hint}</div>

      {/* 材料商店：七族標籤 + 階級標籤（不鎖階級，價格就是門檻） */}
      {section === "material" && (
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {MAT_FAMILIES.map(f => (
              <button key={f} type="button" onClick={() => { sfxSwitch(); setMatFamily(f); }}
                style={{ padding: "4px 9px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer",
                  border: `1px solid ${matFamily === f ? "#4ade80" : "rgba(255,255,255,.12)"}`,
                  background: matFamily === f ? "rgba(74,222,128,.18)" : "rgba(0,0,0,.3)", color: "#e2e8f0" }}>
                {MAT_FAMILY_META[f].icon} {MAT_FAMILY_META[f].label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {[1, 2, 3, 4, 5, 6].map(t => (
              <button key={t} type="button" onClick={() => { sfxSwitch(); setMatTier(t); }}
                style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer",
                  border: `1px solid ${matTier === t ? "#60a5fa" : "rgba(255,255,255,.12)"}`,
                  background: matTier === t ? "rgba(96,165,250,.18)" : "rgba(0,0,0,.3)", color: "#e2e8f0" }}>
                T{t}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>
            一般怪素材**全部無限量供應**；小王／大王素材買不到，只能靠遠征打。
          </div>
          {matItems.map(item => {
            const v = itemView(item);
            const afford = profile.catCoins >= item.costCat;
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                <span style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
                  {v.icon} <b style={{ color: v.color }}>{v.name}</b>
                  <span style={{ color: "#94a3b8", marginLeft: 6 }}>{v.note}</span>
                </span>
                <button type="button" disabled={!afford} onClick={() => buy(item)}
                  style={{ padding: "4px 10px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0,
                    background: afford ? "linear-gradient(135deg,#a855f7,#6d28d9)" : "#475569", cursor: afford ? "pointer" : "not-allowed" }}>
                  🐾 {item.costCat}
                </button>
              </div>
            );
          })}
          {matItems.length === 0 && <div style={{ fontSize: 11, color: "#64748b" }}>這個族階沒有一般怪素材。</div>}
        </div>
      )}

      {section !== "material" && [1, 2, 3].map(tier => {
        const items = GUILD_SHOP_ITEMS.filter(i => i.tier === tier && i.section === section);
        if (items.length === 0) return null;
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
