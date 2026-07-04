// src/components/member/CouncilHall.jsx — 議會廳入口（冒險者公會卡片風格）
import { useState, useEffect } from "react";
import {
  COUNCIL_BUILDINGS, COUNCIL_MONSTERS, TIER_META, LIFE_TIER_STATS,
  getAvailableTiers, getAvailableTiersByPower,
} from "../../lib/councilMonsters";
import { calcArcherPower } from "../../lib/monsterData";
import {
  checkCouncilDailyLimit, recordCouncilSession, completeCouncilSession,
  getCertRecords, getCertification, getDexConfig, subscribeCardCollection,
} from "../../lib/db";
import { useCheckinActive } from "../../hooks/useCheckinActive";
import { calcArcherStats } from "../../lib/monsterData";
import { calcEquippedBonus } from "../../lib/monsterCards";
import { archerLevelFromXP, archerLevelBonus } from "../../lib/archerLevel";
import { computeDexStats } from "../../lib/achievementDex";
import CouncilBattle from "./CouncilBattle";
import ExpeditionPanel from "./ExpeditionPanel";

const BLD_GRADIENT = {
  mine:      "linear-gradient(135deg,#374151,#1f2937)",
  farm:      "linear-gradient(135deg,#14532d,#166534)",
  harbor:    "linear-gradient(135deg,#1e3a5f,#1e40af)",
  hunting:   "linear-gradient(135deg,#3f6212,#4d7c0f)",
  market:    "linear-gradient(135deg,#92400e,#78350f)",
  warehouse: "linear-gradient(135deg,#4c1d95,#312e81)",
};

const CSS = `
@keyframes ch-pop { 0%{transform:scale(0.97);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes ch-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
`;

export default function CouncilHall({ profile, village, onBack }) {
  const checkinActive = useCheckinActive(profile?.id);
  const [tab,          setTab]          = useState("collect"); // "collect" | "expedition"
  const [activeBld,    setActiveBld]    = useState(null);
  const [activeTier,   setActiveTier]   = useState(null);
  const [expandedId,   setExpandedId]   = useState(null);
  const [selectedTiers, setSelectedTiers] = useState({});
  const [dailyLeft,    setDailyLeft]    = useState(null);
  const [archerStats,  setArcherStats]  = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [doneMsg,      setDoneMsg]      = useState("");

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    let baseStats = null;

    async function load() {
      try {
        const [cr, cert, dcfg] = await Promise.all([
          getCertRecords(profile.id),
          getCertification(profile.id),
          getDexConfig(),
        ]);
        if (cancelled) return;
        const ds = computeDexStats({ member: profile, certification: cert, certRecords: cr, checkinCount: profile?.dailyQuestCount || 0, granted: [], physicalMax: dcfg.physicalMax || 20, pointMax: dcfg.pointMax || 20 });
        baseStats = calcArcherStats({ member: profile, certification: cert, certRecords: cr, dexStats: ds });
        setArcherStats(baseStats);
      } catch { baseStats = { hp: 200, atk: 20, def: 15 }; setArcherStats(baseStats); }
      finally { if (!cancelled) setLoadingStats(false); }
    }
    load();
    checkCouncilDailyLimit(profile.id)
      .then(n => { if (!cancelled) setDailyLeft(n); })
      .catch(() => setDailyLeft(5));

    // 卡片加成 + 射手等級加成
    const unsub = subscribeCardCollection(profile.id, (cardData) => {
      if (cancelled) return;
      const equipped   = cardData?.equipped || [];
      const cardBonus  = calcEquippedBonus(equipped);
      const archerXP   = profile?.archerXP || 0;
      const archerLv   = archerLevelFromXP(archerXP);
      const lvBonus    = archerLevelBonus(archerLv);
      if (!baseStats) return;
      setArcherStats({
        ...baseStats,
        hp:  baseStats.hp  + (cardBonus.hp  || 0) + (lvBonus.hp  || 0),
        atk: baseStats.atk + (cardBonus.atk || 0) + (lvBonus.atk || 0),
        def: baseStats.def + (cardBonus.def || 0) + (lvBonus.def || 0),
      });
    });

    return () => { cancelled = true; unsub?.(); };
  }, [profile?.id]); // eslint-disable-line

  function handleEnter(bld, tier) {
    if (dailyLeft <= 0 || !archerStats || saving) return;
    setExpandedId(null);
    setActiveTier(tier);
    setActiveBld(bld);
  }

  async function handleContractStart() {
    if (dailyLeft <= 0 || saving) return false;
    setSaving(true);
    try {
      await recordCouncilSession(profile.id);
      setDailyLeft(left => Math.max(0, (left ?? 1) - 1));
      return true;
    } catch (error) {
      setDoneMsg(`無法開始委託：${error.message || "請稍後再試"}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish(result) {
    setActiveBld(null);
    if (!result || (!result.clearedTier && !result.failedTier)) return;
    setSaving(true);
    try {
      await completeCouncilSession(profile.id, result);
      const msg = result.clearedTier
        ? `✓ 完成 ${result.checkpointsCleared || 1}/3 階段（×${result.rewardMultiplier || 1}），獎勵已存入背包`
        : `✓ 撤退補償　獎勵已存入背包`;
      setDoneMsg(msg);
      setTimeout(() => setDoneMsg(""), 4000);
    } catch (e) { console.warn(e.message); }
    setSaving(false);
  }

  const powerTiers = archerStats
    ? getAvailableTiersByPower(calcArcherPower(archerStats))
    : [];

  // ── 進入戰鬥 ─────────────────────────────────────────────
  if (activeBld && archerStats) {
    const power      = calcArcherPower(archerStats);
    const availTiers = getAvailableTiersByPower(power);
    return (
      <CouncilBattle
        building={activeBld}
        availableTiers={availTiers}
        selectedTier={activeTier || availTiers[availTiers.length - 1]}
        archerStats={archerStats}
        village={village}
        memberId={profile.id}
        catId={profile?.equippedCat?.catId || null}
        checkinActive={checkinActive}
        onStart={handleContractStart}
        onFinish={handleFinish}
        onBack={() => { setActiveBld(null); setActiveTier(null); }}
      />
    );
  }

  const buildings = village?.buildings || {};

  return (
    <div style={{ minHeight:"100%", background:"linear-gradient(160deg,#1c1008,#2d1a0a,#1a1208)", padding:"12px 12px 100px", color:"white" }}>
      <style>{CSS}</style>

      {/* 標頭 */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <button onClick={onBack} aria-label="返回貓貓村"
          style={{ background:"none", border:"none", fontSize:24, cursor:"pointer", color:"#fbbf24", minWidth:44, minHeight:44 }}>←</button>
        <div>
          <div style={{ fontWeight:900, fontSize:17, color:"#fbbf24" }}>🏛️ 議會廳</div>
          <div style={{ fontSize:12, color:"#d6a46b" }}>採集委託 · 遠征派遣 · 獲取貓毛與藥水</div>
        </div>
      </div>

      {/* 分頁切換 */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {[["collect","⚔️ 採集任務"],["expedition","🚀 遠征隊"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              flex:1, padding:"9px 0", borderRadius:12, fontWeight:800, fontSize:13,
              border:"none", cursor:"pointer", transition:"background-color 0.15s, color 0.15s",
              background: tab === key ? "linear-gradient(90deg,#d97706,#f59e0b)" : "rgba(255,255,255,0.06)",
              color: tab === key ? "#1c1008" : "rgba(255,255,255,0.45)",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* 遠征隊 tab */}
      {tab === "expedition" && (
        <ExpeditionPanel profile={profile} />
      )}
      {tab !== "expedition" && (<>

      {/* 提示訊息 */}
      {doneMsg && (
        <div aria-live="polite" style={{ background: doneMsg.startsWith("✓") ? "#14532d" : "#7f1d1d", borderRadius:10, padding:"10px 14px", marginBottom:12, fontWeight:800, fontSize:13, animation:"ch-fade 0.3s ease" }}>
          {doneMsg}
        </div>
      )}

      {/* 射手狀態列 */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, background:"rgba(245,158,11,0.07)", borderRadius:14, padding:"10px 14px", border:"1px solid rgba(245,158,11,0.15)" }}>
        {loadingStats
          ? <div style={{ color:"#78350f", fontSize:13 }}>載入射手數值…</div>
          : archerStats && (
            <>
              <div style={{ display:"flex", gap:14, fontSize:12 }}>
                <span style={{ color:"#4ade80" }}>❤️ <b>{archerStats.hp}</b></span>
                <span style={{ color:"#f87171" }}>⚔️ <b>{archerStats.atk}</b></span>
                <span style={{ color:"#60a5fa" }}>🛡️ <b>{archerStats.def}</b></span>
              </div>
              <div style={{ flex:1 }} />
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:11, color:"#d6a46b" }}>今日剩餘</div>
                <div style={{ fontWeight:900, fontSize:20, color: dailyLeft > 0 ? "#fbbf24" : "#ef4444", lineHeight:1 }}>
                  {dailyLeft ?? "…"}<span style={{ fontSize:12, color:"#d6a46b" }}>/5</span>
                </div>
              </div>
            </>
          )
        }
      </div>

      {/* 怎麼玩 */}
      <div style={{ background:"rgba(245,158,11,0.08)", borderRadius:12, padding:"11px 13px", marginBottom:16, fontSize:12, color:"#e7c38d", lineHeight:1.75, border:"1px solid rgba(245,158,11,0.18)" }}>
        <b style={{ color:"#fbbf24" }}>委託流程：</b>選擇建築與難度，完成 3 個工作階段。每階段後可安全收工，或繼續提高獎勵倍率。按下正式開始才會使用今日次數。
      </div>

      {/* 建築卡片網格 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {COUNCIL_BUILDINGS.map(bld => {
          const bldLevel   = buildings[bld.id] || 1;
          const availTiers = powerTiers.length > 0 ? powerTiers : getAvailableTiers(bldLevel);
          const selectedTier = selectedTiers[bld.id] || availTiers[availTiers.length - 1];
          const isLocked   = !buildings[bld.id];
          const isExpanded = expandedId === bld.id;
          const canEnter   = !isLocked && dailyLeft > 0 && archerStats && !saving;

          return (
            <div key={bld.id} style={{
              gridColumn: isExpanded ? "1 / -1" : "auto",
              borderRadius:18,
              background: isLocked ? "rgba(255,255,255,0.03)" : BLD_GRADIENT[bld.id],
              border:`1.5px solid ${isExpanded ? "rgba(245,158,11,0.5)" : isLocked ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)"}`,
              opacity: isLocked ? 0.5 : 1,
              overflow:"hidden",
              animation:"ch-pop 0.2s ease",
            }}>
              {/* 建築主卡 */}
              <button
                onClick={() => !isLocked && setExpandedId(isExpanded ? null : bld.id)}
                style={{ width:"100%", background:"none", border:"none", cursor: isLocked ? "default" : "pointer", padding:"14px 12px", textAlign:"left" }}
              >
                <div style={{ fontSize:36, marginBottom:6 }}>{bld.emoji}</div>
                <div style={{ fontWeight:900, fontSize:14, color:"white", marginBottom:2 }}>
                  {bld.name}
                  {isLocked && <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginLeft:5 }}>未解鎖</span>}
                </div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginBottom:8 }}>
                  {bld.raceLabel} · Lv.{bldLevel}
                </div>
                {/* Tier emoji 點 */}
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {availTiers.map(t => {
                    const m  = COUNCIL_MONSTERS[bld.id][t];
                    const tm = TIER_META[t];
                    return (
                      <div key={t} title={m.name} style={{
                        width:26, height:26, borderRadius:"50%",
                        background: tm.color + "30",
                        border:`1.5px solid ${tm.color}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:13,
                      }}>{m.emoji}</div>
                    );
                  })}
                </div>
                {!isLocked && (
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:6, textAlign:"right" }}>
                    {isExpanded ? "▲ 收合" : "▼ 查看任務"}
                  </div>
                )}
              </button>

              {/* 展開：障礙清單 */}
              {isExpanded && (
                <div style={{ padding:"0 12px 14px", animation:"ch-fade 0.25s ease" }}>
                  <div style={{ height:1, background:"rgba(255,255,255,0.1)", marginBottom:10 }} />
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", marginBottom:8 }}>
                    選擇本次委託難度
                  </div>

                  <div style={{ display:"flex", gap:7, overflowX:"auto", paddingBottom:8, marginBottom:8 }}>
                    {availTiers.map(t => {
                      const tm = TIER_META[t];
                      const selected = selectedTier === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTiers(previous => ({ ...previous, [bld.id]: t }))}
                          aria-pressed={selected}
                          style={{
                            flexShrink:0, minHeight:42, padding:"8px 12px", borderRadius:12,
                            border:`1.5px solid ${tm.color}`,
                            background:selected ? tm.color : "rgba(255,255,255,0.06)",
                            color:selected ? "white" : tm.color,
                            fontWeight:900, fontSize:12, cursor:"pointer",
                          }}
                        >
                          {tm.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginBottom:8 }}>
                    3 個工作階段，可在每階段完成後安全收工
                  </div>

                  {selectedTier && (() => {
                    const m = COUNCIL_MONSTERS[bld.id][selectedTier];
                    const tm = TIER_META[selectedTier];
                    const st = LIFE_TIER_STATS[selectedTier];
                    return (
                      <div style={{
                        borderRadius:14, padding:"12px", marginBottom:12,
                        background:m.bgColor, border:`1.5px solid ${tm.color}55`,
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontSize:30 }}>{m.emoji}</span>
                          <div style={{ minWidth:0, flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:900, color:"#1c1008" }}>{m.name}</div>
                            <div style={{ fontSize:11, color:"#78350f" }}>{m.action}</div>
                          </div>
                          <div style={{ fontSize:10, color:"#92400e", textAlign:"right" }}>
                            <div>進度 {st.hp}</div><div>疲勞 {st.atk}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 全通關獎勵提示 */}
                  <div style={{ background:"rgba(245,158,11,0.12)", borderRadius:10, padding:"7px 10px", marginBottom:10, fontSize:11, color:"#fbbf24" }}>
                    🏆 完成越多階段，獎勵倍率越高：×1.0 → ×1.35 → ×1.8
                  </div>

                  <button
                    onClick={() => canEnter && handleEnter(bld, selectedTier)}
                    disabled={!canEnter}
                    style={{
                      width:"100%", padding:"12px 0", borderRadius:14, fontWeight:900, fontSize:15, cursor: canEnter ? "pointer" : "default", border:"none",
                      background: canEnter ? "linear-gradient(90deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.1)",
                      color: canEnter ? "#1c1008" : "rgba(255,255,255,0.3)",
                    }}>
                    {dailyLeft <= 0 ? "❌ 今日次數已用盡" : saving ? "準備中…" : `查看${TIER_META[selectedTier]?.label || ""}委託`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </>)}
    </div>
  );
}
