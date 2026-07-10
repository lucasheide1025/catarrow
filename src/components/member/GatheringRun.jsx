import { useMemo, useRef, useState } from "react";
import {
  GATHERING_ARROWS_PER_ROUND,
  GATHERING_TIER_META,
  buildGatheringRunContract,
  calculateGatheringRewards,
  calculateGatheringRound,
  scoreToGatheringProgress,
} from "../../lib/catVillageGathering";

const SCORE_LABELS = ["X", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];

const RESULT_COLOR = {
  comfort: "#94a3b8",
  partial: "#38bdf8",
  complete: "#22c55e",
  harvest: "#f59e0b",
  great: "#f472b6",
};

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
  onStart,
  onFinish,
  onBack,
}) {
  const seedRef = useRef(Date.now());
  const contract = useMemo(() => buildGatheringRunContract({
    buildingId: site.id,
    tier,
    buildingLevel,
    seed: seedRef.current,
  }), [site.id, tier, buildingLevel]);

  const [phase, setPhase] = useState("setup");
  const [roundNo, setRoundNo] = useState(1);
  const [arrows, setArrows] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [startLoading, setStartLoading] = useState(false);
  const [error, setError] = useState("");

  const theme = site.palette;
  const tierMeta = GATHERING_TIER_META[contract.tier] || GATHERING_TIER_META.common;
  const totalProgress = rounds.reduce((sum, round) => sum + round.progress, 0);
  const previewProgress = totalProgress + arrows.reduce((sum, label) => sum + scoreToGatheringProgress(label), 0);
  const progressPct = Math.min(200, previewProgress);
  const result = phase === "result" ? calculateGatheringRewards({ contract, rounds, partySize }) : null;

  async function start() {
    if (startLoading) return;
    setStartLoading(true);
    setError("");
    const ok = await onStart?.();
    setStartLoading(false);
    if (ok === false) {
      setError("今日委託次數不足，或委託建立失敗。");
      return;
    }
    setPhase("input");
  }

  function addArrow(label) {
    if (phase !== "input" || arrows.length >= GATHERING_ARROWS_PER_ROUND) return;
    setArrows(prev => [...prev, label]);
  }

  function undoArrow() {
    if (phase !== "input" || arrows.length === 0) return;
    setArrows(prev => prev.slice(0, -1));
  }

  function submitRound() {
    if (arrows.length !== GATHERING_ARROWS_PER_ROUND) return;
    const roundResult = calculateGatheringRound(arrows);
    const nextRounds = [...rounds, { ...roundResult, arrows }];
    setRounds(nextRounds);
    setArrows([]);
    if (roundNo >= contract.rounds) {
      setPhase("result");
      return;
    }
    setRoundNo(prev => prev + 1);
  }

  function finish() {
    if (!result) return;
    onFinish?.({
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
    });
  }

  if (phase === "setup") {
    return (
      <div style={{ minHeight: "100vh", padding: "16px 12px 88px", color: "white", background: `linear-gradient(160deg,${theme[0]},${theme[1]})` }}>
        <button onClick={onBack} style={{ minHeight: 40, border: "none", background: "rgba(255,255,255,0.08)", color: "white", borderRadius: 8, padding: "0 12px", fontWeight: 800, cursor: "pointer" }}>
          返回委託板
        </button>

        <section style={{ marginTop: 16, padding: "18px 14px", borderRadius: 8, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.12)" }}>
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
    return (
      <div style={{ minHeight: "100vh", padding: "16px 12px 88px", color: "white", background: `linear-gradient(160deg,${theme[0]},${theme[1]})` }}>
        <section style={{ padding: "18px 14px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: `1px solid ${resultColor}66`, textAlign: "center" }}>
          <div style={{ fontSize: 54, marginBottom: 8 }}>{result.progressPct >= 100 ? "✅" : "🧭"}</div>
          <div style={{ fontSize: 24, fontWeight: 950, color: resultColor }}>{result.completion.label}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            總進度 {result.progressPct}% · 總分 {result.totalScore} · X {result.xCount}
          </div>
        </section>

        <section style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <RewardLine icon="🧩" label={result.materialName} value={`×${result.materialCount}`} />
          {Object.values(result.villageResources).map((count, index) => (
            <RewardLine key={index} icon={site.icon} label={result.villageResourceName} value={`×${count}`} />
          ))}
          <RewardLine icon="🐱" label="貓貓經驗" value={`+${result.catXP}`} />
          <RewardLine icon="💗" label="貓貓羈絆" value={`+${result.catBond}`} />
          {result.partySize > 1 && (
            <RewardLine icon="👥" label="協力加成" value={`素材 x${result.partyBonus.materialMult.toFixed(2)} · 貓XP x${result.partyBonus.catXPMult.toFixed(2)}`} />
          )}
          {result.rareRewards.map((reward, index) => (
            <RewardLine key={`${reward.type}-${index}`} icon={reward.type === "gachaCoins" ? "🎰" : "✨"} label={reward.name} value={`×${reward.count}`} />
          ))}
        </section>

        <button onClick={finish} style={{
          width: "100%",
          minHeight: 54,
          marginTop: 16,
          border: "none",
          borderRadius: 8,
          background: "linear-gradient(90deg,#16a34a,#22c55e)",
          color: "white",
          fontWeight: 950,
          fontSize: 17,
          cursor: "pointer",
        }}>
          領取採集成果
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "14px 12px 88px", color: "white", background: `linear-gradient(160deg,${theme[0]},${theme[1]})` }}>
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

      <section style={{ padding: 14, borderRadius: 8, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 78, height: 78, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 44, background: "rgba(255,255,255,0.1)", border: `1px solid ${theme[2]}66` }}>
            {site.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 7 }}>
              <span style={{ color: theme[2], fontWeight: 900 }}>採集進度</span>
              <b>{Math.round(previewProgress)}%</b>
            </div>
            <div style={{ height: 16, borderRadius: 999, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <div style={{ width: `${progressPct / 2}%`, height: "100%", background: `linear-gradient(90deg,${theme[2]},#ffffff)`, transition: "width 0.2s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
              <span>100% 完成</span>
              <span>130% 豐收</span>
              <span>180% 大豐收</span>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <b style={{ color: theme[2] }}>本輪箭矢</b>
          <button onClick={undoArrow} disabled={!arrows.length} style={{ minHeight: 34, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.15)", color: "white", fontWeight: 800, cursor: arrows.length ? "pointer" : "default", opacity: arrows.length ? 1 : 0.4 }}>
            復原
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${GATHERING_ARROWS_PER_ROUND}, minmax(0, 1fr))`, gap: 6, marginBottom: 12 }}>
          {Array.from({ length: GATHERING_ARROWS_PER_ROUND }).map((_, index) => (
            <div key={index} style={{ height: 40, borderRadius: 8, display: "grid", placeItems: "center", background: arrows[index] ? theme[2] : "rgba(255,255,255,0.08)", color: arrows[index] ? theme[0] : "rgba(255,255,255,0.45)", fontWeight: 950 }}>
              {arrows[index] || "-"}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 7 }}>
          {SCORE_LABELS.map(label => (
            <button key={label} onClick={() => addArrow(label)} disabled={arrows.length >= GATHERING_ARROWS_PER_ROUND} style={{
              minHeight: 43,
              borderRadius: 8,
              border: `1px solid ${theme[2]}55`,
              background: label === "X" ? theme[2] : "rgba(0,0,0,0.16)",
              color: label === "X" ? theme[0] : "white",
              fontWeight: 950,
              cursor: arrows.length >= GATHERING_ARROWS_PER_ROUND ? "default" : "pointer",
              opacity: arrows.length >= GATHERING_ARROWS_PER_ROUND ? 0.55 : 1,
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
        background: arrows.length === GATHERING_ARROWS_PER_ROUND ? `linear-gradient(90deg,${theme[2]},#ffffff)` : "rgba(255,255,255,0.12)",
        color: arrows.length === GATHERING_ARROWS_PER_ROUND ? theme[0] : "rgba(255,255,255,0.45)",
        fontWeight: 950,
        fontSize: 16,
        cursor: arrows.length === GATHERING_ARROWS_PER_ROUND ? "pointer" : "default",
      }}>
        {roundNo >= contract.rounds ? "結束委託並結算" : "送出本輪"}
      </button>
    </div>
  );
}
