// src/components/member/ExpeditionPanel.jsx — 遠征隊派遣面板（3 槽位）
import { useState, useEffect, useRef } from "react";
import { subscribeMyCats } from "../../lib/catDb";
import { CATS } from "../../lib/catData";
import { catLevelFromXP } from "../../lib/catLevel";
import { startExpedition, collectExpedition } from "../../lib/db";
import {
  EXPEDITION_MISSIONS, calcExpeditionRewards, fmtCountdown,
  calcCatFullStats, catPowerMult,
} from "../../lib/expeditionData";

const TYPE_LABEL = { attack:"攻擊型", defense:"防禦型", allround:"治癒型" };
const TYPE_COLOR = { attack:"#f87171", defense:"#60a5fa", allround:"#a78bfa" };
const TIER_COLOR = ["","#9ca3af","#4ade80","#60a5fa","#a78bfa","#fbbf24"];

const RES_CN   = { fur:"貓毛", potion:"貓草藥水", arrowdew:"箭露", gachaToken:"扭蛋幣", archer:"射手", ore:"礦物", melon:"瓜瓜", fish:"鮮魚", meat:"動物肉", driedfish:"小魚乾", can:"貓罐頭" };
const RES_ICON = { fur:"🐾", potion:"🍵", arrowdew:"💧", gachaToken:"🎰", archer:"🏹", ore:"⛏️", melon:"🍈", fish:"🐟", meat:"🍖", driedfish:"🐠", can:"🥫" };

function fmtRewardKey(key, amt) {
  if (key === "arrowdew")   return `${RES_ICON.arrowdew} 箭露 ×${amt}`;
  if (key === "gachaToken") return `${RES_ICON.gachaToken} 扭蛋幣 ×${amt}`;
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
        style={{
          flex:1, minWidth:0,
          background: isActive ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${isActive ? "rgba(167,139,250,0.7)" : "rgba(255,255,255,0.1)"}`,
          borderRadius:16, padding:"14px 8px", cursor:"pointer",
          display:"flex", flexDirection:"column", alignItems:"center", gap:6,
          transition:"all 0.15s",
        }}>
        <div style={{ fontSize:28 }}>🏕️</div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", fontWeight:600 }}>遠征槽 {slotIdx+1}</div>
        <div style={{ fontSize:10, color: isActive ? "#a78bfa" : "rgba(255,255,255,0.25)", fontWeight:800 }}>
          {isActive ? "設定中…" : "空置"}
        </div>
      </button>
    );
  }

  const endsAt     = expedition.endsAt?.toMillis?.() || 0;
  const msLeft     = endsAt - now;
  const isDone     = msLeft <= 0;
  const expMission = EXPEDITION_MISSIONS.find(m => m.tier === expedition.missionTier);
  const expCatInfo = CATS[expedition.catId];
  const catData    = myCats[expedition.catId];
  const catLv      = catData ? catLevelFromXP(catData.catXP || 0) : "?";

  return (
    <div style={{
      flex:1, minWidth:0,
      background: isDone
        ? "linear-gradient(135deg,#14532d,#166534)"
        : "linear-gradient(135deg,#1c1f2e,#2a1a3e)",
      border: `1.5px solid ${isDone ? "rgba(74,222,128,0.5)" : "rgba(167,139,250,0.3)"}`,
      borderRadius:16, padding:"10px 8px",
      display:"flex", flexDirection:"column", alignItems:"center", gap:4,
    }}>
      <img src={expMission?.image} alt={expMission?.label || "遠征任務"} style={{ width:48, height:48, objectFit:"contain" }} />
      <img
        src={`/cats/portraits/${expedition.catId}.webp`}
        alt={expedition.catName}
        style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", border:"1.5px solid rgba(167,139,250,0.5)" }}
      />
      <div style={{ fontSize:10, fontWeight:900, color:"white", textAlign:"center", lineHeight:1.2 }}>
        {expCatInfo?.name || expedition.catName}
      </div>
      <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)" }}>Lv {catLv}</div>
      <div style={{ fontSize:10, fontWeight:900, color: isDone ? "#4ade80" : "#fbbf24" }}>
        {isDone ? "✓ 完成" : fmtCountdown(msLeft)}
      </div>
      {isDone && (
        <button
          onClick={() => onCollect(slotIdx)}
          disabled={collecting}
          style={{
            marginTop:2, width:"100%", padding:"6px 0", borderRadius:10,
            fontWeight:900, fontSize:10, border:"none",
            background: collecting ? "rgba(255,255,255,0.08)" : "linear-gradient(90deg,#4ade80,#16a34a)",
            color: collecting ? "rgba(255,255,255,0.3)" : "#fff",
            cursor: collecting ? "not-allowed" : "pointer",
          }}>
          {collecting ? "領取中" : "🎁 領取"}
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
  }, [profile?.id]); // eslint-disable-line

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timerRef.current);
  }, []);

  const villageRes    = profile?.village?.resources || {};
  const equippedCatId = profile?.equippedCat?.catId;

  // 向後兼容：支援舊的單一 expedition 欄位
  const rawExpeditions = profile?.expeditions || {};
  const expeditions = Object.keys(rawExpeditions).length > 0
    ? rawExpeditions
    : (profile?.expedition ? { 0: profile.expedition } : {});

  // 已在遠征的貓咪 IDs
  const onExpeditionCatIds = new Set(
    Object.values(expeditions).filter(Boolean).map(e => e.catId)
  );

  // 可派遣：持有、非裝備中、非遠征中
  const availableCats = Object.values(myCats).filter(
    c => c.catId !== equippedCatId && !onExpeditionCatIds.has(c.catId)
  );

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
    const result = await collectExpedition(profile.id, slotIdx, rewards);
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

      {/* 說明 */}
      <div style={{ background:"rgba(167,139,250,0.07)", borderRadius:12, padding:"9px 13px", marginBottom:14, fontSize:11, color:"rgba(167,139,250,0.8)", border:"1px solid rgba(167,139,250,0.15)" }}>
        可同時派遣最多 3 隻貓咪遠征。貓咪等級越高，帶回的素材越多。<br/>
        <span style={{ color:"rgba(255,255,255,0.3)" }}>裝備中的貓咪不能派遣 · 射手消耗後不歸還</span>
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
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:16, padding:"14px 12px" }}>
          <div style={{ fontWeight:900, fontSize:13, color:"#a78bfa", marginBottom:12 }}>
            遠征槽 {activeSlot+1} — 派遣設定
          </div>

          {/* Step 1：選貓 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#a78bfa", marginBottom:8 }}>① 選擇領隊貓咪</div>
            {availableCats.length === 0 ? (
              <div style={{ color:"rgba(255,255,255,0.3)", fontSize:12, padding:"12px", textAlign:"center", background:"rgba(255,255,255,0.04)", borderRadius:12 }}>
                沒有可派遣的貓咪（裝備中或全在遠征中）
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
                {availableCats.map(cat => {
                  const info       = CATS[cat.catId];
                  const lv         = catLevelFromXP(cat.catXP || 0);
                  const isSelected = selectedCat === cat.catId;
                  return (
                    <button key={cat.catId}
                      onClick={() => setSelectedCat(isSelected ? null : cat.catId)}
                      style={{
                        background: isSelected ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.05)",
                        border: `1.5px solid ${isSelected ? "rgba(167,139,250,0.7)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius:14, padding:"10px 8px", cursor:"pointer",
                        transition:"all 0.15s",
                      }}>
                      <img
                        src={`/cats/portraits/${cat.catId}.webp`}
                        alt={info?.name || cat.catId}
                        style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", marginBottom:4 }}
                      />
                      <div style={{ fontWeight:900, fontSize:11, color:"white", marginBottom:2 }}>
                        {info?.name || cat.catId}
                      </div>
                      <div style={{ fontSize:10, color: TYPE_COLOR[cat.type] || "#9ca3af" }}>
                        {TYPE_LABEL[cat.type] || "—"}
                      </div>
                      <div style={{ fontSize:10, color:"#fbbf24", fontWeight:800 }}>Lv {lv}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 選中貓咪資訊 */}
          {selCatData && selCatInfo && (
            <div style={{ background:"rgba(167,139,250,0.08)", borderRadius:12, padding:"10px 13px", marginBottom:14, border:"1px solid rgba(167,139,250,0.2)", fontSize:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <span style={{ color:"#a78bfa", fontWeight:800 }}>{selCatInfo.name}</span>
                <span style={{ color:"rgba(255,255,255,0.4)" }}>Lv {selCatLevel}</span>
                <span style={{ color:"#fbbf24", fontWeight:900, marginLeft:"auto" }}>× {catPowerMult(selCatStats.catATK).toFixed(2)} 獎勵加成</span>
              </div>
              <div style={{ display:"flex", gap:10, fontSize:11 }}>
                <span style={{ color:"#f87171" }}>⚔️ ATK {selCatStats.catATK}</span>
                <span style={{ color:"#60a5fa" }}>🛡️ DEF {selCatStats.catDEF}</span>
                <span style={{ color:"#4ade80" }}>❤️ HP {selCatStats.catHP}</span>
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
