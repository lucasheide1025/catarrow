// src/components/dungeon/DungeonChest.jsx — 地下城寶箱房間
import { useState, useEffect, useMemo } from "react";
import { confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";
import { FAMILY_COLLECTIBLES } from "../../lib/dungeonCollectibles";

export default function DungeonChest({ roomId, room, memberId, isHost }) {
  const [animPhase, setAnimPhase] = useState("entering"); // entering | opening | done
  const [confirmed, setConfirmed] = useState(false);

  const members = room?.members || {};
  const aliveIds = Object.keys(members).filter(id => members[id].alive);
  const roomConfirms = room?.roomConfirms || {};
  const dungeonMapId = room?.mapDungeonId || "";
  const family = dungeonMapId.split("_")[0] || "ghost";

  // 固定寶箱內容（首次渲染時計算）
  const chestLoot = useMemo(() => {
    const pool = FAMILY_COLLECTIBLES[family];
    if (!pool) return { coins: 0, item: null };
    const coins = 10 + Math.floor(Math.random() * 30);
    const hasItem = Math.random() < 0.4;
    const item = hasItem
      ? (Math.random() < 0.25
        ? pool.rare[Math.floor(Math.random() * pool.rare.length)]
        : pool.common[Math.floor(Math.random() * pool.common.length)])
      : null;
    return { coins, item: item ? { id: item.id, name: item.name, icon: item.icon, desc: item.desc } : null };
  }, []); // eslint-disable-line

  // 自動播放開箱動畫
  useEffect(() => {
    const t1 = setTimeout(() => setAnimPhase("opening"), 500);
    const t2 = setTimeout(() => setAnimPhase("done"), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  async function handleConfirm() {
    if (confirmed) return;
    setConfirmed(true);

    // 寫入金幣和收藏品
    const { addCoins } = await import("../../lib/db");
    const { addCollectibles } = await import("../../lib/dungeonDb");

    if (chestLoot.coins > 0) {
      addCoins(memberId, chestLoot.coins).catch(() => {});
    }
    if (chestLoot.item) {
      addCollectibles(memberId, [{ itemId: chestLoot.item.id, qty: 1 }]).catch(() => {});
    }

    await confirmNonCombatRoom(roomId, memberId, "opened");
  }

  async function handleResolve() {
    if (!isHost) return;
    await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  const allConfirmed = aliveIds.every(id => roomConfirms[id]);

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white"
      style={{ background:"linear-gradient(160deg,#0a1a0a,#1a2e1a)" }}>
      <style>{`
@keyframes c-glow { 0%,100%{filter:drop-shadow(0 0 10px rgba(251,191,36,0.4))} 50%{filter:drop-shadow(0 0 30px rgba(251,191,36,0.8))} }
@keyframes c-shine { 0%{opacity:0;transform:scale(0.3) rotate(-20deg)} 55%{opacity:1;transform:scale(1.1) rotate(5deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
@keyframes c-coin { 0%{opacity:0;transform:translateY(40px) scale(0.5)} 100%{opacity:1;transform:translateY(0) scale(1)} }
@keyframes c-item { 0%{opacity:0;transform:translateY(30px)} 100%{opacity:1;transform:translateY(0)} }
@keyframes c-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
      `}</style>

      {/* Header */}
      <div className="shrink-0 text-center py-6 border-b border-amber-500/20"
        style={{ animation: animPhase === "entering" ? "c-pulse 0.8s ease infinite" : undefined }}>
        <div className="text-5xl mb-2"
          style={{ animation: animPhase === "opening" ? "c-glow 0.5s ease infinite" : undefined }}>
          {animPhase === "opening" ? "✨" : "📦"}
        </div>
        <div className="text-2xl font-black" style={{ color:"#4ade80" }}>發現寶箱！</div>
        <div className="text-sm text-emerald-300/60 mt-1">
          {animPhase === "entering" ? "一個閃閃發亮的寶箱出現在眼前…" :
           animPhase === "opening" ? "寶箱正在打開…" :
           "寶箱已開啟！"}
        </div>
      </div>

      {/* 寶箱內容 */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 gap-6">
        {animPhase === "done" && chestLoot && (
          <>
            {/* 金幣 */}
            {chestLoot.coins > 0 && (
              <div className="text-center" style={{ animation:"c-coin 0.5s ease both" }}>
                <div className="text-5xl mb-2">🪙</div>
                <div className="text-3xl font-black" style={{ color:"#fbbf24" }}>
                  +{chestLoot.coins}
                </div>
                <div className="text-sm text-amber-300/70">金幣</div>
              </div>
            )}

            {/* 收藏品 */}
            {chestLoot.item && (
              <div className="text-center bg-white/5 border border-amber-500/30 rounded-2xl p-5 w-full max-w-xs"
                style={{ animation:"c-item 0.6s 0.3s ease both" }}>
                <div className="text-5xl mb-2" style={{ animation:"c-shine 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
                  {chestLoot.item.icon}
                </div>
                <div className="text-lg font-black text-amber-300 mb-1">
                  {chestLoot.item.name}
                </div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  {chestLoot.item.desc}
                </div>
                <div className="mt-2 text-[10px] text-purple-400 font-bold">
                  🔮 收藏品已存入圖鑑
                </div>
              </div>
            )}

            {!chestLoot.coins && !chestLoot.item && (
              <div className="text-center text-slate-500 text-lg">寶箱是空的…</div>
            )}
          </>
        )}

        {animPhase !== "done" && (
          <div className="text-center animate-pulse">
            <div className="text-8xl mb-4"
              style={animPhase === "opening" ? { animation:"c-glow 0.5s ease infinite" } : {}}>
              📦
            </div>
            <div className="text-lg text-amber-300 font-bold">
              {animPhase === "entering" ? "🔓 點擊打開" : "⚡ 喀嚓…"}
            </div>
          </div>
        )}
      </div>

      {/* 已確認成員 */}
      {Object.keys(roomConfirms).length > 0 && (
        <div className="shrink-0 px-4 pb-2">
          <div className="flex justify-center gap-2 flex-wrap">
            {Object.keys(roomConfirms).map(id => (
              <span key={id} className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                ✅ {members[id]?.name || id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-amber-500/20 space-y-3">
        {!confirmed ? (
          <button onClick={handleConfirm} disabled={animPhase !== "done"}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg disabled:opacity-40 transition-all"
            style={{
              background: animPhase === "done"
                ? "linear-gradient(90deg,#f59e0b,#eab308)"
                : "rgba(255,255,255,0.1)",
              color: animPhase === "done" ? "black" : "rgba(255,255,255,0.4)",
            }}>
            {animPhase !== "done" ? "⏳ 寶箱開啟中…" : "💰 領取寶物，繼續前進"}
          </button>
        ) : isHost && !allConfirmed ? (
          <div className="text-center text-slate-400 text-sm py-2">等待其他隊員領取寶物…</div>
        ) : isHost && allConfirmed ? (
          <button onClick={handleResolve}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg"
            style={{ background:"linear-gradient(90deg,#22c55e,#16a34a)", color:"white" }}>
            🗺️ 繼續探索
          </button>
        ) : (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已領取，等待房主繼續</div>
        )}

        {isHost && confirmed && !allConfirmed && (
          <button onClick={handleResolve}
            className="w-full py-2 rounded-xl text-amber-400 text-xs font-bold bg-amber-900/30 border border-amber-500/30">
            👑 強制繼續（{Object.keys(roomConfirms).length}/{aliveIds.length} 已領取）
          </button>
        )}
      </div>
    </div>
  );
}
