// src/components/dungeon/DungeonShop.jsx — 地下城商店
import { useState } from "react";
import { purchaseDungeonItem } from "../../lib/dungeonDb";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function DungeonShop({ roomId, room, memberId, memberData, onDone, isHost }) {
  const [loading, setLoading] = useState(false);
  const [bought, setBought]   = useState([]);

  const shopItems     = room?.shopItems     || [];
  const shopPurchases = room?.shopPurchases || {};
  const myPurchases   = shopPurchases[memberId] || [];
  const coins         = memberData?.coins ?? 0;

  async function handleBuy(item) {
    if (loading) return;
    if (myPurchases.includes(item.id)) return;
    if (coins < item.cost) return;
    setLoading(true);
    await purchaseDungeonItem(roomId, memberId, item, memberData);
    // 扣除金幣（addCoins 傳負數即扣除）
    const { addCoins } = await import("../../lib/db");
    await addCoins(memberId, -item.cost).catch(() => {});
    setBought(b => [...b, item.id]);
    setLoading(false);
  }

  async function handleReady() {
    if (!isHost) return;
    await updateDoc(doc(db, "dungeonRooms", roomId), { status:"floor_transition" });
  }

  const effectLabel = (item) => {
    switch (item.effect) {
      case "hp_restore":     return `HP +${Math.round(item.value*100)}%`;
      case "atk_mult":       return `ATK ×${item.value}`;
      case "def_mult":       return `DEF ×${item.value}`;
      case "contract_reset": return "重抽任務";
      case "revival":        return "復活一次";
      default:               return "";
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="shrink-0 text-center py-5 border-b border-white/10">
        <div className="text-3xl mb-1">🛒</div>
        <div className="text-xl font-black">補給商店</div>
        <div className="text-sm text-slate-400 mt-0.5">金幣：<span className="text-amber-400 font-bold">{coins}</span></div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {shopItems.map(item => {
          const alreadyBought = myPurchases.includes(item.id) || bought.includes(item.id);
          const canAfford     = coins >= item.cost;
          return (
            <div key={item.id}
              className={`flex items-center gap-4 rounded-2xl px-4 py-3 border ${alreadyBought ? "bg-white/5 border-white/5 opacity-50" : "bg-white/8 border-white/15"}`}>
              <span className="text-3xl">{item.icon}</span>
              <div className="flex-1">
                <div className="font-bold">{item.name}</div>
                <div className="text-xs text-slate-400">{item.desc}</div>
                <div className="text-xs text-emerald-400 mt-0.5">{effectLabel(item)}</div>
              </div>
              <button onClick={() => handleBuy(item)}
                disabled={loading || alreadyBought || !canAfford}
                className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${alreadyBought ? "bg-slate-700 text-slate-500" : canAfford ? "bg-amber-500 text-white active:scale-95" : "bg-slate-700 text-slate-500"}`}>
                {alreadyBought ? "已購" : `💰${item.cost}`}
              </button>
            </div>
          );
        })}
        {shopItems.length === 0 && (
          <div className="text-center text-slate-500 py-10">商店無商品</div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-white/10 space-y-2">
        <button onClick={onDone}
          className="w-full py-3 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
          完成購物
        </button>
        {isHost && (
          <button onClick={handleReady}
            className="w-full py-2 rounded-xl text-slate-400 text-sm">
            房主：跳過商店繼續
          </button>
        )}
      </div>
    </div>
  );
}
