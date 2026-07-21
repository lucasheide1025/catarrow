// src/zombie/domain/zombieSound.js
// ═══════════════════════════════════════════════════════════════
//  🔊 殭屍生存 — 音效引擎
//  包裝專案現有 src/lib/sound.js，將遊戲事件對應到音效
// ═══════════════════════════════════════════════════════════════

import {
  unlockAudio,
  sfxTap,
  sfxSwitch,
  sfxNotify,
  sfxOpen,
  sfxClose,
  sfxError,
  sfxArrowShoot,
  sfxArrowHit,
  sfxCritBoom,
  sfxSoftFail,
  sfxSuccess,
  sfxRoundEnd,
  sfxLevelUp,
  sfxCoinDrop,
  sfxBattleIntro,
  sfxMonsterDead,
  sfxCounter,
  sfxVictory,
  sfxDefeat,
  sfxZombieRoar,
} from "../../lib/sound";

// ── 音量倍率控制 ─────────────────────────────────────────
const VOLUME = {
  ui: 0.5,       // UI 按鈕/選單
  feedback: 0.6, // 操作回饋（就緒/選擇）
  combat: 0.8,   // 戰鬥音效
  ambient: 0.3,  // 背景/氛圍
  alert: 0.7,    // 警告音
  victory: 0.9,  // 勝利
};

// ── 遊戲事件 → 音效對照 ─────────────────────────────────
const EVENT_SOUND_MAP = {
  // ── 大廳事件 ────────────────────────────────────────
  "lobby:player_join":      () => { sfxOpen(); sfxNotify(); },
  "lobby:player_leave":     () => sfxClose(),
  "lobby:ready_toggle":     () => sfxSwitch(),
  "lobby:all_ready":        () => sfxSuccess(),
  "lobby:zone_select":      () => sfxTap(),
  "lobby:danger_select":    () => { sfxTap(); sfxZombieRoar(); },
  "lobby:start_mission":    () => { sfxBattleIntro(); },

  // ── 探索事件 ────────────────────────────────────────
  "explore:node_move":      () => sfxTap(),
  "explore:item_found":     () => { sfxCoinDrop(); sfxLevelUp(); },
  "explore:combat_trigger": () => sfxBattleIntro(),
  "explore:extract_found":  () => sfxSuccess(),

  // ── 戰鬥事件 ────────────────────────────────────────
  "combat:shoot":           () => sfxArrowShoot(),
  "combat:hit":             () => sfxArrowHit(),
  "combat:crit":            () => sfxCritBoom(),
  "combat:miss":            () => sfxSoftFail(),
  "combat:kill":            () => { sfxMonsterDead(); sfxCoinDrop(); },
  "combat:zombie_hit":      () => sfxCounter(),
  "combat:zombie_roar":     () => sfxZombieRoar(),
  "combat:round_end":       () => sfxRoundEnd(),

  // ── 結果事件 ────────────────────────────────────────
  "result:victory":         () => sfxVictory(),
  "result:defeat":          () => sfxDefeat(),
  "result:continue":        () => sfxSuccess(),

  // ── 基地事件 ────────────────────────────────────────
  "base:upgrade":           () => sfxLevelUp(),
  "base:error":             () => sfxError(),

  // ── 系統事件 ────────────────────────────────────────
  "system:error":           () => sfxError(),
  "system:notification":    () => sfxNotify(),
  "system:complete":        () => sfxSuccess(),
};

// ── 播放遊戲音效 ─────────────────────────────────────────
export function playZombieSound(eventType, options = {}) {
  const soundFn = EVENT_SOUND_MAP[eventType];
  if (soundFn) {
    try { soundFn(); } catch {}
  }
}

// ── 解鎖音頻（在首次使用者互動時呼叫） ──────────────────
export function initZombieAudio() {
  try { unlockAudio(); } catch {}
}

// ── 單一音效快捷 ─────────────────────────────────────────
export { sfxTap, sfxSwitch, sfxNotify, sfxError, sfxLevelUp, sfxCoinDrop };

// ── 回合結果音效（根據情境播放） ─────────────────────────
export function playRoundResultSound(isSuccess, isLastRound = false) {
  if (isLastRound) {
    isSuccess ? sfxVictory() : sfxDefeat();
  } else {
    sfxRoundEnd();
    if (isSuccess) sfxSuccess();
  }
}
