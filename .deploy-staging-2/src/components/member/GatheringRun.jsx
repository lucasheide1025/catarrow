import { useEffect, useMemo, useRef, useState } from "react";
import {
  GATHERING_ARROWS_PER_ROUND,
  GATHERING_TIER_META,
  buildGatheringRunContract,
  calculateGatheringRewards,
  calculateGatheringRound,
  scoreToGatheringProgress,
} from "../../lib/catVillageGathering";
import {
  sfxArrowShoot,
  sfxCouncilWork,
  sfxCritBoom,
  sfxGatherClick,
  sfxGatherVictory,
  sfxRoundEnd,
  sfxSoftFail,
  sfxSuccess,
  unlockAudio,
  vibrate,
} from "../../lib/sound";
import { MATERIALS } from "../../lib/monsterMaterials";

const SCORE_LABELS = ["X", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];
const MATERIAL_MAP = Object.fromEntries(MATERIALS.map(item => [item.id, item]));

const RESULT_COLOR = {
  comfort: "#94a3b8",
  partial: "#38bdf8",
  complete: "#22c55e",
  harvest: "#f59e0b",
  great: "#f472b6",
};

const GATHERING_RUN_CSS = `
.gather-run {
  min-height: 100vh;
  padding: 14px 12px 88px;
  color: white;
  overflow: hidden;
}
.gather-panel {
  border-radius: 8px;
  background: rgba(3,7,18,0.68);
  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 18px 52px rgba(0,0,0,0.34);
  backdrop-filter: blur(12px);
}
.gather-stage {
  position: relative;
  min-height: 190px;
  padding: 16px;
  margin-bottom: 12px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
}
.gather-stage::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(0,0,0,0.78), rgba(0,0,0,0.46), rgba(0,0,0,0.74)),
    linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.54)),
    radial-gradient(circle at 18% 30%, rgba(255,255,255,0.18), transparent 16%),
    radial-gradient(circle at 82% 22%, rgba(255,255,255,0.12), transparent 18%),
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0));
  pointer-events: none;
}
.gather-stage-row {
  position: relative;
  display: grid;
  grid-template-columns: 86px 1fr 92px;
  align-items: center;
  gap: 12px;
  min-height: 118px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(3,7,18,0.58);
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
  backdrop-filter: blur(8px);
}
.gather-archer,
.gather-node {
  width: 82px;
  height: 82px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 42px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.18);
  position: relative;
  z-index: 2;
  overflow: hidden;
}
.gather-archer {
  animation: gather-breathe 1.9s ease-in-out infinite;
}
.gather-node {
  justify-self: end;
}
.gather-actor-img,
.gather-node-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 10px 14px rgba(0,0,0,0.36));
}
.gather-node-img {
  transform: scale(1.08);
}
.gather-node.hit {
  animation: gather-hit 0.34s ease-out;
}
.gather-lane {
  position: relative;
  height: 74px;
  border-top: 1px dashed rgba(255,255,255,0.26);
  border-bottom: 1px dashed rgba(255,255,255,0.12);
  background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04));
  border-radius: 8px;
}
.gather-arrow-fx {
  position: absolute;
  left: 0;
  top: 23px;
  font-size: 28px;
  transform: translateX(0);
  animation: gather-shot 0.42s ease-out both;
  filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35));
}
.gather-float {
  position: absolute;
  right: 80px;
  top: -12px;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 950;
  background: rgba(15,23,42,0.88);
  border: 1px solid rgba(255,255,255,0.18);
  animation: gather-float 0.72s ease-out both;
  white-space: nowrap;
}
.gather-round-fx {
  position: relative;
  margin-top: 10px;
  padding: 9px 11px;
  border-radius: 8px;
  background: rgba(3,7,18,0.74);
  border: 1px solid rgba(255,255,255,0.2);
  font-size: 13px;
  font-weight: 900;
  animation: gather-pop 0.28s ease-out;
}
.gather-progress-track {
  position: relative;
  height: 18px;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  overflow: hidden;
}
.gather-progress-fill {
  position: relative;
  height: 100%;
  border-radius: inherit;
  transition: width 0.22s ease;
  overflow: hidden;
}
.gather-progress-fill::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
  transform: translateX(-100%);
  animation: gather-shine 1.35s linear infinite;
}
.gather-marker-row {
  position: relative;
  height: 22px;
  margin-top: 6px;
  font-size: 11px;
  color: rgba(255,255,255,0.58);
}
.gather-marker {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}
.gather-arrow-slots {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 12px;
}
.gather-slot,
.gather-score-btn {
  min-width: 0;
  border-radius: 8px;
  font-weight: 950;
}
.gather-slot {
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255,255,255,0.12);
  transition: transform 0.14s ease, background 0.14s ease;
}
.gather-slot.filled {
  transform: translateY(-1px);
}
.gather-score-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
}
.gather-score-btn {
  min-height: 45px;
  cursor: pointer;
  transition: transform 0.12s ease, filter 0.12s ease, opacity 0.12s ease;
}
.gather-score-btn:not(:disabled):active {
  transform: scale(0.96);
}
.gather-score-btn.high {
  box-shadow: 0 8px 22px rgba(0,0,0,0.25);
}
.gather-score-btn.low {
  opacity: 0.82;
}
.gather-score-btn:disabled {
  cursor: default;
  opacity: 0.48;
}
.gather-result-hero {
  position: relative;
  padding: 20px 14px;
  text-align: center;
  overflow: hidden;
}
.gather-readable {
  position: relative;
  z-index: 1;
  display: inline-block;
  max-width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(3,7,18,0.68);
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: 0 12px 30px rgba(0,0,0,0.28);
  backdrop-filter: blur(10px);
}
.gather-result-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 16px;
}
.gather-result-hero::before,
.gather-result-hero::after {
  content: "✨";
  position: absolute;
  font-size: 24px;
  opacity: 0.8;
  animation: gather-spark 1.4s ease-in-out infinite;
}
.gather-result-hero::before {
  left: 18px;
  top: 20px;
}
.gather-result-hero::after {
  right: 22px;
  bottom: 18px;
  animation-delay: 0.35s;
}
.gather-result-icon {
  width: 88px;
  height: 88px;
  margin: 0 auto 10px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 48px;
  background: rgba(255,255,255,0.12);
  animation: gather-pop 0.34s ease-out;
}
@keyframes gather-shot {
  0% { left: 0; transform: rotate(-8deg); opacity: 0; }
  12% { opacity: 1; }
  100% { left: calc(100% - 24px); transform: rotate(0deg); opacity: 0; }
}
@keyframes gather-float {
  0% { transform: translateY(8px) scale(0.9); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateY(-24px) scale(1); opacity: 0; }
}
@keyframes gather-hit {
  0% { transform: scale(1); filter: brightness(1); }
  45% { transform: scale(1.1); filter: brightness(1.45); }
  100% { transform: scale(1); filter: brightness(1); }
}
@keyframes gather-breathe {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes gather-pop {
  0% { transform: scale(0.94); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes gather-shine {
  100% { transform: translateX(100%); }
}
@keyframes gather-spark {
  0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.45; }
  50% { transform: translateY(-8px) rotate(12deg); opacity: 1; }
}
@media (max-width: 390px) {
  .gather-stage { padding: 12px; }
  .gather-stage-row { grid-template-columns: 68px 1fr 72px; gap: 8px; }
  .gather-archer, .gather-node { width: 66px; height: 66px; font-size: 34px; }
  .gather-score-grid { gap: 6px; }
  .gather-score-btn { min-height: 42px; }
}
`;

function scoreClass(label) {
  if (label === "X" || label === "10" || label === "9") return "high";
  if (label === "M" || Number(label) <= 3) return "low";
  return "";
}

function RewardLine({ icon, label, value }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      minHeight: 42,
      padding: "9px 11px",
      borderRadius: 8,
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.12)",
    }}>
      <span style={{ fontSize: 22, width: 28, textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.78)" }}>{label}</span>
      <b style={{ fontSize: 14, color: "white" }}>{value}</b>
    </div>
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function playGatheringArrowSfx(label, progress, siteId) {
  if (label === "X") sfxCritBoom();
  else if (progress >= 20) sfxArrowShoot();
  else if (progress > 0) sfxGatherClick();
  else sfxSoftFail();
  if (progress > 0) sfxCouncilWork(siteId);
  vibrate(label === "X" ? [0, 24, 36, 24] : 12);
}

function materialRewardDisplay(materialId, fallbackName) {
  const item = MATERIAL_MAP[materialId];
  if (!item) return { icon: "🧩", name: fallbackName || "素材" };
  return { icon: item.icon || "🧩", name: item.name || fallbackName || "素材" };
}

function loadStoredRun(storageKey, siteId, tier) {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.siteId !== siteId || parsed?.tier !== tier) return null;
    if (!["input", "result"].includes(parsed.phase)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredRun(storageKey, payload) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {}
}

function clearStoredRun(storageKey) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey);
  } catch {}
}

export default function GatheringRun({
  site,
  tier,
  buildingLevel,
  memberId,
  catId,
  catName,
  partySize = 1,
  goalParticipants = 1,
  modeLabel = "單人採集",
  storageKey = "",
  onStart,
  onFinish,
  onBack,
}) {
  const restoredRef = useRef(loadStoredRun(storageKey, site.id, tier));
  const restoredRun = restoredRef.current;
  const seedRef = useRef(restoredRun?.seed || Date.now());
  const contract = useMemo(() => buildGatheringRunContract({
    buildingId: site.id,
    tier,
    buildingLevel,
    seed: seedRef.current,
  }), [site.id, tier, buildingLevel]);

  const [phase, setPhase] = useState(restoredRun?.phase || "setup");
  const [roundNo, setRoundNo] = useState(restoredRun?.roundNo || 1);
  const [arrows, setArrows] = useState(() => Array.isArray(restoredRun?.arrows) ? restoredRun.arrows : []);
  const [rounds, setRounds] = useState(() => Array.isArray(restoredRun?.rounds) ? restoredRun.rounds : []);
  const [roundProgressFx, setRoundProgressFx] = useState(0);
  const [startLoading, setStartLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastShot, setLastShot] = useState(null);
  const [roundFx, setRoundFx] = useState(null);

  const theme = site.palette;
  const tierMeta = GATHERING_TIER_META[contract.tier] || GATHERING_TIER_META.common;
  const totalProgress = rounds.reduce((sum, round) => sum + round.progress, 0);
  const liveProgress = totalProgress + roundProgressFx;
  const progressPct = Math.min(200, liveProgress);
  const result = phase === "result" ? calculateGatheringRewards({ contract, rounds, partySize }) : null;
  const bgUrl = `/council/bg/${site.id}.webp`;
  const catUrl = `/council/cat/${site.id}.webp`;
  const obstacleUrl = `/council/obs/${site.id}_${contract.tier}.webp`;

  useEffect(() => {
    if (phase === "result") {
      sfxGatherVictory();
    }
  }, [phase]);

  useEffect(() => {
    if (!storageKey || phase === "setup") return;
    saveStoredRun(storageKey, {
      version: 1,
      siteId: site.id,
      tier,
      buildingLevel,
      seed: seedRef.current,
      phase: phase === "animating" ? "input" : phase,
      roundNo,
      arrows,
      rounds,
      updatedAt: Date.now(),
    });
  }, [storageKey, phase, site.id, tier, buildingLevel, roundNo, arrows, rounds]);

  async function start() {
    if (startLoading) return;
    unlockAudio();
    sfxCouncilWork(site.id);
    setStartLoading(true);
    setError("");
    const ok = await onStart?.();
    setStartLoading(false);
    if (ok === false) {
      sfxSoftFail();
      setError("今日委託次數不足，或委託建立失敗。");
      return;
    }
    sfxSuccess();
    setPhase("input");
  }

  function addArrow(label) {
    if (phase !== "input") return;
    unlockAudio();
    if (arrows.length >= GATHERING_ARROWS_PER_ROUND) {
      sfxSoftFail();
      return;
    }
    sfxGatherClick();
    setRoundFx(null);
    setArrows(prev => [...prev, label]);
  }

  function undoArrow() {
    if (phase !== "input" || arrows.length === 0) return;
    sfxSoftFail();
    setLastShot(null);
    setArrows(prev => prev.slice(0, -1));
  }

  async function submitRound() {
    if (phase !== "input" || arrows.length !== GATHERING_ARROWS_PER_ROUND) {
      sfxSoftFail();
      return;
    }
    const submittedArrows = [...arrows];
    setPhase("animating");
    setRoundFx(null);
    setRoundProgressFx(0);
    let animatedProgress = 0;

    for (const label of submittedArrows) {
      const progress = scoreToGatheringProgress(label);
      playGatheringArrowSfx(label, progress, site.id);
      animatedProgress += progress;
      setLastShot({ id: `${Date.now()}_${label}_${animatedProgress}`, label, progress });
      setRoundProgressFx(animatedProgress);
      await sleep(430);
    }

    const roundResult = calculateGatheringRound(submittedArrows);
    const nextRounds = [...rounds, { ...roundResult, arrows: submittedArrows }];
    setRoundFx({
      id: Date.now(),
      roundNo,
      progress: roundResult.progress,
      score: roundResult.score,
      xCount: roundResult.xCount,
    });
    setRounds(nextRounds);
    setArrows([]);
    setRoundProgressFx(0);
    sfxRoundEnd();
    if (roundNo >= contract.rounds) {
      setPhase("result");
      return;
    }
    setRoundNo(prev => prev + 1);
    setPhase("input");
  }

  async function finish({ continueRun = false } = {}) {
    if (!result) return;
    sfxGatherVictory();
    const payload = {
      race: site.race,
      clearedTier: contract.tier,
      contractVersion: contract.version,
      contractId: contract.id,
      gatheringRewards: { ...result, goalParticipants },
      catId,
      buildingId: site.id,
      totalArrows: rounds.length * GATHERING_ARROWS_PER_ROUND,
      goalParticipants,
      progressPct: result.progressPct,
      continueRun,
    };
    const ok = await onFinish?.(payload);
    if (ok !== false) clearStoredRun(storageKey);
  }

  if (phase === "setup") {
    return (
      <div style={{ minHeight: "100vh", padding: "16px 12px 88px", color: "white", background: `linear-gradient(160deg,${theme[0]},${theme[1]})` }}>
        <style>{GATHERING_RUN_CSS}</style>
        <button onClick={onBack} style={{ minHeight: 40, border: "none", background: "rgba(255,255,255,0.08)", color: "white", borderRadius: 8, padding: "0 12px", fontWeight: 800, cursor: "pointer" }}>
          返回委託板
        </button>

        <section style={{ marginTop: 16, padding: "18px 14px", borderRadius: 8, background: `linear-gradient(180deg,rgba(0,0,0,0.38),rgba(0,0,0,0.2)), url("${bgUrl}") center / cover`, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 18px 52px rgba(0,0,0,0.24)" }}>
          <div style={{ fontSize: 58, lineHeight: 1, marginBottom: 10 }}>{site.icon}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 24, letterSpacing: 0 }}>{site.name}</h2>
            <span style={{ padding: "4px 8px", borderRadius: 999, background: tierMeta.color, color: "white", fontSize: 12, fontWeight: 900 }}>
              {tierMeta.label}
            </span>
          </div>
          <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.7 }}>
            {site.flavor}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            <RewardLine icon="🎯" label="回合" value={`${contract.rounds}輪`} />
            <RewardLine icon="🏹" label="每輪" value={`${contract.arrowsPerRound}箭`} />
            <RewardLine icon="👥" label="模式" value={partySize > 1 ? `${modeLabel} ${partySize}人` : modeLabel} />
          </div>
          <div style={{ marginTop: 8 }}>
            <RewardLine icon="🐾" label="陪練" value={catId ? (catName || "已出戰") : "未裝備"} />
          </div>
        </section>

        <section style={{ marginTop: 12, padding: "12px", borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ fontWeight: 900, color: theme[2], marginBottom: 8 }}>採集規則</div>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: "rgba(255,255,255,0.72)" }}>
            分數會推進採集進度。三輪結束後依總進度結算：100%完成、130%豐收、180%大豐收。採集不給寶箱、金幣、射手經驗，主要獎勵是指定素材、貓村資源、貓經驗與羈絆。
          </div>
        </section>

        {error && <div style={{ marginTop: 12, color: "#fecaca", fontWeight: 800 }}>{error}</div>}
        <button onClick={start} disabled={startLoading} style={{
          width: "100%",
          minHeight: 54,
          marginTop: 16,
          border: "none",
          borderRadius: 8,
          background: `linear-gradient(90deg,${theme[2]},#ffffff)`,
          color: theme[0],
          fontWeight: 950,
          fontSize: 17,
          cursor: startLoading ? "default" : "pointer",
          opacity: startLoading ? 0.65 : 1,
        }}>
          {startLoading ? "建立委託中..." : "開始採集"}
        </button>
      </div>
    );
  }

  if (phase === "result" && result) {
    const resultColor = RESULT_COLOR[result.completion.key] || "#22c55e";
    const materialDisplay = materialRewardDisplay(result.materialId, result.materialName);
    return (
      <div className="gather-run" style={{ background: `linear-gradient(160deg,${theme[0]},${theme[1]})` }}>
        <style>{GATHERING_RUN_CSS}</style>
        <section className="gather-panel gather-result-hero" style={{ border: `1px solid ${resultColor}66`, background: `linear-gradient(180deg,rgba(0,0,0,0.48),rgba(0,0,0,0.22)), url("${bgUrl}") center / cover` }}>
          <div className="gather-readable">
            <div className="gather-result-icon" style={{ border: `2px solid ${resultColor}88` }}>
              {result.progressPct >= 100 ? "✅" : "🧭"}
            </div>
            <div style={{ fontSize: 24, fontWeight: 950, color: resultColor }}>{result.completion.label}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
              總進度 {result.progressPct}% · 總分 {result.totalScore} · X {result.xCount}
            </div>
          </div>
        </section>

        <section style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <RewardLine icon={materialDisplay.icon} label={materialDisplay.name} value={`×${result.materialCount}`} />
          {Object.values(result.villageResources).map((count, index) => (
            <RewardLine key={index} icon={site.icon} label={result.villageResourceName} value={`×${count}`} />
          ))}
          <RewardLine icon="🐱" label="貓貓經驗" value={`+${result.catXP}`} />
          <RewardLine icon="💗" label="貓貓羈絆" value={`+${result.catBond}`} />
          {result.partySize > 1 && (
            <RewardLine icon="👥" label="協力加成" value={`素材 x${result.partyBonus.materialMult.toFixed(2)} · 貓XP x${result.partyBonus.catXPMult.toFixed(2)}`} />
          )}
          {result.rareRewards.map((reward, index) => {
            const rareMaterial = reward.type === "material"
              ? materialRewardDisplay(reward.materialId, reward.name)
              : null;
            return (
              <RewardLine
                key={`${reward.type}-${index}`}
                icon={reward.type === "gachaCoins" ? "🎰" : rareMaterial?.icon || "✨"}
                label={rareMaterial?.name || reward.name}
                value={`×${reward.count}`}
              />
            );
          })}
        </section>

        <div className="gather-result-actions">
          <button onClick={() => finish({ continueRun: true })} style={{
            width: "100%",
            minHeight: 54,
            border: "none",
            borderRadius: 8,
            background: "linear-gradient(90deg,#16a34a,#22c55e)",
            color: "white",
            fontWeight: 950,
            fontSize: 17,
            cursor: "pointer",
          }}>
            領取並繼續採集
          </button>
          <button onClick={() => finish({ continueRun: false })} style={{
            width: "100%",
            minHeight: 48,
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 8,
            background: "rgba(255,255,255,0.1)",
            color: "white",
            fontWeight: 900,
            fontSize: 15,
            cursor: "pointer",
          }}>
            領取並返回委託板
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gather-run" style={{ background: `linear-gradient(160deg,${theme[0]},${theme[1]})` }}>
      <style>{GATHERING_RUN_CSS}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} style={{ minWidth: 42, minHeight: 42, border: "none", borderRadius: 8, background: "rgba(255,255,255,0.08)", color: "white", fontWeight: 900, cursor: "pointer" }}>
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>{site.name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
            第 {roundNo} / {contract.rounds} 輪 · {tierMeta.label}
          </div>
        </div>
      </div>

      <section className="gather-panel gather-stage" style={{ backgroundImage: `url("${bgUrl}")` }}>
        <div className="gather-stage-row">
          <div className="gather-archer" style={{ borderColor: `${theme[2]}66` }}>
            <img className="gather-actor-img" src={catUrl} alt="" draggable="false" />
          </div>
          <div className="gather-lane">
            {lastShot && (
              <div key={lastShot.id} className="gather-arrow-fx">➜</div>
            )}
            {lastShot && (
              <div key={`${lastShot.id}-float`} className="gather-float" style={{ color: lastShot.label === "X" ? "#fde68a" : "white" }}>
                {lastShot.label} · +{lastShot.progress}%
              </div>
            )}
          </div>
          <div className={`gather-node ${lastShot ? "hit" : ""}`} style={{ borderColor: `${theme[2]}66` }}>
            <img className="gather-node-img" src={obstacleUrl} alt="" draggable="false" />
          </div>
        </div>
        {roundFx && (
          <div key={roundFx.id} className="gather-round-fx">
            第 {roundFx.roundNo} 輪 +{roundFx.progress}% · {roundFx.score}分{roundFx.xCount ? ` · X ${roundFx.xCount}` : ""}
          </div>
        )}
      </section>

      <section className="gather-panel" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 78, height: 78, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 44, background: "rgba(255,255,255,0.1)", border: `1px solid ${theme[2]}66` }}>
            {site.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 7 }}>
              <span style={{ color: theme[2], fontWeight: 900 }}>採集進度</span>
            <b>{Math.round(liveProgress)}%</b>
            </div>
            <div className="gather-progress-track">
              <div className="gather-progress-fill" style={{ width: `${progressPct / 2}%`, background: `linear-gradient(90deg,${theme[2]},#ffffff)` }} />
            </div>
            <div className="gather-marker-row">
              <span className="gather-marker" style={{ left: "50%" }}>100% 完成</span>
              <span className="gather-marker" style={{ left: "65%" }}>130% 豐收</span>
              <span className="gather-marker" style={{ left: "90%" }}>180% 大豐收</span>
            </div>
          </div>
        </div>
      </section>

      <section className="gather-panel" style={{ padding: 12, background: "rgba(255,255,255,0.08)", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <b style={{ color: theme[2] }}>本輪箭矢</b>
          <button onClick={undoArrow} disabled={!arrows.length} style={{ minHeight: 34, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.15)", color: "white", fontWeight: 800, cursor: arrows.length ? "pointer" : "default", opacity: arrows.length ? 1 : 0.4 }}>
            復原
          </button>
        </div>
        <div className="gather-arrow-slots">
          {Array.from({ length: GATHERING_ARROWS_PER_ROUND }).map((_, index) => (
            <div key={index} className={`gather-slot ${arrows[index] ? "filled" : ""}`} style={{ background: arrows[index] ? theme[2] : "rgba(255,255,255,0.08)", color: arrows[index] ? theme[0] : "rgba(255,255,255,0.45)" }}>
              {arrows[index] || "-"}
            </div>
          ))}
        </div>
        <div className="gather-score-grid">
          {SCORE_LABELS.map(label => (
            <button key={label} className={`gather-score-btn ${scoreClass(label)}`} onClick={() => addArrow(label)} disabled={phase !== "input" || arrows.length >= GATHERING_ARROWS_PER_ROUND} style={{
              border: `1px solid ${theme[2]}55`,
              background: label === "X" ? theme[2] : "rgba(0,0,0,0.16)",
              color: label === "X" ? theme[0] : "white",
            }}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {rounds.map((round, index) => (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8, background: "rgba(0,0,0,0.16)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <b style={{ color: theme[2] }}>第 {index + 1} 輪</b>
            <span style={{ flex: 1, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>{round.arrows.join(" / ")}</span>
            <b>+{round.progress}%</b>
          </div>
        ))}
      </section>

      <button onClick={submitRound} disabled={arrows.length !== GATHERING_ARROWS_PER_ROUND} style={{
        width: "100%",
        minHeight: 52,
        border: "none",
        borderRadius: 8,
        background: phase === "input" && arrows.length === GATHERING_ARROWS_PER_ROUND ? `linear-gradient(90deg,${theme[2]},#ffffff)` : "rgba(255,255,255,0.12)",
        color: phase === "input" && arrows.length === GATHERING_ARROWS_PER_ROUND ? theme[0] : "rgba(255,255,255,0.45)",
        fontWeight: 950,
        fontSize: 16,
        cursor: phase === "input" && arrows.length === GATHERING_ARROWS_PER_ROUND ? "pointer" : "default",
      }}>
        {phase === "animating" ? "採集中..." : roundNo >= contract.rounds ? "送出並結算" : "送出本輪"}
      </button>
    </div>
  );
}
