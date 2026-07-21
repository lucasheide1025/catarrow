// src/zombie/ui/ZombieResultScreen.jsx
// ═══════════════════════════════════════════════════════════════
//  🏆 殭屍生存 — 結算畫面（增強動畫版）
//  統計計數動畫、勝利/失敗特效、火花粒子
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useCallback } from "react";
import { COLORS, RADIUS, ANIM } from "./theme";
import { playZombieSound, initZombieAudio } from "../domain/zombieSound";
import { ANIM_CLASS, ANIM_DURATION } from "../style/zombieAnimations";

// ── 計數動畫 Hook ─────────────────────────────────────────
function useCountUp(target, duration = 1000) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }
    const startTime = performance.now();
    const startVal = 0;
    const diff = target - startVal;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(startVal + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
    return () => {};
  }, [target, duration]);

  return display;
}

// ── 火花粒子 ─────────────────────────────────────────────
function SparkleParticles({ color = COLORS.green, count = 20 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 2,
      duration: 1 + Math.random() * 2,
    }));
  }, [count]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: p.size,
          height: p.size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${p.size * 2}px ${color}`,
          opacity: 0,
          animation: `za-sparkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── 浮動骷髏（失敗畫面） ─────────────────────────────────
function FloatingSkulls({ count = 6 }) {
  const skulls = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: 10 + Math.random() * 80,
      delay: Math.random() * 3,
      size: 16 + Math.random() * 24,
    }));
  }, [count]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {skulls.map(s => (
        <div key={s.id} style={{
          position: "absolute",
          left: `${s.left}%`,
          bottom: "10%",
          fontSize: s.size,
          opacity: 0,
          animation: `za-skull-float ${3 + Math.random() * 2}s ease-out ${s.delay}s infinite`,
        }}>
          💀
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  🏆 結算畫面主元件
// ═════════════════════════════════════════════════════════════
export default function ZombieResultScreen({ result, gameState, party, onReturnToLobby }) {
  const isVictory = result?.type === "victory" || gameState?.phase === "victory";

  useEffect(() => {
    initZombieAudio();
    const timer = setTimeout(() => {
      playZombieSound(isVictory ? "result:victory" : "result:defeat");
    }, 500);
    return () => clearTimeout(timer);
  }, [isVictory]);

  const stats = useMemo(() => {
    if (!party?.members) return [];
    return party.members.map(m => ({
      name: m.name,
      slot: m.slot,
      alive: m.isAlive !== false,
      infected: m.isFullyInfected,
      kills: m.combatStats?.targetsKilled || 0,
      accuracy: m.combatStats?.accuracy || 0,
      shots: m.combatStats?.totalShots || 0,
    }));
  }, [party]);

  const totalKills = useMemo(() => stats.reduce((sum, s) => sum + s.kills, 0), [stats]);
  const totalShots = useMemo(() => stats.reduce((sum, s) => sum + s.shots, 0), [stats]);
  const survivors = useMemo(() => stats.filter(s => s.alive).length, [stats]);

  // 計數動畫
  const animKills = useCountUp(totalKills, 1200);
  const animShots = useCountUp(totalShots, 1200);
  const animSurvivors = useCountUp(survivors, 800);

  const handleReturn = useCallback(() => {
    playZombieSound("lobby:player_leave");
    onReturnToLobby?.();
  }, [onReturnToLobby]);

  return (
    <div style={RESULT_CONTAINER}>
      {/* 背景效果 */}
      <div style={{
        ...RESULT_BG,
        background: isVictory
          ? `radial-gradient(ellipse 50% 50% at 50% 40%, rgba(34,197,94,0.12) 0%, transparent 70%),
             radial-gradient(ellipse 40% 30% at 30% 60%, rgba(59,130,246,0.08) 0%, transparent 100%),
             #050505`
          : `radial-gradient(ellipse 50% 40% at 50% 50%, rgba(239,68,68,0.08) 0%, transparent 70%),
             #050505`,
      }} />

      {/* 粒子特效 */}
      {isVictory && <SparkleParticles color={COLORS.green} count={25} />}
      {!isVictory && <FloatingSkulls count={8} />}
      {!isVictory && <SparkleParticles color={COLORS.red} count={8} />}

      <div style={RESULT_CONTENT}>
        {/* 結算標題 */}
        <div style={RESULT_HEADER}>
          <div style={{
            ...RESULT_ICON,
            animation: isVictory
              ? `za-victory-glow 1.5s ease-in-out infinite`
              : `za-defeat-pulse 1.5s ease-in-out infinite`,
          }}>
            {isVictory ? "🏆" : "💀"}
          </div>
          <h1 style={{ ...RESULT_TITLE, color: isVictory ? COLORS.green : COLORS.red }}>
            {isVictory ? "任務成功" : "全員陣亡"}
          </h1>
          <p style={{
            ...RESULT_SUBTITLE,
            animation: `za-fade-in 0.8s ease-out 0.5s both`,
          }}>
            {isVictory ? "所有目標達成。撤離成功。" : "任務失敗。殭屍軍團取得了勝利。"}
          </p>
        </div>

        {/* 統計摘要 — 計數動畫 */}
        <div style={STATS_GRID}>
          <StatCard icon="🎯" value={animKills} label="總擊殺" delay="0s" />
          <StatCard icon="👥" value={`${animSurvivors}/${stats.length}`} label="存活" delay="0.1s" />
          <StatCard icon="🏹" value={animShots} label="總射擊" delay="0.2s" />
          <StatCard icon="⏱️" value={formatTime(Math.floor(gameState?.startedAt ? (Date.now() - gameState.startedAt) / 1000 : 0))} label="遊戲時間" delay="0.3s" />
        </div>

        {/* 各隊員統計 */}
        <div style={{
          ...PLAYER_STATS_SECTION,
          animation: `za-slide-in-up ${ANIM_DURATION.entrance} ease-out 0.6s both`,
        }}>
          <div style={SECTION_TITLE}>👤 分隊統計</div>
          <div style={PLAYER_STATS_TABLE}>
            <div style={TABLE_HEADER}>
              <span style={COL_PLAYER}>隊員</span>
              <span style={COL_STAT}>狀態</span>
              <span style={COL_STAT}>擊殺</span>
              <span style={COL_STAT}>射擊</span>
              <span style={COL_STAT}>命中率</span>
            </div>
            {stats.map((s, i) => (
              <div key={i} style={{
                ...TABLE_ROW,
                opacity: s.alive ? 1 : 0.4,
                animation: `za-slide-in-left ${ANIM_DURATION.entrance} ease-out ${0.7 + i * 0.1}s both`,
              }}>
                <span style={COL_PLAYER}>
                  <span style={{ fontWeight: 700 }}>{s.slot}</span>
                  <span style={{ marginLeft: 6, color: COLORS.text }}>{s.name}</span>
                </span>
                <span style={{ ...COL_STAT, color: s.alive ? (s.infected ? COLORS.green : COLORS.text) : COLORS.red }}>
                  {!s.alive ? "💀 陣亡" : s.infected ? "🧟 感染" : "✓ 存活"}
                </span>
                <span style={COL_STAT}>{s.kills}</span>
                <span style={COL_STAT}>{s.shots}</span>
                <span style={{ ...COL_STAT, color: s.accuracy > 60 ? COLORS.green : s.accuracy > 30 ? COLORS.amber : COLORS.red, fontWeight: 700 }}>
                  {s.accuracy}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 任務總結 */}
        <div style={{
          ...RESULT_SUMMARY,
          animation: `za-scale-in ${ANIM_DURATION.entrance} ease-out 0.9s both`,
        }}>
          <div style={SUMMARY_LINE}><span>任務區域</span><span>{gameState?.zone || "未知"}</span></div>
          <div style={SUMMARY_LINE}><span>最後存活</span><span>{survivors} 人</span></div>
          <div style={SUMMARY_LINE}><span>總擊殺數</span><span>{totalKills} 隻殭屍</span></div>
          <div style={SUMMARY_LINE}><span>最高命中率</span><span>
            {stats.length > 0 ? Math.max(...stats.map(s => s.accuracy)) : 0}%
          </span></div>
        </div>

        {/* 返回大廳 */}
        <button onClick={handleReturn} style={{
          ...RETURN_BTN,
          animation: `za-slide-in-up ${ANIM_DURATION.entrance} ease-out 1.1s both`,
        }}>
          🏛️ 返回大廳
        </button>
      </div>
    </div>
  );
}

// ── 統計卡片 ─────────────────────────────────────────────
function StatCard({ icon, value, label, delay }) {
  return (
    <div style={{
      ...STAT_CARD,
      animation: `za-count-up ${ANIM_DURATION.slow} ease-out ${delay} both`,
    }}>
      <div style={STAT_ICON}>{icon}</div>
      <div style={STAT_VALUE}>{value}</div>
      <div style={STAT_LABEL}>{label}</div>
    </div>
  );
}

// ── 輔助 ────────────────────────────────────────────────
function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ═════════════════════════════════════════════════════════════
//  🎨 樣式
// ═════════════════════════════════════════════════════════════

const RESULT_CONTAINER = { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Noto Sans TC',sans-serif", color: COLORS.text, overflow: "auto" };
const RESULT_BG = { position: "absolute", inset: 0, pointerEvents: "none" };
const RESULT_CONTENT = { position: "relative", zIndex: 1, width: "100%", maxWidth: 600, padding: 24, display: "flex", flexDirection: "column", alignItems: "center" };
const RESULT_HEADER = { textAlign: "center", marginBottom: 32 };
const RESULT_ICON = { fontSize: 64, marginBottom: 12, filter: "drop-shadow(0 0 30px rgba(255,255,255,0.15))" };
const RESULT_TITLE = { fontSize: 36, fontWeight: 900, margin: 0, letterSpacing: 4, textShadow: "0 2px 20px rgba(0,0,0,0.5)" };
const RESULT_SUBTITLE = { fontSize: 13, color: COLORS.textDim, margin: "10px 0 0" };
const STATS_GRID = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, width: "100%", marginBottom: 24 };
const STAT_CARD = { padding: "16px 8px", borderRadius: RADIUS.md, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" };
const STAT_ICON = { fontSize: 20, marginBottom: 8 };
const STAT_VALUE = { fontSize: 22, fontWeight: 900, fontFamily: "'JetBrains Mono',monospace", color: COLORS.text, marginBottom: 4 };
const STAT_LABEL = { fontSize: 9, fontWeight: 600, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1 };
const PLAYER_STATS_SECTION = { width: "100%", marginBottom: 20 };
const SECTION_TITLE = { fontSize: 11, fontWeight: 700, color: COLORS.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 };
const PLAYER_STATS_TABLE = { borderRadius: RADIUS.md, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" };
const TABLE_HEADER = { display: "grid", gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr 0.7fr", padding: "8px 12px", background: "rgba(255,255,255,0.03)", fontSize: 9, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid rgba(255,255,255,0.06)" };
const TABLE_ROW = { display: "grid", gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr 0.7fr", padding: "8px 12px", fontSize: 11, color: COLORS.textDim, borderBottom: "1px solid rgba(255,255,255,0.03)" };
const COL_PLAYER = { display: "flex", alignItems: "center" };
const COL_STAT = { textAlign: "center" };
const RESULT_SUMMARY = { width: "100%", padding: "12px 16px", borderRadius: RADIUS.md, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24 };
const SUMMARY_LINE = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: COLORS.textDim, borderBottom: "1px solid rgba(255,255,255,0.03)" };
const RETURN_BTN = { padding: "14px 40px", borderRadius: RADIUS.md, background: "linear-gradient(135deg, #7c3aed, #2563eb)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 1, transition: `all ${ANIM.fast}`, boxShadow: "0 4px 20px rgba(124,58,237,0.3)" };
