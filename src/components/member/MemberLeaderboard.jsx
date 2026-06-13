// src/components/member/MemberLeaderboard.jsx
import { useState, useEffect } from "react";
import { getMembers, getCompetitions, getAllCertRecords, getResults } from "../../lib/db";
import { getAllDuelStats } from "../../lib/duelDb";
import { useAuth } from "../../hooks/useAuth";
import { COMP_TYPE_COLOR, calcBadgePoints, getCertLevel, certLevelStyle } from "../../lib/constants";
import { Card, Spinner, Empty } from "../shared/UI";

const TABS = [
  { id: "event",             label: "🎪 賽事積分",  group: "活動" },
  { id: "duel",              label: "⚔️ 決鬥排行",  group: "活動" },
  { id: "checkin",           label: "📋 報到達人",  group: "活動" },
  { id: "fatcat",            label: "🐱 肥貓章",    group: "徽章" },
  { id: "score",             label: "⭐ 積分章",    group: "徽章" },
  { id: "achieve",           label: "🏆 成就章",    group: "徽章" },
  { id: "cert_recurve_bare", label: "🏹 裸弓檢定",  group: "檢定" },
  { id: "cert_recurve_full", label: "🎯 全配檢定",  group: "檢定" },
  { id: "cert_compound",     label: "🦅 獵弓檢定",  group: "檢定" },
  { id: "cert_traditional",  label: "🌿 傳統檢定",  group: "檢定" },
];

const CERT_TAB = {
  cert_recurve_bare: "recurve_bare",
  cert_recurve_full: "recurve_full",
  cert_compound:     "compound",
  cert_traditional:  "traditional",
};

export default function MemberLeaderboard() {
  const { profile } = useAuth();
  const [tab, setTab]               = useState("event");
  const [members, setMembers]         = useState([]);
  const [comps, setComps]             = useState([]);
  const [compResults, setCompResults] = useState({});
  const [certRecords, setCertRecords] = useState([]);
  const [duelStatsMap, setDuelStatsMap] = useState({}); // { memberId: stats }
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([getMembers(), getCompetitions(), getAllCertRecords(), getAllDuelStats()])
      .then(async ([ms, cs, certs, duelList]) => {
        setMembers(ms);
        setCertRecords(Array.isArray(certs) ? certs : []);

        // duelStats map
        const dm = {};
        duelList.forEach(d => { dm[d.memberId] = d; });
        setDuelStatsMap(dm);

        // 只抓已結算比賽的 results
        const settled = cs.filter(c => c.status === "settled");
        const resultsMap = {};
        await Promise.all(
          settled.map(async c => {
            try { resultsMap[c.id] = await getResults(c.id); }
            catch { resultsMap[c.id] = []; }
          })
        );
        setComps(cs);
        setCompResults(resultsMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const thisYear = new Date().getFullYear();

  // ✅ 修復：直接讀 member.eventPoints（由結算比賽＋日常任務＋打怪共同累積）
  function calcEventPts(memberId) {
    const m = members.find(x => x.id === memberId);
    return m?.eventPoints || 0;
  }

  function badgePts(member, type) {
    return calcBadgePoints(member, type);
  }

  function certRanking(bowType) {
    const map = {};
    certRecords
      .filter(r => r.bowType === bowType && Number(r.year) === thisYear)
      .forEach(r => {
        const score = r.score || 0;
        if (map[r.memberId] === undefined || score > map[r.memberId]) {
          map[r.memberId] = score;
        }
      });
    return Object.entries(map)
      .map(([memberId, total]) => {
        const m = members.find(x => x.id === memberId);
        return { memberId, total, name: m?.name, nickname: m?.nickname };
      })
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }

  function BadgeSummary({ member, type }) {
    if (type === "fatcat") {
      const d = member.fatCat || {};
      return (
        <div className="flex gap-1 text-xs">
          <span className="bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded">金{d.gold||0}</span>
          <span className="bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded">銀{d.silver||0}</span>
          <span className="bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded">銅{d.bronze||0}</span>
        </div>
      );
    }
    if (type === "score") {
      const d = member.score || {};
      return (
        <div className="flex gap-1 text-xs">
          <span className="bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded">金{d.gold||0}</span>
          <span className="bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded">銀{d.silver||0}</span>
          <span className="bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded">銅{d.bronze||0}</span>
        </div>
      );
    }
    if (type === "achieve") {
      const d = member.achievement || {};
      return (
        <div className="flex gap-1 text-xs">
          <span className="bg-gray-800 text-white font-bold px-1.5 py-0.5 rounded">黑{d.black||0}</span>
          <span className="bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded">金{d.gold||0}</span>
          <span className="bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded">銀{d.silver||0}</span>
        </div>
      );
    }
    return null;
  }

  if (loading) return <Spinner />;

  const isCertTab = !!CERT_TAB[tab];
  const isDuelTab    = tab === "duel";
  const isCheckinTab = tab === "checkin";

  // 決鬥排行
  const duelRanked = isDuelTab
    ? members
        .map(m => {
          const s = duelStatsMap[m.id] || {};
          const wins   = s.wins   || 0;
          const losses = s.losses || 0;
          const draws  = s.draws  || 0;
          const total  = wins + losses + draws;
          const rate   = total > 0 ? Math.round(wins / total * 100) : 0;
          return { ...m, wins, losses, draws, flawless: s.flawless || 0, totalDmg: s.totalDmg || 0, total, rate };
        })
        .filter(m => m.total > 0)
        .sort((a, b) => b.wins - a.wins || b.rate - a.rate)
    : [];

  // 報到達人
  const checkinRanked = isCheckinTab
    ? [...members]
        .map(m => ({ ...m, cnt: m.dailyQuestCount || 0 }))
        .filter(m => m.cnt > 0)
        .sort((a, b) => b.cnt - a.cnt)
    : [];

  // 一般榜排序
  const ranked = !isCertTab && !isDuelTab && !isCheckinTab
    ? [...members].map(m => ({
        ...m,
        pts: tab === "event" ? calcEventPts(m.id) : badgePts(m, tab),
      })).sort((a, b) => b.pts - a.pts)
    : [];

  // 檢定榜
  const certList = isCertTab ? certRanking(CERT_TAB[tab]) : [];
  const certBow  = CERT_TAB[tab];

  // ✅ 修復：用 status === "settled" 判斷，不再依賴 c.results
  const settledComps = comps.filter(c => c.status === "settled");

  return (
    <div className="p-4 flex flex-col gap-4">
      <h2 className="text-gray-800 font-black text-xl">📊 排行榜</h2>

      {/* Tab 切換（按分組排列）*/}
      {["活動","徽章","檢定"].map(group => (
        <div key={group}>
          <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{group}</div>
          <div className="grid grid-cols-3 gap-2">
            {TABS.filter(t => t.group === group).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all
                  ${tab === t.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* 規則提示 */}
      {tab === "event" && <InfoBar color="blue">累積賽事積分 = 比賽名次積分 + 日常任務完成 + 打怪勝利，越多越高！</InfoBar>}
      {tab === "duel"  && <InfoBar color="indigo">依總勝場數排名，勝場相同時比較勝率。至少需有 1 場紀錄才上榜。</InfoBar>}
      {tab === "checkin" && <InfoBar color="emerald">累積報到（每日打卡）次數，持續練習的就是達人！</InfoBar>}
      {["fatcat","score","achieve"].includes(tab) && (
        <InfoBar color="blue">{tab === "achieve" ? "計分：銀 1 分、金 2 分、黑 3 分" : "計分：銅 1 分、銀 10 分、金 50 分"}</InfoBar>
      )}
      {isCertTab && <InfoBar color="teal">{thisYear} 年度檢定 · 取每人今年最高分（已通過審核）</InfoBar>}

      {/* 決鬥排行 */}
      {isDuelTab && (
        <Card className="p-4">
          {duelRanked.length === 0
            ? <Empty message="尚無決鬥紀錄" />
            : duelRanked.map((m, i) => {
                const isMe = m.id === profile?.id;
                return (
                  <div key={m.id}
                    className={`flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 ${isMe ? "bg-blue-50 -mx-4 px-4 rounded-xl" : ""}`}>
                    <div className="w-8 text-center flex-shrink-0">
                      {["🥇","🥈","🥉"][i]
                        ? <span className="text-2xl">{["🥇","🥈","🥉"][i]}</span>
                        : <span className="text-gray-400 font-bold text-sm">{i+1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                        {m.nickname || m.name}{isMe && <span className="ml-1 text-xs text-blue-500">（我）</span>}
                      </div>
                      <div className="flex gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">{m.wins}勝 {m.losses}負{m.draws > 0 ? ` ${m.draws}平` : ""}</span>
                        <span className="text-xs text-gray-400">勝率 {m.rate}%</span>
                        {m.flawless > 0 && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded">全勝 ×{m.flawless}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-black text-2xl ${isMe ? "text-blue-600" : "text-gray-800"}`}>{m.wins}</div>
                      <div className="text-gray-400 text-xs">勝場</div>
                    </div>
                  </div>
                );
              })
          }
        </Card>
      )}

      {/* 報到達人 */}
      {isCheckinTab && (
        <Card className="p-4">
          {checkinRanked.length === 0
            ? <Empty message="尚無報到紀錄" />
            : checkinRanked.map((m, i) => {
                const isMe = m.id === profile?.id;
                return (
                  <div key={m.id}
                    className={`flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 ${isMe ? "bg-blue-50 -mx-4 px-4 rounded-xl" : ""}`}>
                    <div className="w-8 text-center flex-shrink-0">
                      {["🥇","🥈","🥉"][i]
                        ? <span className="text-2xl">{["🥇","🥈","🥉"][i]}</span>
                        : <span className="text-gray-400 font-bold text-sm">{i+1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                        {m.nickname || m.name}{isMe && <span className="ml-1 text-xs text-blue-500">（我）</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">累積報到 {m.cnt} 天</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-black text-2xl ${isMe ? "text-blue-600" : "text-gray-800"}`}>{m.cnt}</div>
                      <div className="text-gray-400 text-xs">次</div>
                    </div>
                  </div>
                );
              })
          }
        </Card>
      )}

      {/* 檢定榜 */}
      {isCertTab ? (
        <Card className="p-4">
          {certList.length === 0
            ? <Empty message="今年尚無已審核的檢定成績" />
            : certList.map((m, i) => {
                const isMe  = m.memberId === profile?.id;
                const level = getCertLevel(certBow, m.total);
                return (
                  <div key={m.memberId}
                    className={`flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 ${isMe ? "bg-blue-50 -mx-4 px-4 rounded-xl" : ""}`}>
                    <div className="w-8 text-center flex-shrink-0">
                      {["🥇","🥈","🥉"][i]
                        ? <span className="text-2xl">{["🥇","🥈","🥉"][i]}</span>
                        : <span className="text-gray-400 font-bold text-sm">{i+1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                        {m.nickname || m.name}
                        {isMe && <span className="ml-1 text-xs text-blue-500">（我）</span>}
                      </div>
                      {level && (
                        <span className={`inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${certLevelStyle(level, "soft")}`}>
                          {level} 級
                        </span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-black text-2xl ${isMe ? "text-blue-600" : "text-gray-800"}`}>{m.total}</div>
                      <div className="text-gray-400 text-xs">分</div>
                    </div>
                  </div>
                );
              })
          }
        </Card>
      ) : !isDuelTab && !isCheckinTab && (
        /* 一般榜 */
        <Card className="p-4">
          {ranked.length === 0 && <Empty message="尚無資料" />}
          {ranked.map((m, i) => {
            const isMe  = m.id === profile?.id;
            const medal = ["🥇","🥈","🥉"][i];
            return (
              <div key={m.id}
                className={`flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 ${isMe ? "bg-blue-50 -mx-4 px-4 rounded-xl" : ""}`}>
                <div className="w-8 text-center flex-shrink-0">
                  {medal
                    ? <span className="text-2xl">{medal}</span>
                    : <span className="text-gray-400 font-bold text-sm">{i+1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                    {m.nickname || m.name}
                    {isMe && <span className="ml-1 text-xs text-blue-500">（我）</span>}
                  </div>
                  {tab !== "event" && <BadgeSummary member={m} type={tab} />}
                  {tab === "event" && (
                    <div className="text-gray-400 text-xs">賽事積分 {m.pts} 分</div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-black text-2xl ${isMe ? "text-blue-600" : "text-gray-800"}`}>{m.pts}</div>
                  <div className="text-gray-400 text-xs">{tab === "event" ? "積分" : "徽章分"}</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* 各場比賽排名（賽事積分 tab）*/}

      {tab === "event" && settledComps.length > 0 && (
        <div>
          <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">各場比賽排名</div>
          {settledComps.map(c => {
            const tc     = COMP_TYPE_COLOR[c.type] || {};
            // ✅ 修復：從 compResults 取，不從 c.results
            const sorted = [...(compResults[c.id] || [])].sort((a, b) => b.total - a.total);
            if (sorted.length === 0) return null;
            return (
              <Card key={c.id} className="p-4 mb-3">
                <div className={`text-xs font-bold mb-1 ${tc.text}`}>{c.type}</div>
                <div className="text-gray-800 font-bold text-sm mb-3">{c.title}</div>
                {sorted.map((r, i) => {
                  const isMe = r.memberId === profile?.id;
                  return (
                    <div key={r.memberId}
                      className={`flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 ${isMe ? "text-blue-600" : "text-gray-700"}`}>
                      <span className="w-6 text-center text-sm">{["🥇","🥈","🥉"][i] || i+1}</span>
                      <span className="flex-1 text-sm font-medium">
                        {r.nickname || r.name}{isMe && " (我)"}
                      </span>
                      <span className="font-black text-lg">{r.total}</span>
                      <span className="text-xs text-gray-400 w-12 text-right">
                        {i===0?"+3":i===1?"+2":i===2?"+1":""}
                      </span>
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const COLOR_MAP = {
  blue:    "bg-blue-50 border-blue-100 text-blue-600",
  indigo:  "bg-indigo-50 border-indigo-100 text-indigo-600",
  teal:    "bg-teal-50 border-teal-100 text-teal-600",
  emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
};
function InfoBar({ color = "blue", children }) {
  return (
    <div className={`border rounded-xl px-3 py-2 text-xs ${COLOR_MAP[color] || COLOR_MAP.blue}`}>
      {children}
    </div>
  );
}