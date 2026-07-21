// src/zombie/ui/ZombieLobby.jsx
// ═══════════════════════════════════════════════════════════════
//  🏛️ 殭屍生存 — 集結大廳（增強版動畫+音效）
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from "react";
import { COLORS, SHADOWS, ANIM, RADIUS, FONT } from "./theme";
import {
  createParty,
  joinParty,
  leaveParty,
  toggleReady,
  isAllReady,
  PLAYER_ROLE,
  SLOT_LABELS,
  getRoleLabel,
} from "../domain/partyEngine";
import { playZombieSound, initZombieAudio } from "../domain/zombieSound";
import { ANIM_CLASS, ANIM_DURATION } from "../style/zombieAnimations";

const ZONE_OPTIONS = [
  { id: "safe",    label: "🟢 安全區",   desc: "無殭屍，練習用", danger: false },
  { id: "normal",  label: "🟡 普通區",   desc: "少量普通殭屍", danger: false },
  { id: "danger",  label: "🟠 危險區",   desc: "含特殊殭屍", danger: true },
  { id: "extreme", label: "🔴 高危區",   desc: "精英+高遭遇率", danger: true },
  { id: "forbid",  label: "⚫ 禁區",     desc: "BOSS 可能出現", danger: true },
];

const DIFFICULTY_OPTIONS = [
  { id: "easy",     label: "🟢 簡單", desc: "補給豐富、殭屍少" },
  { id: "standard", label: "🟡 標準", desc: "平衡體驗" },
  { id: "hard",     label: "🟠 困難", desc: "補給稀缺、殭屍多" },
  { id: "nightmare",label: "🔴 噩夢", desc: "極限生存考驗" },
];

// ═════════════════════════════════════════════════════════════
//  🏛️ 大廳主元件
// ═════════════════════════════════════════════════════════════
export default function ZombieLobby({
  onStartGame, party, localPlayerId = "local_1", localPlayerName = "倖存者",
}) {
  const [localParty, setLocalParty] = useState(() =>
    party || createParty(localPlayerId, localPlayerName)
  );
  const [selectedZone, setSelectedZone] = useState(ZONE_OPTIONS[2].id);
  const [selectedDifficulty, setSelectedDifficulty] = useState(DIFFICULTY_OPTIONS[1].id);
  const [animSlots, setAnimSlots] = useState({ A: true, B: false, C: false, D: false, E: false });
  const containerRef = useRef(null);
  const allReady = isAllReady(localParty);

  // 初始化音效
  useEffect(() => { initZombieAudio(); }, []);

  const handleToggleReady = useCallback(() => {
    const updated = toggleReady(localParty, localPlayerId);
    setLocalParty(updated);
    playZombieSound(updated.members.find(m => m.id === localPlayerId)?.isReady
      ? "lobby:ready_toggle" : "lobby:ready_toggle");
    if (isAllReady(updated)) {
      setTimeout(() => playZombieSound("lobby:all_ready"), 300);
    }
  }, [localParty, localPlayerId]);

  const handleAddBot = useCallback(() => {
    const botIndex = localParty.members.length;
    if (botIndex >= 5) return;
    const botNames = ["偵查兵", "支援兵", "狙擊手", "醫療兵"];
    const botName = botNames[Math.min(botIndex - 1, 3)] || `隊員${botIndex + 1}`;
    const result = joinParty(localParty, `bot_${botIndex + 1}`, botName);
    if (result.ok) {
      setLocalParty(result.party);
      const slot = result.party.members[result.party.members.length - 1].slot;
      setAnimSlots(prev => ({ ...prev, [slot]: true }));
      playZombieSound("lobby:player_join");
    }
  }, [localParty]);

  const handleRemoveBot = useCallback((botId) => {
    const result = leaveParty(localParty, botId);
    if (result.ok) {
      setLocalParty(result.party);
      playZombieSound("lobby:player_leave");
    }
  }, [localParty]);

  const handleStart = useCallback(() => {
    playZombieSound("lobby:start_mission");
    onStartGame?.({ party: localParty, zone: selectedZone, difficulty: selectedDifficulty });
  }, [localParty, selectedZone, selectedDifficulty, onStartGame]);

  const handleStartSolo = useCallback(() => {
    const soloParty = createParty(localPlayerId, localPlayerName);
    playZombieSound("lobby:start_mission");
    onStartGame?.({ party: soloParty, zone: selectedZone, difficulty: selectedDifficulty, solo: true });
  }, [localPlayerId, localPlayerName, selectedZone, selectedDifficulty, onStartGame]);

  const handleSelectZone = useCallback((zoneId) => {
    setSelectedZone(zoneId);
    const zone = ZONE_OPTIONS.find(z => z.id === zoneId);
    playZombieSound(zone?.danger ? "lobby:danger_select" : "lobby:zone_select");
  }, []);

  return (
    <div ref={containerRef} style={LOBBY_CONTAINER}>
      <div style={LOBBY_BG} />

      <div style={LOBBY_CONTENT}>
        {/* 標題 — 浮動動畫 */}
        <div style={{ ...LOBBY_HEADER, animation: `za-float ${ANIM_DURATION.float} ease-in-out infinite` }}>
          <div style={LOBBY_TITLE_ICON}>☠️</div>
          <h1 style={LOBBY_TITLE}>殭屍生存</h1>
          <p style={LOBBY_SUBTITLE}>合作射擊生存遊戲 · 集結大廳</p>
        </div>

        <div style={LOBBY_GRID}>
          {/* ── 左：隊伍面板 ── */}
          <div style={{ ...LOBBY_COLUMN, animation: `za-slide-in-left ${ANIM_DURATION.entrance} ease-out` }}>
            <div style={PANEL_HEADER}>
              👥 小隊編制
              <span style={MEMBER_COUNT}>{localParty.members.length}/{localParty.maxSize}</span>
            </div>

            <div style={MEMBERS_CONTAINER}>
              {SLOT_LABELS.map((slot, index) => {
                const member = localParty.members.find(m => m.slot === slot);
                const isLocal = member?.id === localPlayerId;
                const showAnim = animSlots[slot];

                return (
                  <div key={slot}
                    style={{
                      ...MEMBER_SLOT,
                      borderColor: member
                        ? member.isReady
                          ? "rgba(59,130,246,0.5)"
                          : COLORS.glassBorder
                        : "rgba(255,255,255,0.03)",
                      opacity: member ? 1 : 0.4,
                      animation: showAnim
                        ? `za-slide-in-left 0.3s ease-out`
                        : undefined,
                    }}
                  >
                    <span style={{
                      ...SLOT_TAG,
                      background: member?.isReady
                        ? "rgba(59,130,246,0.2)"
                        : "rgba(255,255,255,0.06)",
                      color: member?.isReady ? COLORS.blue : COLORS.textMuted,
                      transition: `all ${ANIM.fast}`,
                    }}>
                      {member?.isReady ? "✓" : slot}
                    </span>

                    {member ? (
                      <>
                        <div style={{
                          ...MEMBER_AVATAR,
                          animation: member.isReady
                            ? `za-glow-pulse 1.5s ease-in-out infinite`
                            : undefined,
                        }}>
                          {member.role === PLAYER_ROLE.LEADER ? "👑" : "🦸"}
                        </div>
                        <div style={MEMBER_INFO}>
                          <div style={MEMBER_NAME}>
                            {member.name}
                            {isLocal && <span style={LOCAL_TAG}>（你）</span>}
                          </div>
                          <div style={MEMBER_ROLE}>{getRoleLabel(member.role)}</div>
                        </div>
                        <div style={MEMBER_STATUS}>
                          {member.isReady ? (
                            <span style={READY_BADGE}>✓ 就緒</span>
                          ) : (
                            <span style={WAITING_BADGE}>⋯</span>
                          )}
                        </div>
                        {!isLocal && member.id.startsWith("bot_") && (
                          <button onClick={() => handleRemoveBot(member.id)} style={KICK_BUTTON}>✕</button>
                        )}
                      </>
                    ) : (
                      <div style={EMPTY_SLOT}>
                        <span style={EMPTY_TEXT}>等待隊員</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 隊伍操作按鈕 */}
            <div style={PARTY_ACTIONS}>
              <button
                onClick={handleToggleReady}
                style={{
                  ...ACTION_BTN,
                  background: allReady
                    ? "linear-gradient(135deg, #16a34a, #22c55e)"
                    : "rgba(255,255,255,0.06)",
                  border: allReady ? "none" : "1px solid rgba(255,255,255,0.1)",
                  color: allReady ? "#fff" : COLORS.text,
                  boxShadow: allReady ? "0 0 20px rgba(34,197,94,0.3)" : "none",
                  animation: allReady ? `za-pulse-green ${ANIM_DURATION.pulse} ease infinite` : undefined,
                }}
              >
                {allReady ? "✅ 取消就緒" : "⏳ 準備就緒"}
              </button>
              <button onClick={handleAddBot} style={ACTION_BTN_SECONDARY}>
                🤖 添加 AI 隊友
              </button>
              <button onClick={handleStartSolo} style={ACTION_BTN_DANGER}>
                🎯 單人挑戰
              </button>
            </div>
          </div>

          {/* ── 右：任務設定 ── */}
          <div style={{ ...LOBBY_COLUMN, animation: `za-slide-in-right ${ANIM_DURATION.entrance} ease-out` }}>
            <div style={PANEL_HEADER}>⚙️ 任務設定</div>

            <div style={SETTING_GROUP}>
              <div style={SETTING_LABEL}>區域</div>
              <div style={OPTIONS_GRID}>
                {ZONE_OPTIONS.map((zone) => {
                  const isSelected = selectedZone === zone.id;
                  return (
                    <button key={zone.id} onClick={() => handleSelectZone(zone.id)}
                      style={{
                        ...OPTION_BTN,
                        borderColor: isSelected
                          ? "rgba(239,68,68,0.5)"
                          : COLORS.glassBorder,
                        background: isSelected
                          ? "rgba(239,68,68,0.1)"
                          : "transparent",
                        color: isSelected ? COLORS.accent : COLORS.textDim,
                        boxShadow: isSelected ? "0 0 12px rgba(239,68,68,0.15)" : "none",
                        transform: isSelected ? "scale(1.04)" : "scale(1)",
                        animation: isSelected ? `za-glow-pulse 2s ease-in-out infinite` : undefined,
                      }}
                    >
                      <div style={OPTION_LABEL}>{zone.label}</div>
                      <div style={OPTION_DESC}>{zone.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={SETTING_GROUP}>
              <div style={SETTING_LABEL}>難度</div>
              <div style={OPTIONS_GRID}>
                {DIFFICULTY_OPTIONS.map((diff) => {
                  const isSelected = selectedDifficulty === diff.id;
                  return (
                    <button key={diff.id} onClick={() => { setSelectedDifficulty(diff.id); playZombieSound("lobby:zone_select"); }}
                      style={{
                        ...OPTION_BTN,
                        borderColor: isSelected
                          ? "rgba(239,68,68,0.5)"
                          : COLORS.glassBorder,
                        background: isSelected
                          ? "rgba(239,68,68,0.1)"
                          : "transparent",
                        color: isSelected ? COLORS.accent : COLORS.textDim,
                        boxShadow: isSelected ? "0 0 12px rgba(239,68,68,0.15)" : "none",
                        transform: isSelected ? "scale(1.04)" : "scale(1)",
                      }}
                    >
                      <div style={OPTION_LABEL}>{diff.label}</div>
                      <div style={OPTION_DESC}>{diff.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 任務摘要 */}
            <div style={{
              ...MISSION_BRIEF,
              animation: `za-fade-in 0.5s ease-out`,
            }}>
              <div style={BRIEF_HEADER}>📋 任務摘要</div>
              <div style={BRIEF_LINE}>
                <span style={{ color: COLORS.textDim }}>區域</span>
                <span style={{ color: COLORS.accent, fontWeight: 700 }}>
                  {ZONE_OPTIONS.find(z => z.id === selectedZone)?.label}
                </span>
              </div>
              <div style={BRIEF_LINE}>
                <span style={{ color: COLORS.textDim }}>難度</span>
                <span>
                  {DIFFICULTY_OPTIONS.find(d => d.id === selectedDifficulty)?.label}
                </span>
              </div>
              <div style={BRIEF_LINE}>
                <span style={{ color: COLORS.textDim }}>隊員</span>
                <span style={{ color: COLORS.blue, fontWeight: 700 }}>
                  {localParty.members.length} 人
                </span>
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={localParty.members.length < 2}
              style={{
                ...START_BTN,
                opacity: localParty.members.length >= 2 ? 1 : 0.35,
                cursor: localParty.members.length >= 2 ? "pointer" : "not-allowed",
                transform: localParty.members.length >= 2 ? "scale(1)" : "scale(0.97)",
                transition: `all ${ANIM.fast}`,
              }}
            >
              🚀 開始任務
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  🎨 樣式
// ═════════════════════════════════════════════════════════════

const LOBBY_CONTAINER = {
  position: "fixed", inset: 0, top: 32,
  display: "flex", flexDirection: "column", alignItems: "center",
  background: "radial-gradient(ellipse at center, #1a1a2e 0%, #16213e 100%)",
  fontFamily: FONT.family, color: "#fff", overflow: "auto",
  paddingTop: 16,
};

const LOBBY_BG = {
  position: "absolute", inset: 0,
  background: `
    radial-gradient(ellipse 60% 40% at 20% 30%, rgba(100,0,0,0.08) 0%, transparent 100%),
    radial-gradient(ellipse 40% 30% at 80% 60%, rgba(0,0,0,0.3) 0%, transparent 100%),
    repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.02) 3px, rgba(0,0,0,0.02) 4px)
  `,
  pointerEvents: "none",
};

const LOBBY_CONTENT = { position: "relative", zIndex: 1, width: "100%", maxWidth: 960, padding: 24, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" };
const LOBBY_HEADER = { textAlign: "center", marginBottom: 32 };
const LOBBY_TITLE_ICON = { fontSize: 48, marginBottom: 8, filter: "drop-shadow(0 0 20px rgba(239,68,68,0.3))" };
const LOBBY_TITLE = { fontSize: 42, fontWeight: 900, color: "#ffffff", margin: 0, letterSpacing: 4, textShadow: "0 2px 20px rgba(0,0,0,0.5), 0 0 60px rgba(239,68,68,0.1)" };
const LOBBY_SUBTITLE = { fontSize: 13, color: "#94a3b8", margin: "8px 0 0", letterSpacing: 2 };
const LOBBY_GRID = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16, background: "rgba(0,0,0,0.2)", padding: 16, borderRadius: 12 };
const LOBBY_COLUMN = { display: "flex", flexDirection: "column", gap: 10 };

const PANEL_HEADER = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  fontSize: 12, fontWeight: 700, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: 1,
  padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.12)",
};
const MEMBER_COUNT = { fontSize: 10, fontWeight: 600, fontFamily: FONT.mono, color: COLORS.textMuted };
const MEMBERS_CONTAINER = { display: "flex", flexDirection: "column", gap: 6 };

const MEMBER_SLOT = {
  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
  borderRadius: RADIUS.md, background: "rgba(255,255,255,0.06)", border: "1px solid",
  transition: `all ${ANIM.normal}`, position: "relative",
};

const SLOT_TAG = {
  width: 24, height: 24, borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 9, fontWeight: 900, fontFamily: FONT.mono, flexShrink: 0,
};

const MEMBER_AVATAR = { fontSize: 20, flexShrink: 0 };
const MEMBER_INFO = { flex: 1, minWidth: 0 };
const MEMBER_NAME = { fontSize: 12, fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const LOCAL_TAG = { fontSize: 9, color: COLORS.textMuted, fontWeight: 500, marginLeft: 3 };
const MEMBER_ROLE = { fontSize: 9, color: COLORS.textDim, marginTop: 1 };
const MEMBER_STATUS = {};
const READY_BADGE = { fontSize: 9, fontWeight: 700, color: COLORS.blue, padding: "2px 6px", borderRadius: 4, background: "rgba(59,130,246,0.15)", animation: `za-fade-in 0.2s ease-out` };
const WAITING_BADGE = { fontSize: 16, color: COLORS.textMuted };

const KICK_BUTTON = {
  width: 20, height: 20, borderRadius: "50%", border: "none",
  background: "rgba(239,68,68,0.15)", color: COLORS.red,
  fontSize: 10, fontWeight: 700, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};

const EMPTY_SLOT = { width: "100%", textAlign: "center", padding: "2px 0" };
const EMPTY_TEXT = { fontSize: 10, color: COLORS.textMuted };
const PARTY_ACTIONS = { display: "flex", gap: 6, marginTop: 4 };

const ACTION_BTN = {
  flex: 1, padding: "10px 14px", borderRadius: RADIUS.md,
  fontSize: 12, fontWeight: 700, cursor: "pointer", transition: `all ${ANIM.fast}`,
};
const ACTION_BTN_SECONDARY = { ...ACTION_BTN, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: COLORS.textDim };
const ACTION_BTN_DANGER = { ...ACTION_BTN, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: COLORS.accent };

const SETTING_GROUP = { marginBottom: 12 };
const SETTING_LABEL = { fontSize: 10, fontWeight: 700, color: COLORS.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 };
const OPTIONS_GRID = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 };

const OPTION_BTN = {
  padding: "8px 6px", borderRadius: RADIUS.sm, border: "1px solid",
  background: "transparent", cursor: "pointer",
  transition: `all ${ANIM.fast}`, textAlign: "center",
};
const OPTION_LABEL = { fontSize: 10, fontWeight: 700, marginBottom: 2 };
const OPTION_DESC = { fontSize: 8, color: COLORS.textMuted };

const MISSION_BRIEF = {
  padding: "12px 14px", borderRadius: RADIUS.md,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 8,
};
const BRIEF_HEADER = { fontSize: 11, fontWeight: 700, color: COLORS.textDim, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase" };
const BRIEF_LINE = { fontSize: 11, color: COLORS.text, padding: "3px 0", display: "flex", justifyContent: "space-between" };

const START_BTN = {
  width: "100%", padding: "14px 20px", borderRadius: RADIUS.md,
  background: "linear-gradient(135deg, #dc2626, #ef4444)", border: "none",
  color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: 2,
  boxShadow: "0 4px 20px rgba(239,68,68,0.3)", transition: `all ${ANIM.fast}`,
};
