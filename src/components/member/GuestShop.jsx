// src/components/member/GuestShop.jsx — 訪客金幣商店
import { useState } from "react";
import { sfxShopBuy, sfxSoftFail, sfxTap } from "../../lib/sound";

function getCoins() {
  return parseInt(sessionStorage.getItem("guest_coins") || "500", 10);
}

const WB_POTIONS = [
  { id: "small",  icon: "💚", name: "小強心針", desc: "世界王傷害 ×1.2（下次出戰自動套用）", cost: 50,  badge: "" },
  { id: "medium", icon: "💙", name: "中強心針", desc: "世界王傷害 ×1.5（下次出戰自動套用）", cost: 120, badge: "推薦" },
  { id: "large",  icon: "💛", name: "大強心針", desc: "世界王傷害 ×2.0（下次出戰自動套用）", cost: 250, badge: "強力" },
];

const MISC_ITEMS = [
  {
    id:   "coin_boost",
    icon: "💰",
    name: "金幣護符",
    desc: "下次打怪金幣獲得量 ×2（一次性，用完消失）",
    cost: 80,
    badge: "",
  },
  {
    id:   "coin_boost_big",
    icon: "🏆",
    name: "金幣護符（強化）",
    desc: "下次打怪金幣獲得量 ×3（一次性）",
    cost: 180,
    badge: "超值",
  },
];

export default function GuestShop() {
  const [coins,  setCoins]  = useState(getCoins);
  const [msg,    setMsg]    = useState("");
  const [msgOk,  setMsgOk]  = useState(true);

  function showMsg(text, ok = true) {
    setMsg(text); setMsgOk(ok);
    setTimeout(() => setMsg(""), 2200);
  }

  function currentPotion() { return sessionStorage.getItem("guest_wb_potion") || null; }
  function hasCoinBoost()  { return !!sessionStorage.getItem("guest_coin_boost"); }

  function buy(item) {
    const c = getCoins();
    if (c < item.cost) { sfxSoftFail(); showMsg("💸 金幣不足！", false); return; }
    sfxShopBuy();
    const newC = c - item.cost;
    sessionStorage.setItem("guest_coins", String(newC));
    setCoins(newC);

    if (["small", "medium", "large"].includes(item.id)) {
      sessionStorage.setItem("guest_wb_potion", item.id);
      showMsg(`✅ 已裝備「${item.name}」，進入世界王自動生效！`);
    } else if (item.id === "coin_boost") {
      sessionStorage.setItem("guest_coin_boost", "10");
      showMsg("✅ 金幣護符已啟動！下次打怪金幣 ×2");
    } else if (item.id === "coin_boost_big") {
      sessionStorage.setItem("guest_coin_boost", "15");
      showMsg("✅ 強化護符啟動！下次打怪金幣 ×3");
    }
    // force re-render to reflect equipped state
    setCoins(newC);
  }

  const activePot = currentPotion();
  const coinBoost = hasCoinBoost();

  return (
    <div style={{ padding: "16px", paddingBottom: "100px", fontFamily: "sans-serif" }}>

      {/* 金幣餘額 */}
      <div style={{
        background: "linear-gradient(135deg,#7c3aed,#2563eb)",
        borderRadius: "18px", padding: "18px 20px", marginBottom: "16px",
        display: "flex", alignItems: "center", gap: "14px",
      }}>
        <span style={{ fontSize: "36px" }}>💰</span>
        <div>
          <div style={{ color: "rgba(255,255,255,.65)", fontSize: "11px", letterSpacing: "0.05em" }}>可用金幣</div>
          <div style={{ color: "white", fontSize: "30px", fontWeight: 900 }}>{coins}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,.5)", fontSize: "10px" }}>打怪每次可獲得</div>
          <div style={{ color: "#fbbf24", fontSize: "13px", fontWeight: 900 }}>15 ~ 500 金幣</div>
        </div>
      </div>

      {/* 訊息列 */}
      {msg && (
        <div style={{
          background: msgOk ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${msgOk ? "#86efac" : "#fca5a5"}`,
          borderRadius: "12px", padding: "10px 14px", marginBottom: "12px",
          fontSize: "13px", fontWeight: 700,
          color: msgOk ? "#166534" : "#991b1b",
        }}>{msg}</div>
      )}

      {/* 已裝備狀態 */}
      {(activePot || coinBoost) && (
        <div style={{
          background: "#fef9c3", border: "1px solid #fde047",
          borderRadius: "12px", padding: "10px 14px", marginBottom: "14px",
          fontSize: "12px", color: "#854d0e", fontWeight: 700,
        }}>
          {activePot && <div>⚔️ 世界王藥水：{WB_POTIONS.find(p => p.id === activePot)?.name}（已裝備）</div>}
          {coinBoost  && <div>💰 金幣護符：下次打怪生效</div>}
        </div>
      )}

      {/* 世界王強心針 */}
      <div style={{ fontWeight: 900, fontSize: "13px", color: "#1e293b", marginBottom: "6px" }}>
        ⚔️ 世界王強心針
      </div>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px" }}>
        購買後進入世界王出戰時自動套用，用完即消耗
      </div>

      {WB_POTIONS.map(item => {
        const isEquipped = activePot === item.id;
        const canBuy     = coins >= item.cost;
        return (
          <div key={item.id} style={{
            background: "white",
            border: `2px solid ${isEquipped ? "#7c3aed" : "#e2e8f0"}`,
            borderRadius: "16px", padding: "14px",
            marginBottom: "10px", display: "flex", alignItems: "center", gap: "12px",
          }}>
            <span style={{ fontSize: "26px" }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 900, fontSize: "14px", color: "#1e293b" }}>{item.name}</span>
                {item.badge && (
                  <span style={{ fontSize: "10px", background: "#7c3aed", color: "white", borderRadius: "4px", padding: "1px 5px", fontWeight: 700 }}>{item.badge}</span>
                )}
                {isEquipped && (
                  <span style={{ fontSize: "10px", background: "#22c55e", color: "white", borderRadius: "4px", padding: "1px 5px", fontWeight: 700 }}>已裝備</span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{item.desc}</div>
              <div style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700, marginTop: "3px" }}>💰 {item.cost}</div>
            </div>
            <button
              onClick={() => buy(item)}
              disabled={isEquipped || !canBuy}
              style={{
                padding: "9px 14px", border: "none", borderRadius: "10px",
                fontWeight: 900, fontSize: "13px", cursor: isEquipped || !canBuy ? "default" : "pointer",
                background: isEquipped ? "#22c55e" : canBuy ? "#7c3aed" : "#e2e8f0",
                color: isEquipped || canBuy ? "white" : "#94a3b8",
                flexShrink: 0,
              }}>
              {isEquipped ? "✓ 已選" : "購買"}
            </button>
          </div>
        );
      })}

      {/* 其他道具 */}
      <div style={{ fontWeight: 900, fontSize: "13px", color: "#1e293b", marginBottom: "6px", marginTop: "8px" }}>
        💎 打怪加成道具
      </div>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px" }}>
        下次打怪勝利時觸發，用完即消耗
      </div>

      {MISC_ITEMS.map(item => {
        const isActive = item.id === "coin_boost" ? coinBoost && sessionStorage.getItem("guest_coin_boost") === "10"
                       : item.id === "coin_boost_big" ? coinBoost && sessionStorage.getItem("guest_coin_boost") === "15"
                       : false;
        const canBuy = coins >= item.cost && !isActive;
        return (
          <div key={item.id} style={{
            background: "white",
            border: `2px solid ${isActive ? "#f59e0b" : "#e2e8f0"}`,
            borderRadius: "16px", padding: "14px",
            marginBottom: "10px", display: "flex", alignItems: "center", gap: "12px",
          }}>
            <span style={{ fontSize: "26px" }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontWeight: 900, fontSize: "14px", color: "#1e293b" }}>{item.name}</span>
                {item.badge && (
                  <span style={{ fontSize: "10px", background: "#f59e0b", color: "white", borderRadius: "4px", padding: "1px 5px", fontWeight: 700 }}>{item.badge}</span>
                )}
                {isActive && (
                  <span style={{ fontSize: "10px", background: "#f59e0b", color: "white", borderRadius: "4px", padding: "1px 5px", fontWeight: 700 }}>已啟動</span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{item.desc}</div>
              <div style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700, marginTop: "3px" }}>💰 {item.cost}</div>
            </div>
            <button
              onClick={() => buy(item)}
              disabled={!canBuy}
              style={{
                padding: "9px 14px", border: "none", borderRadius: "10px",
                fontWeight: 900, fontSize: "13px", cursor: canBuy ? "pointer" : "default",
                background: isActive ? "#f59e0b" : canBuy ? "#7c3aed" : "#e2e8f0",
                color: isActive || canBuy ? "white" : "#94a3b8",
                flexShrink: 0,
              }}>
              {isActive ? "✓" : "購買"}
            </button>
          </div>
        );
      })}

      {/* 提示 */}
      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "12px", padding: "12px 14px", marginTop: "8px" }}>
        <div style={{ fontSize: "12px", color: "#0369a1", fontWeight: 700, lineHeight: 1.8 }}>
          💡 打怪勝利可獲得大量金幣<br />
          💡 世界王藥水同時只能裝備一瓶<br />
          💡 金幣在這次訪客連結有效期間內保留
        </div>
      </div>
    </div>
  );
}
