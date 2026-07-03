// src/components/dungeon/DungeonExcavationTab.jsx — 地下城發掘分頁
// 顯示發掘進度條、今日狀態、稀有度預測，100% 時可揭曉出發

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { StatBar, SectionHeader } from "../shared/Widgets";
import { revealExcavation } from "../../lib/dungeonExcavation";

const FAMILY_LABEL = {
  ghost:     { emoji:"👻", label:"幽冥系" },
  mountain:  { emoji:"⛰️", label:"山嶺系" },
  insect:    { emoji:"🦋", label:"昆蟲系" },
  workplace: { emoji:"💼", label:"職場系" },
  exam:      { emoji:"📝", label:"考試系" },
  temple:    { emoji:"🏛️", label:"神廟系" },
};

const TIER_LABEL = {
  1: { label:"普通級", icon:"🌱", color:"#4ade80" },
  2: { label:"稀有級", icon:"🔵", color:"#60a5fa" },
  3: { label:"精英級", icon:"⚔️", color:"#a78bfa" },
  4: { label:"強悍級", icon:"🔥", color:"#f97316" },
  5: { label:"頭目級", icon:"👑", color:"#ef4444" },
  6: { label:"神話級", icon:"💀", color:"#dc2626" },
};

export default function DungeonExcavationTab({ profile }) {
  const myId = profile?.id;
  const [excavation, setExcavation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [pendingReveal, setPendingReveal] = useState(null);
  const [upgradeBusy, setUpgradeBusy] = useState(false);

  // 訂閱 member doc 即時取得 dungeonExcavation
  useEffect(() => {
    if (!myId) return;
    const unsub = onSnapshot(doc(db, "members", myId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const ex = data.dungeonExcavation || null;
      setExcavation(ex);
      // 只在本地沒有 pendingReveal 時才從 Firestore 同步（避免蓋掉強化後的本地值）
      if (ex?.pendingReveal) {
        setPendingReveal(prev => prev || ex.pendingReveal);
      }
    });
    return unsub;
  }, [myId]);

  const progress = excavation?.progress || 0;
  const dailyArrows = excavation?.dailyArrowsUsed || 0;
  const isComplete = progress >= 100;

  // 稀有度預測權重
  let weights = { common: 60, rare: 30, hidden: 10 };
  if (dailyArrows >= 30) { weights.common -= 10; weights.rare += 10; }
  if (dailyArrows >= 60) { weights.rare -= 5; weights.hidden += 15; }
  if (dailyArrows >= 90) { weights.rare -= 5; weights.hidden += 10; }

  const totalW = Object.values(weights).reduce((s, v) => s + v, 0);
  const commonPct = Math.round((weights.common / totalW) * 100);
  const rarePct = Math.round((weights.rare / totalW) * 100);
  const hiddenPct = Math.round((weights.hidden / totalW) * 100);

  async function handleReveal() {
    if (!myId || loading) return;
    setLoading(true);
    const result = await revealExcavation(myId);
    if (result) {
      setPendingReveal(result);
      setRevealOpen(true);
    }
    setLoading(false);
  }

  function handleAbandon() {
    setPendingReveal(null);
    setRevealOpen(false);
    import("../../lib/dungeonExcavation").then(m => m.abandonExcavation(myId));
  }

  function handleCloseOverlay() {
    setRevealOpen(false);
  }

  async function handleUpgrade() {
    if (!myId || upgradeBusy) return;
    setUpgradeBusy(true);
    const m = await import("../../lib/dungeonExcavation");
    const res = await m.upgradeExcavationDifficulty(myId);
    if (res.ok) {
      setPendingReveal(prev => ({ ...prev, difficulty: res.newDifficulty }));
    } else {
      alert(res.reason || "強化失敗");
    }
    setUpgradeBusy(false);
  }

  function handleStartExpedition() {
    if (!pendingReveal) return;
    setRevealOpen(false);
    // 由 Phase D 的 DungeonExpedition 元件接管路由
    // 暫用 CustomEvent 通知 DungeonLobby
    window.dispatchEvent(new CustomEvent("expedition-start", {
      detail: {
        family: pendingReveal.family,
        difficulty: pendingReveal.difficulty,
        isHidden: pendingReveal.isHidden,
      },
    }));
  }

  return (
    <div className="space-y-4">
      {/* 發掘進度卡 */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(30,41,59,0.95) 50%)",
          border: "1px solid rgba(245,158,11,0.2)",
        }}>
        <SectionHeader icon="⛏️" title="發掘進度" />

        {/* 進度條 */}
        <div className="mt-3">
          <StatBar
            value={Math.min(progress, 100)}
            max={100}
            color={isComplete ? "#f59e0b" : "#4ade80"}
            label={`發掘進度 ${Math.round(progress)}%`}
            height={12}
          />
        </div>

        {/* 進度來源明細 */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>📅 每日登入</span>
            <span style={{ color: "var(--text-primary)" }}>+10</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>✅ 報到</span>
            <span style={{ color: "var(--text-primary)" }}>+10</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>🏹 今日練箭</span>
            <span style={{ color: "var(--text-primary)" }}>
              +{Math.round(dailyArrows * 0.3 * 10) / 10}（{dailyArrows} 箭）
            </span>
          </div>
        </div>

        {/* 稀有度預測 */}
        {!isComplete && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="text-xs font-bold mb-2" style={{ color: "var(--text-secondary)" }}>🎲 發現預測</div>
            <div className="flex gap-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-full"
                style={{ background:"rgba(74,222,128,0.15)", color:"#4ade80" }}>
                普通 {commonPct}%
              </span>
              <span className="px-2 py-0.5 rounded-full"
                style={{ background:"rgba(96,165,250,0.15)", color:"#60a5fa" }}>
                稀有 {rarePct}%
              </span>
              <span className="px-2 py-0.5 rounded-full"
                style={{ background:"rgba(251,191,36,0.15)", color:"#fbbf24" }}>
                隱藏 {hiddenPct}%
              </span>
            </div>
            <div className="mt-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
              💡 今日再射 {Math.max(1, 30 - dailyArrows)} 箭可提升稀有度機率
            </div>
          </div>
        )}

        {/* 100% 出發按鈕 */}
        {isComplete && !pendingReveal && (
          <button onClick={handleReveal} disabled={loading}
            className="w-full mt-4 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg active:scale-95 transition-all disabled:opacity-40">
            {loading ? "揭曉中…" : "✨ 出發！"}
          </button>
        )}
      </div>

      {/* 揭曉 Overlay */}
      {pendingReveal && revealOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center"
          onClick={handleCloseOverlay}
          style={{
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
          }}>
          <div
            className="animate-bounce-in text-center px-6 max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-6xl mb-4">
              {pendingReveal.isHidden ? "🎁" : (FAMILY_LABEL[pendingReveal.family]?.emoji || "🏰")}
            </div>
            <div className="text-2xl font-black text-white mb-1">
              {pendingReveal.isHidden ? "✨ 隱藏地下城！" : "🏰 地下城揭曉！"}
            </div>
            <div className="text-lg font-bold" style={{ color: "var(--text-secondary)" }}>
              {pendingReveal.isHidden ? "🎁 寶藏地下城" : (FAMILY_LABEL[pendingReveal.family]?.label || "未知族系")}
            </div>
            <div className="mt-2">
              <span className="inline-block px-3 py-1 rounded-full text-sm font-black"
                style={{
                  background: `${(TIER_LABEL[pendingReveal.difficulty]?.color || "#94a3b8")}33`,
                  color: TIER_LABEL[pendingReveal.difficulty]?.color || "#94a3b8",
                  border: `1px solid ${(TIER_LABEL[pendingReveal.difficulty]?.color || "#94a3b8")}55`,
                }}>
                {TIER_LABEL[pendingReveal.difficulty]?.icon || ""} {TIER_LABEL[pendingReveal.difficulty]?.label || `Tier ${pendingReveal.difficulty}`}
              </span>
            </div>

            {/* 金幣強化 */}
            {pendingReveal.difficulty < 6 && (
              <button onClick={handleUpgrade} disabled={upgradeBusy}
                className="mt-5 w-full py-3 rounded-xl font-black text-sm border transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: "rgba(251,191,36,0.12)",
                  borderColor: "rgba(251,191,36,0.3)",
                  color: "#fbbf24",
                }}>
                {upgradeBusy ? "強化中…" : "🔧 花費隨機金幣強化一級（500~2000）"}
              </button>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={handleAbandon}
                className="flex-1 py-3 rounded-xl text-sm font-bold border border-white/20"
                style={{ color: "var(--text-secondary)" }}>
                ❌ 放棄重新挖掘
              </button>
              <button onClick={handleStartExpedition}
                className="flex-1 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg active:scale-95 transition-all">
                ⚔️ 開始探索
              </button>
            </div>

            {/* 關閉按鈕 */}
            <button onClick={handleCloseOverlay}
              className="mt-4 text-xs opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: "var(--text-muted)" }}>
              稍後決定
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-in {
          0% { opacity:0; transform:scale(0.5); }
          60% { transform:scale(1.1); }
          100% { opacity:1; transform:scale(1); }
        }
        .animate-bounce-in { animation: bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
      `}</style>
    </div>
  );
}
