// src/zombie/domain/gameStateMachine.js
// ═══════════════════════════════════════════════════════════════
//  🎮 殭屍生存 — 遊戲狀態機（純函數）
//  定義所有遊戲狀態與合法轉換
// ═══════════════════════════════════════════════════════════════

// ── 遊戲階段 ─────────────────────────────────────────────
export const GAME_PHASE = Object.freeze({
  /** 大廳：創建/加入隊伍 */
  LOBBY: "lobby",
  /** 任務簡報：選擇區域、裝備配置 */
  BRIEFING: "briefing",
  /** 地圖探索：移動、資源管理 */
  EXPLORATION: "exploration",
  /** 遭遇戰準備：選擇箭矢、戰術 */
  ENCOUNTER: "encounter",
  /** 戰鬥中：射擊、命中判定 */
  COMBAT: "combat",
  /** 戰鬥結算：獎勵、狀態更新 */
  RESULT: "result",
  /** 撤離序列 */
  EXTRACTION: "extraction",
  /** 勝利 */
  VICTORY: "victory",
  /** 全滅 */
  DEFEAT: "defeat",
});

// ── 合法轉換表 ───────────────────────────────────────────
// key: 當前階段, value: 可轉換到的階段集合
const VALID_TRANSITIONS = {
  [GAME_PHASE.LOBBY]:         [GAME_PHASE.BRIEFING],
  [GAME_PHASE.BRIEFING]:      [GAME_PHASE.LOBBY, GAME_PHASE.EXPLORATION],
  [GAME_PHASE.EXPLORATION]:   [GAME_PHASE.ENCOUNTER, GAME_PHASE.COMBAT, GAME_PHASE.EXTRACTION, GAME_PHASE.DEFEAT],
  [GAME_PHASE.ENCOUNTER]:     [GAME_PHASE.LOBBY, GAME_PHASE.COMBAT],
  [GAME_PHASE.COMBAT]:        [GAME_PHASE.RESULT],
  [GAME_PHASE.RESULT]:        [GAME_PHASE.EXPLORATION, GAME_PHASE.EXTRACTION, GAME_PHASE.DEFEAT, GAME_PHASE.VICTORY],
  [GAME_PHASE.EXTRACTION]:    [GAME_PHASE.VICTORY, GAME_PHASE.DEFEAT],
  [GAME_PHASE.VICTORY]:       [GAME_PHASE.LOBBY],
  [GAME_PHASE.DEFEAT]:        [GAME_PHASE.LOBBY],
};

// ── 預設遊戲狀態 ─────────────────────────────────────────
export function createInitialGameState() {
  return {
    phase: GAME_PHASE.LOBBY,
    party: [],           // Player[] — 隊伍成員
    zone: null,          // string — 當前區域
    round: 0,            // number — 遊戲回合
    resources: {         // 共享資源
      food: 30,
      water: 30,
      arrows: 20,
      specialArrows: [],
    },
    mapState: null,      // 地圖狀態
    encounterState: null,// 當前遭遇戰狀態
    combatResults: null, // 戰鬥結算
    events: [],          // 遊戲事件日誌
    startedAt: null,     // 遊戲開始時間
    missionLog: [],      // 任務記錄
  };
}

// ── 階段轉換 ─────────────────────────────────────────────
export function transitionPhase(state, targetPhase, extra = {}) {
  const current = state.phase;
  const allowed = VALID_TRANSITIONS[current];

  if (!allowed || !allowed.includes(targetPhase)) {
    return {
      ok: false,
      error: `invalid_transition: ${current} → ${targetPhase}`,
      state,
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      phase: targetPhase,
      ...extra,
      events: [
        ...state.events,
        {
          type: "phase_transition",
          from: current,
          to: targetPhase,
          time: Date.now(),
        },
      ],
    },
  };
}

// ── 查詢輔助 ─────────────────────────────────────────────
export function getPhaseLabel(phase) {
  const labels = {
    [GAME_PHASE.LOBBY]: "集結大廳",
    [GAME_PHASE.BRIEFING]: "任務簡報",
    [GAME_PHASE.EXPLORATION]: "探索中",
    [GAME_PHASE.ENCOUNTER]: "遭遇準備",
    [GAME_PHASE.COMBAT]: "戰鬥中",
    [GAME_PHASE.RESULT]: "戰鬥結算",
    [GAME_PHASE.EXTRACTION]: "撤離中",
    [GAME_PHASE.VICTORY]: "任務成功",
    [GAME_PHASE.DEFEAT]: "全員陣亡",
  };
  return labels[phase] || phase;
}

export function getPhaseIcon(phase) {
  const icons = {
    [GAME_PHASE.LOBBY]: "🏛️",
    [GAME_PHASE.BRIEFING]: "📋",
    [GAME_PHASE.EXPLORATION]: "🗺️",
    [GAME_PHASE.ENCOUNTER]: "⚔️",
    [GAME_PHASE.COMBAT]: "🎯",
    [GAME_PHASE.RESULT]: "📊",
    [GAME_PHASE.EXTRACTION]: "🚁",
    [GAME_PHASE.VICTORY]: "🏆",
    [GAME_PHASE.DEFEAT]: "💀",
  };
  return icons[phase] || "❓";
}

export function isValidTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  return allowed && allowed.includes(to);
}

// ── 遊戲階段重置輔助 ────────────────────────────────────
export function resetToLobby(state) {
  return transitionPhase(
    { ...createInitialGameState(), events: state.events },
    GAME_PHASE.LOBBY,
  );
}
