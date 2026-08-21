// src/arcade/ArcadeShop.jsx — 金幣商店（M2）
// 消耗冒險金幣購買道具，幫助下一次冒險走得更遠。
import { useState } from "react";
import { SHOP_ITEMS, buyItem } from "./arcadeShop";

export default function ArcadeShop({ profile, onSave, onExit, onToast }) {
  const [busyId, setBusyId] = useState(null);
  const coins = profile.coins || 0;
  const inventory = profile.inventory || {};

  async function handleBuy(item) {
    if (busyId) return;
    setBusyId(item.id);
    const res = buyItem(profile, item.id, 1);
    if (res.ok) {
      await onSave(res.updated);
      onToast(`🛒 買了 ${item.icon} ${item.name}！`);
    } else {
      onToast(res.reason);
    }
    setBusyId(null);
  }

  return (
    <div className="arcade-stage">
      <div className="arcade-wrap">
        <div className="arcade-topbar">
          <div className="arcade-logo">
            <div className="arcade-logo-badge">🛒</div>
            <div>
              <div className="arcade-logo-title">金幣商店</div>
              <div className="arcade-logo-sub">{profile.nickname} 的補給站</div>
            </div>
          </div>
          <button type="button" className="arcade-danger" style={{ marginLeft: "auto" }} onClick={onExit}>
            回大廳
          </button>
        </div>

        <div className="arcade-card arcade-shop-hero">
          <div className="arcade-hub-kicker">SHOP</div>
          <h1 className="arcade-hub-title">用冒險金幣買補給！</h1>
          <p className="arcade-hub-copy">在射箭場賺到的金幣，在這裡換成下一次冒險的戰力。</p>
          <div className="arcade-shop-coins">
            <span className="arcade-shop-coins-icon">🪙</span>
            <span className="arcade-shop-coins-v">{coins}</span>
            <span className="arcade-shop-coins-l">冒險金幣</span>
          </div>
        </div>

        <div className="arcade-section-title">道具（消耗品）</div>
        <div className="arcade-shop-grid">
          {SHOP_ITEMS.map((item) => {
            const owned = inventory[item.id] || 0;
            const afford = coins >= item.price;
            return (
              <div key={item.id} className="arcade-shop-card">
                <div className="arcade-shop-icon">{item.icon}</div>
                <div className="arcade-shop-name">{item.name}</div>
                <div className="arcade-shop-desc">{item.desc}</div>
                <div className="arcade-shop-row">
                  <span className={`arcade-shop-price${afford ? "" : " poor"}`}>🪙 {item.price}</span>
                  <span className="arcade-shop-owned">持有 {owned}/{item.maxBuy}</span>
                </div>
                <button
                  type="button"
                  className={`arcade-primary ${afford ? "" : "gray"}`}
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={busyId === item.id || !afford || owned >= item.maxBuy}
                  onClick={() => handleBuy(item)}
                >
                  {busyId === item.id ? "購買中…" : owned >= item.maxBuy ? "已達上限" : "🛒 購買 ×1"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="arcade-note">
          💡 <strong>小撇步：</strong>火焰箭與貓薄荷在開打前使用，飯糰留著王戰前補血。商店道具會跟著你的雲端進度，換手機也不怕。
        </div>
      </div>
    </div>
  );
}
