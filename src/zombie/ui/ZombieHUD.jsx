// src/zombie/ui/ZombieHUD.jsx
// ═══════════════════════════════════════════════════════════════
//  🎯 殭屍生存 — 遊戲 HUD
//  末日風格暗色玻璃介面，使用集中化設計系統
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { COLORS, RADIUS, FONT, ANIM } from "./theme";
import { GAME_PHASE, getPhaseLabel, getPhaseIcon } from "../domain/gameStateMachine";
import { getRoleLabel } from "../domain/partyEngine";
import { playZombieSound } from "../domain/zombieSound";
import { ANIM_DURATION } from "../style/zombieAnimations";

// ── HUD 主容器 ──────────────────────────────────────────
export default function ZombieHUD({ gameState, party, onAction, children }) {
  const phase = gameState?.phase || GAME_PHASE.LOBBY;
  const showHud = phase !== GAME_PHASE.LOBBY && phase !== GAME_PHASE.VICTORY && phase !== GAME_PHASE.DEFEAT;

  return (
    <div style={HUD_CONTAINER}>
      {/* 頂部橫幅 — 氣氛用掃描線 */}
      <div style={SCANLINE_OVERLAY} />

      {showHud && <TopBar phase={phase} round={gameState?.round} resources={gameState?.resources} zone={gameState?.zone} startedAt={gameState?.startedAt} />}
      {showHud && <SideBar party={party} />}
      <main style={MAIN_CONTENT}>{children}</main>
      {showHud && <ActionBar phase={phase} party={party} onAction={onAction} />}
    </div>
  );
}

// ── TopBar：資源條與狀態列 ─────────────────────────────
function TopBar({ phase, round, resources, zone, startedAt }) {
  const [gameTime, setGameTime] = useState("00:00");
  const [isLowResource, setIsLowResource] = useState({});
  const prevLowRef = useRef({});

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setGameTime(`${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    if (!resources) return;
    const low = { food: resources.food <= 10, water: resources.water <= 10, arrows: resources.arrows <= 5 };
    const prev = prevLowRef.current;
    if ((low.food && !prev.food) || (low.water && !prev.water) || (low.arrows && !prev.arrows)) {
      playZombieSound("system:notification");
    }
    prevLowRef.current = low;
    setIsLowResource(low);
  }, [resources]);

  return (
    <header style={TOP_BAR}>
      <div style={TOP_BAR_LEFT}>
        <div style={PHASE_BADGE}>
          <span>{getPhaseIcon(phase)}</span>
          <span style={{ marginLeft: 5 }}>{getPhaseLabel(phase)}</span>
        </div>
      </div>

      <div style={TOP_BAR_CENTER}>
        <span style={ROUND_PILL}>R{round}</span>
        {zone && <span style={ZONE_PILL}>{zone}</span>}
      </div>

      <div style={TOP_BAR_RIGHT}>
        <ResourceBar
          icon="🍖"
          label="食物"
          value={resources?.food ?? 0}
          max={50}
          low={isLowResource.food}
          color={COLORS.green}
        />
        <ResourceBar
          icon="💧"
          label="飲水"
          value={resources?.water ?? 0}
          max={50}
          low={isLowResource.water}
          color={COLORS.blue}
        />
        <ResourceBar
          icon="🏹"
          label="箭矢"
          value={resources?.arrows ?? 0}
          max={35}
          low={isLowResource.arrows}
          color={COLORS.amber}
        />
        <span style={TIMER}>{gameTime}</span>
      </div>
    </header>
  );
}

function ResourceBar({ icon, value, max, low, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={RES_BAR_WRAP} title={`${icon} ${value}/${max}`}>
      <span style={RES_ICON}>{icon}</span>
      <div style={RES_TRACK}>
        <div
          style={{
            ...RES_FILL,
            width: `${pct}%`,
            background: low
              ? `linear-gradient(90deg, #ef4444, #dc2626)`
              : `linear-gradient(90deg, ${color}, ${color}dd)`,
            boxShadow: low ? `0 0 8px rgba(239,68,68,0.5)` : "none",
            transition: `width ${ANIM_DURATION.slow} ease-out`,
          }}
        />
      </div>
      <span style={{ ...RES_VAL, color: low ? "#ef4444" : COLORS.text }}>
        {value}
      </span>
      {low && <span style={LOW_WARN}>⚠</span>}
    </div>
  );
}

// ── SideBar：隊列（可收合） ────────────────────────────
function SideBar({ party }) {
  const members = party?.members || [];
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("zombieSidebarCollapsed") !== "false";
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("zombieSidebarCollapsed", String(next));
      return next;
    });
  };

  if (collapsed) {
    return (
      <aside style={SIDEBAR_COLLAPSED}>
        <button
          onClick={toggle}
          style={SIDEBAR_TOGGLE_BTN}
          title="展開隊伍列"
        >
          <span style={{ transform: "rotate(0deg)", display: "inline-block" }}>▶</span>
        </button>
        <div style={SIDEBAR_COLLAPSED_BADGE}>
          <span style={{ fontSize: 10 }}>👥</span>
          <span style={{ fontSize: 7, fontWeight: 700, marginTop: 1 }}>{members.length}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside style={SIDEBAR_EXPANDED}>
      <button
        onClick={toggle}
        style={SIDEBAR_TOGGLE_BTN_EXPANDED}
        title="收起隊伍列"
      >
        <span style={{ transform: "rotate(180deg)", display: "inline-block" }}>▶</span>
      </button>
      <div style={SIDEBAR_HEADER}>
        <span style={SIDEBAR_TITLE}>👥 小隊</span>
        <span style={SIDEBAR_COUNT}>{members.length}/{party?.maxSize || 5}</span>
      </div>
      <div style={SIDEBAR_LIST}>
        {members.map((m, i) => (
          <PlayerPortrait key={m.id} player={m} index={i} />
        ))}
      </div>
    </aside>
  );
}

function PlayerPortrait({ player, index }) {
  const infectionPct = (player.infectionProgress || 0) / 10;
  const alive = player.isAlive !== false;
  const infected = player.isFullyInfected;
  return (
    <div
      style={{
        ...PORTRAIT,
        opacity: alive ? 1 : 0.35,
        borderColor: infected
          ? `${COLORS.green}66`
          : player.isReady
          ? `${COLORS.blue}66`
          : "rgba(255,255,255,0.06)",
        background: infected
          ? "rgba(34,197,94,0.08)"
          : "rgba(255,255,255,0.03)",
        animation: `za-slide-in-left ${ANIM_DURATION.entrance} ease-out ${
          index * 0.06
        }s both`,
      }}
    >
      <div
        style={{
          ...AVATAR,
          background: infected
            ? "rgba(34,197,94,0.15)"
            : "rgba(255,255,255,0.05)",
          fontSize: alive ? (infected ? 14 : 16) : 14,
        }}
      >
        {!alive ? "💀" : infected ? "🧟" : player.role === "leader" ? "👑" : "🏹"}
      </div>
      <div style={PORTRAIT_BODY}>
        <div style={PORTRAIT_NAME}>{player.name}</div>
        <div style={PORTRAIT_ROLE}>{getRoleLabel(player.role)}</div>
        {player.infectionProgress > 0 && alive && (
          <div style={INF_BAR}>
            <div style={INF_FILL_BG}>
              <div
                style={{ ...INF_FILL, width: `${infectionPct * 100}%` }}
              />
            </div>
            <span style={INF_TEXT}>{player.infectionProgress}/10</span>
          </div>
        )}
      </div>
      {player.isReady && <span style={READY_DOT} />}
    </div>
  );
}

// ── ActionBar：底部操作列 ──────────────────────────────
function ActionBar({ phase, party, onAction }) {
  const actions = {
    [GAME_PHASE.EXPLORATION]: [
      { id: "move", icon: "🚶", label: "移動", primary: true },
      { id: "rest", icon: "🏕️", label: "休息" },
      { id: "scavenge", icon: "🔍", label: "搜刮" },
      { id: "extract", icon: "🚁", label: "撤離", danger: true },
    ],
    [GAME_PHASE.ENCOUNTER]: [
      { id: "fight", icon: "⚔️", label: "戰鬥", primary: true },
      { id: "flee", icon: "🏃", label: "撤退", danger: true },
    ],
    [GAME_PHASE.COMBAT]: [
      { id: "shoot", icon: "🎯", label: "射擊", primary: true },
      { id: "pause", icon: "⏸️", label: "暫停" },
    ],
    [GAME_PHASE.RESULT]: [
      { id: "continue", icon: "➡️", label: "繼續", primary: true },
    ],
    [GAME_PHASE.EXTRACTION]: [
      { id: "extract_now", icon: "🚁", label: "撤離", primary: true },
    ],
  };
  const list = actions[phase] || [];

  if (list.length === 0) return null;

  return (
    <footer style={ACTION_FOOTER}>
      <div style={ACTION_INNER}>
        {list.map((a, i) => (
          <button
            key={a.id}
            onClick={() => {
              onAction?.(a.id);
              playZombieSound("lobby:zone_select");
            }}
            style={{
              ...ACT_BTN,
              ...(a.primary ? ACT_PRIMARY : {}),
              ...(a.danger ? ACT_DANGER : {}),
              animation: `za-slide-in-up ${ANIM_DURATION.fast} ease-out ${
                i * 0.04
              }s both`,
            }}
          >
            <span style={{ fontSize: a.primary || a.danger ? 22 : 20 }}>
              {a.icon}
            </span>
            <span style={ACT_LABEL}>{a.label}</span>
          </button>
        ))}
      </div>
    </footer>
  );
}

// ── 感染覆蓋層 ──────────────────────────────────────────
export function InfectionOverlay({ progress = 0, isFullyInfected = false }) {
  if (progress <= 0 && !isFullyInfected) return null;
  const i = Math.min(progress / 10, 0.6);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        pointerEvents: "none",
        background: isFullyInfected
          ? "rgba(0,80,0,0.15)"
          : `rgba(0,40,0,${i * 0.3})`,
        boxShadow: isFullyInfected
          ? "inset 0 0 80px rgba(34,197,94,0.3)"
          : `inset 0 0 60px rgba(34,197,94,${i * 0.3})`,
      }}
    />
  );
}

// ── 傷害覆蓋層 ──────────────────────────────────────────
export function DamageOverlay({ intensity = 0 }) {
  if (intensity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        pointerEvents: "none",
        boxShadow: `inset 0 0 100px rgba(239,68,68,${Math.min(intensity, 0.4)})`,
        border: `2px solid rgba(239,68,68,${Math.min(intensity, 0.2)})`,
      }}
    />
  );
}

// ── 螢幕震動（僅包內部內容，不包 HUD 固定層） ────────────
export function ScreenShake({ intensity = 0, children }) {
  const [shake, setShake] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (intensity <= 0) {
      setShake({ x: 0, y: 0 });
      return;
    }
    const interval = setInterval(
      () =>
        setShake({
          x: (Math.random() - 0.5) * intensity * 4,
          y: (Math.random() - 0.5) * intensity * 4,
        }),
      50
    );
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setShake({ x: 0, y: 0 });
    }, 500);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [intensity]);
  return (
    <div
      style={{
        transform: `translate(${shake.x}px,${shake.y}px)`,
        transition: "transform 0.05s",
      }}
    >
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  🎨 設計系統 Token（末日生存暗色主題，確保高可讀性）
// ═════════════════════════════════════════════════════════════

const HUD_CONTAINER = {
  position: "fixed",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  color: COLORS.text,
  fontFamily: FONT.family,
  overflow: "hidden",
  background: COLORS.bgGradient,
};

/* 掃描線裝飾 — 增添末日氣氛 */
const SCANLINE_OVERLAY = {
  position: "absolute",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  background: `repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  )`,
};

// ── TopBar ──────────────────────────────────────────────
const TOP_BAR = {
  position: "relative",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "5px 10px",
  gap: 6,
  flexShrink: 0,
  background: "rgba(15, 12, 25, 0.85)",
  backdropFilter: "blur(12px)",
  borderBottom: `1px solid ${COLORS.glassBorder}`,
  boxShadow: "0 2px 20px rgba(0,0,0,0.4)",
};

const TOP_BAR_LEFT = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const TOP_BAR_CENTER = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const TOP_BAR_RIGHT = {
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const PHASE_BADGE = {
  display: "flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: RADIUS.sm,
  background: `linear-gradient(135deg, ${COLORS.accent}, #b91c1c)`,
  fontSize: 9,
  fontWeight: 700,
  color: "#fff",
  whiteSpace: "nowrap",
  letterSpacing: 0.5,
  boxShadow: `0 0 12px ${COLORS.accentGlow}`,
};

const ROUND_PILL = {
  padding: "2px 7px",
  borderRadius: RADIUS.sm,
  background: "rgba(255,255,255,0.08)",
  fontSize: 9,
  fontWeight: 700,
  fontFamily: FONT.mono,
  color: COLORS.text,
  border: `1px solid ${COLORS.glassBorder}`,
};

const ZONE_PILL = {
  padding: "2px 7px",
  borderRadius: RADIUS.sm,
  background: "rgba(59,130,246,0.12)",
  fontSize: 8,
  fontWeight: 700,
  color: COLORS.blue,
  border: `1px solid ${COLORS.blue}44`,
};

const RES_BAR_WRAP = {
  display: "flex",
  alignItems: "center",
  gap: 2,
};

const RES_ICON = {
  fontSize: 10,
  flexShrink: 0,
};

const RES_TRACK = {
  width: 48,
  height: 4,
  borderRadius: 2,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const RES_FILL = {
  height: "100%",
  borderRadius: 2,
};

const RES_VAL = {
  fontSize: 8,
  fontWeight: 700,
  fontFamily: FONT.mono,
  minWidth: 14,
  textAlign: "right",
};

const LOW_WARN = {
  fontSize: 9,
  color: COLORS.accent,
  animation: `za-resource-low-pulse ${ANIM_DURATION.pulse} ease infinite`,
};

const TIMER = {
  fontSize: 9,
  fontWeight: 700,
  fontFamily: FONT.mono,
  color: COLORS.textDim,
  padding: "0 4px",
};

// ── SideBar ─────────────────────────────────────────────
const SIDEBAR_COLLAPSED = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: 28,
  zIndex: 90,
  background:
    "linear-gradient(90deg, rgba(10, 8, 20, 0.8) 0%, rgba(10, 8, 20, 0.3) 70%, transparent 100%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "8px 0",
  gap: 4,
  pointerEvents: "none",
  borderRight: `1px solid ${COLORS.glassBorder}`,
  transition: "width 0.25s ease",
};

const SIDEBAR_TOGGLE_BTN = {
  padding: "4px 2px",
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.glassBorder}`,
  background: "rgba(255,255,255,0.04)",
  color: COLORS.textDim,
  cursor: "pointer",
  fontSize: 8,
  lineHeight: 1,
  pointerEvents: "auto",
  transition: "all 0.15s",
};

const SIDEBAR_COLLAPSED_BADGE = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 1,
  color: COLORS.textMuted,
};

const SIDEBAR_EXPANDED = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: 148,
  zIndex: 90,
  background:
    "linear-gradient(90deg, rgba(10, 8, 20, 0.88) 0%, rgba(10, 8, 20, 0.6) 70%, transparent 100%)",
  padding: "10px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  pointerEvents: "none",
  borderRight: `1px solid ${COLORS.glassBorder}`,
  transition: "width 0.25s ease",
};

const SIDEBAR_TOGGLE_BTN_EXPANDED = {
  position: "absolute",
  right: 2,
  top: 10,
  padding: "2px 3px",
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.glassBorder}`,
  background: "rgba(255,255,255,0.04)",
  color: COLORS.textDim,
  cursor: "pointer",
  fontSize: 7,
  lineHeight: 1,
  pointerEvents: "auto",
  transition: "all 0.15s",
  zIndex: 2,
};

const SIDEBAR_HEADER = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "2px 4px 6px",
  marginBottom: 4,
  borderBottom: `1px solid ${COLORS.glassBorder}`,
  paddingRight: 18,
};

const SIDEBAR_TITLE = {
  fontSize: 8,
  fontWeight: 700,
  color: COLORS.textMuted,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const SIDEBAR_COUNT = {
  fontSize: 8,
  fontWeight: 700,
  fontFamily: FONT.mono,
  color: COLORS.textDim,
};

const SIDEBAR_LIST = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  flex: 1,
  overflowY: "auto",
};

const PORTRAIT = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 5px",
  borderRadius: RADIUS.sm,
  border: "1px solid",
  pointerEvents: "auto",
  transition: `all ${ANIM.normal}`,
};

const AVATAR = {
  width: 24,
  height: 24,
  borderRadius: RADIUS.sm,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  overflow: "hidden",
};

const PORTRAIT_BODY = {
  flex: 1,
  minWidth: 0,
};

const PORTRAIT_NAME = {
  fontSize: 9,
  fontWeight: 700,
  color: COLORS.text,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const PORTRAIT_ROLE = {
  fontSize: 7,
  color: COLORS.textDim,
  marginTop: 1,
};

const INF_BAR = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  marginTop: 2,
};

const INF_FILL_BG = {
  flex: 1,
  height: 2,
  borderRadius: 1,
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const INF_FILL = {
  height: "100%",
  borderRadius: 1,
  background: `linear-gradient(90deg, ${COLORS.green}, #16a34a)`,
  transition: `width ${ANIM_DURATION.slow} ease-out`,
};

const INF_TEXT = {
  fontSize: 6,
  fontWeight: 700,
  fontFamily: FONT.mono,
  color: COLORS.textMuted,
};

const READY_DOT = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: `${COLORS.blue}33`,
  border: `2px solid ${COLORS.blue}66`,
  flexShrink: 0,
};

// ── ActionBar ───────────────────────────────────────────
const ACTION_FOOTER = {
  position: "relative",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "7px 12px",
  flexShrink: 0,
  background: "rgba(15, 12, 25, 0.85)",
  backdropFilter: "blur(12px)",
  borderTop: `1px solid ${COLORS.glassBorder}`,
  boxShadow: "0 -2px 20px rgba(0,0,0,0.4)",
};

const ACTION_INNER = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  maxWidth: 400,
};

const ACT_BTN = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 1,
  padding: "5px 12px",
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.glassBorder}`,
  background: "rgba(255,255,255,0.04)",
  color: COLORS.text,
  cursor: "pointer",
  transition: `all ${ANIM.fast}`,
  minWidth: 44,
};

const ACT_PRIMARY = {
  background: `linear-gradient(135deg, #dc2626, ${COLORS.accent})`,
  border: `1px solid ${COLORS.accent}66`,
  color: "#fff",
  boxShadow: `0 2px 12px ${COLORS.accentGlow}`,
};

const ACT_DANGER = {
  background: "rgba(239,68,68,0.12)",
  border: `1px solid ${COLORS.accent}44`,
  color: COLORS.accent,
};

const ACT_LABEL = {
  fontSize: 8,
  fontWeight: 600,
  letterSpacing: 0.3,
};

// ── Main Content ────────────────────────────────────────
const MAIN_CONTENT = {
  position: "relative",
  zIndex: 1,
  flex: 1,
  overflow: "auto",
  padding: 8,
};
