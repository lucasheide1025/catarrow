// src/components/member/cards/CardFilterBar.jsx
// L1 遭遇分類籤 + 屬性標籤 (HP / ATK / DEF) + L2 篩選 chip（族系 / Tier / 已取得 / 可升星 / 新取得）。

import { L1_CATEGORIES, FAMILIES, TIERS } from "./cardCatalog";

function Chip({ active, onClick, children, color = "#6366f1" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-chip"
      aria-pressed={active}
      style={{
        flexShrink: 0, padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800,
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
  l1, family, tier, statFilter, ownedFilter, upgradableOnly, newOnly,
  l1Unread = {}, onL1, onFamily, onTier, onStatFilter, onOwned, onUpgradable, onNew,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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

      {/* L2 族系 */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <Chip active={!family} onClick={() => onFamily(null)}>全族</Chip>
        {FAMILIES.map(f => (
          <Chip key={f.id} active={family === f.id} onClick={() => onFamily(f.id)}>{f.label}</Chip>
        ))}
      </div>

      {/* L2 Tier */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <Chip active={!tier} onClick={() => onTier(null)}>全 Tier</Chip>
        {TIERS.map(t => (
          <Chip key={t.id} active={tier === t.id} onClick={() => onTier(t.id)} color="#10b981">{t.label}</Chip>
        ))}
      </div>

      {/* L2 狀態 */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <Chip active={ownedFilter === "owned"} onClick={() => onOwned(ownedFilter === "owned" ? "all" : "owned")} color="#0ea5e9">已取得</Chip>
        <Chip active={ownedFilter === "unowned"} onClick={() => onOwned(ownedFilter === "unowned" ? "all" : "unowned")} color="#64748b">未取得</Chip>
        <Chip active={upgradableOnly} onClick={() => onUpgradable(!upgradableOnly)} color="#f59e0b">可升星</Chip>
        <Chip active={newOnly} onClick={() => onNew(!newOnly)} color="#ef4444">新取得</Chip>
      </div>
    </div>
  );
}
