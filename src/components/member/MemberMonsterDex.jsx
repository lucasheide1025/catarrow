// src/components/member/MemberMonsterDex.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeMonsterDex } from "../../lib/db";
import { FAMILIES, TIER_LABEL } from "../../lib/monsterData";
import { EXPANSION_MONSTERS } from "../../lib/monsterExpansionCatalog";
import { MonsterImage } from "../MonsterSVG";

const TIER_ORDER = ["common", "rare", "elite", "fierce", "boss", "mythic"];
const MONSTER_TOTAL = EXPANSION_MONSTERS.length;
const HP_MAX = Math.max(1, ...EXPANSION_MONSTERS.map(monster => Number(monster.hp) || 0));
const ATK_MAX = Math.max(1, ...EXPANSION_MONSTERS.map(monster => Number(monster.atk) || 0));
const DEF_MAX = Math.max(1, ...EXPANSION_MONSTERS.map(monster => Number(monster.def) || 0));
const ENCOUNTER_LABEL = {
  normal: { label:"一般怪", icon:"⚔️", className:"bg-slate-500/20 text-slate-300" },
  miniBoss: { label:"小王", icon:"💀", className:"bg-orange-500/20 text-orange-300" },
  boss: { label:"大王", icon:"👑", className:"bg-red-500/20 text-red-300" },
};

export default function MemberMonsterDex({ onBack, monsterDex }) {
  const { profile } = useAuth();
  const [dexData,      setDexData]      = useState({});
  const [loading,      setLoading]      = useState(true);
  const [familyFilter, setFamilyFilter] = useState("all");
  const [tierFilter,   setTierFilter]   = useState("all");
  const [encounterFilter, setEncounterFilter] = useState("all");
  const [selected,     setSelected]     = useState(null);

  useEffect(() => {
    if (monsterDex !== undefined) {
      setDexData(monsterDex || {});
      setLoading(false);
      return undefined;
    }
    if (!profile?.id) { setLoading(false); return; }
    const unsub = subscribeMonsterDex(profile.id, data => {
      setDexData(data);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [profile?.id, monsterDex]);

  const defeated   = EXPANSION_MONSTERS.filter(m => (dexData[m.id]?.wins  || 0) > 0).length;
  const seen       = EXPANSION_MONSTERS.filter(m => (dexData[m.id]?.wins  || 0) > 0 || (dexData[m.id]?.losses || 0) > 0).length;
  const totalWins  = EXPANSION_MONSTERS.reduce((sum, m) => sum + (dexData[m.id]?.wins || 0), 0);
  const totalLoss  = EXPANSION_MONSTERS.reduce((sum, m) => sum + (dexData[m.id]?.losses || 0), 0);
  const familyProgress = Object.fromEntries(Object.keys(FAMILIES).map(family => {
    const familyCatalog = EXPANSION_MONSTERS.filter(monster => monster.family === family);
    const familyDefeated = familyCatalog.filter(monster => (dexData[monster.id]?.wins || 0) > 0).length;
    return [family, { defeated:familyDefeated, total:familyCatalog.length }];
  }));

  const visible = EXPANSION_MONSTERS.filter(m => {
    if (familyFilter !== "all" && m.family !== familyFilter) return false;
    if (tierFilter   !== "all" && m.tier   !== tierFilter)   return false;
    if (encounterFilter !== "all" && m.encounter !== encounterFilter) return false;
    return true;
  });

  return (
    <div className="p-4 flex flex-col gap-4 pb-24">
      {/* 頂部 */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="text-gray-400 text-sm px-2 py-1">← 返回</button>
        )}
        <h2 className="font-black text-xl text-gray-100 flex-1">📖 怪物圖鑑</h2>
      </div>

      {/* 總覽卡 */}
      <div className="rounded-2xl p-4 text-white"
        style={{ background: "linear-gradient(135deg,#1e1b4b,#7c3aed)" }}>
        <div className="grid grid-cols-4 gap-2 text-center mb-3">
          <div>
            <div className="text-purple-200 text-[10px] mb-0.5">已擊敗</div>
            <div className="font-black text-xl">{defeated}<span className="text-purple-300 text-xs font-normal">/{MONSTER_TOTAL}</span></div>
          </div>
          <div>
            <div className="text-purple-200 text-[10px] mb-0.5">已遭遇</div>
            <div className="font-black text-xl">{seen}<span className="text-purple-300 text-xs font-normal">/{MONSTER_TOTAL}</span></div>
          </div>
          <div>
            <div className="text-purple-200 text-[10px] mb-0.5">總勝場</div>
            <div className="font-black text-xl">{totalWins}</div>
          </div>
          <div>
            <div className="text-purple-200 text-[10px] mb-0.5">總敗場</div>
            <div className="font-black text-xl">{totalLoss}</div>
          </div>
        </div>
        <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${defeated / MONSTER_TOTAL * 100}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-purple-200 text-[10px]">圖鑑完成度</span>
          <span className="text-amber-300 text-[10px] font-bold">{Math.round(defeated / MONSTER_TOTAL * 100)}%</span>
        </div>
      </div>

      {/* 七族各自 36 種的完成度 */}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(FAMILIES).map(([id, fam]) => {
          const progress = familyProgress[id] || { defeated:0, total:0 };
          return (
            <button key={id} onClick={() => setFamilyFilter(id)}
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-left active:scale-[0.98] transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-gray-200">{fam.icon} {fam.label}</span>
                <span className="text-[11px] font-black" style={{ color:fam.color }}>{progress.defeated}/{progress.total}</span>
              </div>
              <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width:`${progress.total ? progress.defeated / progress.total * 100 : 0}%`, background:fam.color }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* 族別篩選 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5">
        <button onClick={() => setFamilyFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border flex-shrink-0 transition-all
            ${familyFilter === "all" ? "bg-purple-600 text-white border-purple-600" : "bg-white/10 text-gray-300 border-white/15"}`}>
          全部族
        </button>
        {Object.entries(FAMILIES).map(([id, fam]) => (
          <button key={id} onClick={() => setFamilyFilter(id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border flex-shrink-0 transition-all
              ${familyFilter === id ? "text-white border-transparent" : "bg-white/10 text-gray-300 border-white/15"}`}
            style={familyFilter === id ? { background: fam.color } : {}}>
            {fam.icon} {fam.label}
          </button>
        ))}
      </div>

      {/* 階級篩選 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5">
        <button onClick={() => setTierFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border flex-shrink-0 transition-all
            ${tierFilter === "all" ? "bg-white/25 text-white border-white/40" : "bg-white/10 text-gray-300 border-white/15"}`}>
          全部階
        </button>
        {TIER_ORDER.map(tier => {
          const t = TIER_LABEL[tier];
          return (
            <button key={tier} onClick={() => setTierFilter(tier)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border flex-shrink-0 transition-all
                ${tierFilter === tier ? "text-white border-transparent" : "bg-white/10 text-gray-300 border-white/15"}`}
              style={tierFilter === tier ? { background: t.color } : {}}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 遭遇類型篩選 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5">
        <button onClick={() => setEncounterFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border flex-shrink-0 ${encounterFilter === "all" ? "bg-white/25 text-white border-white/40" : "bg-white/10 text-gray-300 border-white/15"}`}>
          全部類型
        </button>
        {Object.entries(ENCOUNTER_LABEL).map(([id, meta]) => (
          <button key={id} onClick={() => setEncounterFilter(id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border flex-shrink-0 ${encounterFilter === id ? `${meta.className} border-white/25` : "bg-white/10 text-gray-300 border-white/15"}`}>
            {meta.icon} {meta.label}
          </button>
        ))}
      </div>

      {/* 怪物卡格 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">載入中…</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {visible.map(monster => {
            const rec      = dexData[monster.id];
            const wins     = rec?.wins   || 0;
            const losses   = rec?.losses || 0;
            const hasSeen  = wins > 0 || losses > 0;
            const hasWon   = wins > 0;
            const tier     = TIER_LABEL[monster.tier];
            const encounter = ENCOUNTER_LABEL[monster.encounter] || ENCOUNTER_LABEL.normal;

            return (
              <button key={monster.id}
                onClick={() => hasSeen && setSelected(monster)}
                className={`rounded-2xl p-3 text-center border flex flex-col items-center gap-1 transition-all
                  ${hasWon  ? "bg-white/10 border-white/20 shadow-sm active:scale-95"
                  : hasSeen ? "bg-white/5 border-white/15 opacity-75 active:scale-95"
                             : "bg-white/5 border-white/10 opacity-30 cursor-default"}`}>
                <div>
                  {hasWon
                    ? <MonsterImage id={monster.id} name={monster.name} size={52}/>
                    : <div className="text-3xl w-[52px] h-[52px] flex items-center justify-center bg-white/10 rounded-xl">{hasSeen ? "💀" : "❓"}</div>}
                </div>
                <div className={`text-[11px] font-black leading-tight
                  ${hasWon ? "text-gray-100" : hasSeen ? "text-gray-400" : "text-gray-500"}`}>
                  {hasSeen ? monster.name : "???"}
                </div>
                <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: tier.bg, color: tier.color }}>
                  {tier.label}
                </div>
                <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${encounter.className}`}>
                  {encounter.icon} {encounter.label}
                </div>
                {hasWon && (
                  <div className="text-[10px] font-bold text-emerald-400">⚔️ {wins}勝</div>
                )}
                {!hasWon && hasSeen && (
                  <div className="text-[10px] font-bold text-red-400">💔 {losses}敗</div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 詳細 Modal */}
      {selected && <MonsterDetailModal
        monster={selected}
        rec={dexData[selected.id] || {}}
        onClose={() => setSelected(null)}
      />}
    </div>
  );
}

function StatBar({ label, value, max, color }) {
  const pct = Math.min(100, Math.round(value / max * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-xs font-bold text-gray-400">{label}</div>
      <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="w-10 text-right text-xs font-black text-gray-200">{value}</div>
    </div>
  );
}

function MonsterDetailModal({ monster, rec, onClose }) {
  const wins    = rec.wins   || 0;
  const losses  = rec.losses || 0;
  const total   = wins + losses;
  const winRate = total > 0 ? Math.round(wins / total * 100) : 0;
  const tier    = TIER_LABEL[monster.tier];
  const fam     = FAMILIES[monster.family];
  const encounter = ENCOUNTER_LABEL[monster.encounter] || ENCOUNTER_LABEL.normal;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
      onClick={onClose}>
      <div className="rounded-t-3xl w-full max-w-md max-h-[88vh] overflow-y-auto"
        style={{ background:"var(--bg-surface)", borderTop:"1px solid var(--border-card)" }}
        onClick={e => e.stopPropagation()}>
        {/* 彩色頂部 */}
        <div className="rounded-t-3xl p-6 pb-4 text-white"
          style={{ background: `linear-gradient(135deg,${fam?.color || "#7c3aed"}cc,${tier.color}cc)` }}>
          <div className="flex items-start gap-4">
            <div className="drop-shadow-lg"><MonsterImage id={monster.id} name={monster.name} size={80}/></div>
            <div className="flex-1">
              <div className="font-black text-2xl drop-shadow">{monster.name}</div>
              <div className="flex gap-2 flex-wrap mt-1.5">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/30 backdrop-blur-sm">
                  {tier.label}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/30 backdrop-blur-sm">
                  {fam?.icon} {fam?.label}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/30 backdrop-blur-sm">
                  {encounter.icon} {encounter.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* 擴充怪物資訊 */}
          <div className="bg-white/5 rounded-xl p-3 text-gray-300 text-sm leading-relaxed border border-white/10 flex flex-col gap-1.5">
            {monster.title && <div className="font-black text-gray-100">「{monster.title}」</div>}
            <div>{monster.signatureName ? `✨ ${monster.signatureName}：` : "✨ "}{monster.signatureSummary || monster.desc || "尚無技能紀錄"}</div>
            {monster.counterSummary && <div className="text-cyan-300">🎯 破解：{monster.counterSummary}</div>}
          </div>

          {/* 能力值 */}
          <div>
            <div className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wide">能力值</div>
            <div className="flex flex-col gap-2">
              <StatBar label="❤️ HP"  value={monster.hp}  max={HP_MAX}  color="#ef4444" />
              <StatBar label="⚔️ ATK" value={monster.atk} max={ATK_MAX} color="#f97316" />
              <StatBar label="🛡️ DEF" value={monster.def} max={DEF_MAX} color="#3b82f6" />
            </div>
          </div>

          {/* 戰績 */}
          <div>
            <div className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wide">你的戰績</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-3 text-center">
                <div className="text-emerald-300 text-xs font-bold mb-0.5">⚔️ 勝</div>
                <div className="font-black text-2xl text-emerald-300">{wins}</div>
              </div>
              <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-3 text-center">
                <div className="text-red-400 text-xs font-bold mb-0.5">💀 敗</div>
                <div className="font-black text-2xl text-red-400">{losses}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-3 text-center">
                <div className="text-blue-300 text-xs font-bold mb-0.5">📊 勝率</div>
                <div className="font-black text-2xl text-blue-300">{winRate}%</div>
              </div>
            </div>
          </div>

          {/* 里程碑 */}
          {(rec.firstWin || rec.bestScore > 0 || rec.totalDmgDealt > 0) && (
            <div className="flex flex-col gap-2">
              {rec.firstWin && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
                  <span className="text-lg">🏆</span>
                  <div>
                    <div className="text-amber-300 text-xs font-bold">首次擊敗</div>
                    <div className="text-amber-200 text-sm font-black">{rec.firstWin}</div>
                  </div>
                </div>
              )}
              {rec.bestScore > 0 && (
                <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-400/30 rounded-xl px-3 py-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <div className="text-purple-300 text-xs font-bold">最高得分</div>
                    <div className="text-purple-200 text-sm font-black">{rec.bestScore} 分</div>
                  </div>
                </div>
              )}
              {rec.totalDmgDealt > 0 && (
                <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-400/30 rounded-xl px-3 py-2">
                  <span className="text-lg">💥</span>
                  <div>
                    <div className="text-orange-300 text-xs font-bold">累積造成傷害</div>
                    <div className="text-orange-200 text-sm font-black">{rec.totalDmgDealt.toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {wins === 0 && (
            <div className="text-center py-2 text-gray-400 text-sm">
              {losses > 0 ? "⚡ 曾遭遇，尚未擊敗" : "❓ 尚未遭遇"}
            </div>
          )}

          <button onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white/10 border border-white/15 text-gray-200 font-black active:scale-95 transition-all mt-1">
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
