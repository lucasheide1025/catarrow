// src/components/dungeon/DungeonShop.jsx — 地下城商店（擴充版 + 全員確認流程）
import { useState, useMemo } from "react";
import { purchaseDungeonItem, confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";

// 擴充商店商品
const SHOP_ITEM_META = {
  hp_potion:       { name:"回復藥",      icon:"🧪", desc:"立即回復 30% 最大血量",          cost:50,  effect:"hp_restore",     value:0.3  },
  hp_max_boost:    { name:"生命上限符",   icon:"💚", desc:"永久提升 30% 最大血量（僅此局）", cost:100, effect:"hp_max_boost",   value:0.3  },
  atk_boost:       { name:"ATK 提升符",   icon:"⚔️", desc:"本次地下城 ATK ×1.2",            cost:80,  effect:"atk_mult",       value:1.2  },
  def_boost:       { name:"DEF 提升符",   icon:"🛡️", desc:"本次地下城 DEF ×1.2",            cost:80,  effect:"def_mult",       value:1.2  },
  atk_large:       { name:"ATK 狂戰符",   icon:"🔥", desc:"本次地下城 ATK ×1.5",            cost:150, effect:"atk_mult",       value:1.5  },
  def_large:       { name:"DEF 鐵壁符",   icon:"🏰", desc:"本次地下城 DEF ×1.5",            cost:150, effect:"def_mult",       value:1.5  },
  revival:         { name:"復活符",       icon:"💫", desc:"下次陣亡自動復活（30% HP）",     cost:100, effect:"revival"                   },
  revival_front:   { name:"前衛復活藥",   icon:"💊", desc:"復活一名倒地前衛（轉回前衛+50%HP）", cost:120, effect:"revival_front"             },
};

export default function DungeonShop({ roomId, room, memberId, memberData, isHost }) {
  const [loading, setLoading] = useState(false);
  const [bought, setBought]   = useState([]);
  const [confirmed, setConfirmed] = useState(false);

  const shopItems     = room?.shopItems     || [];
  const shopPurchases = room?.shopPurchases || {};
  const myPurchases   = shopPurchases[memberId] || [];
  const coins         = memberData?.coins ?? 0;
  const members       = room?.members || {};
  const aliveIds      = Object.keys(members).filter(id => members[id].alive);
  const roomConfirms  = room?.roomConfirms || {};

  // 完整商品資訊（含 meta）
  const fullItems = useMemo(() => shopItems.map(id => ({ id, ...(SHOP_ITEM_META[id] || { name:id, icon:"❓", desc:"未知商品", cost:999, effect:null }) })), [shopItems]);

  async function handleBuy(item) {
    if (loading) return;
    const isPotion = item.id === "hp_potion";
    if (!isPotion && (myPurchases.includes(item.id) || bought.includes(item.id))) return;
    if (coins < item.cost) return;
    setLoading(true);
    await purchaseDungeonItem(roomId, memberId, item, memberData);
    const { addCoins } = await import("../../lib/db");
    await addCoins(memberId, -item.cost).catch(() => {});
    // hp_potion 不加入 bought，允許重複購買
    if (!isPotion) setBought(b => [...b, item.id]);
    setLoading(false);
  }

  async function handleConfirm() {
    if (confirmed) return;
    setConfirmed(true);
    await confirmNonCombatRoom(roomId, memberId, "done");
  }

  async function handleResolve() {
    if (!isHost) return;
    // 結算前衛復活藥：找出所有 role="rear" 的成員，由房主決定
    const choices = room?.roomChoices || {};
    for (const [id, choice] of Object.entries(choices)) {
      if (choice === "revive_front") {
        const m = members[id];
        if (m && m.role === "rear") {
          const { updateDoc, doc } = await import("firebase/firestore");
          const { db } = await import("../../lib/firebase");
          await updateDoc(doc(db, "dungeonRooms", roomId), {
            [`members.${id}.role`]: "front",
            [`members.${id}.hp`]: Math.round((m.maxHP || 100) * 0.5),
          });
        }
      }
    }
    await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  const allConfirmed = aliveIds.every(id => roomConfirms[id]);
  const effectLabel = (item) => {
    switch (item.effect) {
      case "hp_restore":     return `❤️ HP +${Math.round(item.value*100)}%`;
      case "hp_max_boost":   return `💚 HP上限 +${Math.round(item.value*100)}%`;
      case "atk_mult":       return `⚔️ ATK ×${item.value}`;
      case "def_mult":       return `🛡️ DEF ×${item.value}`;
      case "revival":        return "💫 復活一次";
      case "revival_front":  return "💊 復活前衛";
      default:               return "";
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white"
      style={{ background:"linear-gradient(160deg,#0c1929,#0f2942)" }}>

      {/* Header */}
      <div className="shrink-0 text-center py-5 border-b border-blue-500/20">
        <div className="text-4xl mb-1">🛒</div>
        <div className="text-xl font-black" style={{ color:"#60a5fa" }}>補給商店</div>
        <div className="text-sm text-slate-400 mt-0.5">金幣：<span className="text-amber-400 font-bold">{coins}</span></div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {fullItems.map(item => {
          const isPotion      = item.id === "hp_potion";
          const alreadyBought = !isPotion && (myPurchases.includes(item.id) || bought.includes(item.id));
          const canAfford     = coins >= item.cost;
          return (
            <div key={item.id}
              className={`flex items-center gap-4 rounded-2xl px-4 py-3 border transition-all ${
                alreadyBought
                  ? "bg-white/5 border-white/5 opacity-50"
                  : canAfford
                    ? "bg-white/8 border-blue-500/20 hover:border-blue-400/40"
                    : "bg-white/5 border-white/5 opacity-60"
              }`}>
              <span className="text-3xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{item.name}</div>
                <div className="text-xs text-slate-400 truncate">{item.desc}</div>
                <div className="text-xs text-emerald-400 mt-0.5 font-semibold">{effectLabel(item)}</div>
              </div>
              <button onClick={() => handleBuy(item)}
                disabled={loading || alreadyBought || !canAfford}
                className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  alreadyBought
                    ? "bg-slate-700 text-slate-500"
                    : canAfford
                      ? "bg-amber-500 hover:bg-amber-400 text-black active:scale-95"
                      : "bg-slate-700 text-slate-500"
                }`}>
                {alreadyBought ? "✅" : `💰${item.cost}`}
              </button>
            </div>
          );
        })}
        {fullItems.length === 0 && (
          <div className="text-center text-slate-500 py-10">商店無商品</div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-blue-500/20 space-y-3">
        {/* 已購/確認成員 */}
        <div className="flex justify-center gap-2 flex-wrap">
          {Object.keys(roomConfirms).map(id => (
            <span key={id} className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
              ✅ {members[id]?.name || id}
            </span>
          ))}
        </div>

        {!confirmed ? (
          <button onClick={handleConfirm}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg transition-all active:scale-[0.98]"
            style={{
              background:"linear-gradient(90deg,#60a5fa,#3b82f6)",
              color:"white",
            }}>
            👍 確認購物，準備出發
          </button>
        ) : isHost && !allConfirmed ? (
          <div className="text-center text-slate-400 text-sm py-2">等待其他隊員確認購物…</div>
        ) : isHost && allConfirmed ? (
          <button onClick={handleResolve}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg"
            style={{ background:"linear-gradient(90deg,#22c55e,#16a34a)", color:"white" }}>
            🗺️ 繼續探索
          </button>
        ) : (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已確認，等待房主繼續</div>
        )}

        {/* 房主強制結算 */}
        {isHost && confirmed && !allConfirmed && (
          <button onClick={handleResolve}
            className="w-full py-2 rounded-xl text-amber-400 text-xs font-bold bg-amber-900/30 border border-amber-500/30">
            👑 強制繼續（{Object.keys(roomConfirms).length}/{aliveIds.length} 已確認）
          </button>
        )}
      </div>
    </div>
  );
}
