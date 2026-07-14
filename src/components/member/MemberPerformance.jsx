import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getGamePerformanceSummaries, getShootingSessionSummaries } from "../../lib/db";
import { Card, Empty, Spinner, ST } from "../shared/UI";

function percent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function sessionMetrics(session) {
  return session.metricsSnapshot || {};
}

function buildRecentApproximation(sessions, targetArrows) {
  let arrowCount = 0;
  let totalScore = 0;
  let xCount = 0;
  let missCount = 0;
  for (const session of sessions) {
    const metrics = sessionMetrics(session);
    const arrows = Number(metrics.arrowCount ?? session.arrowCount) || 0;
    if (arrows <= 0) continue;
    arrowCount += arrows;
    totalScore += Number(metrics.totalScore) || 0;
    xCount += Number(metrics.xCount) || 0;
    missCount += Number(metrics.missCount) || 0;
    if (arrowCount >= targetArrows) break;
  }
  return {
    targetArrows,
    arrowCount,
    average: arrowCount ? totalScore / arrowCount : null,
    xRate: arrowCount ? xCount / arrowCount : 0,
    missRate: arrowCount ? missCount / arrowCount : 0,
  };
}

function ShootingStat({ label, value, note, tone = "text-blue-300" }) {
  return (
    <Card className="p-3">
      <div className="text-xs" style={{ color:"var(--text-secondary)" }}>{label}</div>
      <div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div>
      {note && <div className="mt-1 text-[11px]" style={{ color:"var(--text-muted)" }}>{note}</div>}
    </Card>
  );
}

export default function MemberPerformance() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.id) {
      setSessions([]);
      setGames([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      getShootingSessionSummaries(profile.id),
      getGamePerformanceSummaries(profile.id),
    ]).then(([nextSessions, nextGames]) => {
      if (!active) return;
      setSessions(nextSessions);
      setGames(nextGames);
    }).catch(() => {
      if (active) setError("暫時無法讀取表現紀錄，請稍後再試。");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [profile?.id]);

  const shooting = useMemo(() => {
    const finalized = sessions.filter(session =>
      session.isRealShooting === true &&
      session.countsToward?.performance !== false &&
      ["finalized", "corrected"].includes(session.status) &&
      (Number(sessionMetrics(session).arrowCount ?? session.arrowCount) || 0) > 0
    );
    const arrowCount = finalized.reduce((sum, session) => sum + (Number(sessionMetrics(session).arrowCount ?? session.arrowCount) || 0), 0);
    const best = finalized.reduce((current, session) => {
      const average = Number(sessionMetrics(session).averageArrow) || 0;
      return !current || average > (Number(sessionMetrics(current).averageArrow) || 0) ? session : current;
    }, null);
    return {
      sessions: finalized,
      arrowCount,
      recent: [30, 60, 90].map(target => buildRecentApproximation(finalized, target)),
      bestAverage: best ? Number(sessionMetrics(best).averageArrow) || 0 : null,
    };
  }, [sessions]);

  const game = useMemo(() => {
    const count = games.length;
    const wins = games.filter(item => item.result === "win").length;
    const damages = games.map(item => Number(item.totalDamage) || 0);
    return {
      count,
      wins,
      totalDamage: damages.reduce((sum, value) => sum + value, 0),
      highestDamage: damages.length ? Math.max(...damages) : 0,
    };
  }, [games]);

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <div>
        <h2 className="text-xl font-black" style={{ color:"var(--text-primary)" }}>射手表現</h2>
        <p className="mt-1 text-xs" style={{ color:"var(--text-secondary)" }}>真實射箭與遊戲結果分開保存、分開解讀。</p>
      </div>
      {error && <Card className="p-4 text-sm text-red-300">{error}</Card>}
      <section>
        <ST>真實射箭表現</ST>
        {shooting.sessions.length === 0 ? <Empty icon="🏹" message="尚未有可分析的真實射箭紀錄。完成一場新戰鬥後會自動加入。" /> : <>
          <div className="grid grid-cols-2 gap-3">
            <ShootingStat label="累計真實箭數" value={shooting.arrowCount} note={`${shooting.sessions.length} 場已完成射擊`} tone="text-emerald-300" />
            <ShootingStat label="最佳單場每箭平均" value={shooting.bestAverage?.toFixed(2) ?? "—"} note="依同場實際箭數計算" tone="text-amber-300" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {shooting.recent.map(item => <ShootingStat key={item.targetArrows} label={`近 ${item.targetArrows} 箭`} value={item.average == null ? "—" : item.average.toFixed(2)} note={item.arrowCount ? `使用 ${item.arrowCount} 箭` : "樣本不足"} />)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ShootingStat label="近期待命中率" value={percent(1 - (shooting.recent[0]?.missRate || 0))} note={`M 率 ${percent(shooting.recent[0]?.missRate)}`} tone="text-emerald-300" />
            <ShootingStat label="近期 X 率" value={percent(shooting.recent[0]?.xRate)} note="X 與 M 均以真實逐箭輸入統計" tone="text-violet-300" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color:"var(--text-muted)" }}>近期 30／60／90 箭目前以完整場次摘要近似；進入單場詳細紀錄後，會使用逐箭資料做精確切分。</p>
        </>}
      </section>
      <section>
        <ST>遊戲戰績</ST>
        {game.count === 0 ? <Empty icon="⚔️" message="尚未有新的遊戲戰績紀錄。" /> : <div className="grid grid-cols-2 gap-3">
          <ShootingStat label="完成戰鬥" value={game.count} note={`勝率 ${percent(game.count ? game.wins / game.count : 0)}`} tone="text-indigo-300" />
          <ShootingStat label="累計傷害" value={game.totalDamage.toLocaleString()} note={`最高單場 ${game.highestDamage.toLocaleString()}`} tone="text-rose-300" />
        </div>}
      </section>
    </div>
  );
}
