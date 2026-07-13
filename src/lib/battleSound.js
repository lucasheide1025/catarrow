// src/lib/battleSound.js
// 統一戰鬥音效管理器
// debug 模式 → console.log 預覽
// live 模式  → 播放真實音效（呼叫 sound.js 的 sfx* 函式）
//
// ✅ localStorage 持久化：重整後自動恢復上次選擇的模式
// ✅ 支援 initBattleSound() 在 App 啟動時呼叫初始化
// ✅ 支援 createBattleSoundInstance() 為多戰鬥實例隔離

import {
  sfxBattleIntro, sfxArrowShoot,
  sfxArrowHit, sfxCritBoom,
  sfxCast, sfxBuff, sfxDebuff,
  sfxCounter, sfxCounterCrit,
  sfxVictoryFanfare, sfxSuccess, sfxDefeat,
  sfxMonsterDead, sfxSoftFail,
} from "./sound";

// ── 全域預設實例 ────────────────────────────────────

const LS_KEY = "buff_battle_sound_mode";
const PREFIX = "🔊 [SOUND]";

let _mode = "live";
let _initialized = false;

/**
 * 初始化音效模式（從 localStorage 讀取，僅執行一次）
 * 建議在 App 啟動時（如 index.js 或 App.jsx）呼叫
 */
export function initBattleSound() {
  if (_initialized) return;
  _initialized = true;
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === "live" || saved === "debug") {
      _mode = saved;
      console.log(`${PREFIX} 從 localStorage 恢復模式：${_mode === "debug" ? "🔧 除錯" : "🎵 播放"}`);
    }
  } catch { /* localStorage 不可用時忽略 */ }
}

export function setBattleSoundMode(mode) {
  if (mode !== "debug" && mode !== "live") return;
  _mode = mode;
  // 持久化到 localStorage
  try { localStorage.setItem(LS_KEY, mode); } catch {}
}
export function getBattleSoundMode() {
  return _mode;
}

export function toggleBattleSoundMode() {
  const next = _mode === "debug" ? "live" : "debug";
  setBattleSoundMode(next);
  console.log(`${PREFIX} 切換為 ${next === "debug" ? "🔧 除錯模式" : "🎵 播放模式"}`);
}

// ── 實例工廠（支援多戰鬥實例隔離） ──────────────────

export function createBattleSoundInstance(initialMode) {
  let _instMode = initialMode || "debug";

  function play(soundId, ctx = {}) {
    const def = SOUND_DEFS[soundId];
    if (!def) {
      if (_instMode === "debug") console.warn(`${PREFIX} [未知音效] ${soundId}`);
      return;
    }
    if (_instMode === "debug") {
      console.log(`${PREFIX} ${soundId}: ${def.debugMsg(ctx)}`);
    } else if (_instMode === "live") {
      def.livePlay?.(ctx);
    }
  }

  function setMode(mode) {
    if (mode === "debug" || mode === "live") _instMode = mode;
  }

  function getMode() { return _instMode; }

  function toggle() {
    _instMode = _instMode === "debug" ? "live" : "debug";
  }

  return {
    playBattleSound: play,
    setBattleSoundMode: setMode,
    getBattleSoundMode: getMode,
    toggleBattleSoundMode: toggle,
  };
}

// ── 音效定義 ────────────────────────────────────────

const SOUND_DEFS = {
  cat_intro: {
    label: "貓貓進場",
    debugMsg: (ctx) => `${ctx.catName}（${ctx.typeLabel}）— ${ctx.typeIcon} 進場特效 + 喵叫聲`,
    livePlay: () => sfxBattleIntro(),
  },
  cat_type_sound: {
    label: "貓貓類型音",
    debugMsg: (ctx) => {
      const map = { heal:"輕柔喵聲💚", atk:"尖銳戰吼⚡", def:"低沉威嚇🛡️" };
      return `播放 ${map[ctx.skillGroup] || map.heal}`;
    },
    livePlay: (ctx) => {
      // 依類型播放不同感覺的音效
      const m = { heal: sfxBuff, atk: sfxCast, def: sfxDebuff };
      (m[ctx.skillGroup] || sfxBuff)();
    },
  },
  arrow_flight: {
    label: "箭矢飛行",
    debugMsg: (ctx) => {
      const hint = ctx.battleMode === "zombie" ? "近距離穿透💨" : "破風疾馳🏹";
      return `第${ctx.arrowIdx}箭 飛向${ctx.monsterName} — ${hint}`;
    },
    livePlay: () => sfxArrowShoot(),
  },
  arrow_hit: {
    label: "箭矢命中",
    debugMsg: (ctx) => `第${ctx.arrowIdx}箭 ${ctx.score} → ${ctx.dmg}傷害${ctx.isCrit ? ' 💥爆擊' : ''}`,
    livePlay: (ctx) => {
      if (ctx.isCrit) sfxCritBoom();
      else sfxArrowHit();
    },
  },
  cat_attack: {
    label: "貓貓協戰",
    debugMsg: (ctx) => {
      const m = { heal:"治癒光環💚", atk:"利爪破空⚡", def:"盾牌衝擊🛡️" };
      return `${ctx.catName} 協戰攻擊！${ctx.particle} ${m[ctx.skillGroup] || m.heal}`;
    },
    livePlay: (ctx) => {
      // 依技能類型播放不同聽感
      const typeMap = { heal: sfxBuff, atk: sfxCast, def: sfxDebuff };
      (typeMap[ctx.skillGroup] || sfxCast)();
    },
  },
  monster_counter: {
    label: "怪物反擊",
    debugMsg: (ctx) => {
      const s = ctx.counterDmg > 100 ? "沉重轟擊💥" : "利爪揮擊🔪";
      return `${ctx.monsterName} 反擊！造成 ${ctx.counterDmg} 傷害 — ${s}`;
    },
    livePlay: (ctx) => {
      if (ctx.counterDmg > 100) sfxCounterCrit();
      else sfxCounter();
    },
  },
  victory_fanfare: {
    label: "凱旋號角",
    debugMsg: (ctx) => `${ctx.monsterName} 被擊倒！回合 ${ctx.round} 總傷 ${ctx.roundDmg} — 凱旋號角🎺`,
    livePlay: () => sfxVictoryFanfare(),
  },
  victory_cheer: {
    label: "勝利歡呼",
    debugMsg: () => "播放勝利歡呼聲！🎉",
    livePlay: () => sfxSuccess(),
  },
  defeat_sigh: {
    label: "敗北嘆息",
    debugMsg: (ctx) => `${ctx.monsterName} 擊倒了 ${ctx.playerName} — 在第 ${ctx.round} 回合 — 沉重嘆息😔`,
    livePlay: () => sfxDefeat(),
  },
  battle_intro: {
    label: "戰鬥進場",
    debugMsg: (ctx) => `${ctx.monsterName || "怪物"} VS ${ctx.playerName || "射手"} — 戰鬥進場⚔️`,
    livePlay: () => sfxBattleIntro(),
  },
  monster_death: {
    label: "怪物死亡",
    debugMsg: (ctx) => `${ctx.monsterName} 被擊殺 — 死亡效果💀`,
    livePlay: () => sfxMonsterDead(),
  },
  soft_fail: {
    label: "失敗音效",
    debugMsg: (ctx) => `${ctx.monsterName} 擊敗了玩家 — 失敗音效😵`,
    livePlay: () => sfxSoftFail(),
  },
};

export function playBattleSound(soundId, ctx = {}) {
  const def = SOUND_DEFS[soundId];
  if (!def) {
    if (_mode === "debug") console.warn(`${PREFIX} [未知音效] ${soundId}`);
    return;
  }
  if (_mode === "debug") {
    console.log(`${PREFIX} ${soundId}: ${def.debugMsg(ctx)}`);
  } else if (_mode === "live") {
    def.livePlay?.(ctx);
  }
}

export const SOUND_IDS = Object.keys(SOUND_DEFS);
