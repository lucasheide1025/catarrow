// src/components/member/CouncilHall.jsx — 議會廳入口
import { useState, useEffect } from "react";
import {
  COUNCIL_BUILDINGS, COUNCIL_MONSTERS, TIER_META, LIFE_TIER_STATS, getAvailableTiers,
} from "../../lib/councilMonsters";
import {
  checkCouncilDailyLimit, recordCouncilSession, completeCouncilSession,
} from "../../lib/db";
import { calcArcherStats } from "../../lib/monsterData";
import { computeDexStats } from "../../lib/achievementDex";
import { getCertRecords, getCertification, getDexConfig } from "../../lib/db";
import CouncilBattle from "./CouncilBattle";

export default function CouncilHall({ profile, village, onBack }) {
  const [activeBld,    setActiveBld]    = useState(null);
  const [dailyLeft,    setDailyLeft]    = useState(null);
  const [archerStats,  setArcherStats]  = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [doneMsg,      setDoneMsg]      = useState("");

  // 載入玩家數值（與 MonsterBattle 相同邏輯）
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
      } catch (e) {
        setArcherStats({ hp: 200, atk: 20, def: 15 });
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }

    load();
    checkCouncilDailyLimit(profile.id).then(n => { if (!cancelled) setDailyLeft(n); }).catch(() => setDailyLeft(5));

    return () => { cancelled = true; };
  }, [profile?.id]); // eslint-disable-line

  async function handleSelectBuilding(bld) {
    if (dailyLeft <= 0) { setDoneMsg("❌ 今日次數已用盡（5/5）"); return; }
    await recordCouncilSession(profile.id).catch(() => {});
    setDailyLeft(l => Math.max(0, (l ?? 1) - 1));
    setActiveBld(bld);
  }

  async function handleFinish(result) {
    setActiveBld(null);
    if (!result || (!result.raceMaterials?.length && !result.isFullClear)) return;
    setSaving(true);
    try {
      await completeCouncilSession(profile.id, result);
      const mats = result.raceMaterials?.length || 0;
      let msg = `✓ 獲得 ${mats} 個種族素材`;
      if (result.isFullClear) msg += `　🏡 村莊材料 ×3　🪙 扭蛋幣 ×5`;
      setDoneMsg(msg);
      setTimeout(() => setDoneMsg(""), 4000);
    } catch (e) { console.warn("completeCouncilSession:", e.message); }
    setSaving(false);
  }

  if (activeBld && archerStats) {
    const bldLevel    = village?.buildings?.[activeBld.id] || 1;
    const availTiers  = getAvailableTiers(bldLevel);
    return (
      <CouncilBattle
        building={activeBld}
        availableTiers={availTiers}
        archerStats={archerStats}
        village={village}
        onFinish={handleFinish}
        onBack={() => { setActiveBld(null); setDailyLeft(l => Math.min(5, (l ?? 0) + 1)); }}
      />
    );
  }

  const buildings = village?.buildings || {};

  return (
    <div style={{ minHeight: "100%", background: "linear-gradient(160deg,#0f172a,#1e1b4b)", padding: "12px 12px 80px", color: "white" }}>
      {/* 標頭 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>←</button>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17 }}>🏛️ 議會廳</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>採集副本 · 射箭驅退障礙 · 獲得種族素材</div>
        </div>
      </div>

      {/* 提示訊息 */}
      {doneMsg && (
        <div style={{ background: doneMsg.startsWith("✓") ? "#14532d" : "#7f1d1d", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontWeight: 800, fontSize: 13 }}>
          {doneMsg}
        </div>
      )}

      {/* 玩家數值 */}
      {loadingStats
        ? <div style={{ color: "#475569", fontSize: 13, marginBottom: 12 }}>載入射手數值…</div>
        : archerStats && (
          <div style={{ display: "flex", gap: 12, marginBottom: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: "#64748b" }}>HP</div><div style={{ fontWeight: 900, color: "#4ade80" }}>{archerStats.hp}</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: "#64748b" }}>ATK</div><div style={{ fontWeight: 900, color: "#f87171" }}>{archerStats.atk}</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: "#64748b" }}>DEF</div><div style={{ fontWeight: 900, color: "#60a5fa" }}>{archerStats.def}</div></div>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>今日剩餘</div>
              <div style={{ fontWeight: 900, color: dailyLeft > 0 ? "#fbbf24" : "#ef4444", fontSize: 18 }}>
                {dailyLeft ?? "…"} / 5
              </div>
            </div>
          </div>
        )
      }

      {/* 說明 */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#64748b", lineHeight: 1.8, border: "1px solid rgba(255,255,255,0.06)" }}>
        <b style={{ color: "#94a3b8" }}>怎麼玩？</b><br/>
        每棟建築有障礙生物，等級越高出現越多隻（最多6隻）。<br/>
        輸入射箭分數驅退它們，獲得對應種族素材。<br/>
        全部通關 → 村莊材料 ×3 + 扭蛋幣 ×5
      </div>

      {/* 建築卡 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {COUNCIL_BUILDINGS.map(bld => {
          const bldLevel    = buildings[bld.id] || 1;
          const availTiers  = getAvailableTiers(bldLevel);
          const isLocked    = !buildings[bld.id]; // 未解鎖建築
          const canEnter    = !isLocked && dailyLeft > 0 && archerStats && !saving;

          return (
            <button key={bld.id}
              onClick={() => canEnter && handleSelectBuilding(bld)}
              disabled={!canEnter}
              style={{
                background: isLocked ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
                borderRadius: 14, padding: "14px 16px",
                border: `1px solid ${isLocked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)"}`,
                cursor: canEnter ? "pointer" : "default",
                textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                opacity: isLocked || dailyLeft <= 0 ? 0.45 : 1,
              }}>
              <span style={{ fontSize: 34, lineHeight: 1 }}>{bld.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 14, color: "white", marginBottom: 2 }}>
                  {bld.name}
                  {isLocked && <span style={{ fontSize: 11, color: "#475569", marginLeft: 6 }}>（未解鎖）</span>}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                  {bld.raceLabel} · Lv.{bldLevel} · {availTiers.length} 隻障礙
                </div>
                {/* tier 點 */}
                <div style={{ display: "flex", gap: 4 }}>
                  {availTiers.map(t => {
                    const tm = TIER_META[t];
                    const m  = COUNCIL_MONSTERS[bld.id][t];
                    return (
                      <div key={t} title={m.name} style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: tm.color + "33",
                        border: `1.5px solid ${tm.color}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11,
                      }}>
                        {m.emoji}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ fontSize: 20, color: "#334155" }}>›</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
