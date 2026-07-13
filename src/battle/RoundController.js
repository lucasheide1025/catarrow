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

const EVT_DELAY_MS = {
  [EventType.ARROW_HIT]: 1500,
  [EventType.ARROW_CRIT]: 1500,
  [EventType.ARROW_ORGAN_HIT]: 1500,
  [EventType.ARROW_MISS]: 1500,
  [EventType.ARROW_THROW_POTION]: 1500,
};

const DEFAULT_DELAY_MS = 1500;

function getDelayMs(type, customDelays) {
  if (type in customDelays) return customDelays[type];
  if (type in EVT_DELAY_MS) return EVT_DELAY_MS[type];
  if (type.startsWith('arrow_')) return DEFAULT_DELAY_MS;
  return 0;
}

function isBattleEndType(type) {
  return type === EventType.BATTLE_WIN || type === EventType.BATTLE_LOSE;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export class RoundController {
  constructor(dispatch, options = {}) {
    this.dispatch = dispatch;
    this.customDelays = options.customDelays || {};
  }

  async playEvents(events, eventCtx, handlers = {}) {
    let battleEnded = false;
    let battleResult = null;

    for (const evt of events) {
      const { type, payload } = evt;
      const animHandler = EVENT_DISPATCH[type];
      if (animHandler) await animHandler(this.dispatch, payload, eventCtx);

      const stateHandler = handlers[type];
      if (stateHandler) stateHandler(payload, eventCtx);

      const delayMs = getDelayMs(type, this.customDelays);
      if (delayMs > 0) await delay(delayMs);

      if (type === EventType.RANDOM_EVENT) {
        await handlers.onRandomEventEnd?.();
      }

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
