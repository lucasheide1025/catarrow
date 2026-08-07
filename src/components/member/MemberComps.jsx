// src/components/member/MemberComps.jsx
import { useState, useEffect } from "react";
import { getCompetitions, register } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { COMP_TYPE_COLOR } from "../../lib/constants";
import { Card, Btn, Spinner, Empty, Pill } from "../shared/UI";
import MemberAchievements from "./MemberAchievements";

// 深色原生：左側色條 + 同色淡色底疊在玻璃卡上（token 化，不再依賴覆寫層）
const TYPE_BG = {
  "積分賽":    { bar: "#3b82f6", bg: "rgba(59,130,246,0.10)" },
  "挑戰賽":    { bar: "#fb923c", bg: "rgba(249,115,22,0.10)" },
  "實體賽":    { bar: "#a855f7", bg: "rgba(168,85,247,0.10)" },
  "臨時任務賽": { bar: "#4ade80", bg: "rgba(34,197,94,0.10)" },
  "年度檢定":  { bar: "#22d3ee", bg: "rgba(8,145,178,0.12)" },
};
function typeStyle(type) {
  const s = TYPE_BG[type] || { bar: "#64748b", bg: "rgba(255,255,255,0.04)" };
  return {
    borderLeft: `4px solid ${s.bar}`,
    background: `linear-gradient(0deg, ${s.bg}, ${s.bg}), var(--glass-bg)`,
    boxShadow: "var(--shadow-card)",
  };
}

const ACTIVE_STATUS  = ["upcoming", "open", "ongoing"];
const HISTORY_STATUS = ["finished", "settled"];

export default function MemberComps({ onSelectComp, onPageChange }) {
  const { profile } = useAuth();
  const [comps, setComps]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("全部");
  const [tab, setTab]             = useState("comps");
  const [registering,  setRegistering]  = useState(null);  // compId 正在報名中
  const [justJoined,   setJustJoined]   = useState(new Set()); // 本次 session 已報名的 compId

  useEffect(() => {
    getCompetitions().then(data => { setComps(data); setLoading(false); });
  }, []); // eslint-disable-line

  async function handleRegister(c) {
    if (registering) return;
    setRegistering(c.id);
    try {
      await register(c.id, { memberId: profile.id, name: profile.name, nickname: profile.nickname, isGuest: false });
      setJustJoined(prev => new Set([...prev, c.id])); // 本地立即標記已報名
    } catch (e) {
      alert("報名失敗：" + (e?.message || "請重試"));
    } finally {
      setRegistering(null);
    }
  }

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
    const isCert = c.type === "年度檢定";
    const joined = c.participants?.includes(profile.id) || justJoined.has(c.id);
    const cardBg = isCert
      ? { bar:"from-cyan-300 to-teal-600", bd:"rgba(34,211,238,.28)", accent:"#67e8f9" }
      : { bar:"from-amber-300 to-orange-600", bd:"rgba(251,191,36,.22)", accent:"#fbbf24" };
    return (
      <div className="relative isolate overflow-hidden rounded-xl p-4" style={{...typeStyle(c.type), ...(isCert && { borderLeft:"4px solid #22d3ee" })}}>
        <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${cardBg.bar}`} style={{ opacity:.7 }} />
        <div className="flex justify-between mb-1">
          <span className="text-xs font-bold" style={{ color:isCert ? cardBg.accent : (tc.darkText || "var(--text-secondary)") }}>{c.type}</span>
          <Pill status={c.status} />
        </div>
        <div className="font-bold text-sm mb-1" style={{ color:"var(--text-primary)" }}>{c.title}</div>
        <div className="text-xs mb-3" style={{ color:"var(--text-secondary)" }}>
          📅 {c.date}{c.endDate ? ` ～ ${c.endDate}` : ""}{c.targetName && `　🎯 ${c.targetName}`}{c.arrowCount && `　${c.arrowCount}箭×${c.roundCount}回`}
        </div>
        {c.announcement && (
          <div className="bg-white/5 border rounded-lg p-2 mb-3" style={{ borderColor:"rgba(255,255,255,0.1)" }}>
            <div className="text-xs font-bold mb-0.5" style={{ color:cardBg.accent }}>📢 公告</div>
            <div className="text-xs" style={{ color:"var(--text-secondary)" }}>{c.announcement}</div>
          </div>
        )}
        {joined && <div className="text-xs font-bold mb-2" style={{ color:"#34d399" }}>✅ 已報名</div>}
        <div className="flex gap-2">
          <Btn v="primary" size="sm" className="flex-1" onClick={() => onSelectComp(c)}>查看詳情</Btn>
          {!joined && (c.status === "open" || c.status === "upcoming") && (
            <Btn v="secondary" size="sm" className="flex-1"
              onClick={() => handleRegister(c)}
              disabled={registering === c.id}>
              {registering === c.id ? "報名中…" : "報名參加"}
            </Btn>
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
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-[.97]
              ${tab === id ? "text-cyan-950" : "text-gray-300"}`}
            style={tab === id ? { background:"linear-gradient(90deg,#67e8f9,#22d3ee)", border:"1px solid #22d3ee" } : { background:"rgba(255,255,255,0.06)", border:"1px solid var(--glass-border)" }}>
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
              style={{ background: "linear-gradient(135deg,#4c1d95,#1e1b4b)", border:"1px solid rgba(167,139,250,.35)", boxShadow:"0 14px 30px rgba(0,0,0,.28)" }}>
              <div className="absolute -right-4 -bottom-4 text-8xl opacity-20 pointer-events-none">👹</div>
              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-purple-300 to-violet-600" />
              <div className="relative">
                <div className="text-xs font-black tracking-widest mb-1" style={{ color:"#c4b5fd" }}>⚔️ RPG 模式</div>
                <div className="text-white font-black text-lg mb-1">打怪模式</div>
                <div className="text-xs" style={{ color:"#ddd6fe" }}>選擇怪物，回合制射箭戰鬥，擊敗後開寶箱掉寶！</div>
                <div className="mt-3 inline-flex items-center gap-1 bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  立即挑戰 →
                </div>
              </div>
            </button>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {types.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all active:scale-95 ${filter === t ? "text-cyan-950" : "text-gray-300"}`}
                style={filter === t ? { background:"linear-gradient(90deg,#67e8f9,#22d3ee)", border:"1px solid #22d3ee" } : { background:"rgba(255,255,255,0.06)", border:"1px solid var(--glass-border)" }}>
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
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/5">
        <span className="text-gray-200 font-black text-sm">{year} 年（{comps.length} 場）</span>
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