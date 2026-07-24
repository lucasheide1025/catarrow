// src/components/member/MemberLeaderboard.jsx — 排行榜（RPG 改版 + 季賽）
// 資料/算分集中在 lib/leaderboardData.js；季賽快照在 lib/seasonDb.js。
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getMembers, getAllCertRecords, getAllMonsterDex } from "../../lib/db";
import { getAllDuelStats } from "../../lib/duelDb";
import { Spinner } from "../shared/UI";
import { certLevelStyle } from "../../lib/constants";
import {
  LB_GROUPS, LB_TABS, LB_TAB_MAP, LB_FAMILY_LIST,
  rankBoard, buildCertMaps, computeSeasonMetrics,
  CERT_BOW_OF, getCertLevel, DUNGEON_DEX_TOTAL,
} from "../../lib/leaderboardData";
import {
  seasonIdOf, seasonLabelOf, seasonDaysLeft, ensureSeasonSnapshot,
} from "../../lib/seasonDb";

const MEDALS = ["🥇", "🥈", "🥉"];
const nm = (m) => m?.nickname || m?.name || "射手";
const fmt = (n) => (Number(n) || 0).toLocaleString();

// 名次色（前三名金銀銅、其餘石板）
function rankColor(i) {
  return i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : i === 2 ? "#f59e0b" : "#64748b";
}

export default function MemberLeaderboard({ guestProfile }) {
  const { profile: authProfile } = useAuth();
  const profile = guestProfile || authProfile;
  const myId = profile?.id;
  const isGuest = !!guestProfile;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [certRecords, setCertRecords] = useState([]);
  const [duelMap, setDuelMap] = useState({});
  const [dexMap, setDexMap] = useState({});
  const [snapshot, setSnapshot] = useState({});

  const [tabId, setTabId] = useState(() => {
    try {
      const t = sessionStorage.getItem("leaderboard_initial_tab");
      if (t) { sessionStorage.removeItem("leaderboard_initial_tab"); if (LB_TAB_MAP[t]) return t; }
    } catch { /* ignore */ }
    return "event";
  });
  const [fam, setFam] = useState("all");
  const [useSeason, setUseSeason] = useState(false);

  const year = new Date().getFullYear();
  const seasonId = seasonIdOf();

  useEffect(() => {
    let alive = true;
    Promise.all([getMembers(), getAllCertRecords(), getAllDuelStats(), getAllMonsterDex()])
      .then(async ([ms, certs, duelList, dexList]) => {
        if (!alive) return;
        setMembers(ms);
        setCertRecords(Array.isArray(certs) ? certs : []);
        const dm = {}; duelList.forEach((d) => { dm[d.memberId] = d; }); setDuelMap(dm);
        const dx = {}; dexList.forEach((d) => { dx[d.memberId] = d.monsters || {}; }); setDexMap(dx);

        // 季賽快照：訪客不觸發寫入
        if (!isGuest) {
          try {
            const data = {
              certMaps: buildCertMaps(certs, year), certRecords: certs,
              duelMap: dm, dexMap: dx, year,
            };
            const snap = await ensureSeasonSnapshot(computeSeasonMetrics(ms, data), seasonId);
            if (alive) setSnapshot(snap || {});
          } catch { /* 快照失敗 → 本季榜退回總榜 */ }
        }
        if (alive) setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isGuest, year, seasonId]);

  const data = useMemo(() => ({
    certMaps: buildCertMaps(certRecords, year), certRecords,
    duelMap, dexMap, year,
  }), [certRecords, duelMap, dexMap, year]);

  const tab = LB_TAB_MAP[tabId];
  const boardId = tab?.kind === "family" ? `${tab.base}:${fam}` : tabId;
  const seasonActive = !isGuest && useSeason && tab?.season;

  const rows = useMemo(
    () => (members.length ? rankBoard(boardId, members, data, { useSeason: seasonActive, snapshot }) : []),
    [boardId, members, data, seasonActive, snapshot],
  );

  const myIdx = rows.findIndex((r) => r.id === myId);
  const daysLeft = seasonDaysLeft();

  if (loading) return <Spinner />;

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="p-4 flex flex-col gap-4 text-slate-100">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-black">📊 排行榜</h2>
        {tab?.season && !isGuest && (
          <div className="flex rounded-full border border-white/10 bg-slate-900/70 p-0.5 text-xs font-black">
            {[["total", "總榜"], ["season", "本季"]].map(([k, lb]) => {
              const on = (k === "season") === useSeason;
              return (
                <button key={k} onClick={() => setUseSeason(k === "season")}
                  className="rounded-full px-3 py-1 transition-colors"
                  style={on ? { background: "#fbbf24", color: "#111827" } : { color: "#94a3b8" }}>
                  {lb}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 季賽資訊條 */}
      {seasonActive && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs">
          <span className="font-black text-amber-300">🏆 {seasonLabelOf(seasonId)}</span>
          <span className="text-amber-200/70">本季新增量排名</span>
          <span className="ml-auto font-bold text-amber-300">距季末 {daysLeft} 天</span>
        </div>
      )}

      {/* 分組 + 分頁 */}
      {LB_GROUPS.map((g) => (
        <div key={g.id}>
          <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">{g.icon} {g.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {LB_TABS.filter((t) => t.group === g.id).map((t) => {
              const on = t.id === tabId;
              return (
                <button key={t.id} onClick={() => { setTabId(t.id); setFam("all"); }}
                  className="rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all"
                  style={on
                    ? { background: "#2563eb", color: "#fff", borderColor: "#2563eb" }
                    : { background: "rgba(255,255,255,.06)", color: "#cbd5e1", borderColor: "rgba(148,163,184,.16)" }}>
                  {t.icon} {t.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 族群子頁 */}
      {tab?.kind === "family" && (
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          <FamBtn on={fam === "all"} onClick={() => setFam("all")} label="全部" icon="🌐" color="#94a3b8" />
          {LB_FAMILY_LIST.map((f) => (
            <FamBtn key={f.id} on={fam === f.id} onClick={() => setFam(f.id)} label={f.label} icon={f.icon} color={f.color} />
          ))}
        </div>
      )}

      {/* 我的名次卡 */}
      {!isGuest && <MyRankCard rows={rows} myIdx={myIdx} tab={tab} />}

      {/* 頒獎台 */}
      {top3.length > 0 && <Podium top3={top3} tab={tab} boardId={boardId} data={data} myId={myId} />}

      {/* 榜單 */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-2">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">尚無資料</div>
        ) : (
          rest.map((r, i) => (
            <Row key={r.id} r={r} rank={i + 4} isMe={r.id === myId} tab={tab} boardId={boardId} data={data} />
          ))
        )}
      </div>
    </div>
  );
}

function FamBtn({ on, onClick, label, icon, color }) {
  return (
    <button onClick={onClick}
      className="shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-black transition-all"
      style={on
        ? { background: color, color: "#0b1220", borderColor: color }
        : { background: "rgba(255,255,255,.05)", color, borderColor: `${color}44` }}>
      {icon} {label}
    </button>
  );
}

// 每列右側的顯示值（含單位／等級）
function valueLabel(r, tab, boardId, data) {
  if (boardId?.startsWith("cert_")) {
    const lv = getCertLevel(CERT_BOW_OF[boardId], r.value);
    return { big: fmt(r.value), unit: "分", sub: lv ? `${lv} 級` : null, subStyle: lv ? certLevelStyle(lv, "soft") : null };
  }
  if (boardId === "max_cat") return { big: `Lv.${r.value}`, unit: "", sub: null };
  if (boardId === "dungeon_dex") return { big: fmt(r.value), unit: `/${DUNGEON_DEX_TOTAL}`, sub: null };
  if (boardId === "duel") {
    const s = data.duelMap[r.id] || {};
    const tot = (s.wins || 0) + (s.losses || 0) + (s.draws || 0);
    const rate = tot ? Math.round((s.wins || 0) / tot * 100) : 0;
    return { big: fmt(r.value), unit: "勝", sub: `勝率 ${rate}%` };
  }
  return { big: fmt(r.value), unit: tab?.unit || "", sub: null };
}

function MyRankCard({ rows, myIdx, tab }) {
  if (myIdx < 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-800/70 to-slate-900/70 p-4 text-center">
        <div className="text-sm font-bold text-slate-400">你在這個榜還沒有紀錄</div>
        <div className="text-xs text-slate-500 mt-0.5">去累積一點成績就會上榜！</div>
      </div>
    );
  }
  const me = rows[myIdx];
  const above = myIdx > 0 ? rows[myIdx - 1] : null;
  const gap = above ? above.value - me.value : 0;
  return (
    <div className="rounded-2xl border border-blue-400/30 bg-gradient-to-r from-blue-600/25 to-indigo-700/20 p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-500/20 text-2xl font-black text-blue-200">
          {myIdx < 3 ? MEDALS[myIdx] : `#${myIdx + 1}`}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wider text-blue-300">我的名次</div>
          <div className="truncate text-base font-black text-white">{nm(me.member)}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-blue-200">{fmt(me.value)}</div>
          <div className="text-[10px] text-blue-300/70">{tab?.unit}</div>
        </div>
      </div>
      {above && (
        <div className="mt-2 text-center text-xs text-blue-200/80">
          距上一名還差 <span className="font-black text-amber-300">{fmt(gap)}</span> {tab?.unit}
        </div>
      )}
    </div>
  );
}

function Podium({ top3, tab, boardId, data, myId }) {
  // 版位：中(1) 高、左(2)、右(3)
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = { 0: "h-16", 1: "h-24", 2: "h-12" };
  const posOfRank = (r) => (r === top3[0] ? 1 : r === top3[1] ? 0 : 2);
  return (
    <div className="flex items-end justify-center gap-2 rounded-2xl border border-amber-400/20 bg-gradient-to-b from-slate-800/50 to-slate-950/60 p-4">
      {order.map((r) => {
        const rankIdx = top3.indexOf(r);
        const pos = posOfRank(r);
        const vl = valueLabel(r, tab, boardId, data);
        const isMe = r.id === myId;
        return (
          <div key={r.id} className="flex w-1/3 flex-col items-center">
            <div className="mb-1 text-2xl">{MEDALS[rankIdx]}</div>
            <div className="grid h-12 w-12 place-items-center rounded-full text-lg font-black shadow-lg"
              style={{ background: `${rankColor(rankIdx)}33`, border: `2px solid ${rankColor(rankIdx)}`, color: rankColor(rankIdx) }}>
              {nm(r.member).slice(0, 1)}
            </div>
            <div className={`mt-1 max-w-full truncate text-center text-xs font-black ${isMe ? "text-blue-300" : "text-white"}`}>
              {nm(r.member)}
            </div>
            <div className="text-[13px] font-black" style={{ color: rankColor(rankIdx) }}>
              {vl.big}<span className="text-[9px] text-slate-400"> {vl.unit}</span>
            </div>
            <div className={`mt-1 w-full rounded-t-lg ${heights[pos]}`}
              style={{ background: `linear-gradient(180deg, ${rankColor(rankIdx)}55, ${rankColor(rankIdx)}11)` }} />
          </div>
        );
      })}
    </div>
  );
}

function Row({ r, rank, isMe, tab, boardId, data }) {
  const vl = valueLabel(r, tab, boardId, data);
  return (
    <div className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 ${isMe ? "bg-blue-500/12 ring-1 ring-blue-400/30" : ""}`}>
      <div className="w-7 shrink-0 text-center text-sm font-black text-slate-400">{rank}</div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-bold ${isMe ? "text-blue-300" : "text-slate-100"}`}>
          {nm(r.member)}{isMe && <span className="ml-1 text-xs text-blue-400">（我）</span>}
        </div>
        {vl.sub && (
          vl.subStyle
            ? <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${vl.subStyle}`}>{vl.sub}</span>
            : <div className="text-[11px] text-slate-500">{vl.sub}</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-lg font-black ${isMe ? "text-blue-300" : "text-slate-100"}`}>{vl.big}</div>
        <div className="text-[10px] text-slate-500">{vl.unit}</div>
      </div>
    </div>
  );
}
