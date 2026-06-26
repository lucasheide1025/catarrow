// src/components/member/ExpeditionPanel.jsx — 遠征隊派遣面板
import { useState, useEffect, useRef } from "react";
import { subscribeMyCats } from "../../lib/catDb";
import { CATS } from "../../lib/catData";
import { catLevelFromXP } from "../../lib/catLevel";
import { startExpedition, collectExpedition } from "../../lib/db";
import {
  EXPEDITION_MISSIONS, calcExpeditionRewards, fmtCountdown, catLevelMult,
} from "../../lib/expeditionData";

const TYPE_LABEL = { attack:"攻擊型", defense:"防禦型", allround:"全能型" };
const TYPE_COLOR = { attack:"#f87171", defense:"#60a5fa", allround:"#a78bfa" };
const TIER_COLOR = ["","#9ca3af","#4ade80","#60a5fa","#a78bfa","#fbbf24"];

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

function RewardPreview({ mission, catLevel }) {
  const mult = catLevelMult(catLevel);
  return (
    <div className="flex flex-col gap-0.5">
      {mission.baseRewards.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px]">
          <span className="font-black" style={{ color: r.resource === "fur" ? "#fbbf24" : "#a78bfa" }}>
            {r.resource === "fur" ? "🐾 貓毛" : "🍵 貓草藥水"} T{r.tier}
          </span>
          <span className="ml-auto" style={{ color: "#86efac" }}>
            {Math.max(1,Math.round(r.min*mult))}–{Math.round(r.max*mult)}
          </span>
        </div>
      ))}
      {mission.bonusChance?.arrowdew > 0 && (
        <div className="text-[10px]" style={{ color:"#78350f" }}>
          💧 箭露 {Math.round(mission.bonusChance.arrowdew*100)}% 機率掉落
        </div>
      )}
      {mission.bonusChance?.gachaToken > 0 && (
        <div className="text-[10px]" style={{ color:"#78350f" }}>
          🎰 扭蛋幣 {Math.round(mission.bonusChance.gachaToken*100)}% 機率掉落
        </div>
      )}
    </div>
  );
}

export default function ExpeditionPanel({ profile }) {
  const [myCats,      setMyCats]      = useState({});
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedTier,setSelectedTier]= useState(null);
  const [sending,     setSending]     = useState(false);
  const [collecting,  setCollecting]  = useState(false);
  const [msg,         setMsg]         = useState("");
  const [now,         setNow]         = useState(Date.now());
  const timerRef = useRef(null);

  useEffect(() => {
    if (!profile?.id) return;
    return subscribeMyCats(profile.id, setMyCats);
  }, [profile?.id]); // eslint-disable-line

  // 倒計時每分鐘更新
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timerRef.current);
  }, []);

  const expedition   = profile?.expedition;
  const villageRes   = profile?.village?.resources || {};
  const equippedCatId = profile?.equippedCat?.catId;

  // 可派遣的貓（持有且非裝備中）
  const availableCats = Object.values(myCats).filter(c => c.catId !== equippedCatId);

  const mission = selectedTier ? EXPEDITION_MISSIONS.find(m => m.tier === selectedTier) : null;
  const selCatData = selectedCat ? myCats[selectedCat] : null;
  const selCatInfo = selectedCat ? CATS[selectedCat] : null;
  const selCatLevel = selCatData ? catLevelFromXP(selCatData.catXP || 0) : 1;

  // 檢查射手是否足夠
  const canDispatch = mission && selectedCat && (() => {
    return Object.entries(mission.archerCost).every(([key, need]) =>
      Math.floor(villageRes[key] || 0) >= need
    );
  })();

  function showMsg(text) {
    setMsg(text);
    setTimeout(() => setMsg(""), 4000);
  }

  async function handleDispatch() {
    if (!canDispatch || sending) return;
    setSending(true);
    const result = await startExpedition(
      profile.id, selectedCat, selCatInfo?.name || selectedCat,
      selectedTier, mission.hours, mission.archerCost,
    );
    setSending(false);
    if (result.ok) {
      showMsg(`✅ ${selCatInfo?.name} 出發了！${mission.hours}小時後回來`);
      setSelectedCat(null);
      setSelectedTier(null);
    } else {
      showMsg(`❌ ${result.reason}`);
    }
  }

  async function handleCollect() {
    if (collecting || !expedition) return;
    const catLv = myCats[expedition.catId]
      ? catLevelFromXP(myCats[expedition.catId].catXP || 0)
      : 1;
    const rewards = calcExpeditionRewards(expedition.missionTier, catLv);
    setCollecting(true);
    const result = await collectExpedition(profile.id, rewards);
    setCollecting(false);
    if (result.ok) {
      const lines = Object.entries(rewards).map(([k,v]) => `${k} ×${v}`).join("、");
      showMsg(`🎉 遠征完成！獲得：${lines}`);
    } else {
      showMsg(`❌ ${result.reason}`);
    }
  }

  // ── 進行中的遠征 ─────────────────────────────────────────
  if (expedition?.status === "active") {
    const endsAt  = expedition.endsAt?.toMillis?.() || 0;
    const msLeft  = endsAt - now;
    const isDone  = msLeft <= 0;
    const expMission = EXPEDITION_MISSIONS.find(m => m.tier === expedition.missionTier);
    const expCatInfo = CATS[expedition.catId];

    return (
      <div style={{ padding:"12px 12px 20px", color:"white" }}>
        {msg && (
          <div style={{ background:"#14532d", borderRadius:10, padding:"9px 13px", marginBottom:12, fontWeight:800, fontSize:13 }}>
            {msg}
          </div>
        )}

        <div style={{ background:"linear-gradient(135deg,#1c1f2e,#2a1a3e)", borderRadius:18, padding:18, border:"1.5px solid rgba(167,139,250,0.3)" }}>
          {/* 標頭 */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ fontSize:40 }}>{expMission?.emoji || "⚡"}</div>
            <div>
              <div style={{ fontWeight:900, fontSize:16, color:"#a78bfa" }}>{expMission?.label}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>難度 T{expedition.missionTier} · {expMission?.hours}小時任務</div>
            </div>
          </div>

          {/* 貓咪資訊 */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, background:"rgba(255,255,255,0.05)", borderRadius:12, padding:"10px 12px" }}>
            <img
              src={`/cats/portraits/${expedition.catId}.webp`}
              alt={expedition.catName}
              style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", border:"2px solid rgba(167,139,250,0.5)", flexShrink:0 }}
            />
            <div>
              <div style={{ fontWeight:900, fontSize:14, color:"white" }}>{expedition.catName}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>
                Lv {myCats[expedition.catId] ? catLevelFromXP(myCats[expedition.catId].catXP||0) : "?"} · 領隊中
              </div>
            </div>
            <div style={{ marginLeft:"auto", textAlign:"right" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>
                {isDone ? "任務完成" : "預計回來"}
              </div>
              <div style={{ fontWeight:900, fontSize:15, color: isDone ? "#4ade80" : "#fbbf24" }}>
                {fmtCountdown(msLeft)}
              </div>
            </div>
          </div>

          {/* 射手消耗 */}
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>消耗射手</div>
          <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"8px 12px", marginBottom:14 }}>
            {Object.entries(expedition.archerCost || {}).map(([k, v]) => {
              const tier = Number(k.replace("archer_t",""));
              return (
                <div key={k} className="flex items-center gap-2 text-xs" style={{ marginBottom:3 }}>
                  <span style={{ color: TIER_COLOR[tier], fontWeight:900 }}>T{tier} 射手</span>
                  <span style={{ color:"rgba(255,255,255,0.5)", marginLeft:"auto" }}>×{v}</span>
                </div>
              );
            })}
          </div>

          {/* 收取按鈕 */}
          <button
            onClick={handleCollect}
            disabled={!isDone || collecting}
            style={{
              width:"100%", padding:"14px 0", borderRadius:14,
              fontWeight:900, fontSize:16, border:"none",
              cursor: isDone ? "pointer" : "not-allowed",
              background: isDone ? "linear-gradient(90deg,#a78bfa,#7c3aed)" : "rgba(255,255,255,0.08)",
              color: isDone ? "white" : "rgba(255,255,255,0.3)",
            }}>
            {collecting ? "領取中…" : isDone ? "🎁 領取遠征獎勵" : `⏳ ${fmtCountdown(msLeft)} 後返回`}
          </button>
        </div>
      </div>
    );
  }

  // ── 派遣設定畫面 ─────────────────────────────────────────
  return (
    <div style={{ padding:"12px 12px 80px", color:"white" }}>
      {msg && (
        <div style={{ background:"#14532d", borderRadius:10, padding:"9px 13px", marginBottom:12, fontWeight:800, fontSize:13 }}>
          {msg}
        </div>
      )}

      {/* 說明 */}
      <div style={{ background:"rgba(167,139,250,0.07)", borderRadius:12, padding:"9px 13px", marginBottom:14, fontSize:11, color:"rgba(167,139,250,0.8)", border:"1px solid rgba(167,139,250,0.15)" }}>
        選一隻貓咪擔任領隊，搭配任務難度出發。貓咪等級越高，回來帶的素材越多。<br/>
        <span style={{ color:"rgba(255,255,255,0.3)" }}>裝備中的貓咪不能派遣 · 射手消耗後不歸還</span>
      </div>

      {/* Step 1：選貓 */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:800, color:"#a78bfa", marginBottom:8 }}>① 選擇領隊貓咪</div>
        {availableCats.length === 0 ? (
          <div style={{ color:"rgba(255,255,255,0.3)", fontSize:12, padding:"12px", textAlign:"center", background:"rgba(255,255,255,0.04)", borderRadius:12 }}>
            沒有可派遣的貓咪（所有貓都在裝備中或未持有）
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
            {availableCats.map(cat => {
              const info  = CATS[cat.catId];
              const lv    = catLevelFromXP(cat.catXP || 0);
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
          <span style={{ color:"#a78bfa", fontWeight:800 }}>{selCatInfo.name}</span>
          <span style={{ color:"rgba(255,255,255,0.5)", marginLeft:6 }}>Lv {selCatLevel}</span>
          <span style={{ color:"#fbbf24", marginLeft:8 }}>× {catLevelMult(selCatLevel).toFixed(2)} 獎勵加成</span>
        </div>
      )}

      {/* Step 2：選任務 */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:800, color:"#a78bfa", marginBottom:8 }}>② 選擇任務難度</div>
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
                  <span style={{ fontSize:22 }}>{m.emoji}</span>
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
                        預期獎勵 {selCatLevel > 1 ? `(Lv${selCatLevel}加成)` : ""}
                      </div>
                      <RewardPreview mission={m} catLevel={selCatLevel} />
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
  );
}
