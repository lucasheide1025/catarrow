// src/components/member/ExpeditionPanel.jsx — 遠征隊派遣面板（3 槽位）
import { useState, useEffect, useRef } from "react";
import { CATS, CAT_TYPE_MAP } from "../../lib/catData";
import { catLevelFromXP } from "../../lib/catLevel";
import { startExpedition, collectExpedition } from "../../lib/db";
import { busyCatIdSet } from "../../lib/catAssignment";
import {
  EXPEDITION_MISSIONS, calcExpeditionRewards, fmtCountdown,
  calcCatFullStats, catPowerMult, buildExpeditionRewardEntries,
} from "../../lib/expeditionData";
import CatVillageNavArt from "./CatVillageNavArt";

const TYPE_LABEL = { attack:"⚔️ 攻擊型", defense:"🛡️ 防禦型", allround:"💚 治癒型" };
const TYPE_COLOR = { attack:"#f87171", defense:"#60a5fa", allround:"#a78bfa" };
const TIER_COLOR = ["","#9ca3af","#4ade80","#60a5fa","#a78bfa","#fbbf24"];

const RES_CN   = { fur:"貓毛", potion:"貓薄荷藥水", arrowdew:"箭露", gachaToken:"扭蛋幣", archer:"射手", ore:"礦物", melon:"瓜瓜", fish:"鮮魚", meat:"動物肉", driedfish:"小魚乾", can:"貓罐頭" };
const RES_ICON = { fur:"🐾", potion:"🍵", arrowdew:"💧", gachaToken:"🎰", archer:"🏹", ore:"⛏️", melon:"🍈", fish:"🐟", meat:"🍖", driedfish:"🐠", can:"🥫" };

function ArcherCostRow({ archerCost, villageRes }) {
  return (
    <div className="flex flex-col gap-1">
      {Object.entries(archerCost).map(([key, need]) => {
        const have = Math.floor(villageRes?.[key] || 0);
        const ok   = have >= need;
        const tier = Number(key.replace("archer_t",""));
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="font-black" style={{ color: TIER_COLOR[tier] }}>T{tier} 射手</span>
            <span className="ml-auto font-black" style={{ color: ok ? "#86efac" : "#f87171" }}>
              {have} / {need}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RewardPreview({ mission, catData }) {
  const { catATK } = calcCatFullStats(catData || {});
  const mult = catPowerMult(catATK);
  const catResources = ["fur","potion"];
  const matResources = ["ore","melon","fish","meat","driedfish","can"];
  const catRewards = mission.baseRewards.filter(r => catResources.includes(r.resource));
  const matRewards = mission.baseRewards.filter(r => matResources.includes(r.resource));
  return (
    <div className="flex flex-col gap-0.5">
      {catRewards.map((r, i) => (
        <div key={i} className="flex items-center gap-1 text-[11px]">
          <span className="font-black" style={{ color: r.resource === "fur" ? "#fbbf24" : "#a78bfa" }}>
            {RES_ICON[r.resource]} {RES_CN[r.resource]} T{r.tier}
          </span>
          <span className="ml-auto" style={{ color: "#86efac" }}>
            {Math.max(1,Math.round(r.min*mult))}–{Math.round(r.max*mult)}
          </span>
        </div>
      ))}
      {matRewards.length > 0 && (
        <div style={{ marginTop:2, display:"flex", flexWrap:"wrap", gap:3 }}>
          {matRewards.map((r, i) => (
            <span key={i} style={{ fontSize:10, background:"rgba(255,255,255,0.06)", borderRadius:6, padding:"1px 5px", color:"rgba(255,255,255,0.6)" }}>
              {RES_ICON[r.resource]} T{r.tier} ×{Math.max(1,Math.round(r.min*mult))}~{Math.round(r.max*mult)}
            </span>
          ))}
        </div>
      )}
      {mission.bonusChance?.arrowdew > 0 && (
        <div className="text-[10px]" style={{ color:"#fbbf24" }}>
          💧 箭露 {Math.round(mission.bonusChance.arrowdew*100)}% 機率
        </div>
      )}
      {mission.bonusChance?.gachaToken > 0 && (
        <div className="text-[10px]" style={{ color:"#fbbf24" }}>
          🎰 扭蛋幣 {Math.round(mission.bonusChance.gachaToken*100)}% 機率
        </div>
      )}
    </div>
  );
}

function ExpeditionRewardResult({ result, onClose }) {
  const mission = EXPEDITION_MISSIONS.find(item => item.tier === result.missionTier);
  const entries = buildExpeditionRewardEntries(result.rewards);
  const materials = entries.filter(entry => entry.kind === "material");
  const specials = entries.filter(entry => entry.kind === "special");

  const renderRewardCard = (entry, index) => (
    <div
      key={entry.key}
      className="expedition-reward-card"
      style={{ animationDelay: `${520 + index * 90}ms` }}
    >
      <div className="h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center bg-black/20 border border-amber-200/20">
        {entry.image ? (
          <img src={entry.image} alt="" className="h-10 w-10 object-contain" />
        ) : (
          <span className="text-2xl" aria-hidden="true">{entry.icon}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-black text-sm text-amber-50 truncate">{entry.name}</div>
        <div className="text-[11px] font-bold text-amber-200/70">
          {entry.tier ? `T${entry.tier} 材料` : "特殊獎勵"}
        </div>
      </div>
      <div className="text-xl font-black text-white tabular-nums">×{entry.count.toLocaleString()}</div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expedition-result-title"
    >
      <style>{`
        @keyframes expeditionChestOpen {
          0% { opacity: 0; transform: translateY(18px) scale(.72); filter: brightness(.7); }
          55% { opacity: 1; transform: translateY(-8px) scale(1.08); filter: brightness(1.45); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: brightness(1); }
        }
        @keyframes expeditionRewardReveal {
          from { opacity: 0; transform: translateY(14px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .expedition-result-chest { animation: expeditionChestOpen .72s cubic-bezier(.2,.85,.25,1) both; }
        .expedition-reward-card {
          opacity: 0;
          animation: expeditionRewardReveal .42s ease-out both;
          display: flex;
          align-items: center;
          gap: .75rem;
          min-width: 0;
          border-radius: 1rem;
          padding: .75rem;
          background: linear-gradient(135deg, rgba(120,53,15,.7), rgba(51,65,85,.78));
          border: 1px solid rgba(253,230,138,.22);
          box-shadow: 0 10px 24px rgba(0,0,0,.22);
        }
        @media (prefers-reduced-motion: reduce) {
          .expedition-result-chest, .expedition-reward-card {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="min-h-full px-4 py-7 flex justify-center bg-[radial-gradient(circle_at_top,rgba(245,158,11,.24),transparent_42%)]">
        <div className="w-full max-w-xl flex flex-col items-center">
          <div className="text-xs font-black tracking-[.24em] text-amber-300">探險隊凱旋</div>
          <h2 id="expedition-result-title" className="mt-2 text-2xl font-black text-center text-amber-50">
            {result.catName} 帶回寶藏！
          </h2>
          <div className="mt-1 text-sm font-bold text-slate-300">
            T{result.missionTier} {mission?.label || "探險任務"}
          </div>

          <div className="relative mt-5 h-36 w-52 flex items-center justify-center expedition-result-chest">
            {mission?.image ? (
              <img src={mission.image} alt="" className="absolute h-32 w-32 object-contain opacity-40 blur-[1px]" />
            ) : null}
            <div className="absolute h-24 w-24 rounded-full bg-amber-300/25 blur-2xl" />
            <span className="relative text-7xl drop-shadow-[0_8px_18px_rgba(245,158,11,.55)]" aria-hidden="true">🎁</span>
            <img
              src={`/cats/portraits/${result.catId}.webp`}
              alt={result.catName}
              className="absolute -bottom-1 -right-1 h-16 w-16 rounded-full object-cover border-4 border-amber-300 shadow-xl"
            />
          </div>

          <div className="mt-3 w-full">
            <div className="mb-2 text-xs font-black text-amber-300">📦 採集材料</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {materials.map(renderRewardCard)}
            </div>
          </div>

          {specials.length > 0 ? (
            <div className="mt-5 w-full">
              <div className="mb-2 text-xs font-black text-fuchsia-300">✨ 特別收穫</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {specials.map((entry, index) => renderRewardCard(entry, materials.length + index))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="mt-7 min-h-12 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-base font-black text-white shadow-lg shadow-amber-950/50 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            收下獎勵
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 單個槽位卡片 ──────────────────────────────────────
function SlotCard({ slotIdx, expedition, myCats, now, onSelect, isActive, onCollect, collecting }) {
  if (!expedition) {
    return (
      <button
        onClick={() => onSelect(slotIdx)}
        className={`relative isolate min-h-[116px] w-full overflow-hidden rounded-2xl border p-3.5 text-left transition-all cursor-pointer active:scale-[.98] ${
          isActive
            ? "border-amber-300 shadow-[0_0_18px_rgba(251,191,36,.28)] ring-2 ring-amber-300/35"
            : "border-amber-100/15 hover:border-amber-300/40"
        }`}>
        <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-r from-[#1b0e06]/95 via-[#251309]/80 to-[#39200e]/40" />
        <span className="relative flex min-h-[88px] items-center gap-3">
          <CatVillageNavArt name="tasks" size={64} />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black tracking-[.18em] text-amber-300">EXPEDITION {slotIdx + 1}</span>
            <span className="mt-1 block text-base font-black text-amber-50">空閒的探險席位</span>
            <span className="mt-1 block text-[11px] font-bold text-amber-100/65">
              {isActive ? "正在規劃這次旅程…" : "選擇貓咪與目的地，展開新探險"}
            </span>
          </span>
          <span className={`grid h-9 w-9 place-items-center rounded-full text-xl font-black ${isActive ? "bg-amber-300 text-amber-950" : "bg-white/10 text-amber-100"}`}>＋</span>
        </span>
      </button>
    );
  }

  const endsAt     = expedition.endsAt?.toMillis?.() || 0;
  const startedAt  = expedition.startedAt?.toMillis?.() || (endsAt - (expedition.hours || 1) * 3600000);
  const totalDuration = Math.max(1, endsAt - startedAt);
  const msLeft     = endsAt - now;
  const isDone     = msLeft <= 0;
  const progressPct = isDone ? 100 : Math.min(100, Math.max(0, Math.round(((totalDuration - msLeft) / totalDuration) * 100)));

  const expMission = EXPEDITION_MISSIONS.find(m => m.tier === expedition.missionTier);
  const expCatInfo = CATS[expedition.catId];
  const catData    = myCats[expedition.catId];
  const catLv      = catData ? catLevelFromXP(catData.catXP || 0) : "?";

  return (
    <div className={`relative isolate min-h-[132px] w-full overflow-hidden rounded-2xl border p-3.5 transition-all shadow-md ${
      isDone
        ? "border-emerald-400/60 shadow-emerald-950/50"
        : "border-violet-400/35 shadow-violet-950/50"
    }`}>
      <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
      <div className={`absolute inset-0 ${isDone ? "bg-gradient-to-r from-emerald-950/95 via-slate-950/80 to-emerald-950/35" : "bg-gradient-to-r from-violet-950/95 via-slate-950/80 to-violet-950/35"}`} />
      <img src={expMission?.image} alt="" className="absolute -bottom-8 -right-3 h-44 w-44 object-contain opacity-65 drop-shadow-2xl" />

      <div className="relative flex items-start gap-3">
        <img
          src={`/cats/portraits/${expedition.catId}.webp`}
          alt={expedition.catName}
          className={`h-14 w-14 shrink-0 rounded-2xl object-cover border-2 shadow-lg ${
            isDone ? "border-emerald-400" : "border-violet-400"
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black tracking-[.16em] text-amber-300">
            探險槽 {slotIdx + 1} · T{expedition.missionTier}
          </div>
          <div className="mt-0.5 truncate text-base font-black text-white">{expCatInfo?.name || expedition.catName}</div>
          <div className="text-[11px] font-bold text-white/60">Lv.{catLv} · {expMission?.label || "探險任務"}</div>
        </div>
      </div>

      <div className="relative mt-3 max-w-[72%] space-y-1">
        <div className="flex justify-between text-[10px] font-black">
          <span className={isDone ? "text-emerald-300" : "text-violet-200"}>{isDone ? "探險完成，可以領取" : `旅程進度 ${progressPct}%`}</span>
          {!isDone && <span className="font-mono text-white/65">{fmtCountdown(msLeft)}</span>}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/45 p-0.5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: isDone
                ? "linear-gradient(90deg, #10B981, #34D399)"
                : "linear-gradient(90deg, #8B5CF6, #EC4899)",
              boxShadow: isDone ? "0 0 6px rgba(16,185,129,0.8)" : "0 0 6px rgba(167,139,250,0.8)",
            }}
          />
        </div>
      </div>

      {isDone && (
        <button
          onClick={() => onCollect(slotIdx)}
          disabled={collecting}
          className="relative mt-3 min-h-10 w-full max-w-[72%] rounded-xl border border-emerald-200/40 bg-gradient-to-r from-emerald-500 to-teal-500 px-3 font-black text-sm text-white shadow-md shadow-emerald-950/50 active:scale-[.98]">
          {collecting ? "領取中…" : "開啟探險寶箱"}
        </button>
      )}
    </div>
  );
}

export default function ExpeditionPanel({ profile, myCats = {} }) {
  const [activeSlot,  setActiveSlot]  = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedTier,setSelectedTier]= useState(null);
  const [sending,     setSending]     = useState(false);
  const [collecting,  setCollecting]  = useState({});
  const [msg,         setMsg]         = useState("");
  const [rewardResult,setRewardResult]= useState(null);
  const [now,         setNow]         = useState(Date.now());
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const villageRes        = profile?.village?.resources || {};

  // 向後兼容：支援舊的單一 expedition 欄位
  const rawExpeditions = profile?.expeditions || {};
  const expeditions = Object.keys(rawExpeditions).length > 0
    ? rawExpeditions
    : (profile?.expedition ? { 0: profile.expedition } : {});

  // 可派遣：持有且沒有在任何地方工作（戰鬥夥伴/挖掘/其他遠征欄位/建築工作）——統一用 busyCatIdSet
  const busyCatIds = busyCatIdSet(profile);
  const availableCats = Object.values(myCats).filter(c => !busyCatIds.has(c.catId));

  const mission    = selectedTier ? EXPEDITION_MISSIONS.find(m => m.tier === selectedTier) : null;
  const selCatData = selectedCat ? myCats[selectedCat] : null;
  const selCatInfo = selectedCat ? CATS[selectedCat] : null;
  const selCatLevel = selCatData ? catLevelFromXP(selCatData.catXP || 0) : 1;
  const selCatStats = selCatData ? calcCatFullStats(selCatData) : { catATK:10, catHP:200, catDEF:10 };

  const canDispatch = mission && selectedCat && (() =>
    Object.entries(mission.archerCost).every(([key, need]) =>
      Math.floor(villageRes[key] || 0) >= need
    )
  )();

  function showMsg(text) {
    setMsg(text);
    setTimeout(() => setMsg(""), 4000);
  }

  function handleSelectSlot(idx) {
    if (activeSlot === idx) {
      setActiveSlot(null);
      setSelectedCat(null);
      setSelectedTier(null);
    } else {
      setActiveSlot(idx);
      setSelectedCat(null);
      setSelectedTier(null);
    }
  }

  async function handleDispatch() {
    if (!canDispatch || sending || activeSlot === null) return;
    setSending(true);
    const result = await startExpedition(
      profile.id, activeSlot, selectedCat, selCatInfo?.name || selectedCat,
      selectedTier, mission.hours, mission.archerCost,
    );
    setSending(false);
    if (result.ok) {
      showMsg(`✅ ${selCatInfo?.name} 出發了！${mission.hours}小時後回來`);
      setActiveSlot(null);
      setSelectedCat(null);
      setSelectedTier(null);
    } else {
      showMsg(`❌ ${result.reason}`);
    }
  }

  async function handleCollect(slotIdx) {
    if (collecting[slotIdx]) return;
    const exp = expeditions[slotIdx];
    if (!exp) return;
    const catData = myCats[exp.catId] || {};
    const rewards = calcExpeditionRewards(exp.missionTier, catData);
    setCollecting(prev => ({ ...prev, [slotIdx]: true }));
    const result = await collectExpedition(profile.id, slotIdx, rewards, exp.catId);
    setCollecting(prev => ({ ...prev, [slotIdx]: false }));
    if (result.ok) {
      setRewardResult({
        rewards,
        catId: exp.catId,
        catName: CATS[exp.catId]?.name || exp.catName || exp.catId,
        missionTier: exp.missionTier,
      });
    } else {
      showMsg(`❌ ${result.reason}`);
    }
  }

  return (
    <div className="px-3 pb-20 pt-3 text-white">
      {msg && (
        <div style={{ background:"#14532d", borderRadius:10, padding:"9px 13px", marginBottom:12, fontWeight:800, fontSize:13, whiteSpace:"pre-line" }}>
          {msg}
        </div>
      )}

      {rewardResult ? (
        <ExpeditionRewardResult result={rewardResult} onClose={() => setRewardResult(null)} />
      ) : null}

      <div className="relative isolate mb-4 min-h-[178px] overflow-hidden rounded-3xl border border-amber-300/30 shadow-2xl">
        <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#160b04]/95 via-[#241207]/65 to-transparent" />
        <div className="relative flex min-h-[178px] items-center gap-3 p-5">
          <CatVillageNavArt name="tasks" size={78} />
          <div>
            <div className="text-[10px] font-black tracking-[.24em] text-amber-300">CAT EXPEDITION</div>
            <div className="mt-1 text-2xl font-black text-amber-50">貓貓探險隊</div>
            <div className="mt-2 max-w-[250px] text-xs font-bold leading-relaxed text-amber-100/75">
              派出最多三隻空閒貓咪，前往不同階級的區域尋找村莊物資與稀有寶藏。
            </div>
            <div className="mt-2 text-[10px] font-bold text-amber-300/75">
              裝備中、發掘中或已出發的貓咪不能重複派遣
            </div>
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-end justify-between px-1">
        <div>
          <div className="text-sm font-black text-amber-50">探險席位</div>
          <div className="text-[10px] font-bold text-amber-100/50">點擊空席位開始安排任務</div>
        </div>
        <div className="rounded-full border border-amber-300/20 bg-amber-950/35 px-2.5 py-1 text-[10px] font-black text-amber-200">
          {Object.values(expeditions).filter(Boolean).length} / 3 出發中
        </div>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[0, 1, 2].map(idx => (
          <SlotCard
            key={idx}
            slotIdx={idx}
            expedition={expeditions[idx] || null}
            myCats={myCats}
            now={now}
            onSelect={handleSelectSlot}
            isActive={activeSlot === idx}
            onCollect={handleCollect}
            collecting={!!collecting[idx]}
          />
        ))}
      </div>

      {/* 派遣設定表單（點空槽後展開） */}
      {activeSlot !== null && (
        <div className="rounded-3xl p-4 bg-slate-900/90 border border-purple-500/30 shadow-xl space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="font-black text-sm text-purple-300 flex items-center gap-1.5">
              <span>🚩</span> 探險槽 {activeSlot+1} — 派遣任務佈署
            </div>
            <button type="button" onClick={() => setActiveSlot(null)} className="text-xs text-slate-400 hover:text-white">✕ 關閉</button>
          </div>

          {/* Step 1：選貓 */}
          <div>
            <div className="text-xs font-black text-purple-300 mb-2 flex items-center justify-between">
              <span>① 選擇隊長貓咪</span>
              <span className="text-[10px] text-slate-400">可派遣：{availableCats.length} 隻</span>
            </div>
            {availableCats.length === 0 ? (
              <div className="text-slate-400 text-xs p-4 text-center bg-black/30 rounded-2xl border border-white/5 space-y-1">
                <div>😿 沒有空閒的貓咪可以派遣</div>
                <div className="text-[10px] text-slate-500">（所有貓咪正在陪練、地下城發掘或探險中）</div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableCats.map(cat => {
                  const info       = CATS[cat.catId];
                  const realType   = CAT_TYPE_MAP[cat.catId] || cat.type || "allround";
                  const lv         = catLevelFromXP(cat.catXP || 0);
                  const isSelected = selectedCat === cat.catId;
                  return (
                    <button key={cat.catId}
                      type="button"
                      onClick={() => setSelectedCat(isSelected ? null : cat.catId)}
                      className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 active:scale-95 relative overflow-hidden ${
                        isSelected
                          ? "bg-purple-900/60 border-purple-300 ring-2 ring-purple-400/50 shadow-lg shadow-purple-950/80"
                          : "bg-slate-950/70 border-white/10 hover:border-purple-400/40 hover:bg-slate-800/50"
                      }`}>
                      <img
                        src={`/cats/portraits/${cat.catId}.webp`}
                        alt={info?.name || cat.catId}
                        className="w-12 h-12 rounded-full object-cover border-2 border-purple-400/50 shadow-md"
                      />
                      <div className="font-black text-xs text-white truncate max-w-full">
                        {info?.name || cat.catId}
                      </div>
                      <div className="text-[10px] font-black" style={{ color: TYPE_COLOR[realType] || "#9ca3af" }}>
                        {TYPE_LABEL[realType] || "—"}
                      </div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Lv.{lv}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 選中貓咪戰力數值與加成 */}
          {selCatData && selCatInfo && (
            <div className="rounded-2xl p-3 bg-purple-950/40 border border-purple-500/30 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-black text-purple-200">
                  <span>🐾 {selCatInfo.name}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Lv.{selCatLevel}</span>
                </div>
                <span className="text-[11px] font-black text-amber-300">
                  × {catPowerMult(selCatStats.catATK).toFixed(2)} 探險獎勵倍率
                </span>
              </div>
              <div className="flex gap-3 text-[11px] font-bold pt-1 border-t border-purple-500/20">
                <span className="text-red-400">⚔️ 攻擊 {selCatStats.catATK}</span>
                <span className="text-blue-400">🛡️ 防禦 {selCatStats.catDEF}</span>
                <span className="text-emerald-400">❤️ HP {selCatStats.catHP}</span>
              </div>
            </div>
          )}

          {/* Step 2：選任務 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#a78bfa", marginBottom:8 }}>② 選擇任務難度</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {EXPEDITION_MISSIONS.map(m => {
                const isSelected = selectedTier === m.tier;
                const costOk = Object.entries(m.archerCost).every(([k, need]) =>
                  Math.floor(villageRes[k] || 0) >= need
                );
                return (
                  <button key={m.tier}
                    onClick={() => setSelectedTier(isSelected ? null : m.tier)}
                    style={{
                      background: isSelected ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${isSelected ? "rgba(167,139,250,0.6)" : costOk ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.3)"}`,
                      borderRadius:14, padding:"11px 13px", cursor:"pointer",
                      textAlign:"left", transition:"all 0.15s",
                    }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: isSelected ? 8 : 0 }}>
                      <img src={m.image} alt="" style={{ width:52, height:52, objectFit:"contain", flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:900, fontSize:13, color:"white" }}>
                          T{m.tier} {m.label}
                        </div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>
                          {m.hours >= 24 ? `${m.hours/24}天` : `${m.hours}小時`} · {costOk ? "✓ 射手足夠" : "⚠ 射手不足"}
                        </div>
                      </div>
                      <div style={{ fontSize:10, color: costOk ? "#4ade80" : "#f87171", fontWeight:800 }}>
                        {costOk ? "可派遣" : "不足"}
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{ borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:8, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        <div>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>消耗射手</div>
                          <ArcherCostRow archerCost={m.archerCost} villageRes={villageRes} />
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>
                            預期獎勵 {selCatData ? `(ATK ${selCatStats.catATK})` : ""}
                          </div>
                          <RewardPreview mission={m} catData={selCatData} />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 派遣按鈕 */}
          <button
            onClick={handleDispatch}
            disabled={!canDispatch || sending}
            style={{
              width:"100%", padding:"15px 0", borderRadius:16,
              fontWeight:900, fontSize:16, border:"none",
              cursor: canDispatch ? "pointer" : "not-allowed",
              background: canDispatch ? "linear-gradient(90deg,#7c3aed,#a78bfa)" : "rgba(255,255,255,0.07)",
              color: canDispatch ? "white" : "rgba(255,255,255,0.25)",
            }}>
            {sending
              ? "派遣中…"
              : !selectedCat
                ? "請先選擇貓咪"
                : !selectedTier
                  ? "請選擇任務難度"
                  : !canDispatch
                    ? "射手資源不足"
                    : `🚀 派遣 ${selCatInfo?.name} 出發！`
            }
          </button>
        </div>
      )}
    </div>
  );
}
