// src/components/member/MemberLeaderboard.jsx
import { useState, useEffect } from "react";
import { getMembers, getCompetitions, getAllCertRecords, getResults } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { COMP_TYPE_COLOR, calcBadgePoints, getCertLevel, certLevelStyle } from "../../lib/constants";
import { Card, Spinner, Empty } from "../shared/UI";

const TABS = [
  { id: "event",             label: "🎪 賽事積分" },
  { id: "fatcat",            label: "🐱 肥貓章"   },
  { id: "score",             label: "⭐ 積分章"   },
  { id: "achieve",           label: "🏆 成就章"   },
  { id: "cert_recurve_bare", label: "🏹 檢定·裸弓" },
  { id: "cert_recurve_full", label: "🎯 檢定·全配" },
  { id: "cert_compound",     label: "🦅 檢定·獵弓" },
  { id: "cert_traditional",  label: "🌿 檢定·傳統" },
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
  const [members, setMembers]       = useState([]);
  const [comps, setComps]           = useState([]);
  const [compResults, setCompResults] = useState({}); // { compId: [results] }
  const [certRecords, setCertRecords] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([getMembers(), getCompetitions(), getAllCertRecords()])
      .then(async ([ms, cs, certs]) => {
        setMembers(ms);
        setCertRecords(Array.isArray(certs) ? certs : []);

        // 只抓已結算比賽的 results（避免多餘查詢）
        const settled = cs.filter(c => c.status === "settled");
        const resultsMap = {};
        await Promise.all(
          settled.map(async c => {
            try {
              const r = await getResults(c.id);
              resultsMap[c.id] = r;
            } catch { resultsMap[c.id] = []; }
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

  // 一般榜排序
  const ranked = !isCertTab
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

      {/* Tab 切換 */}
      <div className="grid grid-cols-2 gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-2.5 rounded-xl text-xs font-bold border transition-all
              ${tab === t.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 規則提示 */}
      {!isCertTab && tab === "event" && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-600">
          累積賽事積分 = 比賽名次積分 + 日常任務完成 + 打怪勝利，越多越高！
        </div>
      )}
      {!isCertTab && tab !== "event" && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-600">
          {tab === "achieve" ? "計分：銀 1 分、金 2 分、黑 3 分" : "計分：銅 1 分、銀 10 分、金 50 分"}
        </div>
      )}
      {isCertTab && (
        <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 text-xs text-teal-600">
          {thisYear} 年度檢定 · 取每人今年最高分（已通過審核）
        </div>
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
      ) : (
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