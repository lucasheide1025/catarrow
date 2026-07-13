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
  confirmDelayMs = 0,   // 全員 ready 後的確認倒數（ms）
  maxRetries = 5,
  canProcess,
}) {
  // ── State ────────────────────────────────────────────────
  const [room, setRoom] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [localProcessing, setLocalProcessing] = useState(false);
  const [allReady, setAllReady] = useState(false);
  const [readyCountdown, setReadyCountdown] = useState(0);
  const roomRef = useRef(room);
  roomRef.current = room;

  // ── Refs（避免 stale closure）───────────────────────────
  const guardRef = useRef(0);       // 已處理的回合號
  const retryCountRef = useRef(0);  // 連續失敗次數
  const retryRoundRef = useRef(0);  // retryCount 所屬回合
  const confirmNowRef = useRef(null); // { timer, interval, doProcess, processDelayMs }

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
  const processRoundRef = useRef(processRound);
  processRoundRef.current = processRound;
  const getMembersRef = useRef(getMembers);
  getMembersRef.current = getMembers;
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  // ── 1. Subscribe ─────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    return subscribe(roomId, r => setRoom(r));
  }, [roomId]); // eslint-disable-line

  // 回合結算後後端會把每位成員的 ready 清回 false。房主有時會先收到
  // processing/log 更新、稍後才收到 round 更新；直接監看自己的 ready 才能
  // 保證下一輪不會殘留「已送出」鎖定狀態。
  // 注意：當 round 結算後 status 同時變成 "resolving" 時，不能擋掉此重置。
  useEffect(() => {
    if (!room) return;
    const me = getMembersRef.current(room).find(member => member.id === myId);
    if (me && !me.ready) {
      setSubmitted(false);
      setLocalProcessing(false);
    }
  }, [room?.status, room?.members?.[myId]?.ready, myId]);

  // 同回合的房間快照更新不能取消已開始的房主確認倒數；僅在卸載時統一清除。
  useEffect(() => () => {
    const pending = confirmNowRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    clearInterval(pending.interval);
    confirmNowRef.current = null;
  }, []);

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
  // Non-host clients also render the shared countdown and can recover a
  // round when the host refreshed. processRound is still protected by its
  // Firestore processing guard, so only one client resolves the round.
  useEffect(() => {
    if (!room || room.status !== "active" || isProcessing(room) || room.hostId === myId) return;
    const alive = getMembers(room).filter(member => member.alive);
    if (!alive.length || !alive.every(member => member.ready)) return;
    setAllReady(true);
    setReadyCountdown(Math.round(confirmDelayMs / 1000));
    const interval = setInterval(() => setReadyCountdown(prev => Math.max(0, prev - 1)), 1000);
    const timer = setTimeout(async () => {
      clearInterval(interval);
      const latestRoom = roomRef.current;
      if (!latestRoom || latestRoom.status !== "active" || isProcessingRef.current(latestRoom)) return;
      const latestAlive = getMembersRef.current(latestRoom).filter(member => member.alive);
      if (!latestAlive.length || !latestAlive.every(member => member.ready)) return;
      const extraArgs = getExtraProcessArgsRef.current?.() || [];
      await processRoundRef.current(roomId, latestRoom, ...extraArgs).catch(() => {});
    }, confirmDelayMs);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [room, myId, roomId, confirmDelayMs]); // eslint-disable-line

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

    if (confirmDelayMs > 0) {
      setAllReady(true);
      setReadyCountdown(Math.round(confirmDelayMs / 1000));

      const countdownInterval = setInterval(() => {
        setReadyCountdown(prev => Math.max(0, prev - 1));
      }, 1000);

      const t = setTimeout(() => {
        clearInterval(countdownInterval);
        confirmNowRef.current = null;
        setAllReady(false);
        setReadyCountdown(0);
        if (processDelayMs > 0) {
          setTimeout(doProcess, processDelayMs);
        } else {
          doProcess();
        }
      }, confirmDelayMs);

      confirmNowRef.current = { timer: t, interval: countdownInterval, doProcess, processDelayMs, round: currentRound };

      return () => {
        // 同回合有隊員資料更新時 effect 會重跑；倒數需繼續，而非被清掉後卡住。
      };
    }

    if (processDelayMs > 0) {
      const t = setTimeout(doProcess, processDelayMs);
      return () => clearTimeout(t);
    }
    doProcess();
  }, [room]); // eslint-disable-line

  // ── confirmNow：房主手動提前觸發 ──────────────────────────
  const confirmNow = useCallback(() => {
    if (!confirmNowRef.current) {
      // A browser refresh clears the five-second local timer while Firestore
      // still has every member marked ready.  Let the host resume that exact
      // pending round instead of leaving the room permanently stuck.
      const latestRoom = roomRef.current;
      if (!latestRoom || latestRoom.status !== "active" || isProcessingRef.current(latestRoom)) return;
      const alive = getMembersRef.current(latestRoom).filter(member => member.alive);
      if (!alive.length || !alive.every(member => member.ready)) return;
      const currentRound = getRound(latestRoom);
      guardRef.current = currentRound;
      const extraArgs = getExtraProcessArgsRef.current?.() || [];
      processRoundRef.current(roomId, latestRoom, ...extraArgs).then(res => {
        if (!res?.ok) guardRef.current = 0;
      }).catch(() => { guardRef.current = 0; });
      return;
    }
    const { timer, interval, doProcess, processDelayMs: pDelay } = confirmNowRef.current;
    clearTimeout(timer);
    clearInterval(interval);
    confirmNowRef.current = null;
    setAllReady(false);
    setReadyCountdown(0);
    if (pDelay > 0) {
      setTimeout(doProcess, pDelay);
    } else {
      doProcess();
    }
  }, []);

  return {
    room,
    setRoom,
    submitted,
    setSubmitted,
    handleSubmit,
    localProcessing,
    allReady,
    readyCountdown,
    confirmNow,
  };
}
