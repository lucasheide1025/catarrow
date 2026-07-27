import { useEffect, useState } from "react";
import {
  BUILDING_META,
  accrueBuildingProduction,
  buildingConstructionMs,
  buildingUpgradeCost,
  buildingVisualStage,
  maxBuildingLevelForRank,
  supplyCapacity,
  weeklyProduction,
} from "../domain/guildBuildings";
import { sfxClose, sfxError, sfxLevelUp, sfxOpen, sfxShopBuy } from "../../lib/sound";
import { hallBg, bgLayer } from "./GuildArt";

const ASSET = "/assets/guild/territory";
const BUILDING_IDS = Object.keys(BUILDING_META);
const DECOR = {
  warehouse: ["📦", "🛒", "🏮"],
  farm: ["🌱", "🌾", "🧺"],
  waterStation: ["🪣", "💧", "⚙️"],
};

const styles = {
  page: {
    minHeight: "100dvh",
    color: "#f8fafc",
    padding: "clamp(12px, 3vw, 22px)",
  },
  shell: { width: "min(100%, 820px)", margin: "0 auto" },
  glass: {
    background: "linear-gradient(145deg,rgba(15,23,42,.92),rgba(9,18,13,.92))",
    border: "1px solid rgba(251,191,36,.18)",
    boxShadow: "0 14px 38px rgba(0,0,0,.26)",
  },
  button: {
    border: 0,
    borderRadius: 11,
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
};

const formatDuration = ms => {
  const safe = Math.max(0, ms);
  const days = Math.floor(safe / 86400000);
  const hours = Math.floor((safe % 86400000) / 3600000);
  const minutes = Math.floor((safe % 3600000) / 60000);
  if (days) return `${days} 天 ${hours} 小時`;
  if (hours) return `${hours} 小時 ${minutes} 分`;
  return `${minutes} 分`;
};

function ResourceChip({ icon, label, value, hint }) {
  return (
    <div style={{ minWidth: 0, padding: "9px 11px", borderRadius: 12, background: "rgba(255,255,255,.055)" }}>
      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{icon} {label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#f8fafc", whiteSpace: "nowrap" }}>{value}</div>
      {hint ? <div style={{ fontSize: 9, color: "#64748b", marginTop: 1 }}>{hint}</div> : null}
    </div>
  );
}

export default function GuildTerritory({
  profile,
  onStartConstruction,
  onFinishConstruction,
  onClaimProduction,
  onClose,
}) {
  const [now, setNow] = useState(Date.now());
  const [selectedId, setSelectedId] = useState("warehouse");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const accrued = accrueBuildingProduction(profile, now);
  const job = profile.construction;
  const jobDone = Boolean(job && now >= job.finishesAt);
  const allowedLevel = maxBuildingLevelForRank(profile.rankId);
  const selectedMeta = BUILDING_META[selectedId];
  const level = profile.buildings[selectedId];
  const stage = buildingVisualStage(level);
  const isSelectedJob = job?.buildingId === selectedId;
  const nextCost = level < 20 ? buildingUpgradeCost(level) : 0;
  const duration = level < 20 ? buildingConstructionMs(level) : 0;
  const rankLocked = level >= allowedLevel;
  const cannotAfford = profile.catCoins < nextCost;
  const upgradeDisabled = Boolean(job || level >= 20 || rankLocked || cannotAfford);
  const progressDecor = level === 0 ? 0 : (level - 1) % 4;
  const pendingFood = Math.floor(accrued.production.food);
  const pendingWater = Math.floor(accrued.production.water);
  const canClaim = pendingFood > 0 || pendingWater > 0;

  const runAction = async (fn, successMessage, isLevelUp = false) => {
    const result = await fn();
    if (!result.ok) {
      sfxError();
      setMessage(`⚠️ ${result.reason}`);
      return;
    }
    isLevelUp ? sfxLevelUp() : sfxShopBuy();
    setMessage(typeof successMessage === "function" ? successMessage(result) : successMessage);
  };

  const effectText =
    selectedId === "warehouse"
      ? `總容量 ${supplyCapacity(profile)} 份`
      : `每週生產 ${weeklyProduction(profile, selectedId === "farm" ? "food" : "water")} 份`;

  const upgradeLabel = (() => {
    if (level >= 20) return "已達最高等級";
    if (rankLocked) return `完成晉升後可突破 Lv${allowedLevel}`;
    if (job) return "目前有其他工程施工中";
    if (cannotAfford) return `CAT 幣不足（需要 ${nextCost}）`;
    return `花費 ${nextCost} CAT，升至 Lv${level + 1}`;
  })();

  return (
    <div style={{ ...styles.page, ...bgLayer(hallBg(), { overlay: "rgba(6,10,7,.76)" }) }}>
      <main style={styles.shell}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(20px,5vw,27px)", color: "#fde68a", letterSpacing: 1 }}>公會領地</h1>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8" }}>目前階級建築上限 Lv{allowedLevel}</p>
          </div>
          <button type="button" onClick={() => { sfxClose(); onClose(); }}
            style={{ ...styles.button, flexShrink: 0, padding: "8px 13px", background: "#334155" }}>
            返回公會
          </button>
        </header>

        <section style={{ ...styles.glass, borderRadius: 16, padding: 11, marginBottom: 11 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 7 }}>
            <ResourceChip icon="🐾" label="CAT 幣" value={profile.catCoins} hint="建設資金" />
            <ResourceChip icon="🍞" label="食物" value={`${profile.supplyStock.food}/${supplyCapacity(profile)}`} />
            <ResourceChip icon="💧" label="飲水" value={`${profile.supplyStock.water}/${supplyCapacity(profile)}`} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 9 }}>
            <div style={{ minWidth: 0, fontSize: 11, color: "#cbd5e1" }}>
              待收成　🍞 {pendingFood}　💧 {pendingWater}
            </div>
            <button type="button" disabled={!canClaim}
              onClick={() => runAction(onClaimProduction, result => `已收成：食物 ${result.food}、飲水 ${result.water}`)}
              style={{ ...styles.button, flexShrink: 0, padding: "7px 12px", background: canClaim ? "#15803d" : "#475569", opacity: canClaim ? 1 : .7 }}>
              一鍵收成
            </button>
          </div>
        </section>

        {job ? (
          <section style={{
            borderRadius: 14,
            padding: "10px 12px",
            marginBottom: 11,
            background: jobDone ? "rgba(21,128,61,.84)" : "rgba(120,53,15,.84)",
            border: `1px solid ${jobDone ? "#4ade80" : "#f59e0b"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#fed7aa" }}>{jobDone ? "工程完成" : "施工進行中"}</div>
                <b style={{ fontSize: 14 }}>{BUILDING_META[job.buildingId].name} → Lv{job.targetLevel}</b>
                {!jobDone ? <div style={{ fontSize: 11, marginTop: 2 }}>剩餘 {formatDuration(job.finishesAt - now)}</div> : null}
              </div>
              {jobDone ? (
                <button type="button"
                  onClick={() => runAction(
                    onFinishConstruction,
                    result => `${BUILDING_META[result.buildingId]?.name} 已升至 Lv${result.level}`,
                    true
                  )}
                  style={{ ...styles.button, padding: "8px 13px", background: "#fbbf24", color: "#422006" }}>
                  驗收完工
                </button>
              ) : <span style={{ fontSize: 24 }}>🚧</span>}
            </div>
          </section>
        ) : null}

        {message ? (
          <div role="status" style={{ margin: "0 2px 9px", fontSize: 11.5, color: message.startsWith("⚠️") ? "#fca5a5" : "#86efac" }}>
            {message}
          </div>
        ) : null}

        <nav aria-label="選擇領地建築" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 7, marginBottom: 9 }}>
          {BUILDING_IDS.map(id => {
            const meta = BUILDING_META[id];
            const selected = id === selectedId;
            return (
              <button key={id} type="button" aria-pressed={selected} onClick={() => setSelectedId(id)}
                style={{
                  ...styles.button,
                  minWidth: 0,
                  padding: "9px 5px",
                  background: selected ? "#7c3aed" : "rgba(30,41,59,.9)",
                  border: `1px solid ${selected ? "#c4b5fd" : "rgba(255,255,255,.08)"}`,
                }}>
                <span style={{ display: "block", fontSize: 18 }}>{meta.icon}</span>
                <span style={{ display: "block", marginTop: 2, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.name}</span>
                <span style={{ display: "block", fontSize: 9, color: selected ? "#ede9fe" : "#94a3b8" }}>Lv{profile.buildings[id]}</span>
              </button>
            );
          })}
        </nav>

        <section style={{ ...styles.glass, overflow: "hidden", borderRadius: 18 }}>
          <div style={{
            position: "relative",
            width: "min(calc(100% - 28px),460px)",
            aspectRatio: "1 / 1",
            display: "grid",
            placeItems: "center",
            margin: "14px auto",
            padding: "clamp(8px,2vw,16px)",
            boxSizing: "border-box",
            overflow: "visible",
            borderRadius: 16,
            border: `2px solid ${isSelectedJob ? "rgba(251,191,36,.72)" : "rgba(148,163,184,.2)"}`,
            background: "radial-gradient(circle at 50% 72%,rgba(34,197,94,.16),rgba(2,6,23,.62) 65%)",
            boxShadow: "inset 0 0 30px rgba(0,0,0,.32)",
          }}>
            <img
              src={`${ASSET}/${selectedId}_stage${stage}.png`}
              alt={`${selectedMeta.name}第 ${stage} 階段外觀`}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                filter: isSelectedJob ? "saturate(.62) brightness(.78)" : "drop-shadow(0 12px 16px rgba(0,0,0,.52))",
              }}
            />
          </div>

          <div style={{ padding: "0 14px 15px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{selectedMeta.icon} {selectedMeta.name}</div>
                <div style={{ marginTop: 2, fontSize: 11, color: "#94a3b8" }}>目前 Lv{level}　·　{effectText}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                  <span style={{ padding: "4px 7px", borderRadius: 999, background: "rgba(124,58,237,.22)", color: "#ddd6fe", fontSize: 10 }}>
                    外觀階段 {stage}/5
                  </span>
                  {isSelectedJob ? (
                    <span style={{ padding: "4px 7px", borderRadius: 999, background: "rgba(180,83,9,.3)", color: "#fde68a", fontSize: 10 }}>
                      🚧 施工中
                    </span>
                  ) : null}
                  {DECOR[selectedId].slice(0, progressDecor).map((item, index) => (
                    <span key={`${item}-${index}`} aria-label="等級裝飾"
                      style={{ padding: "3px 6px", borderRadius: 999, background: "rgba(255,255,255,.06)", fontSize: 13 }}>{item}</span>
                  ))}
                </div>
              </div>
              {level < 20 ? (
                <div style={{ flexShrink: 0, textAlign: "right", fontSize: 10, color: "#cbd5e1" }}>
                  <div>下一級 Lv{level + 1}</div>
                  <div style={{ marginTop: 2, color: "#fbbf24" }}>工期 {formatDuration(duration)}</div>
                </div>
              ) : null}
            </div>

            <button type="button" disabled={upgradeDisabled}
              onClick={() => {
                sfxOpen();
                runAction(() => onStartConstruction(selectedId), `${selectedMeta.name}已開始施工`);
              }}
              style={{
                ...styles.button,
                width: "100%",
                marginTop: 12,
                padding: "11px 12px",
                background: upgradeDisabled ? "#475569" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
                opacity: upgradeDisabled ? .78 : 1,
              }}>
              {upgradeLabel}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
