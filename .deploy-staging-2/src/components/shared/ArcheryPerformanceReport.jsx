import { useMemo } from "react";
import { analyzeBattlePractice } from "../../lib/battlePractice";
import { getTargetFaceFormat } from "../../lib/targetFace";
import { TargetFaceInput } from "./TargetFaceOverlay";

function Metric({ label, value, tone = "text-white" }) {
  return (
    <div className="rounded-xl bg-white/5 p-2 text-center">
      <div className="text-[10px] text-white/40">{label}</div>
      <div className={`mt-0.5 text-base font-black ${tone}`}>{value}</div>
    </div>
  );
}

function landingDirection(landing) {
  if (!landing) return "";
  const horizontal = landing.centerX < -0.08 ? "偏左" : landing.centerX > 0.08 ? "偏右" : "水平居中";
  const vertical = landing.centerY < -0.08 ? "偏上" : landing.centerY > 0.08 ? "偏下" : "垂直居中";
  return `${horizontal}・${vertical}`;
}

export default function ArcheryPerformanceReport({
  rounds,
  targetFormat = "full_110",
  arrowPositions = [],
}) {
  const stats = useMemo(
    () => analyzeBattlePractice(rounds, targetFormat, arrowPositions),
    [arrowPositions, rounds, targetFormat]
  );
  const format = getTargetFaceFormat(targetFormat);
  if (!stats) {
    return <div className="py-4 text-center text-xs text-white/35">沒有可分析的箭值</div>;
  }

  const maxRoundAverage = Math.max(format.maxScore, ...stats.perRound.map(round => round.average));
  const fatigueTone = stats.halfDelta > 0.2
    ? "text-green-300"
    : stats.halfDelta < -0.2
      ? "text-rose-300"
      : "text-blue-200";
  const plotPositions = arrowPositions.map(position => ({
    ...position,
    label:position.label ?? position.score,
    faceIndex:position.faceIndex ?? position.spotIdx ?? 0,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="總箭數" value={stats.count} />
        <Metric label="真實均分" value={stats.average.toFixed(2)} tone="text-blue-200" />
        <Metric label="命中率" value={`${stats.hitRate.toFixed(1)}%`} tone="text-green-300" />
        <Metric label={`高分 ≥${stats.highThreshold}`} value={`${stats.highRate.toFixed(1)}%`} tone="text-amber-300" />
        <Metric label="X／10" value={`${stats.xCount}／${stats.tenCount}`} tone="text-yellow-300" />
        <Metric label="脫靶 M" value={stats.misses} tone={stats.misses ? "text-rose-300" : "text-white"} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-[10px] text-white/40">穩定度</div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="text-lg font-black text-purple-300">{stats.stability.toFixed(1)}%</span>
            <span className="text-[10px] text-white/35">σ {stats.stdDev.toFixed(2)}</span>
          </div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-[10px] text-white/40">前後半段</div>
          <div className={`mt-1 text-sm font-black ${fatigueTone}`}>
            {stats.firstHalfAvg.toFixed(1)} → {stats.secondHalfAvg.toFixed(1)}
            <span className="ml-1 text-[10px]">
              ({stats.halfDelta >= 0 ? "+" : ""}{stats.halfDelta.toFixed(2)})
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white/5 p-3">
        <div className="mb-2 text-[10px] font-black text-white/45">每回合均分</div>
        <div className="flex flex-col gap-1.5">
          {stats.perRound.map(round => (
            <div key={round.round} className="grid grid-cols-[28px_1fr_42px] items-center gap-2 text-[10px]">
              <span className="text-white/35">R{round.round}</span>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-blue-400"
                  style={{ width:`${Math.min(100, round.average / maxRoundAverage * 100)}%` }} />
              </div>
              <span className="text-right font-black text-blue-200">{round.average.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {plotPositions.length > 0 ? (
        <div className="rounded-xl bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-black text-white/45">落點分布</span>
            {stats.landing ? (
              <span className="text-[10px] text-emerald-300">
                {landingDirection(stats.landing)}・散布 {(stats.landing.averageSpread * 100).toFixed(0)}%
              </span>
            ) : null}
          </div>
          <div className="flex justify-center overflow-hidden">
            <TargetFaceInput
              fmtId={format.id}
              radius={format.layout === "vertical_triple" ? 42 : 88}
              arrowLabels={plotPositions.map(position => position.label)}
              arrowPositions={plotPositions}
              arrowsPerRound={0}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
