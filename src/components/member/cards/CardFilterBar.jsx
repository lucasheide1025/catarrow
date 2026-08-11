// src/components/member/cards/CardFilterBar.jsx
// L1 遭遇分類籤 + 屬性標籤 (HP / ATK / DEF) + L2 篩選 chip（族系 / Tier / 已取得 / 可升星 / 新取得）。

import { useState } from "react";
import { L1_CATEGORIES, FAMILIES, TIERS } from "./cardCatalog";
import { activeFilterSummary } from "./cardCollectionUi";

function Chip({ active, onClick, children, color = "#6366f1" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-chip"
      aria-pressed={active}
      style={{
        flexShrink: 0, minHeight: 44, padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800,
        border: `1px solid ${active ? color : "rgba(255,255,255,.15)"}`,
        background: active ? color : "rgba(255,255,255,.06)",
        color: active ? "#fff" : "#94a3b8", cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function CardFilterBar({
  l1, family, tier, statFilter, ownedFilter, upgradableOnly, newOnly, showUnowned = false,
  l1Unread = {}, onL1, onFamily, onTier, onStatFilter, onOwned, onUpgradable, onNew,
  onShowUnowned,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const summary = activeFilterSummary({
    l1,
    statFilter,
    ownedFilter: family || l1 === "worldboss" ? ownedFilter : "all",
    upgradableOnly,
    newOnly,
  });
  const clearAdvanced = () => { onL1("all"); onStatFilter("all"); onOwned("all"); onUpgradable(false); onNew(false); };
  const activeEntries = [
    l1 !== "all" && { key:"l1", label:L1_CATEGORIES.find(item => item.id === l1)?.label || l1, clear:() => onL1("all") },
    statFilter !== "all" && { key:"stat", label:statFilter.toUpperCase(), clear:() => onStatFilter("all") },
    (family || l1 === "worldboss") && ownedFilter !== "all" && { key:"owned", label:ownedFilter === "owned" ? "已取得" : "未取得", clear:() => onOwned("all") },
    upgradableOnly && { key:"upgrade", label:"可升星", clear:() => onUpgradable(false) },
    newOnly && { key:"new", label:"新取得", clear:() => onNew(false) },
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button type="button" className="card-chip" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(value => !value)} style={{padding:"9px 12px",borderRadius:12,border:"1px solid rgba(129,140,248,.4)",background:"rgba(99,102,241,.12)",color:"#c7d2fe",fontWeight:900,textAlign:"left"}}>進階篩選 {summary.length ? `（${summary.join("・")}）` : ""} {advancedOpen ? "▲" : "▼"}</button>
      {activeEntries.length > 0 && <div aria-label="已套用篩選" style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {activeEntries.map(entry => <button type="button" className="card-chip" key={entry.key} onClick={entry.clear} aria-label={`移除${entry.label}篩選`} style={{minHeight:44,fontSize:11,padding:"4px 9px",borderRadius:999,border:"1px solid #4f46e5",background:"#312e81",color:"#c7d2fe"}}>{entry.label} ×</button>)}
        <button type="button" className="card-chip" onClick={clearAdvanced} style={{minHeight:44,padding:"4px 9px",borderRadius:999,border:"1px solid rgba(248,113,113,.5)",background:"rgba(127,29,29,.35)",color:"#fecaca",fontWeight:800}}>清除全部</button>
      </div>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}} aria-label="卡片種類">
        <Chip active={l1 !== "worldboss"} onClick={() => onL1("all")}>怪物卡</Chip>
        <Chip active={l1 === "worldboss"} onClick={() => onL1("worldboss")} color="#ca8a04">世界王卡</Chip>
      </div>

      {advancedOpen && <div style={{display:"flex",flexDirection:"column",gap:8,padding:10,borderRadius:14,background:"rgba(15,23,42,.75)",border:"1px solid rgba(255,255,255,.1)"}}>
      {/* 屬性三大標籤 (HP / ATK / DEF) */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <Chip active={!statFilter || statFilter === "all"} onClick={() => onStatFilter("all")} color="#6366f1">
          全屬性
        </Chip>
        <Chip active={statFilter === "hp"} onClick={() => onStatFilter("hp")} color="#10b981">
          ❤️ HP 類卡片
        </Chip>
        <Chip active={statFilter === "atk"} onClick={() => onStatFilter("atk")} color="#f59e0b">
          ⚔️ ATK 類卡片
        </Chip>
        <Chip active={statFilter === "def"} onClick={() => onStatFilter("def")} color="#3b82f6">
          🛡️ DEF 類卡片
        </Chip>
      </div>

      {/* L1 遭遇 */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        {L1_CATEGORIES.map(cat => {
          const unread = l1Unread[cat.id] || 0;
          return (
            <span key={cat.id} style={{ position: "relative", flexShrink: 0 }}>
              <Chip active={l1 === cat.id} onClick={() => onL1(cat.id)} color={cat.id === "worldboss" ? "#facc15" : "#6366f1"}>
                {cat.label}
              </Chip>
              {unread > 0 && (
                <span aria-label={`${unread} 張新卡`} style={{
                  position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, padding: "0 4px",
                  borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800,
                  display: "grid", placeItems: "center",
                }}>{unread}</span>
              )}
            </span>
          );
        })}
      </div>

      {(family || l1 === "worldboss") && <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} aria-label="持有狀態篩選">
        <Chip active={ownedFilter === "owned"} onClick={() => onOwned(ownedFilter === "owned" ? "all" : "owned")} color="#0ea5e9">已取得</Chip>
        <Chip active={ownedFilter === "unowned"} onClick={() => onOwned(ownedFilter === "unowned" ? "all" : "unowned")} color="#64748b">未取得</Chip>
      </div>}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <Chip active={upgradableOnly} onClick={() => onUpgradable(!upgradableOnly)} color="#f59e0b">可升星</Chip>
        <Chip active={newOnly} onClick={() => onNew(!newOnly)} color="#ef4444">新取得</Chip>
      </div>

      </div>}

      {/* L2 族系 */}
      {l1 !== "worldboss" && <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} aria-label="選擇卡片族系">
        <Chip active={!family} onClick={() => onFamily(null)}>全族</Chip>
        {FAMILIES.map(f => (
          <Chip key={f.id} active={family === f.id} onClick={() => onFamily(f.id)}>{f.label}</Chip>
        ))}
      </div>}

      {l1 !== "worldboss" && !family && <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <Chip active={showUnowned} onClick={() => onShowUnowned?.(!showUnowned)} color="#64748b">{showUnowned ? "隱藏未取得卡片" : "顯示未取得卡片"}</Chip>
        <span style={{fontSize:11,color:"#94a3b8"}}>全族模式預設只顯示已取得卡；開啟後仍維持每族最多 6 張。</span>
      </div>}

      {/* 全族與單一族都必須限制在一個 Tier。 */}
      {l1 !== "worldboss" && <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} aria-label="選擇卡片 Tier">
        {TIERS.map(t => (
          <Chip key={t.id} active={tier === t.id} onClick={() => onTier(t.id)} color="#10b981">{t.label}</Chip>
        ))}
      </div>}

    </div>
  );
}
