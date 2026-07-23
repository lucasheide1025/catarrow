// src/components/dungeon/DungeonExcavationTab.jsx — 地下城發掘分頁
// 三種地下城來源：① 定時自動生成 ② 練箭/報到挖掘 ③ 世界王卷軸

import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { StatBar } from "../shared/Widgets";
import {
  revealExcavation, saveExcavation,
  checkAutoDigStatus, claimAutoDig,
  initAutoDigTimer, resetAutoDigTimer,
  getTierProbabilities,
  downgradeExcavationDifficulty,
  upgradeExcavationDifficulty,
  useDungeonScroll,
  assignDigCat,
  revealCatExcavation,
  CAT_DIG_SPECIALTIES,
  MAX_SAVED_DUNGEONS,
} from "../../lib/dungeonExcavation";
import { getDigSpeech } from "../cat/catSpeeches";
import { getPendingArrowOperationCount, flushPendingArrowProgress } from "../../lib/db";

// 待同步箭數橫幅：pending>0 才顯示;點擊立即重試同步（挖掘/終身箭數卡住的救援入口）
function PendingArrowSyncBanner({ myId }) {
  const [pending, setPending] = useState(() => getPendingArrowOperationCount(myId));
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setPending(getPendingArrowOperationCount(myId)), 4000);
    return () => clearInterval(timer);
  }, [myId]);
  if (!pending) return null;
  return (
    <button disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await flushPendingArrowProgress(myId).catch(error => ({ lastError: error?.message || String(error), pending: getPendingArrowOperationCount(myId) }));
        setPending(getPendingArrowOperationCount(myId));
        setLastError(result?.pending > 0 ? (result?.lastError || (result?.blocked ? "成本防護暫停中" : "")) : "");
        setBusy(false);
      }}
      className="w-full rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-left active:scale-95">
      <div className="text-xs font-black text-amber-300">⚠️ 有 {pending} 回合箭數尚未同步（挖掘進度可能暫停累積）</div>
      <div className="text-[10px] text-amber-200/70 mt-0.5">{busy ? "同步中…" : "點擊立即重試同步"}</div>
      {lastError && <div className="text-[10px] text-rose-300 mt-1">同步失敗原因：{lastError}（截圖給教練）</div>}
    </button>
  );
}

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
  3: { label:"精英級", icon:"⚔️", color:"#8b5cf6" },
  4: { label:"強悍級", icon:"🔥", color:"#f97316" },
  5: { label:"頭目級", icon:"💀", color:"#ef4444" },
  6: { label:"神話級", icon:"👑", color:"#fbbf24" },
};

/**
 * 格式化剩餘時間（毫秒 → 天時分）
 */
function fmtRemaining(ms) {
  if (ms <= 0) return "即將完成";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}天`);
  if (h > 0) parts.push(`${h}小時`);
  parts.push(`${m}分鐘`);
  return parts.join("");
}

export default function DungeonExcavationTab({ profile }) {
  const myId = profile?.id;
  const [excavation, setExcavation] = useState(null);
  const [loading, setLoading] = useState(false);

  // 揭曉 overlay 狀態
  const [pendingReveal, setPendingReveal] = useState(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // 自動挖掘狀態
  const [autoDigStatus, setAutoDigStatus] = useState({ ready: false, remainingMs: 0 });
  const autoDigTimerRef = useRef(null);

  // 卷軸使用狀態
  const [scrollResult, setScrollResult] = useState(null);
  const [scrollBusy, setScrollBusy] = useState(false);

  // 訂閱 member doc
  useEffect(() => {
    if (!myId) return;
    const unsub = onSnapshot(doc(db, "members", myId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const ex = data.dungeonExcavation || null;
      setExcavation(ex);
      // 更新自動挖掘狀態
      setAutoDigStatus(checkAutoDigStatus(ex));
      // 同步 pendingReveal
      if (ex?.pendingReveal) {
        setPendingReveal(prev => prev || ex.pendingReveal);
        setRevealOpen(true);
      }
    });
    return unsub;
  }, [myId]);

  // 初始化自動挖掘計時器
  useEffect(() => {
    if (!myId) return;
    initAutoDigTimer(myId);
  }, [myId]);

  // 自動挖掘倒數計時器
  useEffect(() => {
    if (autoDigStatus.ready) { autoDigTimerRef.current && clearInterval(autoDigTimerRef.current); return; }
    autoDigTimerRef.current = setInterval(() => {
      setAutoDigStatus(prev => {
        if (prev.ready) { clearInterval(autoDigTimerRef.current); return prev; }
        const newMs = prev.remainingMs - 1000;
        if (newMs <= 0) return { ready: true, remainingMs: 0 };
        return { ...prev, remainingMs: newMs };
      });
    }, 1000);
    return () => clearInterval(autoDigTimerRef.current);
  }, [autoDigStatus.ready]);

  const progress = excavation?.progress || 0;
  const dailyArrows = excavation?.dailyArrowsUsed || 0;
  const isComplete = progress >= 100;
  const savedCount = excavation?.savedDungeons?.length || 0;
  const storageFull = savedCount >= MAX_SAVED_DUNGEONS;
  const scrolls = excavation?.scrolls || 0;
  const canUseScroll = scrolls > 0 && !storageFull;

  // T1~T6 機率
  const tierProbs = getTierProbabilities(dailyArrows);
  const maxTier = Math.min(6, 1 + Math.floor(dailyArrows / 30));

  // ── 手動揭曉 ──
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
    const res = await upgradeExcavationDifficulty(myId);
    if (res.ok) {
      setPendingReveal(prev => ({ ...prev, difficulty: res.newDifficulty }));
    } else {
      alert(res.reason || "強化失敗");
    }
    setUpgradeBusy(false);
  }

  async function handleDowngrade() {
    if (!myId || upgradeBusy) return;
    setUpgradeBusy(true);
    const res = await downgradeExcavationDifficulty(myId);
    if (res.ok) {
      setPendingReveal(prev => ({ ...prev, difficulty: res.newDifficulty }));
    } else {
      alert(res.reason || "降級失敗");
    }
    setUpgradeBusy(false);
  }

  async function handleSaveToStorage() {
    if (!myId || !pendingReveal) return;
    setSaveLoading(true);
    const res = await saveExcavation(myId);
    if (res.ok) {
      setPendingReveal(null);
      setRevealOpen(false);
      setSaveDone(true);
      setTimeout(() => setSaveDone(false), 2500);
    } else {
      alert(res.reason);
    }
    setSaveLoading(false);
  }

  // ── 自動挖掘領取 ──
  async function handleClaimAutoDig() {
    if (!myId || loading) return;
    setLoading(true);
    const res = await claimAutoDig(myId);
    if (res.ok) {
      setPendingReveal(res.dungeon);
      setRevealOpen(true);
      setAutoDigStatus({ ready: false, remainingMs: 0 });
    } else {
      alert(res.reason || "領取失敗");
    }
    setLoading(false);
  }

  // ── 使用卷軸 ──
  async function handleUseScroll() {
    if (!myId || scrollBusy || !canUseScroll) return;
    setScrollBusy(true);
    const res = await useDungeonScroll(myId);
    if (res.ok) {
      setScrollResult(res.dungeon);
      setTimeout(() => setScrollResult(null), 3000);
    } else {
      alert(res.reason);
    }
    setScrollBusy(false);
  }

  // 貓貓陪練狀態
  const assignedCatId = excavation?.assignedCatId || null;
  const currentCatSpec = CAT_DIG_SPECIALTIES[assignedCatId] || null;
  const [catSpeech, setCatSpeech] = useState("");
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [assigningCat, setAssigningCat] = useState(false);

  // 定時輪播貓貓語錄
  useEffect(() => {
    if (!assignedCatId) { setCatSpeech(""); return; }
    setCatSpeech(getDigSpeech(assignedCatId));
    const speechTimer = setInterval(() => {
      setCatSpeech(getDigSpeech(assignedCatId));
    }, 12000);
    return () => clearInterval(speechTimer);
  }, [assignedCatId]);

  async function handleSelectCat(catId) {
    if (!myId || assigningCat) return;
    setAssigningCat(true);
    const res = await assignDigCat(myId, catId);
    if (res.ok) {
      setShowCatPicker(false);
    } else {
      alert(res.reason || "指派失敗");
    }
    setAssigningCat(false);
  }

  const catDigProgress = Math.min(100, Math.round(excavation?.catDigProgress || 0));
  const isCatDigComplete = catDigProgress >= 100;

  async function handleRevealCat() {
    if (!myId || loading) return;
    setLoading(true);
    const result = await revealCatExcavation(myId);
    if (result) {
      setPendingReveal(result);
      setRevealOpen(true);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4 pb-4">

      {/* ⚠️ 待同步箭數（同步卡住時可見+手動重試;正常時不顯示） */}
      <PendingArrowSyncBanner myId={myId} />

      {/* 🐾 貓貓陪練與專長區塊 */}
      <div className="rounded-2xl p-4 relative overflow-hidden bg-gradient-to-r from-purple-950/80 to-slate-900/90 border border-purple-500/30 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🐾</span>
            <div>
              <div className="text-base font-black text-purple-200">地下城貓貓隊長挖掘</div>
              <div className="text-[10px] text-purple-300/70">貓貓擁有獨立挖掘進度條，練箭與時間均可推進</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCatPicker(true)}
            className="px-3 py-1.5 rounded-xl bg-purple-600/40 hover:bg-purple-600/60 border border-purple-400/40 text-xs font-bold text-purple-200 transition-all active:scale-95"
          >
            {assignedCatId ? "更換隊長" : "+ 指派隊長"}
          </button>
        </div>

        {assignedCatId && currentCatSpec ? (
          <div className="mt-3 space-y-3 bg-purple-900/30 rounded-xl p-3 border border-purple-500/20">
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <img
                  src={`/cats/portraits/${assignedCatId}.webp`}
                  alt={currentCatSpec.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-purple-400/50 shadow-md animate-bounce"
                  style={{ animationDuration: "3s" }}
                />
                <span className="absolute -bottom-1 -right-1 text-sm">{currentCatSpec.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-purple-100">{currentCatSpec.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/30 text-purple-300 border border-purple-400/30">
                    {currentCatSpec.label}
                  </span>
                </div>
                <div className="text-xs text-purple-200/80 mt-0.5">{currentCatSpec.desc}</div>
                
                {/* 貓貓台詞氣泡 */}
                {catSpeech && (
                  <div className="mt-2.5 relative bg-purple-950/90 text-purple-100 px-3 py-1.5 rounded-xl text-xs font-bold border border-purple-400/40 shadow-inner animate-pulse">
                    <span className="mr-1">💬</span>「{catSpeech}」
                  </div>
                )}
              </div>
            </div>

            {/* 🐾 貓貓獨立挖掘進度條 */}
            <div className="pt-2 border-t border-purple-500/20">
              <StatBar
                value={catDigProgress}
                max={100}
                color={isCatDigComplete ? "#c084fc" : "#a855f7"}
                label={`🐾 ${currentCatSpec.name} 的獨立挖掘進度 ${catDigProgress}%`}
                height={10}
              />
              <div className="flex items-center justify-between text-[10px] text-purple-300/70 mt-1">
                <span>每箭陪伴 +0.5% · 時間自動推進</span>
                <span>{isCatDigComplete ? "已解鎖專屬地下城！" : "挖掘中…"}</span>
              </div>
              {isCatDigComplete && !pendingReveal && !storageFull && (
                <button
                  type="button"
                  onClick={handleRevealCat}
                  disabled={loading}
                  className="w-full mt-2.5 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg active:scale-95 transition-all disabled:opacity-40"
                >
                  {loading ? "揭曉中…" : `🎁 領取 ${currentCatSpec.name} 挖掘的地下城！`}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 p-3 rounded-xl bg-purple-900/10 border border-dashed border-purple-400/30 text-center text-xs text-purple-300/60">
            目前尚未指派貓貓隊長。指派後貓貓將擁有「獨立挖掘進度條」，時間與射箭陪伴都會讓牠為你獨自挖掘地下城！
          </div>
        )}
      </div>

      {/* 🐾 選擇貓貓 Modal */}
      {showCatPicker && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowCatPicker(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>🐾</span> 選擇地下城陪練貓貓
              </h3>
              <button
                type="button"
                onClick={() => setShowCatPicker(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {Object.values(CAT_DIG_SPECIALTIES).map(cat => {
                const isSelected = assignedCatId === cat.id;
                // 檢查是否正處於遠征中
                const activeExpeditions = profile?.expeditions || {};
                const inExpedition = Object.values(activeExpeditions).some(e => e && e.catId === cat.id);
                // 檢查是否正在貓貓村建築物工作
                const villageWorkers = profile?.village?.workers || {};
                const inVillage = Object.values(villageWorkers).includes(cat.id);
                const isBlocked = inExpedition || inVillage;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    disabled={assigningCat || isBlocked}
                    onClick={() => handleSelectCat(cat.id)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "bg-purple-900/60 border-purple-400 text-white ring-2 ring-purple-400/40"
                        : isBlocked
                        ? "bg-slate-950/40 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed"
                        : "bg-slate-950/70 border-slate-800 text-slate-200 hover:bg-purple-950/40 hover:border-purple-500/30"
                    }`}
                  >
                    <img
                      src={`/cats/portraits/${cat.id}.webp`}
                      alt={cat.name}
                      className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white">{cat.name}</span>
                        <span className="text-xs">{cat.icon}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-purple-300">
                          {cat.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{cat.desc}</div>
                      {inExpedition && (
                        <div className="text-[10px] font-bold text-amber-400 mt-1">
                          ⚔️ 正在遠征中（無法同時挖掘）
                        </div>
                      )}
                      {inVillage && (
                        <div className="text-[10px] font-bold text-emerald-400 mt-1">
                          🏘️ 正在貓貓村工作（無法同時挖掘）
                        </div>
                      )}
                    </div>
                    {isSelected && <span className="text-purple-400 font-bold text-sm">✓ 使用中</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ ① 定時生成 ═══════════ */}
      <div className={`rounded-2xl p-4 relative overflow-hidden transition-all duration-500 ${
        autoDigStatus.ready
          ? "bg-gradient-to-br from-amber-950/90 via-slate-900 to-amber-900/60 border-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.35)] animate-pulse"
          : "bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-900 border border-indigo-500/20 shadow-xl backdrop-blur-md"
      }`}>
        {/* 背景微光粒子動畫裝飾 */}
        {autoDigStatus.ready && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.25),transparent_70%)] pointer-events-none" />
        )}

        <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`text-3xl transition-transform duration-500 ${autoDigStatus.ready ? "scale-125 animate-bounce" : "animate-spin-slow"}`}>
              {autoDigStatus.ready ? "🎁" : "⏳"}
            </div>
            <div>
              <div className="text-base font-black text-white flex items-center gap-2">
                <span>定時自動探測</span>
                {autoDigStatus.ready && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 animate-pulse">
                    探測完成！
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                系統每 24~144 小時自動挖掘揭露神秘地下城
              </div>
            </div>
          </div>
        </div>

        {autoDigStatus.ready ? (
          <button onClick={handleClaimAutoDig} disabled={loading}
            className="w-full py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 relative z-10 flex items-center justify-center gap-2">
            <span className="text-lg">✨</span>
            <span>{loading ? "探索中…" : "領取自動生成的地下城！"}</span>
            <span className="text-lg">✨</span>
          </button>
        ) : (
          <div className="relative z-10 bg-slate-950/60 rounded-xl p-3 border border-indigo-500/10">
            <div className="text-center py-1">
              <div className="text-3xl font-black tracking-wider bg-gradient-to-r from-indigo-300 via-purple-200 to-indigo-300 bg-clip-text text-transparent drop-shadow-md">
                {fmtRemaining(autoDigStatus.remainingMs)}
              </div>
              <div className="text-[10px] mt-1 text-slate-400 font-bold flex items-center justify-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                距離下次探測完成
              </div>
            </div>
            <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden mt-2.5 p-0.5 border border-indigo-500/20">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(129,140,248,0.5)]"
                style={{
                  width: `${autoDigStatus.remainingMs > 0
                    ? Math.max(3, (1 - autoDigStatus.remainingMs / (144 * 3600000)) * 100)
                    : 0}%`,
                }} />
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ ② 練箭/報到挖掘 ═══════════ */}
      <div className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: "#101827",
          border: "1px solid rgba(74,222,128,0.18)",
          boxShadow:"inset 4px 0 #22c55e, 0 12px 26px rgba(0,0,0,.24)",
        }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl">⛏️</div>
          <div>
            <div className="text-base font-black text-white">練箭挖掘</div>
            <div className="text-[10px]" style={{ color:"var(--text-secondary)" }}>
              報到 +20 · 每箭 +1 · 每 30 箭提升高等級機率
            </div>
          </div>
        </div>

        {/* 進度條 */}
        <StatBar
          value={Math.min(progress, 100)}
          max={100}
          color={isComplete ? "#f59e0b" : "#4ade80"}
          label={`發掘進度 ${Math.round(progress)}%`}
          height={12}
        />

        {/* 進度來源 */}
        <div className="mt-3 space-y-1 text-xs" style={{ color:"var(--text-secondary)" }}>
          <div className="flex justify-between">
            <span>✅ 每日報到</span>
            <span style={{ color:"var(--text-primary)" }}>+20</span>
          </div>
          <div className="flex justify-between">
            <span>🏹 今日射箭</span>
            <span style={{ color:"var(--text-primary)" }}>+{dailyArrows} / 每箭 +1</span>
          </div>
          <div className="flex justify-between">
            <span>📈 最高可挖等級</span>
            <span className="font-bold" style={{ color:"#fbbf24" }}>T{maxTier}</span>
          </div>
        </div>

        {/* T1~T6 機率表 */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-[10px] font-bold mb-2" style={{ color:"var(--text-secondary)" }}>
            🎲 T1~T6 開出機率（今日 {dailyArrows} 箭）
          </div>
          <div className="flex gap-1 flex-wrap">
            {tierProbs.map(t => {
              const tl = TIER_LABEL[t.tier] || {};
              return (
                <span key={t.tier}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: `${tl.color || "#94a3b8"}18`,
                    color: tl.color || "#94a3b8",
                    opacity: t.tier <= maxTier ? 1 : 0.4,
                  }}>
                  {tl.icon || ""} T{t.tier} {t.pct}%
                </span>
              );
            })}
          </div>
          {dailyArrows < 150 && (
            <div className="mt-1 text-[9px]" style={{ color:"var(--text-muted)" }}>
              💡 再射 {30 - (dailyArrows % 30) || 30} 箭可提升 T{Math.min(6, maxTier + 1)} 機率
            </div>
          )}
        </div>

        {/* 儲存槽已滿提示 */}
        {storageFull && (
          <div className="mt-3 p-2 rounded-xl text-center text-xs font-bold"
            style={{ background:"rgba(239,68,68,0.12)", color:"#f87171", border:"1px solid rgba(239,68,68,0.25)" }}>
            📦 地下城選單已滿（3/3），請先挑戰或移除
          </div>
        )}

        {/* 100% 出發按鈕 */}
        {isComplete && !pendingReveal && !storageFull && (
          <button onClick={handleReveal} disabled={loading}
            className="w-full mt-3 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg active:scale-95 transition-all disabled:opacity-40">
            {loading ? "揭曉中…" : "✨ 揭曉地下城！"}
          </button>
        )}
      </div>

      {/* ═══════════ ③ 世界王卷軸 ═══════════ */}
      <div className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: "#101827",
          border: "1px solid rgba(251,146,60,0.18)",
          boxShadow:"inset 4px 0 #fb923c, 0 12px 26px rgba(0,0,0,.24)",
        }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl">📜</div>
          <div className="flex-1">
            <div className="text-base font-black text-white">世界王卷軸</div>
            <div className="text-[10px]" style={{ color:"var(--text-secondary)" }}>
              擊敗世界王獲得卷軸，可開出隨機等級地下城
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black" style={{ color:"#fb923c" }}>{scrolls}</div>
            <div className="text-[9px]" style={{ color:"var(--text-muted)" }}>持有</div>
          </div>
        </div>

        <button onClick={handleUseScroll} disabled={!canUseScroll || scrollBusy}
          className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: canUseScroll
              ? "linear-gradient(90deg, #f97316, #fb923c)"
              : "rgba(255,255,255,0.08)",
            color: canUseScroll ? "white" : "var(--text-muted)",
          }}>
          {scrollBusy ? "使用中…" :
           scrolls <= 0 ? "尚無卷軸" :
           storageFull ? "儲存槽已滿" :
           `🎴 使用卷軸（剩餘 ${scrolls} 個）`}
        </button>

        {/* 使用成功提示 */}
        {scrollResult && (
          <div className="mt-3 p-3 rounded-xl text-center text-xs font-bold"
            style={{ background:"rgba(74,222,128,0.12)", color:"#4ade80", border:"1px solid rgba(74,222,128,0.25)" }}>
            🎉 獲得 {FAMILY_LABEL[scrollResult.family]?.emoji} {FAMILY_LABEL[scrollResult.family]?.label}
            （{TIER_LABEL[scrollResult.difficulty]?.icon} T{scrollResult.difficulty}）已存入選單！
          </div>
        )}
      </div>

      {/* ═══════════ 揭曉 Overlay ═══════════ */}
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
              {pendingReveal.fromAutoDig ? "⏰ 自動生成地下城！" :
               pendingReveal.isHidden ? "✨ 隱藏地下城！" : "🏰 地下城揭曉！"}
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
                {TIER_LABEL[pendingReveal.difficulty]?.icon || ""} T{pendingReveal.difficulty} {TIER_LABEL[pendingReveal.difficulty]?.label || ""}
              </span>
            </div>

            {/* 貓貓尋寶加成提示 */}
            {pendingReveal.catBonus && (
              <div className="mt-3 p-3 rounded-2xl bg-purple-950/90 border border-purple-400/50 shadow-lg text-left flex items-center gap-3">
                <span className="text-2xl animate-bounce">🎁</span>
                <div>
                  <div className="text-xs font-black text-purple-200">🐾 貓貓陪練額外尋寶收穫！</div>
                  <div className="text-xs font-bold text-amber-300 mt-0.5">{pendingReveal.catBonus.label}</div>
                </div>
              </div>
            )}

            {/* 免費降級 + 金幣強化 */}
            <div className="mt-4 flex gap-2">
              {pendingReveal.difficulty > 1 && (
                <button onClick={handleDowngrade} disabled={upgradeBusy}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs border transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: "rgba(96,165,250,0.12)",
                    borderColor: "rgba(96,165,250,0.3)",
                    color: "#60a5fa",
                  }}>
                  {upgradeBusy ? "處理中…" : "🔽 免費降級"}
                </button>
              )}
              {pendingReveal.difficulty < 6 && (
                <button onClick={handleUpgrade} disabled={upgradeBusy}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs border transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: "rgba(251,191,36,0.12)",
                    borderColor: "rgba(251,191,36,0.3)",
                    color: "#fbbf24",
                  }}>
                  {upgradeBusy ? "強化中…" : "🔧 金幣強化（500~2000）"}
                </button>
              )}
            </div>

            {/* 主操作按鈕 */}
            <div className="mt-5 flex gap-3">
              <button onClick={handleAbandon}
                className="flex-1 py-3 rounded-xl text-sm font-bold border border-white/20"
                style={{ color: "var(--text-secondary)" }}>
                {pendingReveal.fromAutoDig ? "⏳ 等待下一次" : "❌ 放棄重新挖掘"}
              </button>
              <button onClick={handleSaveToStorage} disabled={saveLoading || storageFull}
                className="flex-1 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg active:scale-95 transition-all disabled:opacity-40">
                {saveLoading ? "保存中…" : "📦 保存到地下城選單"}
              </button>
            </div>

            <button onClick={handleCloseOverlay}
              className="mt-4 text-xs opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: "var(--text-muted)" }}>
              稍後決定
            </button>
          </div>
        </div>
      )}

      {/* 儲存成功提示 */}
      {saveDone && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] px-6 py-3 rounded-xl text-sm font-bold shadow-2xl"
          style={{
            background:"linear-gradient(90deg,#059669,#10b981)",
            color:"white",
          }}>
          ✅ 已保存到地下城選單
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
