// src/components/member/ExpeditionPanel.jsx — 遠征隊派遣面板（3 槽位）
import { useState, useEffect, useRef } from "react";
import { subscribeMyCats } from "../../lib/catDb";
import { CATS, CAT_TYPE_MAP } from "../../lib/catData";
import { catLevelFromXP } from "../../lib/catLevel";
import { startExpedition, collectExpedition } from "../../lib/db";
import { busyCatIdSet } from "../../lib/catAssignment";
import {
  EXPEDITION_MISSIONS, calcExpeditionRewards, fmtCountdown,
  calcCatFullStats, catPowerMult,
} from "../../lib/expeditionData";

const TYPE_LABEL = { attack:"⚔️ 攻擊型", defense:"🛡️ 防禦型", allround:"💚 治癒型" };
const TYPE_COLOR = { attack:"#f87171", defense:"#60a5fa", allround:"#a78bfa" };
const TIER_COLOR = ["","#9ca3af","#4ade80","#60a5fa","#a78bfa","#fbbf24"];

const RES_CN   = { fur:"貓毛", potion:"貓草藥水", arrowdew:"箭露", gachaToken:"扭蛋幣", archer:"射手", ore:"礦物", melon:"瓜瓜", fish:"鮮魚", meat:"動物肉", driedfish:"小魚乾", can:"貓罐頭" };
const RES_ICON = { fur:"🐾", potion:"🍵", arrowdew:"💧", gachaToken:"🎰", archer:"🏹", ore:"⛏️", melon:"🍈", fish:"🐟", meat:"🍖", driedfish:"🐠", can:"🥫" };

function fmtRewardKey(key, amt) {
  if (key === "arrowdew")   return `${RES_ICON.arrowdew} 箭露 ×${amt}`;
  if (key === "gachaToken") return `${RES_ICON.gachaToken} 扭蛋幣 ×${amt}`;
  if (key === "catXP")      return `⭐ 貓咪經驗 +${amt}`;
  if (key === "catBond")    return `💛 羈絆 +${amt}`;
  if (key.includes("_t")) {
    const [res, t] = key.split("_t");
    return `${RES_ICON[res] || "📦"} ${RES_CN[res] || res} T${t} ×${amt}`;
  }
  return `${key} ×${amt}`;
}

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

// ── 單個槽位卡片 ──────────────────────────────────────
function SlotCard({ slotIdx, expedition, myCats, now, onSelect, isActive, onCollect, collecting }) {
  if (!expedition) {
    return (
      <button
        onClick={() => onSelect(slotIdx)}
        className={`flex-1 min-w-0 rounded-2xl p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
          isActive
            ? "bg-purple-900/30 border-purple-400 shadow-[0_0_12px_rgba(167,139,250,0.3)] ring-2 ring-purple-400/40"
            : "bg-slate-900/50 border-white/10 hover:border-purple-400/40 hover:bg-slate-800/50"
        }`}>
        <div className="text-3xl mb-0.5">🏕️</div>
        <div className="text-xs font-black text-slate-300">探險槽 {slotIdx+1}</div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? "bg-purple-500/20 text-purple-300" : "bg-white/5 text-slate-400"}`}>
          {isActive ? "設定中…" : "+ 點擊派遣"}
        </div>
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
    <div className={`flex-1 min-w-0 rounded-2xl p-2.5 flex flex-col items-center gap-1.5 border transition-all shadow-md relative overflow-hidden ${
      isDone
        ? "bg-gradient-to-b from-emerald-950/80 to-slate-900/90 border-emerald-500/60 shadow-emerald-950/50"
        : "bg-gradient-to-b from-slate-900/90 to-purple-950/60 border-purple-500/40 shadow-purple-950/50"
    }`}>
      {/* 背景行進微光線條 */}
      {!isDone && (
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#a78bfa_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />
      )}

      {/* 任務等級 Icon + 探險動畫標籤 */}
      <div className="relative flex items-center justify-center">
        <img src={expMission?.image} alt={expMission?.label || "遠征任務"} className="w-12 h-12 object-contain drop-shadow-md" />
        {!isDone && (
          <span className="absolute -top-1 -right-2 text-xs animate-bounce" title="探險進行中">
            🐾
          </span>
        )}
      </div>
      
      {/* 貓咪頭像 (探險中加入微呼吸邊框) */}
      <div className="relative">
        <img
          src={`/cats/portraits/${expedition.catId}.webp`}
          alt={expedition.catName}
          className={`w-10 h-10 rounded-full object-cover border-2 shadow-sm ${
            isDone ? "border-emerald-400" : "border-purple-400 animate-pulse"
          }`}
        />
        <span className="absolute -bottom-1 -right-1 text-[9px] font-black bg-purple-900 text-purple-200 px-1 rounded-full border border-purple-400/40">
          Lv.{catLv}
        </span>
      </div>

      <div className="text-xs font-black text-white text-center truncate max-w-full leading-tight">
        {expCatInfo?.name || expedition.catName}
      </div>

      {/* 即時探險進度條 */}
      <div className="w-full space-y-1 my-0.5">
        <div className="flex justify-between items-center text-[9px] font-bold">
          <span className={isDone ? "text-emerald-400" : "text-purple-300"}>
            {isDone ? "✓ 探險完成" : `探險中 ${progressPct}%`}
          </span>
          <span className="text-slate-400 font-mono">
            {isDone ? "" : fmtCountdown(msLeft)}
          </span>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden p-0.5 bg-black/40 border border-white/10">
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

      {/* 領取按鈕 */}
      {isDone && (
        <button
          onClick={() => onCollect(slotIdx)}
          disabled={collecting}
          className="w-full mt-1 py-1.5 rounded-xl font-black text-xs transition-all active:scale-95 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-md shadow-emerald-950/50 border border-emerald-300/40">
          {collecting ? "領取中…" : "🎁 領取寶藏"}
        </button>
      )}
    </div>
  );
}

export default function ExpeditionPanel({ profile }) {
  const [myCats,      setMyCats]      = useState({});
  const [activeSlot,  setActiveSlot]  = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedTier,setSelectedTier]= useState(null);
  const [sending,     setSending]     = useState(false);
  const [collecting,  setCollecting]  = useState({});
  const [msg,         setMsg]         = useState("");
  const [now,         setNow]         = useState(Date.now());
  const timerRef = useRef(null);

  useEffect(() => {
    if (!profile?.id) return;
    return subscribeMyCats(profile.id, setMyCats);
  }, [profile?.id]);

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
      const lines = Object.entries(rewards).map(([k,v]) => fmtRewardKey(k, v)).join("　");
      showMsg(`🎉 遠征完成！\n${lines}`);
    } else {
      showMsg(`❌ ${result.reason}`);
    }
  }

  return (
    <div style={{ padding:"12px 12px 80px", color:"white" }}>
      {msg && (
        <div style={{ background:"#14532d", borderRadius:10, padding:"9px 13px", marginBottom:12, fontWeight:800, fontSize:13, whiteSpace:"pre-line" }}>
          {msg}
        </div>
      )}

      {/* 說明提示卡 */}
      <div className="rounded-2xl p-3 mb-3.5 bg-gradient-to-r from-purple-950/60 to-slate-900/80 border border-purple-400/20 text-xs text-purple-200/90 shadow-sm flex items-start gap-2.5">
        <span className="text-xl shrink-0">🐾</span>
        <div>
          <div className="font-black text-purple-300">貓貓探險隊須知</div>
          <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
            最多可同時派遣 3 隻貓咪去外頭探險帶回豐厚寶物！<br/>
            <span className="text-amber-300/80">⚠️ 裝備中、正在地下城發掘或正在探險中的貓咪無法重複派遣。</span>
          </div>
        </div>
      </div>

      {/* 3 個槽位卡片 */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
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
