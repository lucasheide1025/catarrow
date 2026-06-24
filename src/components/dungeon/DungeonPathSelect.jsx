// src/components/dungeon/DungeonPathSelect.jsx — A/B 路線選擇
import { useState } from "react";
import { selectDungeonPath } from "../../lib/dungeonDb";

export default function DungeonPathSelect({ roomId, room, isHost }) {
  const [loading, setLoading] = useState(false);
  const pathOptions = room?.pathOptions || {};

  async function handleSelect(key) {
    if (!isHost || loading) return;
    setLoading(true);
    await selectDungeonPath(roomId, key, pathOptions);
    setLoading(false);
  }

  const currentFloor = room?.currentFloor || 1;
  const totalFloors  = room?.totalFloors  || 7;

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="shrink-0 text-center py-6 border-b border-white/10">
        <div className="text-3xl mb-1">🗺️</div>
        <div className="text-xl font-black">選擇路線</div>
        <div className="text-sm text-slate-400 mt-0.5">第 {currentFloor} → {currentFloor + 1} 層 / 共 {totalFloors} 層</div>
      </div>

      {/* Path options */}
      <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col justify-center gap-4">
        {["A","B"].map(key => {
          const p = pathOptions[key];
          if (!p) return null;
          const colorMap = {
            shop_normal:  "from-emerald-500 to-teal-600",
            event_normal: "from-purple-500 to-indigo-600",
            direct:       "from-slate-500 to-slate-700",
            elite:        "from-rose-600 to-red-800",
          };
          const grad = colorMap[p.id] || "from-slate-600 to-slate-800";
          return (
            <button key={key} onClick={() => handleSelect(key)}
              disabled={!isHost || loading}
              className={`relative w-full rounded-2xl p-6 text-left shadow-xl border-2 transition-all ${isHost ? "cursor-pointer active:scale-95" : "cursor-default opacity-80"} border-white/10 bg-gradient-to-br ${grad}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{p.icon}</span>
                <div>
                  <div className="font-black text-lg">{key} 路線：{p.label}</div>
                  <div className="text-sm text-white/70">{p.desc}</div>
                </div>
              </div>
              {p.eliteBoost > 1 && (
                <div className="text-xs bg-white/15 rounded-full px-3 py-0.5 inline-block text-rose-200 font-semibold mt-1">
                  ⚠️ 精英怪 HP ×{p.eliteBoost}
                </div>
              )}
              {p.preContent === "shop"  && <div className="text-xs bg-white/15 rounded-full px-3 py-0.5 inline-block text-emerald-200 font-semibold mt-1">先開商店再戰鬥</div>}
              {p.preContent === "event" && <div className="text-xs bg-white/15 rounded-full px-3 py-0.5 inline-block text-purple-200 font-semibold mt-1">遭遇隨機事件</div>}
            </button>
          );
        })}

        {!isHost && (
          <div className="text-center text-slate-400 text-sm mt-4">等待房主選擇路線…</div>
        )}
      </div>
    </div>
  );
}
