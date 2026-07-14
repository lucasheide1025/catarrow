import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { bootstrapRecentPerformanceCache, getCachedGamePerformanceSummaries, getCachedShootingSessionSummaries, getChangedShootingSessionSummaries, getMemberPerformanceSync, getMembers, getShootingSessionEnds, getLocalPerformanceCacheMeta, setLocalPerformanceCacheMeta } from "../../lib/db";
import { calculateSessionMetrics } from "../../lib/shootingPerformance";
import { Card, Empty, Spinner, ST } from "../shared/UI";

const ALL = "all";
const SOURCE_LABELS = { monster:"打怪", partyBattle:"組隊", dungeon:"地下城", worldBoss:"世界王", duel:"決鬥", practice:"自主練習", lesson:"課程", competition:"賽事", certification:"檢定" };

function percent(value) { return `${Math.round((Number(value) || 0) * 100)}%`; }
function sessionMetrics(session) { return session.metricsSnapshot || {}; }
function selectOptions(values, label) {
  return [{ value:ALL, label:`全部${label}` }, ...[...new Set(values.filter(Boolean))].sort().map(value => ({ value:String(value), label:String(value) }))];
}
function arrowLabel(arrow) { return arrow.captureMode === "targetPlot" ? arrow.recordedScore?.label : arrow.label; }
function displayDate(session) {
  const date = session.finalizedAt?.toDate?.() || session.createdAt?.toDate?.();
  return date ? new Intl.DateTimeFormat("zh-TW", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }).format(date) : "剛完成";
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
function SessionDetail({ session }) {
  const [ends, setEnds] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    getShootingSessionEnds(session.id).then(data => { if (active) setEnds(data); }).catch(() => { if (active) setEnds([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.id]);
  if (loading) return <div className="py-4"><Spinner /></div>;
  if (!ends.length) return <p className="py-3 text-xs" style={{ color:"var(--text-muted)" }}>此場尚未有可讀取的逐箭資料。</p>;
  const metrics = calculateSessionMetrics(ends);
  return <div className="mt-3 border-t pt-3" style={{ borderColor:"var(--border-subtle)" }}>
    <div className="text-xs font-bold mb-2" style={{ color:"var(--text-secondary)" }}>逐回合紀錄</div>
    <div className="flex flex-col gap-2">
      {ends.map(end => <div key={end.id} className="flex items-center gap-2 text-xs">
        <span className="w-10" style={{ color:"var(--text-muted)" }}>第 {end.index} 回</span>
        <div className="flex flex-1 flex-wrap gap-1">{(end.arrows || []).map((arrow, index) => <span key={index} className={`rounded px-2 py-1 font-bold ${arrowLabel(arrow) === "M" ? "bg-red-500/15 text-red-300" : arrowLabel(arrow) === "X" ? "bg-amber-400/15 text-amber-200" : "bg-white/10 text-gray-200"}`}>{arrowLabel(arrow)}</span>)}</div>
        <span className="font-black text-blue-300">{end.metrics?.total ?? "—"}</span>
      </div>)}
    </div>
    {metrics?.targetPlotArrowCount > 0 && <div className="mt-4 border-t pt-3" style={{ borderColor:"var(--border-subtle)" }}><div className="text-xs font-bold" style={{ color:"var(--text-secondary)" }}>靶面箭群分析</div><div className="mt-2 flex gap-3"><TargetPlotScatter ends={ends} /><div className="grid flex-1 grid-cols-2 gap-2 text-xs"><div><span style={{ color:"var(--text-muted)" }}>座標樣本</span><div className="font-black text-blue-300">{metrics.targetPlotArrowCount} 箭</div></div><div><span style={{ color:"var(--text-muted)" }}>R50</span><div className="font-black text-blue-300">{metrics.groupR50?.toFixed(3)}</div></div><div><span style={{ color:"var(--text-muted)" }}>平均徑向誤差</span><div className="font-black text-blue-300">{metrics.meanRadialError?.toFixed(3)}</div></div><div><span style={{ color:"var(--text-muted)" }}>群心偏移</span><div className="font-black text-blue-300">{metrics.horizontalBias?.toFixed(3)}, {metrics.verticalBias?.toFixed(3)}</div></div></div></div>{metrics.targetSlotMetrics?.length > 1 && <div className="mt-2 text-[11px]" style={{ color:"var(--text-secondary)" }}>{metrics.targetSlotMetrics.map(slot => <span key={slot.targetSlotIndex} className="mr-3">靶位 {slot.targetSlotIndex + 1}：{slot.averageScore.toFixed(2)}／{slot.arrowCount} 箭</span>)}</div>}<p className="mt-2 text-[10px]" style={{ color:"var(--text-muted)" }}>座標為正規化靶面資料；群心數值依序為水平、垂直偏移。</p></div>}
  </div>;
}

export default function MemberPerformance({ profileOverride = null }) {
  const { profile: authProfile, role } = useAuth();
  const profile = profileOverride || authProfile;
  const [sessions, setSessions] = useState([]); const [games, setGames] = useState([]);
  const [syncInfo, setSyncInfo] = useState(null); const [transferring, setTransferring] = useState(false); const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [filters, setFilters] = useState({ bow:ALL, distance:ALL, face:ALL, capture:ALL, arrows:ALL, source:ALL });
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const canReviewMembers = !profileOverride && role === "admin";
  const viewedMemberId = canReviewMembers ? (selectedMemberId || profile?.id) : profile?.id;
  useEffect(() => {
    if (!canReviewMembers) { setMembers([]); return; }
    getMembers().then(setMembers).catch(() => setMembers([]));
  }, [canReviewMembers]);
  useEffect(() => {
    if (!viewedMemberId) { setSessions([]); setGames([]); setLoading(false); return; }
    let active = true; setLoading(true); setError("");
    Promise.all([getCachedShootingSessionSummaries(viewedMemberId), getCachedGamePerformanceSummaries(viewedMemberId)])
      .then(async ([cachedSessions, cachedGames]) => {
        if (active) { setSessions(cachedSessions); setGames(cachedGames); }
        let local = getLocalPerformanceCacheMeta(viewedMemberId);
        const cloud = await getMemberPerformanceSync(viewedMemberId); // the only normal network read
        if (!active) return;
        // Existing users already have Firebase's persistent session cache from
        // prior versions. Attach a zero revision once, then fetch only the
        // sessions written by the new sync protocol instead of re-reading the
        // old cache or requiring the new-device transfer button.
        if (!local?.initialized && cachedSessions.length) {
          local = { revision:0, initialized:true, rangeMonths:3, sessionCount:cachedSessions.length };
          setLocalPerformanceCacheMeta(viewedMemberId, local);
        }
        setSyncInfo({ local, cloud });
        if (!local?.initialized || !cloud || Number(local.revision) === Number(cloud.revision)) return;
        const changes = await getChangedShootingSessionSummaries(viewedMemberId, Number(local.revision) || 0);
        if (!active) return;
        const byId = new Map(cachedSessions.map(session => [session.id, session]));
        changes.forEach(session => byId.set(session.id, session));
        setSessions([...byId.values()].sort((a, b) => (b.finalizedAt?.toMillis?.() || 0) - (a.finalizedAt?.toMillis?.() || 0)));
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
      const { sessions:recentSessions, sync } = await bootstrapRecentPerformanceCache(viewedMemberId, 3);
      setSessions(recentSessions); setSyncInfo({ local:getLocalPerformanceCacheMeta(viewedMemberId), cloud:sync });
    } catch (error) { setError("建立近三個月歷史資料失敗，請確認網路後再試。"); }
    finally { setTransferring(false); }
  }
  const sourceSessions = useMemo(() => sessions.filter(session => session.isRealShooting === true && session.countsToward?.performance !== false && ["finalized", "corrected"].includes(session.status) && (Number(sessionMetrics(session).arrowCount ?? session.arrowCount) || 0) > 0), [sessions]);
  const filterOptions = useMemo(() => ({
    bow:selectOptions(sourceSessions.map(item => item.shootingConfig?.bowType), "弓種"),
    distance:selectOptions(sourceSessions.map(item => item.shootingConfig?.distanceM), "距離"),
    face:selectOptions(sourceSessions.map(item => item.shootingConfig?.targetFaceCode), "靶面"),
    capture:[{ value:ALL, label:"全部輸入" }, { value:"scoreInput", label:"一般計分" }, { value:"targetPlot", label:"靶面點擊" }],
    arrows:selectOptions(sourceSessions.map(item => item.shootingConfig?.arrowsPerEnd), "箭制"),
    source:[{ value:ALL, label:"全部模式" }, ...[...new Set(sourceSessions.map(item => item.source?.mode).filter(Boolean))].map(value => ({ value, label:SOURCE_LABELS[value] || value }))],
  }), [sourceSessions]);
  const filtered = useMemo(() => sourceSessions.filter(item => {
    const config = item.shootingConfig || {};
    return (filters.bow === ALL || config.bowType === filters.bow) && (filters.distance === ALL || String(config.distanceM) === filters.distance) && (filters.face === ALL || config.targetFaceCode === filters.face) && (filters.capture === ALL || item.captureMode === filters.capture) && (filters.arrows === ALL || String(config.arrowsPerEnd) === filters.arrows) && (filters.source === ALL || item.source?.mode === filters.source);
  }), [sourceSessions, filters]);
  const shooting = useMemo(() => {
    const arrowCount = filtered.reduce((sum, session) => sum + (Number(sessionMetrics(session).arrowCount ?? session.arrowCount) || 0), 0);
    const best = filtered.reduce((current, session) => !current || (Number(sessionMetrics(session).averageArrow) || 0) > (Number(sessionMetrics(current).averageArrow) || 0) ? session : current, null);
    return { arrowCount, recent:[30, 60, 90].map(target => buildRecentApproximation(filtered, target)), bestAverage:best ? Number(sessionMetrics(best).averageArrow) || 0 : null };
  }, [filtered]);
  const game = useMemo(() => { const wins = games.filter(item => item.result === "win").length; const damages = games.map(item => Number(item.totalDamage) || 0); return { count:games.length, wins, totalDamage:damages.reduce((sum, value) => sum + value, 0), highestDamage:damages.length ? Math.max(...damages) : 0 }; }, [games]);
  if (loading) return <Spinner />;
  return <div className="p-4 flex flex-col gap-4" style={{ minHeight:"100dvh", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
    <div><h2 className="text-xl font-black" style={{ color:"var(--text-primary)" }}>射手表現</h2><p className="mt-1 text-xs" style={{ color:"var(--text-secondary)" }}>真實射箭與遊戲結果分開保存、分開解讀。</p></div>
    {canReviewMembers && <Card className="p-3"><label className="text-xs font-bold" style={{ color:"var(--text-secondary)" }}>查看學員</label><select value={selectedMemberId || profile?.id || ""} onChange={event => setSelectedMemberId(event.target.value)} className="ui-input mt-2 w-full px-3 py-2 text-sm"><option value={profile?.id || ""}>我自己的紀錄</option>{members.filter(member => member.id !== profile?.id).map(member => <option key={member.id} value={member.id}>{member.name || member.nickname || member.id}</option>)}</select></Card>}
    {error && <Card className="p-4 text-sm text-red-300">{error}</Card>}
    <section><ST>篩選射擊條件</ST><div className="flex gap-2 overflow-x-auto pb-1"><FilterSelect value={filters.bow} onChange={value => setFilters(current => ({ ...current, bow:value }))} options={filterOptions.bow} /><FilterSelect value={filters.distance} onChange={value => setFilters(current => ({ ...current, distance:value }))} options={filterOptions.distance} /><FilterSelect value={filters.face} onChange={value => setFilters(current => ({ ...current, face:value }))} options={filterOptions.face} /><FilterSelect value={filters.capture} onChange={value => setFilters(current => ({ ...current, capture:value }))} options={filterOptions.capture} /><FilterSelect value={filters.arrows} onChange={value => setFilters(current => ({ ...current, arrows:value }))} options={filterOptions.arrows} /><FilterSelect value={filters.source} onChange={value => setFilters(current => ({ ...current, source:value }))} options={filterOptions.source} /></div></section>
    <section><ST>真實射箭表現</ST>{!filtered.length ? <Empty icon="🏹" message="此條件下尚未有可分析的真實射箭紀錄。" /> : <><div className="grid grid-cols-2 gap-3"><Stat label="累計真實箭數" value={shooting.arrowCount} note={`${filtered.length} 場已完成射擊`} tone="text-emerald-300" /><Stat label="最佳單場每箭平均" value={shooting.bestAverage?.toFixed(2) ?? "—"} note="依同場實際箭數計算" tone="text-amber-300" /></div><div className="mt-3 grid grid-cols-3 gap-2">{shooting.recent.map(item => <Stat key={item.targetArrows} label={`近 ${item.targetArrows} 箭`} value={item.average == null ? "—" : item.average.toFixed(2)} note={item.arrowCount ? `使用 ${item.arrowCount} 箭` : "樣本不足"} />)}</div><div className="mt-3 grid grid-cols-2 gap-3"><Stat label="近期待命中率" value={percent(1 - (shooting.recent[0]?.missRate || 0))} note={`M 率 ${percent(shooting.recent[0]?.missRate)}`} tone="text-emerald-300" /><Stat label="近期 X 率" value={percent(shooting.recent[0]?.xRate)} note="X 與 M 均以真實逐箭輸入統計" tone="text-violet-300" /></div><p className="mt-3 text-[11px] leading-relaxed" style={{ color:"var(--text-muted)" }}>30／60／90 箭目前以完整場次摘要近似；點選下方單場可讀取其逐箭資料。</p></>}</section>
    <section><ST>場次分析</ST>{!filtered.length ? null : <div className="flex flex-col gap-2">{filtered.map(session => { const metrics = sessionMetrics(session); const isSelected = selectedSessionId === session.id; const config = session.shootingConfig || {}; return <Card key={session.id} className="p-3"><button className="w-full text-left" onClick={() => setSelectedSessionId(isSelected ? null : session.id)}><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>{SOURCE_LABELS[session.source?.mode] || session.source?.mode || "射擊紀錄"}</div><div className="mt-1 text-[11px]" style={{ color:"var(--text-muted)" }}>{displayDate(session)} ・ {config.bowType || "未記錄弓種"} ・ {config.distanceM ?? "—"}m ・ {config.targetFaceCode || "未記錄靶面"} ・ {config.arrowsPerEnd || "—"}箭制</div></div><div className="text-right"><div className="text-lg font-black text-blue-300">{Number(metrics.averageArrow || 0).toFixed(2)}</div><div className="text-[11px]" style={{ color:"var(--text-muted)" }}>{metrics.totalScore || 0} 分 / {metrics.arrowCount || session.arrowCount} 箭</div></div></div><div className="mt-2 flex gap-3 text-[11px]" style={{ color:"var(--text-secondary)" }}><span>X {metrics.xCount || 0}</span><span>M {metrics.missCount || 0}</span><span>回合波動 {Number(metrics.endStdDev || 0).toFixed(2)}</span><span>後段差 {Number(metrics.fatigueDelta || 0).toFixed(2)}</span></div></button>{isSelected && <SessionDetail session={session} />}</Card>; })}</div>}</section>
    <section><ST>遊戲戰績</ST>{game.count === 0 ? <Empty icon="⚔️" message="尚未有新的遊戲戰績紀錄。" /> : <div className="grid grid-cols-2 gap-3"><Stat label="完成戰鬥" value={game.count} note={`勝率 ${percent(game.count ? game.wins / game.count : 0)}`} tone="text-indigo-300" /><Stat label="累計傷害" value={game.totalDamage.toLocaleString()} note={`最高單場 ${game.highestDamage.toLocaleString()}`} tone="text-rose-300" /></div>}</section>
    <section><ST>本機資料與同步</ST><Card className="p-3"><div className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>{syncInfo?.local?.initialized ? "此裝置已儲存射手表現資料" : "此裝置尚未建立射手歷史資料"}</div><p className="mt-1 text-xs leading-relaxed" style={{ color:"var(--text-secondary)" }}>平常只比對一筆同步摘要；版本相同時不會重新讀取全部射擊紀錄。新設備可主動下載最近三個月的場次摘要。</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px]" style={{ color:"var(--text-muted)" }}>本機版本 {syncInfo?.local?.revision ?? "—"} ・ 雲端版本 {syncInfo?.cloud?.revision ?? "—"}</span><button type="button" onClick={transferRecentHistory} disabled={transferring} className="rounded bg-blue-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{transferring ? "建立中…" : "新設備：建立近 3 個月歷史資料"}</button></div></Card></section>
  </div>;
}
