// src/battle/RoundController.js
// 通用回合動畫控制器 — 封裝「事件 → 動畫/音效/log」的播放順序
//
// 設計原則：
//   - 只處理展示層（動畫、音效、log）— 透過 EVENT_DISPATCH 間接呼叫 playXxx
//   - 狀態更新透過 per-event-type handlers 回呼到元件
//   - 計時管理：箭矢事件 1500ms 延遲，其他事件 0ms
//   - BATTLE_WIN / BATTLE_LOSE 自動中斷後續事件播放
//   - RANDOM_EVENT 清理透過 onRandomEventEnd 回呼

import { EventType } from './BattleEvents';
import { EVENT_DISPATCH } from './BattleAnimation';

// ── 事件延遲映射 ──────────────────────────────────────────
// 箭矢事件：每箭之間 1500ms 展示間隔
// 反擊/流程/貓貓事件：內部已有 await delay，外部不需要額外延遲

const EVT_DELAY_MS = {
  [EventType.ARROW_HIT]: 1500,
  [EventType.ARROW_CRIT]: 1500,
  [EventType.ARROW_ORGAN_HIT]: 1500,
  [EventType.ARROW_MISS]: 1500,
  [EventType.ARROW_THROW_POTION]: 1500,
};

const DEFAULT_DELAY_MS = 1500;

function getDelayMs(type, customDelays) {
  // 優先：自訂延遲映射（用於 WorldBoss 600ms 箭矢延遲等）
  if (type in customDelays) return customDelays[type];
  // 其次：預設事件延遲映射
  if (type in EVT_DELAY_MS) return EVT_DELAY_MS[type];
  // ARROW_ 前綴的事件使用預設延遲
  if (type.startsWith('arrow_')) return DEFAULT_DELAY_MS;
  return 0;
}

function isBattleEndType(type) {
  return type === EventType.BATTLE_WIN || type === EventType.BATTLE_LOSE;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * RoundController — 通用回合動畫控制器
 *
 * 使用方式：
 *   const controller = new RoundController(dispatch);
 *   const { battleEnded, battleResult } = await controller.playEvents(events, eventCtx, handlers);
 *
 * @param {object} dispatch — createDispatch 建立的派遣物件
 */
export class RoundController {
  constructor(dispatch, options = {}) {
    this.dispatch = dispatch;
    this.customDelays = options.customDelays || {};
  }

  /**
   * 播放事件序列
   *
   * @param {Array} events — 事件陣列（來自 BattleEngine）
   * @param {object} eventCtx — { monster, catName, ... } 提供 playXxx context
   * @param {object} [handlers] — 事件處理器
   * @param {Function} [handlers.onRandomEventEnd] — RANDOM_EVENT 結束回呼 (清除 currentEvent)
   * @param {Function} [handlers.onBattleEnd] — 戰鬥結束回呼 (type, payload)
   * @param {Object<string, Function>} [handlers.*] — 依 EventType 的狀態更新函數 (payload) => void
   * @returns {{ battleEnded: boolean, battleResult: string|null }}
   *   battleResult: EventType.BATTLE_WIN | EventType.BATTLE_LOSE | null
   */
  async playEvents(events, eventCtx, handlers = {}) {
    let battleEnded = false;
    let battleResult = null;

    for (const evt of events) {
      const { type, payload } = evt;
      const animHandler = EVENT_DISPATCH[type];

      // 1. 動畫/音效/log（playXxx 函數）
      if (animHandler) await animHandler(this.dispatch, payload, eventCtx);

      // 2. 狀態更新（元件提供的 per-event-type handler）
      const stateHandler = handlers[type];
      if (stateHandler) stateHandler(payload, eventCtx);

      // 3. 事件間延遲（支援自訂延遲）
      const delayMs = getDelayMs(type, this.customDelays);
      if (delayMs > 0) await delay(delayMs);

      // 4. RANDOM_EVENT 後置清理（await 暫停後續事件，等玩家確認彈窗）
      if (type === EventType.RANDOM_EVENT) {
        await handlers.onRandomEventEnd?.();
      }

      // 5. 戰鬥結束偵測 — 中斷後續事件
      if (isBattleEndType(type)) {
        battleEnded = true;
        battleResult = type;
        handlers.onBattleEnd?.(type, payload);
        break;
      }
    }

    return { battleEnded, battleResult };
  }
}
