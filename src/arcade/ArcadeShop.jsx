// src/arcade/ArcadeShop.jsx — 金幣商店（M2）
// 消耗冒險金幣購買道具，幫助下一次冒險走得更遠。
import { useState } from "react";
import { SHOP_ITEMS, buyItem } from "./arcadeShop";
import {
  ARCADE_CARDS,
  ARCADE_EQUIPMENT,
  arcadeCardUpgradeCost,
  equipmentUpgradeCost,
  getArcadePlayerStats,
  toggleArcadeCard,
  upgradeArcadeCard,
  upgradeArcadeEquipment,
} from "./arcadeProgression";

export default function ArcadeShop({ profile, onSave, onMutate, onExit, onToast }) {
  const [busyId, setBusyId] = useState(null);
  const coins = profile.coins || 0;
  const inventory = profile.inventory || {};
  const playerStats = getArcadePlayerStats(profile);
  const equipmentSlots = ["weapon", "armor", "accessory"];

  async function runMutation(busyKey, action, successMessage) {
    if (busyId) return;
    setBusyId(busyKey);
    let outcome = null;
    try {
      if (onMutate) {
        await onMutate((current) => {
          outcome = action(current);
          return outcome?.ok ? outcome.updated : current;
        });
      } else {
        outcome = action(profile);
        if (outcome?.ok) await onSave(outcome.updated);
      }
      onToast(outcome?.ok ? successMessage : (outcome?.reason || "操作失敗"));
    } catch {
      onToast("本機進度更新失敗，請再試一次");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBuy(item) {
    await runMutation(`buy:${item.id}`, (current) => buyItem(current, item.id, 1), `🛒 買了 ${item.icon} ${item.name}！`);
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
          <div className="arcade-stats" style={{ marginTop: 12 }}>
            <div className="arcade-stat"><div className="arcade-stat-v">❤️ {playerStats.maxHp}</div><div className="arcade-stat-l">HP</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">⚔️ {playerStats.atk}</div><div className="arcade-stat-l">ATK</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">🛡️ {playerStats.def}</div><div className="arcade-stat-l">DEF</div></div>
          </div>
        </div>

        <div className="arcade-section-title">裝備強化（最高 +5）</div>
        <div className="arcade-shop-grid">
          {equipmentSlots.map((slot) => {
            const equipped = profile.equipment?.[slot];
            const item = ARCADE_EQUIPMENT[equipped?.itemId];
            const level = equipped?.level || 0;
            const cost = equipmentUpgradeCost(profile, slot);
            if (!item) return null;
            return (
              <div key={slot} className="arcade-shop-card">
                <div className="arcade-shop-icon">{item.icon}</div>
                <div className="arcade-shop-name">{item.name} +{level}</div>
                <div className="arcade-shop-desc">{item.desc}</div>
                <div className="arcade-shop-row">
                  <span className="arcade-shop-price">{cost == null ? "MAX" : `🪙 ${cost}`}</span>
                  <span className="arcade-shop-owned">+{level}/+5</span>
                </div>
                <button
                  type="button"
                  className={`arcade-primary ${cost != null && coins >= cost ? "gold" : "gray"}`}
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={busyId === `equip:${slot}` || cost == null || coins < cost}
                  onClick={() => runMutation(
                    `equip:${slot}`,
                    (current) => upgradeArcadeEquipment(current, slot),
                    `✨ ${item.name} 強化成功！`
                  )}
                >
                  {cost == null ? "已強化到 +5" : `強化 → +${level + 1}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="arcade-section-title">異常卡片（最多裝備 2 張）</div>
        <div className="arcade-shop-grid">
          {Object.values(ARCADE_CARDS).map((card) => {
            const owned = profile.cards?.owned?.[card.id];
            const level = owned?.level || 1;
            const equipped = (profile.cards?.equipped || []).includes(card.id);
            const cost = arcadeCardUpgradeCost(profile, card.id);
            return (
              <div key={card.id} className="arcade-shop-card">
                <div className="arcade-shop-icon">{card.icon}</div>
                <div className="arcade-shop-name">{card.name} Lv.{level}</div>
                <div className="arcade-shop-desc">{card.desc}</div>
                <div className="arcade-shop-row">
                  <span className="arcade-shop-price">{cost == null ? "MAX" : `🪙 ${cost}`}</span>
                  <span className="arcade-shop-owned">{equipped ? "已裝備" : "未裝備"}</span>
                </div>
                <div className="arcade-row" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className={`arcade-primary ${equipped ? "blue" : "green"}`}
                    style={{ flex: 1, padding: "10px 8px", fontSize: 12 }}
                    disabled={busyId === `card-equip:${card.id}`}
                    onClick={() => runMutation(
                      `card-equip:${card.id}`,
                      (current) => toggleArcadeCard(current, card.id),
                      equipped ? `已卸下 ${card.name}` : `已裝備 ${card.name}`
                    )}
                  >
                    {equipped ? "卸下" : "裝備"}
                  </button>
                  <button
                    type="button"
                    className={`arcade-primary ${cost != null && coins >= cost ? "gold" : "gray"}`}
                    style={{ flex: 1, padding: "10px 8px", fontSize: 12 }}
                    disabled={busyId === `card-up:${card.id}` || cost == null || coins < cost}
                    onClick={() => runMutation(
                      `card-up:${card.id}`,
                      (current) => upgradeArcadeCard(current, card.id),
                      `✨ ${card.name} 升到 Lv.${Math.min(3, level + 1)}！`
                    )}
                  >
                    {cost == null ? "Lv.3 MAX" : "強化"}
                  </button>
                </div>
              </div>
            );
          })}
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
                  disabled={busyId === `buy:${item.id}` || !afford || owned >= item.maxBuy}
                  onClick={() => handleBuy(item)}
                >
                  {busyId === item.id ? "購買中…" : owned >= item.maxBuy ? "已達上限" : "🛒 購買 ×1"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="arcade-note">
          💾 <strong>本機養成：</strong>金幣、裝備、卡片與強化都保存在這個瀏覽器；同一瀏覽器的其他分頁會自動同步。
        </div>
      </div>
    </div>
  );
}
