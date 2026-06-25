// src/components/member/CouncilHall.jsx — 議會廳入口（冒險者公會卡片風格）
import { useState, useEffect } from "react";
import {
  COUNCIL_BUILDINGS, COUNCIL_MONSTERS, TIER_META, LIFE_TIER_STATS, getAvailableTiersByPower,
} from "../../lib/councilMonsters";
import { calcArcherPower } from "../../lib/monsterData";
import {
  checkCouncilDailyLimit, recordCouncilSession, completeCouncilSession,
  getCertRecords, getCertification, getDexConfig,
} from "../../lib/db";
import { useCheckinActive } from "../../hooks/useCheckinActive";
import { calcArcherStats } from "../../lib/monsterData";
import { computeDexStats } from "../../lib/achievementDex";
import CouncilBattle from "./CouncilBattle";

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
  const [activeBld,    setActiveBld]    = useState(null);
  const [expandedId,   setExpandedId]   = useState(null);
  const [dailyLeft,    setDailyLeft]    = useState(null);
  const [archerStats,  setArcherStats]  = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [doneMsg,      setDoneMsg]      = useState("");

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    async function load() {
      try {
        const [cr, cert, dcfg] = await Promise.all([
          getCertRecords(profile.id),
          getCertification(profile.id),
          getDexConfig(),
        ]);
        if (cancelled) return;
        const ds    = computeDexStats({ member: profile, certification: cert, certRecords: cr, checkinCount: profile?.dailyQuestCount || 0, granted: [], physicalMax: dcfg.physicalMax || 20, pointMax: dcfg.pointMax || 20 });
        const stats = calcArcherStats({ member: profile, certification: cert, certRecords: cr, dexStats: ds });
        setArcherStats(stats);
      } catch { setArcherStats({ hp: 200, atk: 20, def: 15 }); }
      finally { if (!cancelled) setLoadingStats(false); }
    }
    load();
    checkCouncilDailyLimit(profile.id)
      .then(n => { if (!cancelled) setDailyLeft(n); })
      .catch(() => setDailyLeft(5));
    return () => { cancelled = true; };
  }, [profile?.id]); // eslint-disable-line

  async function handleEnter(bld) {
    if (dailyLeft <= 0 || !archerStats || saving) return;
    await recordCouncilSession(profile.id).catch(() => {});
    setDailyLeft(l => Math.max(0, (l ?? 1) - 1));
    setExpandedId(null);
    setActiveBld(bld);
  }

  async function handleFinish(result) {
    setActiveBld(null);
    if (!result || (!result.clearedTier && !result.failedTier)) return;
    setSaving(true);
    try {
      await completeCouncilSession(profile.id, result);
      const msg = result.clearedTier
        ? `✓ ${TIER_META[result.clearedTier].label}關通關　獎勵已存入背包`
        : `✓ 撤退補償　獎勵已存入背包`;
      setDoneMsg(msg);
      setTimeout(() => setDoneMsg(""), 4000);
    } catch (e) { console.warn(e.message); }
    setSaving(false);
  }

  // ── 進入戰鬥 ─────────────────────────────────────────────
  if (activeBld && archerStats) {
    const power      = calcArcherPower(archerStats);
    const availTiers = getAvailableTiersByPower(power);
    return (
      <CouncilBattle
        building={activeBld}
        availableTiers={availTiers}
        archerStats={archerStats}
        village={village}
        memberId={profile.id}
        catId={profile?.equippedCat?.catId || null}
        checkinActive={checkinActive}
        onFinish={handleFinish}
        onBack={() => { setActiveBld(null); setDailyLeft(l => Math.min(5, (l ?? 0) + 1)); }}
      />
    );
  }

  const buildings = village?.buildings || {};

  return (
    <div style={{ minHeight:"100%", background:"linear-gradient(160deg,#1c1008,#2d1a0a,#1a1208)", padding:"12px 12px 100px", color:"white" }}>
      <style>{CSS}</style>

      {/* 標頭 */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#92400e" }}>←</button>
        <div>
          <div style={{ fontWeight:900, fontSize:17, color:"#fbbf24" }}>🏛️ 議會廳</div>
          <div style={{ fontSize:11, color:"#78350f" }}>採集任務 · 射箭解決障礙 · 獲得種族素材</div>
        </div>
      </div>

      {/* 提示訊息 */}
      {doneMsg && (
        <div style={{ background: doneMsg.startsWith("✓") ? "#14532d" : "#7f1d1d", borderRadius:10, padding:"10px 14px", marginBottom:12, fontWeight:800, fontSize:13, animation:"ch-fade 0.3s ease" }}>
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
                <div style={{ fontSize:10, color:"#78350f" }}>今日剩餘</div>
                <div style={{ fontWeight:900, fontSize:20, color: dailyLeft > 0 ? "#fbbf24" : "#ef4444", lineHeight:1 }}>
                  {dailyLeft ?? "…"}<span style={{ fontSize:12, color:"#92400e" }}>/5</span>
                </div>
              </div>
            </>
          )
        }
      </div>

      {/* 怎麼玩 */}
      <div style={{ background:"rgba(245,158,11,0.05)", borderRadius:12, padding:"9px 13px", marginBottom:16, fontSize:11, color:"#92400e", lineHeight:1.9, border:"1px solid rgba(245,158,11,0.1)" }}>
        <b style={{ color:"#b45309" }}>怎麼玩？</b>　點擊建築查看任務清單，射箭解決障礙。每關勝利 → T1素材＋種族/金幣寶箱　失敗撤退 → 少量素材＋扭蛋幣機率　·　每日 5 次
      </div>

      {/* 建築卡片網格 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {COUNCIL_BUILDINGS.map(bld => {
          const bldLevel   = buildings[bld.id] || 1;
          const availTiers = getAvailableTiers(bldLevel);
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
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginBottom:8 }}>本次任務清單（共 {availTiers.length} 個障礙）</div>

                  {/* 障礙小卡 2欄 */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, marginBottom:12 }}>
                    {availTiers.map(t => {
                      const m  = COUNCIL_MONSTERS[bld.id][t];
                      const tm = TIER_META[t];
                      const st = LIFE_TIER_STATS[t];
                      return (
                        <div key={t} style={{
                          borderRadius:12, padding:"10px 10px",
                          background: m.bgColor,
                          border:`1.5px solid ${tm.color}44`,
                        }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                            <span style={{ fontSize:22 }}>{m.emoji}</span>
                            <div>
                              <div style={{ fontSize:9, fontWeight:800, color:tm.color }}>{tm.label}</div>
                              <div style={{ fontSize:12, fontWeight:900, color:"#1c1008" }}>{m.name}</div>
                            </div>
                          </div>
                          <div style={{ fontSize:10, color:"#78350f", marginBottom:4 }}>{m.action}</div>
                          <div style={{ fontSize:9, color:"#92400e", display:"flex", gap:6 }}>
                            <span>❤️{st.hp}</span>
                            <span>⚔️{st.atk}</span>
                            <span>🛡️{st.def}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 全通關獎勵提示 */}
                  <div style={{ background:"rgba(245,158,11,0.12)", borderRadius:10, padding:"7px 10px", marginBottom:10, fontSize:11, color:"#fbbf24" }}>
                    🏆 每關勝利都有獎勵：T1素材＋種族寶箱＋金幣寶箱
                  </div>

                  <button
                    onClick={() => canEnter && handleEnter(bld)}
                    disabled={!canEnter}
                    style={{
                      width:"100%", padding:"12px 0", borderRadius:14, fontWeight:900, fontSize:15, cursor: canEnter ? "pointer" : "default", border:"none",
                      background: canEnter ? "linear-gradient(90deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.1)",
                      color: canEnter ? "#1c1008" : "rgba(255,255,255,0.3)",
                    }}>
                    {dailyLeft <= 0 ? "❌ 今日次數已用盡" : saving ? "存檔中…" : "🌟 開始採集任務"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
