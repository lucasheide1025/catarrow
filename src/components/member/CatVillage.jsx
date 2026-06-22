// src/components/member/CatVillage.jsx
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  collectVillageResources, upgradeVillageBuilding, initVillageIfNeeded,
} from "../../lib/db";
import { sfxSuccess, sfxEpic, sfxTap } from "../../lib/sound";
import {
  BUILDINGS, BUILDING_LIST, getVillageLevel, getBuildingStage,
  getProductionRate, getUpgradeRequirements, canUpgrade,
  calcPendingResources, RESOURCE_NAMES, DEFAULT_VILLAGE,
  UNLOCK_REQS, isBuildingUnlocked,
} from "../../lib/villageData";
import GachaMachine from "./GachaMachine";

// 手繪風配色常數
const C = {
  bg:       "linear-gradient(180deg,#FDF6EC,#F0E8D8)",
  card:     "rgba(255,255,255,0.88)",
  border:   "#E0CDB5",
  brown:    "#5C3D2E",
  mid:      "#9B7B6A",
  muted:    "#C4A899",
  sage:     "#6B8E5E",
  lock:     "rgba(218,205,190,0.45)",
  lockBd:   "#D8C4B0",
  shadow:   "0 2px 8px rgba(100,70,50,0.10)",
};

// ── 全景圖（可橫移） ─────────────────────────────────────────
function PanoramaView({ villageLevel }) {
  const lv  = Math.max(1, Math.min(20, villageLevel || 1));
  const pad = String(lv).padStart(2, "0");
  const src = `/ui/village/panorama-lv${pad}.webp`;

  return (
    <div className="overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
      <div style={{ width: "750px", height: "370px", position: "relative", flexShrink: 0 }}>
        <img
          src={src}
          alt={`村莊 Lv${lv}`}
          style={{ width: "750px", height: "370px", objectFit: "cover", display: "block" }}
          onError={e => { e.target.style.display = "none"; }}
        />
        <div style={{
          position: "absolute", top: 10, left: 12,
          background: "rgba(60,35,15,0.62)", backdropFilter: "blur(6px)",
          borderRadius: "20px", padding: "4px 14px",
          color: "#FFF8F0", fontWeight: 900, fontSize: "13px",
        }}>
          🏡 村莊 Lv.{lv}
        </div>
      </div>
    </div>
  );
}

// ── 資源採集列 ───────────────────────────────────────────────
function ResourceBar({ resources, pending, onCollect, collecting, nextCollectSec }) {
  const arrowdew = (resources?.arrowdew || 0);
  const hasPending = Object.values(pending || {}).some(v => v > 0);
  const pendingArrow = pending?.arrowdew || 0;

  const timeStr = useMemo(() => {
    if (nextCollectSec <= 0) return null;
    const h = Math.floor(nextCollectSec / 3600);
    const m = Math.floor((nextCollectSec % 3600) / 60);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
  }, [nextCollectSec]);

  return (
    <div className="px-4 py-3 flex items-center gap-3"
      style={{ background: "rgba(255,255,255,0.6)", borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 flex-1">
        <span className="text-lg">💧</span>
        <div>
          <div className="font-black text-sm" style={{ color: C.brown }}>{arrowdew.toLocaleString()}</div>
          <div className="text-[10px]" style={{ color: C.muted }}>箭露</div>
        </div>
        {hasPending && pendingArrow > 0 && (
          <div className="text-xs font-bold" style={{ color: C.sage }}>+{pendingArrow.toLocaleString()}</div>
        )}
      </div>
      <button
        onClick={onCollect}
        disabled={collecting || !hasPending}
        className="px-4 py-2 rounded-xl font-black text-sm transition-all active:scale-95"
        style={{
          background: hasPending
            ? "linear-gradient(135deg,#7CBF70,#5A9E50)"
            : C.lockBd,
          color: hasPending ? "white" : C.muted,
          cursor: hasPending ? "pointer" : "default",
          boxShadow: hasPending ? "0 2px 6px rgba(90,158,80,0.35)" : "none",
        }}>
        {collecting ? "採集中…" : hasPending ? "✦ 採集" : (timeStr ? `${timeStr}後` : "已採集")}
      </button>
    </div>
  );
}

// ── 建築卡片 ─────────────────────────────────────────────────
function BuildingCard({ buildingId, level, resources, onClick }) {
  const b     = BUILDINGS[buildingId];
  const stage = getBuildingStage(level);
  const rate  = getProductionRate(buildingId, level);
  const check = canUpgrade(buildingId, { [buildingId]: level }, resources);
  const maxed = level >= 20;

  const statusColor = maxed ? C.muted : check.ok ? C.sage : "#D4933A";
  const statusText  = maxed ? "MAX" : check.ok ? "可升級" : "缺材料";
  const imgSrc = `/ui/village/building-${buildingId}-stage${stage}.webp`;

  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-2xl overflow-hidden active:scale-95 transition-transform text-left"
      style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#F5EBD8" }}>
        <img
          src={imgSrc} alt={b.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={e => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
        <div style={{
          display: "none", position: "absolute", inset: 0,
          alignItems: "center", justifyContent: "center", fontSize: "36px",
        }}>{b.emoji}</div>
        <div style={{
          position: "absolute", top: 5, right: 5,
          background: "rgba(60,35,15,0.60)", borderRadius: "8px",
          padding: "1px 7px", color: "#FFF8F0", fontWeight: 900, fontSize: "10px",
        }}>Lv.{level}</div>
      </div>
      <div className="p-2.5">
        <div className="font-black text-xs leading-tight" style={{ color: C.brown }}>{b.name}</div>
        <div className="text-[10px] mt-0.5" style={{ color: C.mid }}>{b.resourceName} {rate}/hr</div>
        <div className="mt-1.5 text-[10px] font-bold" style={{ color: statusColor }}>● {statusText}</div>
      </div>
    </button>
  );
}

// ── 鎖定建築卡片 ─────────────────────────────────────────────
function LockedBuildingCard({ buildingId }) {
  const b = BUILDINGS[buildingId];
  let hint = "";
  if (buildingId === 'market') {
    hint = "海港或獵場 Lv2";
  } else {
    const req = UNLOCK_REQS[buildingId];
    if (req) {
      hint = Object.entries(req)
        .map(([id, lv]) => `${BUILDINGS[id].name} Lv${lv}`)
        .join(" 且 ");
    }
  }

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden text-left"
      style={{ background: C.lock, border: `1px solid ${C.lockBd}` }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#EDE0CE" }}>
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <div style={{ fontSize: 26, opacity: 0.25, filter: "grayscale(1)" }}>{b.emoji}</div>
          <div style={{ fontSize: 18 }}>🔒</div>
        </div>
      </div>
      <div className="p-2.5">
        <div className="font-black text-xs leading-tight" style={{ color: C.muted }}>{b.name}</div>
        <div className="text-[9px] mt-0.5 leading-tight" style={{ color: C.lockBd }}>{hint}</div>
      </div>
    </div>
  );
}

// ── 升級 Modal ───────────────────────────────────────────────
function UpgradeModal({ buildingId, level, resources, onUpgrade, onClose, upgrading }) {
  const b         = BUILDINGS[buildingId];
  const stage     = getBuildingStage(level);
  const nextStage = getBuildingStage(level + 1);
  const nextLv    = level + 1;
  const req       = nextLv <= 20 ? getUpgradeRequirements(buildingId, nextLv) : null;
  const check     = canUpgrade(buildingId, { [buildingId]: level }, resources);
  const curRate   = getProductionRate(buildingId, level);
  const nextRate  = getProductionRate(buildingId, nextLv);
  const imgSrc    = `/ui/village/building-${buildingId}-stage${stage}.webp`;
  const stageUp   = nextStage !== stage;
  const nextImgSrc = stageUp ? `/ui/village/building-${buildingId}-stage${nextStage}.webp` : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: "rgba(80,50,30,0.55)" }}
      onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-3xl overflow-hidden"
        style={{ background: "linear-gradient(180deg,#FDF6EC,#F5EBD8)", maxHeight: "88vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* 大圖預覽 */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#EDE0CE", flexShrink: 0 }}>
          <img src={imgSrc} alt={b.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }} />
          <div style={{ display: "none", position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", fontSize: 64 }}>
            {b.emoji}
          </div>
          {/* 等級角標 */}
          <div style={{
            position: "absolute", top: 12, left: 14,
            background: "rgba(60,35,15,0.65)", backdropFilter: "blur(6px)",
            borderRadius: 20, padding: "4px 14px",
            color: "#FFF8F0", fontWeight: 900, fontSize: 14,
          }}>Lv.{level}</div>
          {/* 關閉按鈕 */}
          <button onClick={onClose} style={{
            position: "absolute", top: 10, right: 12,
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(60,35,15,0.55)", color: "#FFF8F0",
            fontSize: 16, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer",
          }}>✕</button>
          {/* 段位提升預告 */}
          {stageUp && nextImgSrc && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(to top, rgba(107,142,94,0.85), transparent)",
              padding: "28px 14px 10px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: "#F0FFE8", fontSize: 11, fontWeight: 900 }}>✨ 升至 Lv.{nextLv} 將解鎖新外觀！</span>
              <div style={{ width: 44, height: 33, borderRadius: 6, overflow: "hidden", border: "2px solid #A0C898", flexShrink: 0 }}>
                <img src={nextImgSrc} alt="下一段位"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => { e.target.style.display = "none"; }} />
              </div>
            </div>
          )}
        </div>

        {/* 內容區 */}
        <div className="px-5 pt-4 pb-8">
          <div className="flex items-baseline justify-between mb-1">
            <div className="font-black text-xl" style={{ color: C.brown }}>{b.emoji} {b.name}</div>
            <div className="text-xs" style={{ color: C.muted }}>Lv.{level} → {nextLv <= 20 ? nextLv : "MAX"}</div>
          </div>
          <div className="text-xs font-bold mb-4" style={{ color: C.sage }}>
            產出：{curRate}/hr {nextLv <= 20 ? `→ ${nextRate}/hr` : "（已滿）"}
          </div>

          {level >= 20 ? (
            <div className="text-center py-4 text-sm" style={{ color: C.muted }}>🏆 已達最高等級 Lv.20</div>
          ) : req ? (
            <>
              <div className="text-xs font-bold mb-2 tracking-wider" style={{ color: C.mid }}>升級需求</div>

              {/* 箭露 */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-2"
                style={{ background: "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2">
                  <span>💧</span>
                  <span className="text-sm" style={{ color: C.brown }}>箭露</span>
                </div>
                <div>
                  <span className="font-black text-sm"
                    style={{ color: (resources?.arrowdew || 0) >= req.arrowdew ? C.sage : "#C0533A" }}>
                    {req.arrowdew.toLocaleString()}
                  </span>
                  <span className="text-xs ml-1.5" style={{ color: C.muted }}>/ {(resources?.arrowdew || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* 材料 */}
              {req.materials.map((mat, i) => {
                const have = resources?.[mat.resource] || 0;
                const ok   = have >= mat.count;
                return (
                  <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3 mb-2"
                    style={{ background: "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2">
                      <img src={`/ui/village/resource-${mat.resource}.webp`} alt=""
                        style={{ width: 20, height: 20 }}
                        onError={e => { e.target.style.display = "none"; }} />
                      <span className="text-sm" style={{ color: C.brown }}>{RESOURCE_NAMES[mat.resource]} T{mat.tier}</span>
                    </div>
                    <div className="font-black text-sm" style={{ color: ok ? C.sage : "#C0533A" }}>
                      {mat.count} <span className="font-normal text-xs" style={{ color: C.muted }}>/ {have}</span>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={onUpgrade}
                disabled={!check.ok || upgrading}
                className="w-full py-4 rounded-2xl font-black text-base mt-3 transition-all active:scale-95"
                style={{
                  background: check.ok
                    ? "linear-gradient(135deg,#7CBF70,#5A9E50)"
                    : C.lockBd,
                  color: check.ok ? "white" : C.muted,
                  boxShadow: check.ok ? "0 3px 10px rgba(90,158,80,0.35)" : "none",
                }}>
                {upgrading ? "升級中…" : check.ok ? `⬆ 升級至 Lv.${nextLv}` : check.reason}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── 資源總覽列 ───────────────────────────────────────────────
function ResourceRow({ resources }) {
  const keys = ['ore','melon','fish','meat','driedfish','can','potion','fur','archer'];
  return (
    <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="text-[10px] font-bold mb-1.5" style={{ color: C.mid }}>村莊資源</div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {keys.map(k => (
          <div key={k} className="flex flex-col items-center gap-0.5 shrink-0">
            <div style={{ width: 32, height: 32, position: "relative" }}>
              <img src={`/ui/village/resource-${k}.webp`} alt={RESOURCE_NAMES[k]}
                style={{ width: 32, height: 32, objectFit: "contain" }}
                onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }} />
              <div style={{ display: "none", fontSize: 20, textAlign: "center" }}>
                {BUILDINGS[BUILDING_LIST.find(id => BUILDINGS[id].resource === k)]?.emoji || ""}
              </div>
            </div>
            <div className="font-bold text-[10px]" style={{ color: C.brown }}>{resources?.[k] || 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 主元件 ───────────────────────────────────────────────────
export default function CatVillage({ catCards, gachaCoins }) {
  const { profile } = useAuth();
  const [tab, setTab]               = useState("village");
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [collecting, setCollecting] = useState(false);
  const [upgrading, setUpgrading]   = useState(false);
  const [localVillage, setLocalVillage] = useState(null);

  const village    = localVillage || profile?.village || DEFAULT_VILLAGE;
  const buildings  = village.buildings || DEFAULT_VILLAGE.buildings;
  const resources  = village.resources || DEFAULT_VILLAGE.resources;
  const villageLevel = getVillageLevel(buildings);

  useEffect(() => {
    if (profile?.id && !profile?.village) {
      initVillageIfNeeded(profile.id, profile?.village).catch(() => {});
    }
  }, [profile?.id]); // eslint-disable-line

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const { pending, hours } = useMemo(
    () => calcPendingResources(village),
    [village, tick] // eslint-disable-line
  );

  const nextCollectSec = useMemo(() => {
    const lastMs = village?.lastCollectedAt?.toMillis?.() || (Date.now() - hours * 3600000);
    return Math.max(0, Math.floor((lastMs + 8 * 3600000 - Date.now()) / 1000));
  }, [village, hours]);

  async function handleCollect() {
    if (collecting || !profile?.id) return;
    setCollecting(true);
    try {
      const res = await collectVillageResources(profile.id, village);
      if (res.resources) {
        setLocalVillage(prev => ({
          ...(prev || village),
          resources: res.resources,
          lastCollectedAt: { toMillis: () => Date.now() },
        }));
      }
    } catch (e) {
      alert("採集失敗：" + e.message);
    } finally {
      setCollecting(false);
    }
  }

  async function handleUpgrade(buildingId) {
    if (upgrading || !profile?.id) return;
    setUpgrading(true);
    try {
      const currentLevel = buildings[buildingId] || 1;
      const stageChanges = getBuildingStage(currentLevel) !== getBuildingStage(currentLevel + 1);
      const res = await upgradeVillageBuilding(profile.id, buildingId, village);
      if (stageChanges) sfxEpic(); else sfxSuccess();
      setLocalVillage(prev => ({
        ...(prev || village),
        buildings: { ...(prev?.buildings || buildings), [buildingId]: res.newLevel },
        resources: res.resources,
      }));
      setSelectedBuilding(null);
    } catch (e) {
      alert("升級失敗：" + e.message);
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: C.bg }}>

      {/* 頁籤 */}
      <div className="flex shrink-0" style={{ background: "#FDF6EC", borderBottom: `1px solid ${C.border}` }}>
        {[["village","🏡 貓貓村"],["gacha","🎰 扭蛋機"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-3 text-sm font-black transition-colors"
            style={{
              color: tab === id ? C.brown : C.muted,
              borderBottom: tab === id ? `2.5px solid ${C.sage}` : "2.5px solid transparent",
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "gacha" && (
        <GachaMachine catCards={catCards} gachaCoins={gachaCoins} onCoinsUpdated={() => {}} />
      )}

      {tab === "village" && (
        <>
          <PanoramaView villageLevel={villageLevel} />

          <ResourceBar
            resources={resources}
            pending={pending}
            onCollect={handleCollect}
            collecting={collecting}
            nextCollectSec={nextCollectSec}
          />

          <ResourceRow resources={resources} />

          {/* 建築網格 */}
          <div className="px-4 py-3 flex-1">
            {(() => {
              const unlockedIds = BUILDING_LIST.filter(id => isBuildingUnlocked(id, buildings));
              return (
                <>
                  <div className="text-[10px] font-bold mb-2" style={{ color: C.mid }}>
                    已解鎖 {unlockedIds.length} / 9 棟建築
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {BUILDING_LIST.map(id =>
                      isBuildingUnlocked(id, buildings) ? (
                        <BuildingCard
                          key={id}
                          buildingId={id}
                          level={buildings[id] || 1}
                          resources={resources}
                          onClick={() => { sfxTap(); setSelectedBuilding(id); }}
                        />
                      ) : (
                        <LockedBuildingCard key={id} buildingId={id} buildings={buildings} />
                      )
                    )}
                  </div>

                  {/* 村莊等級說明 */}
                  <div className="mt-4 rounded-2xl px-4 py-3 text-center"
                    style={{ background: "rgba(255,255,255,0.55)", border: `1px solid ${C.border}` }}>
                    <div className="text-xs" style={{ color: C.mid }}>村莊等級 = 已解鎖建築平均等級</div>
                    <div className="text-xs mt-1" style={{ color: C.brown }}>
                      目前：{unlockedIds.reduce((s,id) => s + (buildings[id]||1), 0)} / {unlockedIds.length * 20} 總級 → Lv.{villageLevel}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* 升級 Modal */}
      {selectedBuilding && (
        <UpgradeModal
          buildingId={selectedBuilding}
          level={buildings[selectedBuilding] || 1}
          resources={resources}
          onUpgrade={() => handleUpgrade(selectedBuilding)}
          onClose={() => setSelectedBuilding(null)}
          upgrading={upgrading}
        />
      )}
    </div>
  );
}
