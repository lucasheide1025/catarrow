// src/components/member/MemberMaterials.jsx
// 材料庫存 v2：六族分組 + 材料升級系統（5個低階 → 1個高階）
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeMaterials, upgradeMaterial } from "../../lib/db";
import { MATERIALS, RARITY_CONFIG } from "../../lib/monsterMaterials";
import { useToast } from "../shared/UI";

// 六族 + 章碎片 顯示設定
const FAMILY_CONFIG = {
  ghost:     { label: "鬼怪族", icon: "👻", color: "#7c3aed" },
  mountain:  { label: "山林族", icon: "🏔️", color: "#16a34a" },
  insect:    { label: "毒蟲族", icon: "🦂", color: "#65a30d" },
  workplace: { label: "職場族", icon: "💼", color: "#475569" },
  exam:      { label: "考試族", icon: "📝", color: "#dc2626" },
  temple:    { label: "西方怪物族", icon: "🏰", color: "#ea580c" },
  all:       { label: "章碎片", icon: "✨", color: "#d97706" },
};
const FAMILY_ORDER = ["ghost", "mountain", "insect", "workplace", "exam", "temple", "all"];
const TIER_ORDER   = ["common", "rare", "elite", "fierce", "boss", "mythic", "all"];

export default function MemberMaterials({ onBack }) {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [inventory, setInventory] = useState({});
  const [loading,   setLoading]   = useState(true);
  const [familyFilter, setFamilyFilter] = useState("all_families"); // all_families | ghost | ... | all
  const [confirmMat,   setConfirmMat]   = useState(null); // 待確認升級的材料
  const [upgrading,    setUpgrading]    = useState(false);
  const [celebrate,    setCelebrate]    = useState(null); // { from, to } 升級成功動畫

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeMaterials(profile.id, data => {
      setInventory(data);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [profile?.id]);

  // 統計
  const totalKinds = MATERIALS.length;
  const ownedKinds = MATERIALS.filter(m => (inventory[m.id] || 0) > 0).length;
  const totalCount = Object.values(inventory).reduce((s, v) => s + (v || 0), 0);

  // 可升級數量（提示用）
  const upgradableCount = MATERIALS.filter(m =>
    m.upgradesTo && (inventory[m.id] || 0) >= (m.upgradeCount || 5)
  ).length;

  // 依族篩選後分組
  const familiesToShow = familyFilter === "all_families"
    ? FAMILY_ORDER
    : [familyFilter];

  function matsOfFamily(fam) {
    return MATERIALS
      .filter(m => m.family === fam)
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  }

  async function doUpgrade(mat) {
    if (upgrading) return;
    setUpgrading(true);
    const res = await upgradeMaterial(profile.id, mat.id);
    setUpgrading(false);
    setConfirmMat(null);
    if (res.ok) {
      setCelebrate({ from: res.from, to: res.to });
    } else {
      toast(res.reason || "升級失敗，請稍後再試");
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />

      {/* 頂部 */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>
        )}
        <div className="flex-1">
          <h2 className="text-gray-800 font-black text-xl">🧪 材料庫存</h2>
        </div>
      </div>

      {/* 總覽卡 */}
      <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-purple-200 text-xs mb-0.5">已收集種類</div>
            <div className="font-black text-2xl">{ownedKinds}<span className="text-purple-300 text-sm font-normal">/{totalKinds}</span></div>
          </div>
          <div>
            <div className="text-purple-200 text-xs mb-0.5">材料總數</div>
            <div className="font-black text-2xl">{totalCount}</div>
          </div>
          <div>
            <div className="text-purple-200 text-xs mb-0.5">圖鑑完成度</div>
            <div className="font-black text-2xl">{Math.round(ownedKinds / totalKinds * 100)}<span className="text-purple-300 text-sm font-normal">%</span></div>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
            style={{ width: `${ownedKinds / totalKinds * 100}%` }} />
        </div>
        {upgradableCount > 0 && (
          <div className="mt-3 bg-white/15 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5">
            ⬆️ 有 {upgradableCount} 種材料可以升級了！
          </div>
        )}
      </div>

      {/* 升級說明 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-700 text-xs leading-relaxed">
        💡 集滿 <b>5 個</b>同一種材料，就能升級成 <b>1 個</b>更高階的材料！每族材料都有自己的升級鏈。
      </div>

      {/* 族別篩選 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFamilyFilter("all_families")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
            ${familyFilter === "all_families" ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200"}`}>
          全部
        </button>
        {FAMILY_ORDER.map(fam => {
          const cfg = FAMILY_CONFIG[fam];
          return (
            <button key={fam} onClick={() => setFamilyFilter(fam)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
                ${familyFilter === fam ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-600 border-gray-200"}`}>
              {cfg.icon} {cfg.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">載入中…</div>
      ) : (
        <div className="flex flex-col gap-5">
          {familiesToShow.map(fam => {
            const cfg  = FAMILY_CONFIG[fam];
            const mats = matsOfFamily(fam);
            if (mats.length === 0) return null;
            const famOwned = mats.filter(m => (inventory[m.id] || 0) > 0).length;

            return (
              <section key={fam}>
                {/* 族標題 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cfg.icon}</span>
                    <span className="font-black text-sm" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <span className="text-gray-400 text-xs font-bold">{famOwned}/{mats.length}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {mats.map((mat, idx) => {
                    const count   = inventory[mat.id] || 0;
                    const rarity  = RARITY_CONFIG[mat.rarity] || RARITY_CONFIG.common;
                    const owned   = count > 0;
                    const canChain = !!mat.upgradesTo;
                    const need    = mat.upgradeCount || 5;
                    const canUpgrade = canChain && count >= need;
                    const nextMat = canChain ? MATERIALS.find(m => m.id === mat.upgradesTo) : null;

                    return (
                      <div key={mat.id}
                        className={`rounded-2xl p-4 border transition-all ${owned ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"}`}>
                        <div className="flex items-center gap-3">
                          {/* 圖示 */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${owned ? "bg-purple-50" : "bg-gray-100"}`}>
                            {owned ? mat.icon : "❓"}
                          </div>

                          {/* 資訊 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-black text-sm ${owned ? "text-gray-800" : "text-gray-400"}`}>
                                {owned ? mat.name : "???"}
                              </span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: rarity.color + "22", color: rarity.color }}>
                                {rarity.label}
                              </span>
                            </div>
                            {owned && (
                              <div className="text-gray-400 text-xs mt-0.5 leading-relaxed">{mat.desc}</div>
                            )}
                          </div>

                          {/* 持有數 */}
                          <div className="text-right flex-shrink-0">
                            <div className={`font-black text-2xl ${owned ? "text-purple-600" : "text-gray-300"}`}>
                              {count}
                            </div>
                            <div className="text-gray-400 text-xs">個</div>
                          </div>
                        </div>

                        {/* 升級區（有升級鏈且已持有才顯示） */}
                        {canChain && owned && nextMat && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-gray-500 font-bold">
                                    {need} 個 → {(inventory[nextMat.id] || 0) > 0 ? `${nextMat.icon} ${nextMat.name}` : "❓ 下一階材料"}
                                  </span>
                                  <span className={`font-black ${canUpgrade ? "text-amber-500" : "text-gray-400"}`}>
                                    {Math.min(count, need)}/{need}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${canUpgrade ? "bg-amber-400" : "bg-purple-300"}`}
                                    style={{ width: `${Math.min(count / need, 1) * 100}%` }} />
                                </div>
                              </div>
                              <button
                                onClick={() => canUpgrade && setConfirmMat({ ...mat, _idx: idx })}
                                disabled={!canUpgrade}
                                className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all
                                  ${canUpgrade
                                    ? "bg-amber-400 text-amber-900 shadow-sm active:scale-95"
                                    : "bg-gray-100 text-gray-300"}`}>
                                ⬆️ 升級
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── 升級確認彈窗 ───────────────────────────── */}
      {confirmMat && (() => {
        const nextMat = MATERIALS.find(m => m.id === confirmMat.upgradesTo);
        const need = confirmMat.upgradeCount || 5;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
            onClick={() => !upgrading && setConfirmMat(null)}>
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-4">
                <div className="font-black text-gray-800 text-lg mb-1">⬆️ 材料升級</div>
                <div className="text-gray-400 text-xs">確定要升級嗎？升級後低階材料會消耗掉</div>
              </div>

              {/* 升級示意 */}
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center text-3xl mx-auto">
                    {confirmMat.icon}
                  </div>
                  <div className="text-gray-600 text-xs font-bold mt-1">{confirmMat.name}</div>
                  <div className="text-red-500 text-xs font-black">−{need} 個</div>
                </div>
                <div className="text-2xl text-gray-300">➜</div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl mx-auto">
                    {nextMat?.icon}
                  </div>
                  <div className="text-gray-600 text-xs font-bold mt-1">{nextMat?.name}</div>
                  <div className="text-green-600 text-xs font-black">＋1 個</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setConfirmMat(null)} disabled={upgrading}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-black">
                  取消
                </button>
                <button onClick={() => doUpgrade(confirmMat)} disabled={upgrading}
                  className="flex-1 py-3 rounded-2xl bg-amber-400 text-amber-900 text-sm font-black active:scale-95 transition-all">
                  {upgrading ? "升級中…" : "確定升級！"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 升級成功動畫 ───────────────────────────── */}
      {celebrate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6"
          onClick={() => setCelebrate(null)}>
          <div className="text-center">
            <div className="text-7xl mb-3 animate-bounce">{celebrate.to.icon}</div>
            <div className="text-amber-300 font-black text-2xl mb-1">升級成功！</div>
            <div className="text-white font-bold text-lg mb-2">獲得「{celebrate.to.name}」×1</div>
            <div className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4"
              style={{
                background: (RARITY_CONFIG[celebrate.to.rarity]?.color || "#9ca3af") + "33",
                color: RARITY_CONFIG[celebrate.to.rarity]?.color || "#9ca3af",
              }}>
              {RARITY_CONFIG[celebrate.to.rarity]?.label || ""}
            </div>
            <div className="text-white/60 text-xs leading-relaxed max-w-xs mx-auto mb-6">
              {celebrate.to.desc}
            </div>
            <button onClick={() => setCelebrate(null)}
              className="px-8 py-3 rounded-full bg-white text-gray-800 text-sm font-black">
              太棒了！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}