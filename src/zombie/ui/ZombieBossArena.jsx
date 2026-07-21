// src/zombie/ui/ZombieBossArena.jsx
// ═══════════════════════════════════════════════════════════════
//  👑 殭屍生存 — BOSS 戰鬥（圖形化版）
//  血條取代文字、身體圖示命中區、視覺事件回饋
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  createBossEncounter, processBossRound, resolveBossHit,
  getBossPhase, getBossStatus,
  BOSS_EVENT, BOSS_PHASE, BOSS_PHASE_COLORS, BOSS_PHASE_LABELS,
} from "../domain/bossEngine";
import { getBOSSArchetype } from "../data/zombieArchetypes";
import { calculateBossReward } from "../data/bossRewards";
import { COLORS, ANIM, RADIUS } from "./theme";
import { playZombieSound, initZombieAudio } from "../domain/zombieSound";
import { ANIM_DURATION } from "../style/zombieAnimations";

const EVENT_STYLE = {
  [BOSS_EVENT.PHASE_CHANGE]:      { icon: "⚡", color: COLORS.purple },
  [BOSS_EVENT.ARMOR_HIT]:         { icon: "🔨", color: COLORS.purple },
  [BOSS_EVENT.HEART_CORE_HIT]:    { icon: "💔", color: COLORS.red },
  [BOSS_EVENT.SWEEP_ATTACK]:      { icon: "🌀", color: COLORS.red },
  [BOSS_EVENT.CORPSE_PROJECTILE]: { icon: "💩", color: COLORS.amber },
  [BOSS_EVENT.ARMOR_REPAIR]:      { icon: "🔧", color: COLORS.blue },
  [BOSS_EVENT.WEAKPOINT_EXPOSED]: { icon: "🎯", color: COLORS.amber },
  [BOSS_EVENT.BOSS_DEFEATED]:     { icon: "🏆", color: COLORS.green },
};

const HIT_PARTS = [
  { id: "head",  icon: "🎯", label: "頭部弱點", color: COLORS.amber, desc: "致命一擊" },
  { id: "chest", icon: "🛡️", label: "裝甲胸腔", color: COLORS.purple, desc: "破甲攻擊" },
  { id: "belly", icon: "⚡", label: "腹部", color: COLORS.textDim, desc: "穩定傷害" },
  { id: "arm",   icon: "🦾", label: "手臂", color: COLORS.green, desc: "降低抓取" },
  { id: "groin", icon: "🎲", label: "鼠蹊", color: COLORS.blue, desc: "減速效果" },
];

export default function ZombieBossArena() {
  const [encounter, setEncounter] = useState(null);
  const [log, setLog] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [rewards, setRewards] = useState(null);
  const [flashPart, setFlashPart] = useState(null);
  const [prevBossPhase, setPrevBossPhase] = useState(null);

  useEffect(() => { initZombieAudio(); }, []);

  const bossStatus = useMemo(() => {
    if (!encounter) return null;
    return getBossStatus(Object.values(encounter.zombies)[0]);
  }, [encounter]);
  const bossDef = useMemo(() => {
    if (!encounter?.bossId) return null;
    return getBOSSArchetype(encounter.bossId);
  }, [encounter]);

  useEffect(() => {
    if (!bossStatus?.phase || prevBossPhase === bossStatus.phase) return;
    if (prevBossPhase) playZombieSound("combat:crit");
    setPrevBossPhase(bossStatus.phase);
  }, [bossStatus?.phase, prevBossPhase]);

  const handleStart = useCallback(() => {
    const state = createBossEncounter("giant_zombie_king", ["p1", "p2", "p3"], { startDistance: 14 });
    if (!state) return;
    setEncounter(state); setPhase("fighting"); setRewards(null);
    setPrevBossPhase(BOSS_PHASE.ARMORED);
    playZombieSound("combat:zombie_roar");
    playZombieSound("lobby:start_mission");
    setLog([{ type: "system", text: "👑 巨型殭屍王出現！", time: Date.now() }]);
  }, []);

  const handleSimulateHit = useCallback((part) => {
    if (!encounter) return;
    const bossState = Object.values(encounter.zombies)[0];
    if (!bossState?.alive) return;
    setFlashPart(part);
    setTimeout(() => setFlashPart(null), 300);

    const newBoss = { ...bossState, body: { ...bossState.body } };
    newBoss.body[part] = (newBoss.body[part] || 0) + 1;
    const currentPhase = getBossPhase(newBoss);
    const hitResult = resolveBossHit(newBoss, part, newBoss.body[part], currentPhase);

    playZombieSound(hitResult.killed ? "result:victory" : "combat:hit");
    if (hitResult.killed) setTimeout(() => playZombieSound("result:victory"), 200);

    setEncounter({ ...encounter, zombies: { ...encounter.zombies, [encounter.bossId]: newBoss } });
    const now = Date.now();
    const newLog = [...log, { type: "hit", text: `🏹 ${part}命中 [${BOSS_PHASE_LABELS[currentPhase]}]`, time: now }];
    hitResult.additionalEvents.forEach(evt => newLog.push({ type: evt.type, text: formatEvt(evt), time: now }));
    if (hitResult.killed) {
      setPhase("victory");
      const reward = calculateBossReward(encounter.bossId);
      setRewards(reward);
      newLog.push({ type: "reward", text: `🏆 擊敗！${reward.items.length}件物品+${reward.coins}金幣`, time: now });
    }
    setLog(newLog);
  }, [encounter, log]);

  const handleBossRound = useCallback(() => {
    if (!encounter) return;
    const bossState = Object.values(encounter.zombies)[0];
    if (!bossState?.alive) return;
    playZombieSound("combat:round_end");
    const members = Object.keys(encounter.survivors).filter(id => encounter.survivors[id].alive);
    const result = processBossRound(bossState, members);
    setEncounter({ ...encounter, zombies: { ...encounter.zombies, [encounter.bossId]: result.nextBoss }, round: (encounter.round || 0) + 1 });
    const now = Date.now();
    const newLog = [...log, { type: "round", text: `⏹️ R${(encounter.round || 0) + 1} — ${result.nextBoss.distanceM.toFixed(1)}m`, time: now }];
    result.events.forEach(evt => newLog.push({ type: evt.type, text: formatEvt(evt), time: now }));
    setLog(newLog);
  }, [encounter, log]);

  const handleReset = useCallback(() => {
    setEncounter(null); setPhase("idle"); setLog([]); setRewards(null);
    playZombieSound("lobby:player_leave");
  }, []);

  const empty = phase === "idle";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* 標題列 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, animation: `za-fade-in ${ANIM_DURATION.entrance}`,
      }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: COLORS.text, letterSpacing: 1 }}>👑 BOSS</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {empty && <button onClick={handleStart} style={S(btn("primary"))}>👑 召喚</button>}
          {!empty && <button onClick={handleBossRound} style={S(btn())}>⏹️ 回合</button>}
          {!empty && <button onClick={handleReset} style={S(btn())}>🔄</button>}
        </div>
      </div>

      {empty ? (
        /* 空狀態 */
        <div style={CARD}>
          <div style={{ fontSize: 56, textAlign: "center", opacity: 0.3, animation: `za-float ${ANIM_DURATION.float} infinite` }}>👑</div>
          <p style={{ textAlign: "center", color: COLORS.textDim, fontSize: 12, marginTop: 8 }}>按下召喚開始 BOSS 戰</p>
        </div>
      ) : encounter && bossStatus && bossDef && (
        <>
          {/* BOSS 面板 */}
          <div style={{
            ...CARD, borderLeft: `4px solid ${BOSS_PHASE_COLORS[bossStatus.phase]}`,
            animation: `za-scale-in ${ANIM_DURATION.slow}`,
          }}>
            {/* 頭部：名稱 + 階段徽章 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 28, filter: bossStatus.alive ? "none" : "grayscale(1)",
                  animation: bossStatus.alive ? `za-glow-pulse ${ANIM_DURATION.float} infinite` : undefined,
                }}>👑</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: COLORS.text }}>{bossDef.name}</div>
                  <div style={{ fontSize: 9, color: COLORS.textDim }}>{bossDef.desc?.slice(0, 30)}</div>
                </div>
              </div>
              <span style={{
                padding: "3px 10px", borderRadius: RADIUS.sm,
                background: `${BOSS_PHASE_COLORS[bossStatus.phase]}22`,
                color: BOSS_PHASE_COLORS[bossStatus.phase],
                border: `1px solid ${BOSS_PHASE_COLORS[bossStatus.phase]}44`,
                fontSize: 10, fontWeight: 700,
                animation: `za-glow-pulse 2s infinite`,
              }}>{BOSS_PHASE_LABELS[bossStatus.phase]}</span>
            </div>

            {/* 圖形化狀態條 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
              <StatusBar icon="📏" label="距離" val={bossStatus.distanceM} max={14} unit="m"
                color={bossStatus.distanceM <= 4 ? COLORS.red : bossStatus.distanceM <= 8 ? COLORS.amber : COLORS.green} />
              <StatusBar icon="🔨" label="裝甲" val={bossStatus.armorDamage} max={12}
                color={COLORS.purple} />
              <StatusBar icon="💔" label="心臟" val={bossStatus.heartCoreHits} max={3}
                color={COLORS.red} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: COLORS.textMuted }}>
                <span>🔄 階段回合 R{bossStatus.phaseRound}</span>
                {bossStatus.armorRepairs > 0 && <span>🔧 修復 ×{bossStatus.armorRepairs}</span>}
              </div>
            </div>

            {/* 弱點提示 */}
            {bossStatus.alive && (
              <div style={{
                padding: "5px 10px", borderRadius: RADIUS.sm,
                background: `${COLORS.amber}10`, border: `1px solid ${COLORS.amber}22`,
                fontSize: 9, color: COLORS.amber, display: "flex", gap: 6, marginBottom: 10,
              }}>
                <span>🎯</span>
                {bossDef.visibleWeakPoints.map((wp, i) => <span key={i} style={{ animation: `za-fade-in ${ANIM_DURATION.entrance} ${i * 0.1}s both` }}>{wp}</span>)}
              </div>
            )}

            {/* 命中按鈕 — 圖形化 */}
            {phase === "fighting" && bossStatus.alive && (
              <div style={{ animation: `za-slide-in-up ${ANIM_DURATION.entrance} 0.2s both` }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: COLORS.textMuted, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>🎯 射擊部位</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                  {HIT_PARTS.map(p => {
                    const flashing = flashPart === p.id;
                    return (
                      <button key={p.id} onClick={() => handleSimulateHit(p.id)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                          padding: "8px 4px", borderRadius: RADIUS.md,
                          background: flashing ? `${p.color}22` : COLORS.glass,
                          border: `1px solid ${flashing ? p.color : COLORS.glassBorder}`,
                          color: p.color, cursor: "pointer",
                          transform: flashing ? "scale(0.93)" : "scale(1)",
                          transition: `all ${ANIM.fast}`,
                        }}>
                        <span style={{ fontSize: 18 }}>{p.icon}</span>
                        <span style={{ fontSize: 8, fontWeight: 600 }}>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 擊敗標記 */}
            {!bossStatus.alive && (
              <div style={{ textAlign: "center", padding: 8, animation: `za-scale-in ${ANIM_DURATION.slow} 0.3s both` }}>
                <span style={{ fontSize: 28, display: "block", animation: `za-victory-glow 1.5s infinite` }}>🏆</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.green }}>BOSS 擊敗！</span>
              </div>
            )}
          </div>

          {/* 獎勵 */}
          {rewards && (
            <div style={{ ...CARD, animation: `za-scale-in ${ANIM_DURATION.slow} 0.5s both`, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.green, marginBottom: 8 }}>🏆 獎勵 +{rewards.coins}💰</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {rewards.items.map((item, i) => (
                  <span key={item.id} style={{
                    padding: "4px 8px", borderRadius: RADIUS.sm,
                    background: `${item.color}12`, border: `1px solid ${item.color}33`,
                    fontSize: 9, fontWeight: 600, color: item.color,
                    animation: `za-slide-in-up ${ANIM_DURATION.fast} ${0.5 + i * 0.08}s both`,
                  }}>{item.icon} {item.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* 事件日誌 */}
          <div style={{ ...CARD, maxHeight: 160, overflowY: "auto", fontSize: 9, lineHeight: 1.8 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: COLORS.textMuted, marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" }}>📜 戰報</div>
            {log.slice(-30).reverse().map((e, i) => (
              <div key={i} style={{ animation: `za-slide-in-left ${ANIM_DURATION.fast} ${i * 0.01}s both`, color: COLORS.textDim }}>
                {e.text}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── 圖形化狀態條元件 ──────────────────────────────────
function StatusBar({ icon, label, val, max, unit, color }) {
  const pct = Math.min((val / max) * 100, 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 9, width: 30, color: COLORS.textMuted }}>{icon} {label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 3,
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          boxShadow: `0 0 6px ${color}44`,
          transition: `width ${ANIM_DURATION.slow} ease-out`,
        }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color, minWidth: 30, textAlign: "right" }}>
        {val}{unit || ""}/{max}
      </span>
    </div>
  );
}

// ── 輔助 ─────────────────────────────────────────────────
function formatEvt(evt) {
  const d = EVENT_STYLE[evt.type];
  if (!d) return evt.type;
  const p = evt.payload || {};
  switch (evt.type) {
    case BOSS_EVENT.PHASE_CHANGE: return `${d.icon} ${p.from}→${p.to}`;
    case BOSS_EVENT.ARMOR_HIT: return `🔨 ${p.totalTorso}/${p.threshold}`;
    case BOSS_EVENT.HEART_CORE_HIT: return `💔 ${p.hits}/${p.threshold}`;
    case BOSS_EVENT.SWEEP_ATTACK: return `🌀 ${p.affected?.length || 0}人被掃 [${p.phase}]`;
    case BOSS_EVENT.CORPSE_PROJECTILE: return `💩→${p.targets?.join(",") || "?"}`;
    case BOSS_EVENT.ARMOR_REPAIR: return `🔧 +${p.repairAmount}(T${p.totalRepairs})`;
    case BOSS_EVENT.WEAKPOINT_EXPOSED: return `🎯 ${p.weakPoint || "?"}`;
    case BOSS_EVENT.BOSS_DEFEATED: return `🏆 R${p.round}`;
    default: return `${d.icon} ${d.label}`;
  }
}

function S(style) { return style; }
function btn(v) {
  const b = { padding: "5px 12px", borderRadius: RADIUS.md, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "none", transition: `all ${ANIM.fast}` };
  if (v === "primary") return { ...b, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" };
  return { ...b, background: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`, color: COLORS.text };
}
const CARD = {
  padding: "12px 14px", marginBottom: 8,
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: RADIUS.lg, backdropFilter: "blur(8px)",
};
