import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { bootstrapRecentPerformanceCache, bootstrapRecentPerformanceSummaries, correctTargetPlotArrow, ensureMemberPerformanceSync, flushPendingShootingSessions, getCachedGamePerformanceSummaries, getCachedShootingSessionEnds, getCachedShootingSessionSummaries, getChangedGamePerformanceSummaries, getChangedShootingSessionSummaries, getMemberPerformanceSync, getMembers, getShootingSessionEnds, getShootingSessionHistory, getLocalPerformanceCacheMeta, setLocalPerformanceCacheMeta } from "../../lib/db";
import { calculateSessionMetrics } from "../../lib/shootingPerformance";
import { TARGET_FACE_FORMATS } from "../../lib/targetFace";
import { Card, Empty, Spinner, ST } from "../shared/UI";

const ALL = "all";
const SOURCE_LABELS = { freePractice:"自主練習", monster:"一般打怪", party:"組隊戰鬥", partyBattle:"組隊戰鬥", dungeon:"地下城", worldBoss:"世界王", duel:"決鬥", dailyMission:"每日任務", councilMission:"採集委託", guildMission:"公會任務", practice:"自主練習", lesson:"課程", competition:"賽事", certification:"檢定" };
const GAME_MODE_LABELS = { monster:"一般打怪", partyBattle:"組隊戰鬥", dungeon:"地下城", worldBoss:"世界王", duel:"決鬥" };
const PERIOD_OPTIONS = [["day", "日"], ["week", "週"], ["month", "月"], ["year", "年"], ["all", "全部"]];
const BOW_LABELS = { rental:"租借器材", recurve_bare:"裸弓", recurve_full:"反曲弓（全配）", compound:"複合弓", traditional:"傳統弓" };
const TARGET_FACE_LABELS = Object.fromEntries(TARGET_FACE_FORMATS.map(format => [format.id, format.shortLabel || format.label]));

function percent(value) { return `${Math.round((Number(value) || 0) * 100)}%`; }
function sessionMetrics(session) { return session.metricsSnapshot || {}; }
function selectOptions(values, label, display = value => value) {
  return [{ value:ALL, label:`全部${label}` }, ...[...new Set(values.filter(Boolean))].sort().map(value => ({ value:String(value), label:display(value) }))];
}
function arrowLabel(arrow) { return arrow.captureMode === "targetPlot" ? arrow.recordedScore?.label : arrow.label; }
function displayDate(session) {
  const date = session.finalizedAt?.toDate?.() || session.createdAt?.toDate?.();
  return date ? new Intl.DateTimeFormat("zh-TW", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }).format(date) : "剛完成";
}
function periodStartMs(period) {
  if (period === "all") return 0;
  const now = new Date();
  if (period === "year") return new Date(now.getFullYear(), 0, 1).getTime();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  now.setHours(0, 0, 0, 0);
  if (period === "week") now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return now.getTime();
}
function sessionTimeMs(session) {
  return session.finalizedAt?.toMillis?.() || session.createdAt?.toMillis?.() || 0;
}
function gameTitle(game) {
  return game.monster?.nameSnapshot || GAME_MODE_LABELS[game.mode] || game.mode || "戰鬥紀錄";
}
function gameResultLabel(result) {
  return result === "win" ? "勝利" : result === "lose" ? "戰敗" : "中途離開";
}
function buildRecentApproximation(sessions, targetArrows) {
  let arrowCount = 0; let totalScore = 0; let xCount = 0; let missCount = 0;
  for (const session of sessions) {
    const metrics = sessionMetrics(session);
    const arrows = Number(metrics.arrowCount ?? session.arrowCount) || 0;
    if (!arrows) continue;
    arrowCount += arrows; totalScore += Number(metrics.totalScore) || 0;
    xCount += Number(metrics.xCount) || 0; missCount += Number(metrics.missCount) || 0;
    if (arrowCount >= targetArrows) break;
  }
  return { targetArrows, arrowCount, average:arrowCount ? totalScore / arrowCount : null, xRate:arrowCount ? xCount / arrowCount : 0, missRate:arrowCount ? missCount / arrowCount : 0 };
}
function buildExactRecent(arrows, targetArrows) {
  const sample = arrows.slice(0, targetArrows);
  const total = sample.reduce((sum, arrow) => sum + arrow.score, 0);
  const xCount = sample.filter(arrow => arrow.isX).length;
  const missCount = sample.filter(arrow => arrow.isMiss).length;
  return { targetArrows, arrowCount:sample.length, average:sample.length ? total / sample.length : null, xRate:sample.length ? xCount / sample.length : 0, missRate:sample.length ? missCount / sample.length : 0 };
}
function arrowStats(arrows) {
  const count = arrows.length;
  const total = arrows.reduce((sum, arrow) => sum + arrow.score, 0);
  const misses = arrows.filter(arrow => arrow.isMiss).length;
  const xs = arrows.filter(arrow => arrow.isX).length;
  return { count, average:count ? total / count : 0, missRate:count ? misses / count : 0, xRate:count ? xs / count : 0 };
}
function buildTrainingInsight(arrows) {
  if (arrows.length < 30) return { title:"累積樣本中", text:"再完成一些逐箭紀錄後，系統會開始比較近期變化。" };
  if (arrows.length < 60) return { title:"近期狀態", text:`目前已有 ${arrows.length} 支本機逐箭資料；再累積至 60 支即可比較前後兩段表現。` };
  const recent = arrowStats(arrows.slice(0, 30));
  const previous = arrowStats(arrows.slice(30, 60));
  const averageDelta = recent.average - previous.average;
  const missDelta = recent.missRate - previous.missRate;
  if (averageDelta >= 0.2 && missDelta <= 0) return { title:"近期穩定進步", text:`近 30 箭平均 ${recent.average.toFixed(2)}，比前一組提升 ${averageDelta.toFixed(2)}；維持目前節奏。` };
  if (missDelta >= 0.04) return { title:"先降低失箭", text:`近 30 箭 M 率 ${(recent.missRate * 100).toFixed(0)}%，比前一組增加 ${(missDelta * 100).toFixed(0)}%；下一輪優先放慢射擊節奏與確認出箭流程。` };
  if (averageDelta <= -0.2) return { title:"近期平均下降", text:`近 30 箭平均比前一組低 ${Math.abs(averageDelta).toFixed(2)}；建議先以穩定節奏完成一組，再調整瞄準。` };
  return { title:"近期表現持平", text:`近 30 箭平均 ${recent.average.toFixed(2)}，M 率 ${(recent.missRate * 100).toFixed(0)}%；可用下一組專注一致的射前流程。` };
}
function Stat({ label, value, note, tone = "text-blue-300" }) {
  return <Card className="p-3"><div className="text-xs" style={{ color:"var(--text-secondary)" }}>{label}</div><div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div>{note && <div className="mt-1 text-[11px]" style={{ color:"var(--text-muted)" }}>{note}</div>}</Card>;
}
function FilterSelect({ value, onChange, options }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="ui-input min-w-28 px-2 py-1.5 text-xs">
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}
function TargetPlotScatter({ ends }) {
  const arrows = ends.flatMap(end => end.arrows || []).filter(arrow => arrow.captureMode === "targetPlot" && Number.isFinite(arrow.position?.x) && Number.isFinite(arrow.position?.y));
  if (!arrows.length) return null;
  return <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 rounded-full bg-slate-950/40" aria-label="箭群位置">
    {[44, 35, 26, 17, 8].map(radius => <circle key={radius} cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />)}
    <line x1="6" x2="94" y1="50" y2="50" stroke="rgba(255,255,255,.15)" /><line x1="50" x2="50" y1="6" y2="94" stroke="rgba(255,255,255,.15)" />
    {arrows.map((arrow, index) => <circle key={index} cx={50 + arrow.position.x * 44} cy={50 + arrow.position.y * 44} r="2.7" fill="#60a5fa" stroke="#dbeafe" strokeWidth=".6" />)}
  </svg>;
}
function correctionLabels(session) {
  const format = TARGET_FACE_FORMATS.find(item => item.id === session.shootingConfig?.targetFaceCode);
  const max = Number(format?.maxScore || session.shootingConfig?.maxScorePerArrow || 10);
  const min = Number(format?.minScore || 1);
  return ["X", ...Array.from({ length:max - min + 1 }, (_, index) => String(max - index)), "M"];
}
function SessionDetail({ session, canCorrect = false, correctedBy, onCorrected }) {
  const [ends, setEnds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    getShootingSessionEnds(session.id).then(data => { if (active) setEnds(data); }).catch(() => { if (active) setEnds([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.id]);
  async function applyCorrection(end, arrowIndex, label) {
    if (saving) return;
    setSaving(true); setEditError("");
    try {
      const metricsSnapshot = await correctTargetPlotArrow({ sessionId:session.id, memberId:session.memberId, endId:end.id, arrowIndex, label, correctedBy });
      setEnds(await getShootingSessionEnds(session.id));
      setEditing(null);
      onCorrected?.(session.id, metricsSnapshot);
    } catch (error) { setEditError(error?.message || "無法修正此箭"); }
    finally { setSaving(false); }
  }
  if (loading) return <div className="py-4"><Spinner /></div>;
  if (!ends.length) return <p className="py-3 text-xs" style={{ color:"var(--text-muted)" }}>此場尚未有可讀取的逐箭資料。</p>;
  const metrics = calculateSessionMetrics(ends);
  return <div className="mt-3 border-t pt-3" style={{ borderColor:"var(--border-subtle)" }}>
    <div className="text-xs font-bold mb-2" style={{ color:"var(--text-secondary)" }}>逐回合紀錄</div>
    <div className="flex flex-col gap-2">
      {ends.map(end => <div key={end.id} className="flex items-center gap-2 text-xs">
        <span className="w-10" style={{ color:"var(--text-muted)" }}>第 {end.index} 回</span>
        <div className="flex flex-1 flex-wrap gap-1">{(end.arrows || []).map((arrow, index) => <span key={index} className="inline-flex flex-col gap-1"><button type="button" disabled={!canCorrect || arrow.captureMode !== "targetPlot"} onClick={() => setEditing(editing?.endId === end.id && editing?.arrowIndex === index ? null : { endId:end.id, arrowIndex:index })} className={`rounded px-2 py-1 font-bold disabled:cursor-default ${arrowLabel(arrow) === "M" ? "bg-red-500/15 text-red-300" : arrowLabel(arrow) === "X" ? "bg-amber-400/15 text-amber-200" : "bg-white/10 text-gray-200"}`}>{arrowLabel(arrow)}{arrow.override?.applied ? "*" : ""}</button>{editing?.endId === end.id && editing?.arrowIndex === index && <span className="flex max-w-44 flex-wrap gap-1 rounded bg-slate-950/80 p-1">{correctionLabels(session).map(label => <button key={label} type="button" disabled={saving} onClick={() => applyCorrection(end, index, label)} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white">{label}</button>)}</span>}</span>)}</div>
        <span className="font-black text-blue-300">{end.metrics?.total ?? "—"}</span>
      </div>)}
    </div>
    {canCorrect && metrics?.targetPlotArrowCount > 0 && <p className="mt-2 text-[10px]" style={{ color:"var(--text-muted)" }}>點選靶面箭的分數可修正壓線判定；* 表示已覆寫。此修正只更新射箭分析，不會改變既有戰鬥傷害或獎勵。</p>}
    {editError && <p className="mt-2 text-xs text-red-300">{editError}</p>}
    {metrics?.targetPlotArrowCount > 0 && <div className="mt-4 border-t pt-3" style={{ borderColor:"var(--border-subtle)" }}><div className="text-xs font-bold" style={{ color:"var(--text-secondary)" }}>靶面箭群分析</div><div className="mt-2 flex gap-3"><TargetPlotScatter ends={ends} /><div className="grid flex-1 grid-cols-2 gap-2 text-xs"><div><span style={{ color:"var(--text-muted)" }}>座標樣本</span><div className="font-black text-blue-300">{metrics.targetPlotArrowCount} 箭</div></div><div><span style={{ color:"var(--text-muted)" }}>R50</span><div className="font-black text-blue-300">{metrics.groupR50?.toFixed(3)}</div></div><div><span style={{ color:"var(--text-muted)" }}>平均徑向誤差</span><div className="font-black text-blue-300">{metrics.meanRadialError?.toFixed(3)}</div></div><div><span style={{ color:"var(--text-muted)" }}>群心偏移</span><div className="font-black text-blue-300">{metrics.horizontalBias?.toFixed(3)}, {metrics.verticalBias?.toFixed(3)}</div></div></div></div>{metrics.targetSlotMetrics?.length > 1 && <div className="mt-2 text-[11px]" style={{ color:"var(--text-secondary)" }}>{metrics.targetSlotMetrics.map(slot => <span key={slot.targetSlotIndex} className="mr-3">靶位 {slot.targetSlotIndex + 1}：{slot.averageScore.toFixed(2)}／{slot.arrowCount} 箭</span>)}</div>}<p className="mt-2 text-[10px]" style={{ color:"var(--text-muted)" }}>座標為正規化靶面資料；群心數值依序為水平、垂直偏移。</p></div>}
  </div>;
}

// Game data is rendered from the immutable snapshot written at battle time.
// It intentionally never joins shooting metrics or requests arrow ends.
function GamePerformanceHistory({ games }) {
  const [limit, setLimit] = useState(5);
  const [selectedId, setSelectedId] = useState(null);
  const sorted = useMemo(() => [...games].sort((a, b) => sessionTimeMs(b) - sessionTimeMs(a)), [games]);
  const selected = sorted.find(item => item.id === selectedId);
  if (!sorted.length) return null;
  return <section><ST>遊戲表現詳細紀錄</ST><Card className="p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs" style={{ color:"var(--text-secondary)" }}>只顯示戰鬥當下鎖定的遊戲數值</span><div className="flex gap-1">{[5, 10, 20].map(count => <button key={count} type="button" onClick={() => setLimit(count)} className={`rounded px-2 py-1 text-[10px] font-bold ${limit === count ? "bg-indigo-500 text-white" : "bg-white/10"}`}>{count} 場</button>)}</div></div><div className="flex flex-col divide-y" style={{ borderColor:"var(--border-subtle)" }}>{sorted.slice(0, limit).map(game => <button key={game.id} type="button" onClick={() => setSelectedId(selectedId === game.id ? null : game.id)} className="flex items-center justify-between gap-3 py-2 text-left text-xs"><span><b style={{ color:"var(--text-primary)" }}>{gameTitle(game)}</b><span className="ml-2" style={{ color:"var(--text-muted)" }}>{displayDate(game)} ・ {gameResultLabel(game.result)}</span></span><b className="text-rose-300">{(Number(game.totalDamage) || 0).toLocaleString()} 傷害</b></button>)}</div>{selected && <div className="mt-3 border-t pt-3 text-xs" style={{ borderColor:"var(--border-subtle)" }}><div className="grid grid-cols-2 gap-2"><div><span style={{ color:"var(--text-muted)" }}>怪物／難度</span><div className="font-bold" style={{ color:"var(--text-primary)" }}>{selected.monster?.nameSnapshot || "—"}{selected.monster?.difficulty ? ` ・ ${selected.monster.difficulty}` : ""}</div></div><div><span style={{ color:"var(--text-muted)" }}>剩餘 HP</span><div className="font-bold" style={{ color:"var(--text-primary)" }}>{selected.monster?.remainingHp ?? "—"}</div></div></div>{selected.rounds?.length > 0 && <div className="mt-3"><div className="font-bold" style={{ color:"var(--text-secondary)" }}>各回合傷害</div><div className="mt-1 flex flex-wrap gap-1">{selected.rounds.map(round => <span key={round.endIndex} className="rounded bg-white/10 px-2 py-1">第 {round.endIndex} 回：{Number(round.finalDamage || 0).toLocaleString()}</span>)}</div></div>}{selected.rewards && <div className="mt-3"><div className="font-bold" style={{ color:"var(--text-secondary)" }}>獎勵</div><div className="mt-1">XP {selected.rewards.xp || 0} ・ 金幣 {selected.rewards.coins || 0}{selected.rewards.drops?.length ? ` ・ ${selected.rewards.drops.map(drop => `${drop.itemNameSnapshot || drop.itemId} ×${drop.quantity}`).join("、")}` : ""}</div></div>}<p className="mt-3 text-[10px]" style={{ color:"var(--text-muted)" }}>戰鬥資料已鎖定；修正射擊分數不會重新計算本場傷害、獎勵或勝敗。</p></div>}</Card></section>;
}

export default function MemberPerformance({ profileOverride = null, coachView = false }) {
  const { profile: authProfile, role } = useAuth();
  const profile = profileOverride || authProfile;
  const [sessions, setSessions] = useState([]); const [games, setGames] = useState([]);
  const [syncInfo, setSyncInfo] = useState(null); const [transferring, setTransferring] = useState(false); const [transferProgress, setTransferProgress] = useState(null); const [exactRecent, setExactRecent] = useState([]); const [exactArrows, setExactArrows] = useState([]); const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [filters, setFilters] = useState({ period:"month", bow:ALL, distance:ALL, face:ALL, capture:ALL, arrows:ALL, source:ALL });
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionListLimit, setSessionListLimit] = useState(5);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [loadingFullHistory, setLoadingFullHistory] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const canReviewMembers = !profileOverride && role === "admin";
  const viewedMemberId = canReviewMembers ? (selectedMemberId || profile?.id) : profile?.id;
  const canCorrectTargetPlot = Boolean(profile?.id) && (coachView || viewedMemberId === profile.id || role === "admin");
  function handleSessionCorrected(sessionId, metricsSnapshot) {
    setSessions(current => current.map(item => item.id === sessionId ? { ...item, status:"corrected", metricsSnapshot } : item));
  }
  async function loadFullHistory() {
    if (!viewedMemberId || loadingFullHistory) return;
    setLoadingFullHistory(true); setError("");
    try {
      const history = await getShootingSessionHistory(viewedMemberId, 300);
      setSessions(history);
      setFilters(current => ({ ...current, period:"all" }));
      setShowSessionHistory(true);
    } catch (error) { setError("完整歷史紀錄暫時無法載入，請稍後再試。"); }
    finally { setLoadingFullHistory(false); }
  }
  useEffect(() => {
    if (!canReviewMembers) { setMembers([]); return; }
    getMembers().then(setMembers).catch(() => setMembers([]));
  }, [canReviewMembers]);
  useEffect(() => {
    if (!viewedMemberId) { setSessions([]); setGames([]); setLoading(false); return; }
    let active = true; setLoading(true); setError("");
    Promise.all([getCachedShootingSessionSummaries(viewedMemberId), getCachedGamePerformanceSummaries(viewedMemberId), flushPendingShootingSessions(viewedMemberId)])
      .then(async ([cachedSessions, cachedGames]) => {
        if (active) { setSessions(cachedSessions); setGames(cachedGames); }
        let local = getLocalPerformanceCacheMeta(viewedMemberId);
        let cloud = await getMemberPerformanceSync(viewedMemberId); // the only normal network read
        if (!active) return;
        // Existing users already have Firebase's persistent session cache from
        // prior versions. Attach a zero revision once, then fetch only the
        // sessions written by the new sync protocol instead of re-reading the
        // old cache or requiring the new-device transfer button.
        if (!local?.initialized && cachedSessions.length) {
          local = { revision:0, initialized:true, rangeMonths:3, sessionCount:cachedSessions.length };
          setLocalPerformanceCacheMeta(viewedMemberId, local);
        }
        // A coach cannot use the student's browser cache. On first view, load
        // only three months of session summaries into the coach's own cache.
        if (!local?.initialized && coachView) {
          const transferred = await bootstrapRecentPerformanceSummaries(viewedMemberId, 3);
          if (!active) return;
          cachedSessions = transferred.sessions;
          cloud = transferred.sync;
          local = getLocalPerformanceCacheMeta(viewedMemberId);
          setSessions(cachedSessions); setGames(transferred.games);
        }
        // New shooters start at revision 0 automatically; their first session
        // increments it and will be picked up without a manual transfer.
        if (!local?.initialized && !coachView) {
          cloud = await ensureMemberPerformanceSync(viewedMemberId);
          local = { revision:Number(cloud?.revision) || 0, initialized:true, rangeMonths:3, sessionCount:0 };
          setLocalPerformanceCacheMeta(viewedMemberId, local);
        }
        setSyncInfo({ local, cloud });
        if (!local?.initialized || !cloud || Number(local.revision) === Number(cloud.revision)) return;
        const [changes, gameChanges] = await Promise.all([
          getChangedShootingSessionSummaries(viewedMemberId, Number(local.revision) || 0),
          getChangedGamePerformanceSummaries(viewedMemberId, Number(local.revision) || 0),
        ]);
        if (!active) return;
        const byId = new Map(cachedSessions.map(session => [session.id, session]));
        changes.forEach(session => byId.set(session.id, session));
        setSessions([...byId.values()].sort((a, b) => (b.finalizedAt?.toMillis?.() || 0) - (a.finalizedAt?.toMillis?.() || 0)));
        const gamesById = new Map(cachedGames.map(item => [item.id, item]));
        gameChanges.forEach(item => gamesById.set(item.id, item));
        setGames([...gamesById.values()].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
        setLocalPerformanceCacheMeta(viewedMemberId, { ...local, initialized:true, revision:Number(cloud.revision) || 0 });
        setSyncInfo({ local:{ ...local, revision:Number(cloud.revision) || 0, initialized:true }, cloud });
      })
      .catch(error => { console.warn("performance load:", error?.message); if (active) setError("本機表現資料同步暫時失敗，請稍後再試。"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [viewedMemberId]);
  async function transferRecentHistory() {
    if (!viewedMemberId || transferring) return;
    setTransferring(true); setError("");
    try {
      const { sessions:recentSessions, games:recentGames, sync } = await bootstrapRecentPerformanceCache(viewedMemberId, 3, setTransferProgress);
      setSessions(recentSessions); setGames(recentGames); setSyncInfo({ local:getLocalPerformanceCacheMeta(viewedMemberId), cloud:sync });
    } catch (error) { setError("建立近三個月歷史資料失敗，請確認網路後再試。"); }
    finally { setTransferring(false); setTransferProgress(null); }
  }
  const sourceSessions = useMemo(() => sessions.filter(session => session.isRealShooting === true && session.countsToward?.performance !== false && ["finalized", "corrected"].includes(session.status) && (Number(sessionMetrics(session).arrowCount ?? session.arrowCount) || 0) > 0), [sessions]);
  const filterOptions = useMemo(() => ({
    bow:selectOptions(sourceSessions.map(item => item.shootingConfig?.bowType), "弓種", value => BOW_LABELS[value] || value),
    distance:selectOptions(sourceSessions.map(item => item.shootingConfig?.distanceM), "距離"),
    face:selectOptions(sourceSessions.map(item => item.shootingConfig?.targetFaceCode), "靶面", value => TARGET_FACE_LABELS[value] || value),
    capture:[{ value:ALL, label:"全部輸入" }, { value:"scoreInput", label:"一般計分" }, { value:"targetPlot", label:"靶面點擊" }],
    arrows:selectOptions(sourceSessions.map(item => item.shootingConfig?.arrowsPerEnd), "箭制"),
    // Modes are a product taxonomy, not a side effect of whichever records
    // happened to be cached on this device. Keep empty modes selectable.
    source:[{ value:ALL, label:"全部模式" }, ...Object.keys(SOURCE_LABELS).map(value => ({ value, label:SOURCE_LABELS[value] }))],
  }), [sourceSessions]);
  const filtered = useMemo(() => sourceSessions.filter(item => {
    const config = item.shootingConfig || {};
    return sessionTimeMs(item) >= periodStartMs(filters.period) && (filters.bow === ALL || config.bowType === filters.bow) && (filters.distance === ALL || String(config.distanceM) === filters.distance) && (filters.face === ALL || config.targetFaceCode === filters.face) && (filters.capture === ALL || item.captureMode === filters.capture) && (filters.arrows === ALL || String(config.arrowsPerEnd) === filters.arrows) && (filters.source === ALL || item.source?.mode === filters.source);
  }), [sourceSessions, filters]);
  // Main coaching metrics must never average unlike shooting conditions.
  // When no explicit condition filter is selected, use the newest comparable
  // profile in the current period; the session list still shows every record.
  const activePerformanceKey = useMemo(() => filtered.find(item => item.analysis?.comparable !== false && item.analysis?.performanceKey)?.analysis?.performanceKey || null, [filtered]);
  const comparableFiltered = useMemo(() => activePerformanceKey ? filtered.filter(item => item.analysis?.performanceKey === activePerformanceKey) : [], [filtered, activePerformanceKey]);
  const visibleSessions = useMemo(() => filtered.slice(0, sessionListLimit), [filtered, sessionListLimit]);
  const historicalSessions = useMemo(() => filtered.slice(20), [filtered]);
  useEffect(() => {
    let active = true;
    async function loadExactRecent() {
      const arrows = [];
      for (const session of comparableFiltered) {
        const ends = await getCachedShootingSessionEnds(session.id);
        for (const end of [...ends].reverse()) for (const arrow of [...(end.arrows || [])].reverse()) {
          const recorded = arrow.captureMode === "targetPlot" ? arrow.recordedScore : arrow;
          if (Number.isFinite(Number(recorded?.score))) arrows.push({ score:Number(recorded.score), isX:Boolean(recorded.isX), isMiss:Boolean(recorded.isMiss) });
          if (arrows.length >= 90) break;
        }
        if (arrows.length >= 90) break;
      }
      if (active) { setExactArrows(arrows); setExactRecent(arrows.length ? [30, 60, 90].map(target => buildExactRecent(arrows, target)) : []); }
    }
    loadExactRecent();
    return () => { active = false; };
  }, [comparableFiltered]);
  const shooting = useMemo(() => {
    // The headline total is an activity total: it must include every real
    // session selected by the user, regardless of mode or shooting condition.
    // Only averages/PB below stay limited to a comparable performance key.
    const arrowCount = filtered.reduce((sum, session) => sum + (Number(sessionMetrics(session).arrowCount ?? session.arrowCount) || 0), 0);
    const comparableArrowCount = comparableFiltered.reduce((sum, session) => sum + (Number(sessionMetrics(session).arrowCount ?? session.arrowCount) || 0), 0);
    const best = comparableFiltered.reduce((current, session) => !current || (Number(sessionMetrics(session).averageArrow) || 0) > (Number(sessionMetrics(current).averageArrow) || 0) ? session : current, null);
    return { arrowCount, comparableArrowCount, recent:[30, 60, 90].map(target => buildRecentApproximation(comparableFiltered, target)), bestAverage:best ? Number(sessionMetrics(best).averageArrow) || 0 : null };
  }, [filtered, comparableFiltered]);
  const trainingInsight = useMemo(() => buildTrainingInsight(exactArrows), [exactArrows]);
  const game = useMemo(() => {
    const wins = games.filter(item => item.result === "win").length;
    const damages = games.map(item => Number(item.totalDamage) || 0);
    const byMode = new Map();
    games.forEach(item => {
      const mode = item.mode || "unknown";
      const current = byMode.get(mode) || { mode, count:0, wins:0, totalDamage:0, highestDamage:0 };
      const damage = Number(item.totalDamage) || 0;
      current.count += 1; current.wins += item.result === "win" ? 1 : 0; current.totalDamage += damage; current.highestDamage = Math.max(current.highestDamage, damage);
      byMode.set(mode, current);
    });
    return { count:games.length, wins, totalDamage:damages.reduce((sum, value) => sum + value, 0), highestDamage:damages.length ? Math.max(...damages) : 0, byMode:[...byMode.values()].sort((a, b) => b.count - a.count), recent:[...games].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 10) };
  }, [games]);
  if (loading) return <Spinner />;
  return <div className="p-4 flex flex-col gap-4" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
    <div><h2 className="text-xl font-black" style={{ color:"var(--text-primary)" }}>射手表現</h2><p className="mt-1 text-xs" style={{ color:"var(--text-secondary)" }}>真實射箭與遊戲結果分開保存、分開解讀。</p></div>
    <GamePerformanceHistory games={games} />
    {canReviewMembers && <Card className="p-3"><label className="text-xs font-bold" style={{ color:"var(--text-secondary)" }}>查看射手</label><select value={selectedMemberId || profile?.id || ""} onChange={event => setSelectedMemberId(event.target.value)} className="ui-input mt-2 w-full px-3 py-2 text-sm"><optgroup label="教練本人"><option value={profile?.id || ""}>我自己的射手表現</option></optgroup><optgroup label="學員（最近登入優先）">{members.filter(member => member.id !== profile?.id).map(member => <option key={member.id} value={member.id}>{member.name || member.nickname || member.id}{member.lastLoginAt ? " ・ 已登入" : " ・ 尚未登入"}</option>)}</optgroup></select><p className="mt-2 text-[10px]" style={{ color:"var(--text-muted)" }}>學員依最近登入時間排序；教練的個人紀錄不會與學員資料混在一起。</p></Card>}
    {error && <Card className="p-4 text-sm text-red-300">{error}</Card>}
    <Card className="p-3"><div className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>完整歷史紀錄</div><p className="mt-1 text-xs" style={{ color:"var(--text-secondary)" }}>平常只保留近三個月於此裝置；需要回顧舊資料時，才會一次載入最多 300 場歷史摘要。</p><button type="button" onClick={loadFullHistory} disabled={loadingFullHistory} className="mt-3 rounded bg-white/10 px-3 py-2 text-xs font-bold text-blue-200 disabled:opacity-50">{loadingFullHistory ? "載入中…" : "載入完整歷史（最多 300 場）"}</button></Card>
    <section><ST>篩選射擊條件</ST><div className="mb-2 flex gap-1 overflow-x-auto pb-1">{PERIOD_OPTIONS.map(([value, label]) => <button key={value} type="button" onClick={() => setFilters(current => ({ ...current, period:value }))} className={`shrink-0 rounded px-3 py-1.5 text-xs font-bold ${filters.period === value ? "bg-emerald-500 text-white" : "bg-white/10"}`} style={filters.period === value ? undefined : { color:"var(--text-secondary)" }}>{label}</button>)}</div><div className="flex gap-2 overflow-x-auto pb-1"><FilterSelect value={filters.bow} onChange={value => setFilters(current => ({ ...current, bow:value }))} options={filterOptions.bow} /><FilterSelect value={filters.distance} onChange={value => setFilters(current => ({ ...current, distance:value }))} options={filterOptions.distance} /><FilterSelect value={filters.face} onChange={value => setFilters(current => ({ ...current, face:value }))} options={filterOptions.face} /><FilterSelect value={filters.capture} onChange={value => setFilters(current => ({ ...current, capture:value }))} options={filterOptions.capture} /><FilterSelect value={filters.arrows} onChange={value => setFilters(current => ({ ...current, arrows:value }))} options={filterOptions.arrows} /><FilterSelect value={filters.source} onChange={value => setFilters(current => ({ ...current, source:value }))} options={filterOptions.source} /></div><p className="mt-2 text-[10px]" style={{ color:"var(--text-muted)" }}>期間以場次完成時間分類；切換日、週、月、年不會重新下載全部資料。</p></section>
    <section><ST>真實射箭表現</ST>{!comparableFiltered.length ? <Empty icon="🏹" message="此條件下尚未有可比較的真實射箭紀錄。" /> : <>{(() => { const recent = exactRecent.length ? exactRecent : shooting.recent; return <><div className="grid grid-cols-2 gap-3"><Stat label="累計真實箭數" value={shooting.arrowCount} note={`全部模式共 ${filtered.length} 場；其中 ${shooting.comparableArrowCount} 箭可作同條件比較`} tone="text-emerald-300" /><Stat label="最佳單場每箭平均" value={shooting.bestAverage?.toFixed(2) ?? "—"} note="僅依相同射擊條件計算" tone="text-amber-300" /></div><div className="mt-3 grid grid-cols-3 gap-2">{recent.map(item => <Stat key={item.targetArrows} label={`近 ${item.targetArrows} 箭`} value={item.average == null ? "—" : item.average.toFixed(2)} note={item.arrowCount ? `使用 ${item.arrowCount} 箭` : "樣本不足"} />)}</div><div className="mt-3 grid grid-cols-2 gap-3"><Stat label="近期待命中率" value={percent(1 - (recent[0]?.missRate || 0))} note={`M 率 ${percent(recent[0]?.missRate)}`} tone="text-emerald-300" /><Stat label="近期 X 率" value={percent(recent[0]?.xRate)} note="X 與 M 均以真實逐箭輸入統計" tone="text-violet-300" /></div><p className="mt-3 text-[11px] leading-relaxed" style={{ color:"var(--text-muted)" }}>{exactRecent.length ? "近 30／60／90 箭直接以此裝置快取的逐箭資料精確計算。" : "尚未有本機逐箭快取，暫以完整場次摘要近似；可建立近三個月歷史資料取得精確計算。"} 箭數總覽會包含所有模式；平均、X 率與 PB 則只比較相同射擊條件。</p></>; })()}</>}</section>
    <section><ST>下一個訓練提示</ST><Card className="p-3"><div className="text-sm font-black text-amber-200">{trainingInsight.title}</div><p className="mt-1 text-xs leading-relaxed" style={{ color:"var(--text-secondary)" }}>{trainingInsight.text}</p><p className="mt-2 text-[10px]" style={{ color:"var(--text-muted)" }}>提示僅依此裝置的逐箭紀錄產生，不使用遊戲傷害或裝備數值。</p></Card></section>
    <section><ST>場次分析</ST>{!filtered.length ? null : <><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[11px]" style={{ color:"var(--text-muted)" }}>顯示最近場次</span><div className="flex gap-1">{[5, 10, 20].map(count => <button key={count} type="button" onClick={() => setSessionListLimit(count)} className={`rounded px-2 py-1 text-[11px] font-bold ${sessionListLimit === count ? "bg-blue-500 text-white" : "bg-white/10"}`} style={sessionListLimit === count ? undefined : { color:"var(--text-secondary)" }}>{count} 場</button>)}</div></div><div className="flex flex-col gap-2">{visibleSessions.map(session => { const metrics = sessionMetrics(session); const isSelected = selectedSessionId === session.id; const config = session.shootingConfig || {}; return <Card key={session.id} className="p-3"><button className="w-full text-left" onClick={() => setSelectedSessionId(isSelected ? null : session.id)}><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>{SOURCE_LABELS[session.source?.mode] || session.source?.mode || "射擊紀錄"}</div><div className="mt-1 text-[11px]" style={{ color:"var(--text-muted)" }}>{displayDate(session)} ・ {config.bowType || "未記錄弓種"} ・ {config.distanceM ?? "—"}m ・ {config.targetFaceCode || "未記錄靶面"} ・ {config.arrowsPerEnd || "—"}箭制</div></div><div className="text-right"><div className="text-lg font-black text-blue-300">{Number(metrics.averageArrow || 0).toFixed(2)}</div><div className="text-[11px]" style={{ color:"var(--text-muted)" }}>{metrics.totalScore || 0} 分 / {metrics.arrowCount || session.arrowCount} 箭</div></div></div><div className="mt-2 flex gap-3 text-[11px]" style={{ color:"var(--text-secondary)" }}><span>X {metrics.xCount || 0}</span><span>M {metrics.missCount || 0}</span><span>回合波動 {Number(metrics.endStdDev || 0).toFixed(2)}</span><span>後段差 {Number(metrics.fatigueDelta || 0).toFixed(2)}</span></div></button>{isSelected && <SessionDetail session={session} canCorrect={canCorrectTargetPlot} correctedBy={profile?.id} onCorrected={handleSessionCorrected} />}</Card>; })}</div>{historicalSessions.length > 0 && <Card className="mt-3 p-3"><button type="button" onClick={() => setShowSessionHistory(value => !value)} className="flex w-full items-center justify-between text-left"><span className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>歷史紀錄</span><span className="text-xs text-blue-300">{showSessionHistory ? "收起" : `查看其餘 ${historicalSessions.length} 場`}</span></button>{showSessionHistory && <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor:"var(--border-subtle)" }}>{historicalSessions.map(session => { const metrics = sessionMetrics(session); const isSelected = selectedSessionId === session.id; return <button key={session.id} type="button" onClick={() => setSelectedSessionId(isSelected ? null : session.id)} className="flex items-center justify-between gap-3 text-left text-xs"><div><div className="font-bold" style={{ color:"var(--text-primary)" }}>{SOURCE_LABELS[session.source?.mode] || session.source?.mode || "射擊紀錄"}</div><div className="mt-0.5" style={{ color:"var(--text-muted)" }}>{displayDate(session)} ・ {session.shootingConfig?.distanceM ?? "—"}m ・ {metrics.arrowCount || session.arrowCount} 箭</div>{isSelected && <SessionDetail session={session} canCorrect={canCorrectTargetPlot} correctedBy={profile?.id} onCorrected={handleSessionCorrected} />}</div><div className="font-black text-blue-300">{Number(metrics.averageArrow || 0).toFixed(2)}</div></button>; })}</div>}</Card>}</>}</section>
    <section><ST>遊戲戰績</ST>{game.count === 0 ? <Empty icon="⚔️" message="尚未有新的遊戲戰績紀錄。" /> : <div className="flex flex-col gap-3"><div className="grid grid-cols-2 gap-3"><Stat label="完成戰鬥" value={game.count} note={`勝率 ${percent(game.count ? game.wins / game.count : 0)}`} tone="text-indigo-300" /><Stat label="累計傷害" value={game.totalDamage.toLocaleString()} note={`最高單場 ${game.highestDamage.toLocaleString()}`} tone="text-rose-300" /></div><Card className="p-3"><div className="text-xs font-bold" style={{ color:"var(--text-secondary)" }}>各模式戰績</div><div className="mt-2 flex flex-col divide-y" style={{ borderColor:"var(--border-subtle)" }}>{game.byMode.map(item => <div key={item.mode} className="flex items-center justify-between gap-3 py-2 text-xs"><div><div className="font-bold" style={{ color:"var(--text-primary)" }}>{GAME_MODE_LABELS[item.mode] || item.mode}</div><div className="mt-0.5" style={{ color:"var(--text-muted)" }}>{item.count} 場 ・ 勝率 {percent(item.wins / item.count)}</div></div><div className="text-right"><div className="font-black text-rose-300">{item.totalDamage.toLocaleString()}</div><div className="text-[10px]" style={{ color:"var(--text-muted)" }}>最高 {item.highestDamage.toLocaleString()}</div></div></div>)}</div></Card><Card className="p-3"><div className="text-xs font-bold" style={{ color:"var(--text-secondary)" }}>近期戰鬥</div><div className="mt-2 flex flex-col divide-y" style={{ borderColor:"var(--border-subtle)" }}>{game.recent.map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-xs"><div><div className="font-bold" style={{ color:"var(--text-primary)" }}>{gameTitle(item)}</div><div className="mt-0.5" style={{ color:"var(--text-muted)" }}>{GAME_MODE_LABELS[item.mode] || item.mode || "戰鬥"} ・ {displayDate(item)}{item.monster?.difficulty ? ` ・ ${item.monster.difficulty}` : ""}</div></div><div className="text-right"><div className={item.result === "win" ? "font-black text-emerald-300" : "font-black text-amber-300"}>{gameResultLabel(item.result)}</div><div className="text-[11px] text-rose-300">{(Number(item.totalDamage) || 0).toLocaleString()} 傷害</div></div></div>)}</div></Card><p className="text-[10px] leading-relaxed" style={{ color:"var(--text-muted)" }}>此區只顯示戰鬥當下鎖定的傷害與勝敗，不會納入射箭平均、命中率或訓練提示。</p></div>}</section>
    <section><ST>本機資料與同步</ST><Card className="p-3"><div className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>{syncInfo?.local?.initialized ? "此裝置已儲存射手表現資料" : "此裝置尚未建立射手歷史資料"}</div><p className="mt-1 text-xs leading-relaxed" style={{ color:"var(--text-secondary)" }}>平常只比對一筆同步摘要；版本相同時不會重新讀取全部射擊紀錄。新設備可主動下載最近三個月的場次與逐箭資料。</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px]" style={{ color:"var(--text-muted)" }}>{transferProgress ? `下載 ${transferProgress.completed}／${transferProgress.total} 場` : `本機版本 ${syncInfo?.local?.revision ?? "—"} ・ 雲端版本 ${syncInfo?.cloud?.revision ?? "—"}`}</span><button type="button" onClick={transferRecentHistory} disabled={transferring} className="rounded bg-blue-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{transferring ? "建立中…" : "新設備：建立近 3 個月歷史資料"}</button></div></Card></section>
  </div>;
}
