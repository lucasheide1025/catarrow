// src/components/member/GuestShop.jsx — 訪客金幣商店
// 2026-07-09：金幣改接真正持久的 members/{memberId}.coins（訪客帳號現在跨次造訪會保留），
// 世界王藥水/打怪加成護符這類單次消耗buff維持 sessionStorage（本來就是一次性、沒有跨次保留的必要）。
import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc, increment } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { addCoins } from "../../lib/db";
import { sfxShopBuy, sfxSoftFail, sfxTap } from "../../lib/sound";

const GUEST_SHOP_CSS = `
.guest-shop{min-height:100vh;padding:16px 16px 104px;color:#e5eefb;background:transparent;font-family:Inter,"Noto Sans TC",system-ui,sans-serif}
.guest-shop-hero{border:1px solid rgba(255,255,255,.12);background:linear-gradient(135deg,rgba(15,23,42,.94),rgba(79,70,229,.58));border-radius:24px;padding:18px;display:flex;gap:14px;align-items:center;box-shadow:0 20px 50px rgba(0,0,0,.22)}
.guest-shop-coin{font-size:38px}
.guest-shop-kicker{color:#a9bdd6;font-size:11px;font-weight:1000;letter-spacing:.08em}
.guest-shop-balance{color:white;font-size:32px;font-weight:1000;line-height:1}
.guest-shop-side{margin-left:auto;text-align:right;color:#fde68a;font-size:12px;font-weight:1000}
.guest-shop-msg{border-radius:16px;padding:11px 13px;margin:12px 0;font-size:13px;font-weight:900}
.guest-shop-msg.ok{background:rgba(34,197,94,.16);border:1px solid rgba(134,239,172,.42);color:#bbf7d0}
.guest-shop-msg.fail{background:rgba(239,68,68,.16);border:1px solid rgba(252,165,165,.42);color:#fecaca}
.guest-shop-equipped{background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.32);border-radius:16px;padding:11px 13px;margin:12px 0 14px;color:#fde68a;font-size:12px;font-weight:900;line-height:1.7}
.guest-shop-title{font-weight:1000;font-size:13px;color:#f8fafc;margin:18px 2px 5px;letter-spacing:.04em}
.guest-shop-desc{font-size:12px;color:#b6c8dd;margin:0 2px 12px;line-height:1.5}
.guest-shop-item{background:rgba(15,23,42,.78);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.guest-shop-item.active{border-color:rgba(251,191,36,.55);background:rgba(69,46,16,.45)}
.guest-shop-icon{width:42px;height:42px;border-radius:15px;background:rgba(255,255,255,.08);display:grid;place-items:center;font-size:25px;flex-shrink:0}
.guest-shop-name{font-weight:1000;font-size:14px;color:#f8fafc}
.guest-shop-item-desc{font-size:12px;color:#b6c8dd;margin-top:3px;line-height:1.45}
.guest-shop-cost{font-size:12px;color:#fbbf24;font-weight:1000;margin-top:4px}
.guest-shop-badge{font-size:10px;border-radius:999px;padding:2px 7px;font-weight:1000;color:white}
.guest-shop-buy{padding:9px 13px;border:0;border-radius:12px;font-weight:1000;font-size:13px;flex-shrink:0}
.guest-shop-tip{background:rgba(14,165,233,.12);border:1px solid rgba(125,211,252,.28);border-radius:16px;padding:12px 14px;margin-top:10px;color:#bae6fd;font-size:12px;font-weight:800;line-height:1.8}
`;

const WB_POTIONS = [
  { id: "small",  icon: "💚", name: "小強心針", desc: "世界王傷害 ×1.2（下次出戰自動套用）", cost: 50,  badge: "" },
  { id: "medium", icon: "💙", name: "中強心針", desc: "世界王傷害 ×1.5（下次出戰自動套用）", cost: 120, badge: "推薦" },
  { id: "large",  icon: "💛", name: "大強心針", desc: "世界王傷害 ×2.0（下次出戰自動套用）", cost: 250, badge: "強力" },
];

const STARTER_EQUIP = [
  { slotId: "bow", itemId: "bow_hoyt" },
  { slotId: "arrow", itemId: "arr_easton_x10" },
  { slotId: "absorber", itemId: "abs_spigarelli" },
  { slotId: "module", itemId: "mod_beiter" },
  { slotId: "chest", itemId: "chest_fivics" },
  { slotId: "arm", itemId: "arm_fivics" },
  { slotId: "hand", itemId: "hand_shibuya" },
  { slotId: "nutrition", itemId: "nut_powerbar" },
  { slotId: "quiver", itemId: "quiver_fivics" },
  { slotId: "toolkit", itemId: "tool_avalon" },
];

const EQUIP_ITEMS = [
  {
    id: "starter_equip_pack",
    icon: "🛡️",
    name: "新手裝備包",
    desc: "一次補齊 10 格普通裝備，可直接到角色頁查看與強化",
    cost: 240,
    badge: "推薦",
  },
];

const MISC_ITEMS = [
  {
    id:   "gacha_coin",
    icon: "🎰",
    name: "體驗轉蛋幣",
    desc: "可在角色頁的體驗轉蛋機使用 1 次",
    cost: 60,
    badge: "活動",
  },
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

export default function GuestShop({ memberId }) {
  const [memberData, setMemberData] = useState(null);
  const [msg,        setMsg]        = useState("");
  const [msgOk,      setMsgOk]      = useState(true);

  useEffect(() => {
    if (document.querySelector("[data-guest-shop-css]")) return;
    const s = document.createElement("style");
    s.setAttribute("data-guest-shop-css", "1");
    s.textContent = GUEST_SHOP_CSS;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  useEffect(() => {
    if (!memberId) return;
    const unsub = onSnapshot(doc(db, "members", memberId), snap => {
      setMemberData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return unsub;
  }, [memberId]);

  function showMsg(text, ok = true) {
    setMsg(text); setMsgOk(ok);
    setTimeout(() => setMsg(""), 2200);
  }

  const coins = memberData?.coins || 0;
  const rpgEquip = memberData?.rpgEquip || {};
  const hasStarterEquip = STARTER_EQUIP.every(item => rpgEquip[item.slotId]?.itemId);

  function currentPotion() { return sessionStorage.getItem(`guest_wb_potion_${memberId}`) || null; }
  function hasCoinBoost()  { return !!sessionStorage.getItem("guest_coin_boost"); }

  function buy(item) {
    if (item.id === "starter_equip_pack" && hasStarterEquip) {
      sfxSoftFail(); showMsg("已經擁有完整新手裝備", false); return;
    }
    if (coins < item.cost) { sfxSoftFail(); showMsg("💸 金幣不足！", false); return; }
    sfxShopBuy();
    if (memberId) addCoins(memberId, -item.cost).catch(() => {});

    if (["small", "medium", "large"].includes(item.id)) {
      sessionStorage.setItem(`guest_wb_potion_${memberId}`, item.id);
      showMsg(`✅ 已裝備「${item.name}」，進入世界王自動生效！`);
    } else if (item.id === "starter_equip_pack") {
      const patch = {};
      STARTER_EQUIP.forEach(({ slotId, itemId }) => {
        if (!rpgEquip[slotId]?.itemId) {
          patch[`rpgEquip.${slotId}`] = { itemId, grade: "common", plusLevel: 0 };
        }
        patch[`unlockedEquipItems.${itemId}`] = true;
      });
      if (memberId) updateDoc(doc(db, "members", memberId), patch).catch(() => {});
      showMsg("✅ 已裝備新手裝備包，可到角色頁查看！");
    } else if (item.id === "gacha_coin") {
      if (memberId) updateDoc(doc(db, "members", memberId), { gachaCoins: increment(1) }).catch(() => {});
      showMsg("✅ 已取得 1 枚體驗轉蛋幣！");
    } else if (item.id === "coin_boost") {
      sessionStorage.setItem("guest_coin_boost", "2");
      showMsg("✅ 金幣護符已啟動！下次打怪金幣 ×2");
    } else if (item.id === "coin_boost_big") {
      sessionStorage.setItem("guest_coin_boost", "3");
      showMsg("✅ 強化護符啟動！下次打怪金幣 ×3");
    }
  }

  const activePot = currentPotion();
  const coinBoost = hasCoinBoost();

  function renderItem(item, options = {}) {
    const isEquipped = options.isEquipped || activePot === item.id;
    const isActive = options.isActive || false;
    const disabled = options.disabled || isEquipped || isActive || coins < item.cost;
    const canBuy = !disabled;
    return (
      <div key={item.id} className={`guest-shop-item ${isEquipped || isActive ? "active" : ""}`}>
        <span className="guest-shop-icon">{item.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="guest-shop-name">{item.name}</span>
            {item.badge && <span className="guest-shop-badge" style={{ background: options.badgeColor || "#7c3aed" }}>{item.badge}</span>}
            {isEquipped && <span className="guest-shop-badge" style={{ background: "#22c55e" }}>已裝備</span>}
            {isActive && <span className="guest-shop-badge" style={{ background: "#f59e0b" }}>已啟動</span>}
          </div>
          <div className="guest-shop-item-desc">{item.desc}</div>
          <div className="guest-shop-cost">💰 {item.cost}</div>
        </div>
        <button
          onClick={() => buy(item)}
          disabled={disabled}
          className="guest-shop-buy"
          style={{ background: isEquipped ? "#22c55e" : isActive ? "#f59e0b" : canBuy ? "#7c3aed" : "#334155", color: canBuy || isEquipped || isActive ? "white" : "#94a3b8", cursor: canBuy ? "pointer" : "default" }}>
          {isEquipped || isActive ? "✓" : "購買"}
        </button>
      </div>
    );
  }

  return (
    <div className="guest-shop">

      {/* 金幣餘額 */}
      <div className="guest-shop-hero">
        <span className="guest-shop-coin">💰</span>
        <div>
          <div className="guest-shop-kicker">可用金幣</div>
          <div className="guest-shop-balance">{coins}</div>
        </div>
        <div className="guest-shop-side">
          <div style={{ color: "#b6c8dd", fontSize: 10 }}>初始資金</div>
          <div>500 金幣</div>
        </div>
      </div>

      {/* 訊息列 */}
      {msg && (
        <div className={`guest-shop-msg ${msgOk ? "ok" : "fail"}`}>{msg}</div>
      )}

      {/* 已裝備狀態 */}
      {(activePot || coinBoost) && (
        <div className="guest-shop-equipped">
          {activePot && <div>⚔️ 世界王藥水：{WB_POTIONS.find(p => p.id === activePot)?.name}（已裝備）</div>}
          {coinBoost  && <div>💰 金幣護符：下次打怪生效</div>}
        </div>
      )}

      <div className="guest-shop-title">🛡️ 基礎裝備</div>
      <div className="guest-shop-desc">買完後會直接裝備普通等級的新手套裝，角色頁立刻看得到。</div>
      {EQUIP_ITEMS.map(item => renderItem(item, { isActive: hasStarterEquip, disabled: hasStarterEquip, badgeColor: "#22c55e" }))}

      {/* 世界王強心針 */}
      <div className="guest-shop-title">⚔️ 世界王強心針</div>
      <div className="guest-shop-desc">購買後進入世界王出戰時自動套用，用完即消耗。</div>

      {WB_POTIONS.map(item => renderItem(item, { isEquipped: activePot === item.id }))}

      {/* 其他道具 */}
      <div className="guest-shop-title">💎 打怪加成道具</div>
      <div className="guest-shop-desc">下次打怪勝利時觸發，用完即消耗。</div>

      {MISC_ITEMS.map(item => {
        const isActive = item.id === "coin_boost" ? coinBoost && sessionStorage.getItem("guest_coin_boost") === "2"
                       : item.id === "coin_boost_big" ? coinBoost && sessionStorage.getItem("guest_coin_boost") === "3"
                       : false;
        return renderItem(item, { isActive, badgeColor: "#f59e0b" });
      })}

      {/* 提示 */}
      <div className="guest-shop-tip">
          💡 體驗模式打怪會獲得少量金幣<br />
          💡 世界王藥水同時只能裝備一瓶<br />
          💡 金幣在這次訪客連結有效期間內保留
      </div>
    </div>
  );
}
