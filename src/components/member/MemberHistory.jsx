// src/components/member/MemberHistory.jsx
import { useState, useEffect } from "react";
import { getMemberResults, subscribeExternalComps } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { COMP_TYPE_COLOR, fmtDT, certLevelStyle } from "../../lib/constants";
import { Card, ST, Spinner, Empty } from "../shared/UI";

// 分類 tab：全部 + 各比賽類型 + 場外賽
const TABS = [
  { id: "all",     label: "全部" },
  { id: "monster", label: "⚔️ 打怪" },
  { id: "實體賽",   label: "實體賽" },
  { id: "積分賽",   label: "積分賽" },
  { id: "挑戰賽",   label: "挑戰賽" },
  { id: "臨時任務賽", label: "任務賽" },
  { id: "年度檢定", label: "檢定" },
  { id: "external", label: "場外賽" },
];

const BOW_GROUP_LABEL = { recurve_bare: "裸弓", recurve_full: "全配", compound: "獵弓", traditional: "傳統" };

export default function MemberHistory() {
  const { profile } = useAuth();
  const [results, setResults]   = useState([]);
  const [extComps, setExtComps] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("all");

  useEffect(() => {
    if (!profile?.id) return;
    getMemberResults(profile.id).then(data => {
      setResults(data.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)));
      setLoading(false);
    });
    const unsub = subscribeExternalComps(profile.id, list => setExtComps(Array.isArray(list) ? list : []));
    return () => unsub && unsub();
  }, [profile?.id]);

  if (loading) return <Spinner />;

  // 統計（用 results，不含場外賽）
  const best = results.length ? Math.max(...results.map(r => r.total || 0)) : 0;
  const avg  = results.length ? Math.round(results.reduce((a, r) => a + (r.total || 0), 0) / results.length) : 0;

  // 場外賽只顯示已審核通過
  const approvedExt = extComps.filter(e => e.status === "approved");

  // 取年份：results 用 certYear 或 submittedAt 年；場外賽用 date 年
  function yearOfResult(r) {
    if (r.certYear) return Number(r.certYear);
    if (r.submittedAt?.toDate) return r.submittedAt.toDate().getFullYear();
    if (r.date) return new Date(r.date).getFullYear();
    return new Date().getFullYear();
  }
  function yearOfExt(e) {
    if (e.date) return new Date(e.date).getFullYear();
    if (e.submittedAt?.toDate) return e.submittedAt.toDate().getFullYear();
    return new Date().getFullYear();
  }

  // 依目前 tab 取出資料，按年份分組
  function buildGroups() {
    const groups = {}; // year -> [items]
    if (tab === "external") {
      approvedExt.forEach(e => {
        const y = yearOfExt(e);
        (groups[y] = groups[y] || []).push({ kind: "ext", data: e });
      });
    } else {
      const filtered = tab === "all" ? results : results.filter(r => r.compType === tab);
      filtered.forEach(r => {
        const y = yearOfResult(r);
        (groups[y] = groups[y] || []).push({ kind: "result", data: r });
      });
      // 全部 tab 也把場外賽併入
      if (tab === "all") {
        approvedExt.forEach(e => {
          const y = yearOfExt(e);
          (groups[y] = groups[y] || []).push({ kind: "ext", data: e });
        });
      }
    }
    return groups;
  }

  const groups = buildGroups();
  const years = Object.keys(groups).map(Number).sort((a, b) => b - a);
  const totalCount = years.reduce((a, y) => a + groups[y].length, 0);

  return (
    <div className="p-4 flex flex-col gap-4">
      <h2 className="text-gray-800 font-black text-xl">📊 成績歷史</h2>

      <div className="grid grid-cols-3 gap-3">
        {[["參賽場數", results.length, "text-blue-600"],
          ["最高分", best, "text-green-600"],
          ["平均分", avg, "text-orange-600"]].map(([k, v, c]) => (
          <div key={k} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <div className="text-gray-400 text-xs">{k}</div>
            <div className={`font-black text-2xl ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* 分類 tab */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
              ${tab === t.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {totalCount === 0 && <Empty icon="🎯" message="此分類尚無紀錄" />}

      {/* 按年份分組 */}
      {years.map(y => (
        <div key={y} className="flex flex-col gap-2">
          <div className="text-gray-500 text-sm font-black sticky top-0">{y} 年</div>
          {groups[y].map((item, i) =>
            item.kind === "ext"
              ? <ExtCard key={"e" + (item.data.id || i)} e={item.data} />
              : <ResultCard key={"r" + (item.data.id || i)} r={item.data} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── 一般 / 檢定成績卡 ──
function ResultCard({ r }) {
  const tc = COMP_TYPE_COLOR[r.compType] || {};
  const timeStr = r.submittedAt ? fmtDT(r.submittedAt) : (r.date || "");
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-bold ${tc.text || "text-gray-500"}`}>{r.compType || "比賽"}</span>
        <span className="text-gray-400 text-xs">{timeStr}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-gray-700 font-bold text-sm">{r.compTitle || "—"}</div>
        <div className="text-blue-600 font-black text-2xl">{r.total}</div>
      </div>

      {/* 檢定：弓種、級別、審核狀態、租借 */}
      {r.isCert && (
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {(r.bowLabel || BOW_GROUP_LABEL[r.certBowType]) && (
            <span className="text-gray-500 text-xs">{r.bowLabel || BOW_GROUP_LABEL[r.certBowType]}</span>
          )}
          {r.reviewStatus === "approved" && r.certLevel && r.certLevel !== "未達標" && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${certLevelStyle(r.certLevel, "soft")}`}>{r.certLevel}</span>
          )}
          {r.reviewStatus === "pending" && (
            <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">審核中</span>
          )}
          {r.reviewStatus === "rejected" && (
            <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">已退回</span>
          )}
          {r.isRental && <span className="text-orange-500 text-xs">租借</span>}
        </div>
      )}

      {/* 一般賽：名次 */}
      {!r.isCert && r.rank && (
        <div className="text-gray-500 text-xs mt-1">名次：第 {r.rank} 名</div>
      )}

      {r.miss > 0 && <div className="text-red-400 text-xs mt-0.5">脫靶 {r.miss} 支</div>}
      {Array.isArray(r.rounds) && r.rounds.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {r.rounds.map((round, j) => (
            <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
              回{j + 1}:{Array.isArray(round) ? round.filter(s => s !== "M").reduce((a, b) => a + b, 0) : 0}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── 場外賽卡 ──
function ExtCard({ e }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-pink-600">場外賽</span>
        <span className="text-gray-400 text-xs">{e.date || ""}</span>
      </div>
      <div className="text-gray-700 font-bold text-sm">{e.compName || "—"}</div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {e.category && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e.category}</span>}
        {e.rank && <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{e.rank}</span>}
        {e.hasAward && <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full">🏆 {e.awardKept ? "獎項留箭場" : "有獎項"}</span>}
        {e.location && <span className="text-gray-400 text-xs">📍 {e.location}</span>}
      </div>
      {e.note && <div className="text-gray-400 text-xs italic mt-1">「{e.note}」</div>}
    </Card>
  );
}