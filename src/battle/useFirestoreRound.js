// src/battle/useFirestoreRound.js
// 統一 Firestore 回合生命週期 hook
// 處理 PartyBattleRoom / DuelRoom / DungeonBattleRoom 三模式的共通模式：
// 1. Firestore 訂閱
// 2. 提交箭分
// 3. 房主偵測全員 ready → 處理回合
// 4. Processing guard（避免重複結算）
//
// Log animation detection 完全留在 component 中處理，
// 因為各模式的動畫邏輯差異太大無法抽象。

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useFirestoreRound — 統一 Firestore 回合生命週期 hook
 *
 * @param {Object} options
 * @param {string} options.roomId
 * @param {string} options.myId
 * @param {boolean} options.isHost
 *
 * // DB 操作（模式專屬）
 * @param {(roomId: string, cb: (room: any) => void) => () => void} options.subscribe
 *   訂閱函數，例如 subscribePartyRoom
 * @param {(roomId: string, id: string, ...args: any[]) => Promise<any>} options.submit
 *   提交函數，extra args 透過 handleSubmit(args) 傳入
 * @param {(roomId: string, room: any, ...args: any[]) => Promise<any>} options.processRound
 *   回合處理函數，extra args 透過 getExtraProcessArgs 傳入
 *
 * // 資料存取器（模式專屬）
 * @param {(room: any) => Array<{id:string, alive:boolean, ready:boolean}>} options.getMembers
 * @param {(room: any) => boolean} options.isProcessing
 * @param {(room: any) => number} options.getRound
 *
 * // Extra process args（用 ref 避免 stale closure）
 * @param {() => any[]} [options.getExtraProcessArgs]
 *
 * // 可選：Bot 支援（DuelRoom）
 * @param {(room: any) => Array<{id:string, team:string, m:any}>} [options.getBotsUnready]
 * @param {(roomId: string, team: string, botId: string, m: any) => Promise<any>} [options.submitBotArrows]
 *
 * // 回呼（用 ref 存放，避免 stale closure）
 * @param {() => void} [options.onBeforeSubmit]
 * @param {(reason: string) => void} [options.onSubmitError]
 *
 * // 設定
 * @param {number} [options.processDelayMs]   處理回合前延遲（Dungeon 用 1000ms）
 * @param {number} [options.maxRetries]   最大重試次數（預設 5）
 * @param {(room: any) => boolean} [options.canProcess]   額外處理條件（DuelRoom 需要兩隊都有存活）
 *
 * @returns {{
 *   room: any,
 *   setRoom: (r: any) => void,
 *   submitted: boolean,
 *   setSubmitted: (v: boolean) => void,   * handleSubmit: (...extraArgs: any[]) => Promise<boolean>, // true=成功 false=失敗
 *   localProcessing: boolean,
 * }}
 */
export function useFirestoreRound({
  roomId, myId,
  subscribe, submit, processRound,
  getMembers, isProcessing, getRound,
  getExtraProcessArgs,
  getBotsUnready, submitBotArrows,
  onBeforeSubmit, onSubmitError,
  onSubmitSuccess,
  processDelayMs = 0,
  maxRetries = 5,
  canProcess,
}) {
  // ── State ────────────────────────────────────────────────
  const [room, setRoom] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [localProcessing, setLocalProcessing] = useState(false);

  // ── Refs（避免 stale closure）───────────────────────────
  const guardRef = useRef(0);       // 已處理的回合號
  const retryCountRef = useRef(0);  // 連續失敗次數
  const retryRoundRef = useRef(0);  // retryCount 所屬回合

  const onBeforeSubmitRef = useRef(onBeforeSubmit);
  onBeforeSubmitRef.current = onBeforeSubmit;
  const onSubmitErrorRef = useRef(onSubmitError);
  onSubmitErrorRef.current = onSubmitError;
  const onSubmitSuccessRef = useRef(onSubmitSuccess);
  onSubmitSuccessRef.current = onSubmitSuccess;
  const getExtraProcessArgsRef = useRef(getExtraProcessArgs);
  getExtraProcessArgsRef.current = getExtraProcessArgs;
  const getBotsUnreadyRef = useRef(getBotsUnready);
  getBotsUnreadyRef.current = getBotsUnready;
  const submitBotArrowsRef = useRef(submitBotArrows);
  submitBotArrowsRef.current = submitBotArrows;
  const canProcessRef = useRef(canProcess);
  canProcessRef.current = canProcess;

  // ── 1. Subscribe ─────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    return subscribe(roomId, r => setRoom(r));
  }, [roomId]); // eslint-disable-line

  // ── 2. Submit ────────────────────────────────────────────
  const handleSubmit = useCallback(async (...extraArgs) => {
    if (localProcessing || submitted) return false;
    onBeforeSubmitRef.current?.();
    setLocalProcessing(true);
    try {
      const res = await submit(roomId, myId, ...extraArgs);
      if (res?.ok === false) {
        onSubmitErrorRef.current?.(res.reason || "送出失敗");
        return false;
      }
      setSubmitted(true);
      onSubmitSuccessRef.current?.(...extraArgs);
      return true;
    } catch (e) {
      onSubmitErrorRef.current?.(e.message);
      return false;
    } finally {
      setLocalProcessing(false);
    }
  }, [roomId, myId, submitted, localProcessing]); // eslint-disable-line

  // ── 3. Host: detect all-ready → process ──────────────────
  useEffect(() => {
    if (!room || room.hostId !== myId || room.status !== "active") return;

    const currentRound = getRound(room);
    if (guardRef.current === currentRound) return;

    if (currentRound !== retryRoundRef.current) {
      retryRoundRef.current = currentRound;
      retryCountRef.current = 0;
    }

    if (isProcessing(room)) return;

    const members = getMembers(room);
    const alive = members.filter(m => m.alive);
    if (alive.length === 0) return;

    if (retryCountRef.current >= maxRetries) return;

    if (canProcessRef.current && !canProcessRef.current(room)) return;

    // Bot handling（DuelRoom）
    const bots = getBotsUnreadyRef.current?.(room);
    if (bots?.length > 0) {
      bots.forEach(({ id, team, m }) => {
        submitBotArrowsRef.current?.(roomId, team, id, m).catch(() => {});
      });
      return;
    }

    if (!alive.every(m => m.ready)) return;

    guardRef.current = currentRound;

    const doProcess = async () => {
      try {
        const extraArgs = getExtraProcessArgsRef.current?.() || [];
        const res = await processRound(roomId, room, ...extraArgs);
        if (res?.ok) retryCountRef.current = 0;
        else { guardRef.current = 0; retryCountRef.current++; }
      } catch (e) {
        guardRef.current = 0; retryCountRef.current++;
      }
    };

    if (processDelayMs > 0) {
      const t = setTimeout(doProcess, processDelayMs);
      return () => clearTimeout(t);
    }
    doProcess();
  }, [room]); // eslint-disable-line

  return {
    room,
    setRoom,
    submitted,
    setSubmitted,
    handleSubmit,
    localProcessing,
  };
}
