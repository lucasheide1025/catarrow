// src/components/member/cards/CardGroupSection.jsx
// 渲染單一「族系 × Tier」分組（最多 6 張：3 一般 + 2 小王 + 1 大王）。
// 只掛載本組的卡 → 一次最多 6 個 <img>,不建虛擬列表。cards 由呼叫端過濾好傳入。

import CardMiniCell from "./CardMiniCell";

const MAX_PER_GROUP = 6;

export default function CardGroupSection({ title, subtitle, cards = [], isNewFn, onOpen }) {
  // 防禦性上限：一組最多 6 張
  const list = cards.slice(0, MAX_PER_GROUP);
  if (!list.length) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(title || subtitle) && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          {title && <h3 style={{ fontSize: 13, fontWeight: 900, color: "#f1f5f9", margin: 0 }}>{title}</h3>}
          {subtitle && <span style={{ fontSize: 11, color: "#64748b" }}>{subtitle}</span>}
        </div>
      )}
      {/* 小卡橫向排列：桌機一排最多約 5 張（150px 起 + maxWidth 上限）,手機自動 2-3 欄 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", maxWidth: 830, gap: 8 }}>
        {list.map(view => (
          <CardMiniCell
            key={view.monsterId}
            view={view}
            isNew={isNewFn ? isNewFn(view) : false}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

export { MAX_PER_GROUP };
