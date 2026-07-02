// src/battle/useBattleRound.js
// React Hook 封裝 RoundController — 通用回合動畫控制器
//
// 使用方式：
//   const { controller, playEvents, isPlaying } = useBattleRound(dispatch);
//   const { battleEnded, battleResult } = await playEvents(events, eventCtx, handlers);
//
// 若使用 Firestore 模式，可傳入 room 自動監測 log 變化：
//   const { latestEvents } = useBattleRound(dispatch, { room });
//   // room.log 變化時自動提取新事件

import { useRef, useState, useCallback } from 'react';
import { RoundController } from './RoundController';

/**
 * useBattleRound — React Hook 封裝回合動畫控制器
 * @param {object} dispatch — createDispatch 建立的派遣物件
 * @param {object} [options]
 * @param {object} [options.room] — 若提供，自動監測 room.log 長度變化
 * @param {(room: any) => Array} [options.extractEvents] — 從 room 中提取事件陣列
 * @returns {{
 *   controller: RoundController,
 *   playEvents: (events, eventCtx, handlers?) => Promise<{battleEnded, battleResult}>,
 *   isPlaying: boolean,
 *   latestEvents: Array|null,
 * }}
 */
export function useBattleRound(dispatch, options = {}) {
  const { room, extractEvents } = options;

  // ── RoundController（首次渲染建立）─────────────────────
  const controllerRef = useRef(null);
  if (!controllerRef.current) {
    controllerRef.current = new RoundController(dispatch);
  }

  // ── State ────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [latestEvents, setLatestEvents] = useState(null);
  const prevLogLenRef = useRef(room?.log?.length || 0);

  // ── playEvents ──────────────────────────────────────────
  const playEvents = useCallback(async (events, eventCtx, handlers) => {
    setIsPlaying(true);
    try {
      setLatestEvents(events);
      return await controllerRef.current.playEvents(events, eventCtx, handlers);
    } finally {
      setIsPlaying(false);
    }
  }, []);

  // ── Optional: room.log monitoring ───────────────────────
  // 僅當提供 room 與 extractEvents 時啟用
  // 此監測保留給 Firestore 模式使用（Phase 6+）
  // useEffect(() => {
  //   if (!room || !extractEvents) return;
  //   const logLen = room.log?.length || 0;
  //   if (logLen <= prevLogLenRef.current) { prevLogLenRef.current = logLen; return; }
  //   prevLogLenRef.current = logLen;
  //   const events = extractEvents(room, logLen);
  //   if (events?.length) playEvents(events, {});
  // }, [room, extractEvents, playEvents]);

  return {
    controller: controllerRef.current,
    playEvents,
    isPlaying,
    latestEvents,
  };
}
