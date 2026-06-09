// src/components/member/MemberComps.jsx
import { useState, useEffect } from "react";
import { subscribeCompetitions, register } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { COMP_TYPE_COLOR } from "../../lib/constants";
import { Card, Btn, Spinner, Empty, Pill } from "../shared/UI";
import MemberAchievements from "./MemberAchievements";

const TYPE_BG = {
  "積分賽":    { bar: "#2563eb", bg: "#eff6ff" },
  "挑戰賽":    { bar: "#ea580c", bg: "#fff7ed" },
  "實體賽":    { bar: "#9333ea", bg: "#faf5ff" },
  "臨時任務賽": { bar: "#16a34a", bg: "#f0fdf4" },
  "年度檢定":  { bar: "#0891b2", bg: "#ecfeff" },
};
function typeStyle(type) {
  const s = TYPE_BG[type] || { bar: "#94a3b8", bg: "#f8fafc" };
  return { borderLeft: `4px solid ${s.bar}`, background: s.bg };
}

const ACTIVE_STATUS  = ["upcoming", "open", "ongoing"];
const HISTORY_STATUS = ["finished", "settled"];

export default function MemberComps({ onSelectComp, onPageChange }) {
  const { profile } = useAuth();
  const [comps, setComps]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("全部");
  const [tab, setTab]         = useState("comps");

  useEffect(() => {
    const unsub = subscribeCompetitions(data => { setComps(data); setLoading(false); });
    return unsub;
  }, []);

  const types = ["全部", "積分賽", "挑戰賽", "實體賽", "臨時任務賽", "年度檢定"];

  const active = comps.filter(c => ACTIVE_STATUS.includes(c.status) || !c.status);
  const activeFiltered = (filter === "全部" ? active : active.filter(c => c.type === filter))
    .slice().sort((a, b) => {
      const aCert = a.type === "年度檢定" ? 1 : 0;
      const bCert = b.type === "年度檢定" ? 1 : 0;
      if (aCert !== bCert) return aCert - bCert;
      return 0;
    });

  const history = comps.filter(c => HISTORY_STATUS.includes(c.status));
  const historyByYear = {};
  history.forEach(c => {
    const y = (c.date || "").slice(0, 4) || "其他";
    (historyByYear[y] = historyByYear[y] || []).push(c);
  });
  const historyYears = Object.keys(historyByYear).sort().reverse();

  function CompCard({ c }) {
    const tc = COMP_TYPE_COLOR[c.type] || {};
    const joined = c.participants?.includes(profile.id);
    return (
      <div className="rounded-xl p-4 shadow-sm" style={typeStyle(c.type)}>
        <div className="flex justify-between mb-1">
          <span className={`text-xs font-bold ${tc.text}`}>{c.type}</span>
          <Pill status={c.status} />
        </div>
        <div className="text-gray-800 font-bold text-sm mb-1">{c.title}</div>
        <div className="text-gray-400 text-xs mb-3">
          📅 {c.date}{c.endDate ? ` ～ ${c.endDate}` : ""}{c.targetName && `　🎯 ${c.targetName}`}{c.arrowCount && `　${c.arrowCount}箭×${c.roundCount}回`}
        </div>
        {c.announcement && (
          <div className="bg-white/60 border border-gray-100 rounded-lg p-2 mb-3">
            <div className="text-blue-600 text-xs font-bold mb-0.5">📢 公告</div>
            <div className="text-blue-800 text-xs">{c.announcement}</div>
          </div>
        )}
        {joined && <div className="text-green-600 text-xs font-bold mb-2">✅ 已報名</div>}
        <div className="flex gap-2">
          <Btn v="primary" size="sm" className="flex-1" onClick={() => onSelectComp(c)}>查看詳情</Btn>
          {!joined && (c.status === "open" || c.status === "upcoming") && (
            <Btn v="secondary" size="sm" className="flex-1" onClick={() => register(c.id, {
              memberId: profile.id, name: profile.name, nickname: profile.nickname, isGuest: false
            })}>報名參加</Btn>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex gap-2 px-4 pt-4">
        {[["comps","🏆 比賽列表"],["achievements","🎯 成就任務"],["history","📜 歷史比賽"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all
              ${tab === id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "achievements" ? (
        <MemberAchievements />
      ) : loading ? (
        <Spinner />
      ) : tab === "history" ? (
        <div className="p-4 flex flex-col gap-3">
          {historyYears.length === 0 && <Empty icon="📜" message="尚無已結束的比賽" />}
          {historyYears.map(y => (
            <HistoryYear key={y} year={y} comps={historyByYear[y]} CompCard={CompCard} />
          ))}
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-4">
          {/* 打怪模式入口卡片 */}
          {onPageChange && (
            <button onClick={() => onPageChange("monster")}
              className="w-full rounded-2xl p-4 text-left relative overflow-hidden active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
              <div className="absolute -right-4 -bottom-4 text-8xl opacity-20 pointer-events-none">👹</div>
              <div className="relative">
                <div className="text-xs font-black tracking-widest text-purple-200 mb-1">⚔️ RPG 模式</div>
                <div className="text-white font-black text-lg mb-1">打怪模式</div>
                <div className="text-purple-200 text-xs">選擇怪物，回合制射箭戰鬥，擊敗後開寶箱掉寶！</div>
                <div className="mt-3 inline-flex items-center gap-1 bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  立即挑戰 →
                </div>
              </div>
            </button>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {types.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${filter === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
                {t}
              </button>
            ))}
          </div>
          {activeFiltered.length === 0 && <Empty message="目前沒有比賽" />}
          {activeFiltered.map(c => <CompCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

function HistoryYear({ year, comps, CompCard }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50">
        <span className="text-gray-700 font-black text-sm">{year} 年（{comps.length} 場）</span>
        <span className="text-gray-400 text-xs">{open ? "▲ 收起" : "▼ 展開"}</span>
      </button>
      {open && (
        <div className="p-3 flex flex-col gap-3">
          {comps.map(c => <CompCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}