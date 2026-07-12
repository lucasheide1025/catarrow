// src/battle/useMiniRoundReveal.js
// 通用 mini-round 動畫控制器 hook — PartyBattleRoom / DungeonBattleRoom 共用
//
// 管理 mini-round 的 setTimeout 鏈（攻擊 1.4s、反擊 2.7s、清理 1.5s）
// 自動清理上一輪計時器，支援 key-based 去重。
//
// 使用方式：
//   const reveal = useMiniRoundReveal();
//
//   useEffect(() => {
//     const entry = room.log?.at(-1);
//     if (!entry) return;
//     reveal.startReveal(entry, {
//       key: `${room.round}-${entry.round}`,
//       members: room.members,
//       onMiniTick: () => { sfxArrowShoot(); vibrate(8); triggerCatAction(); },
//       onCounterHit: (mini) => { sfxCounter(); vibrate([0,35,55,30]); },
//       onEntryEnd: (entry) => { if (monsterKilled) showKillAnim(); },
//     });
//     return () => reveal.stopReveal();
//   }, [room?.log?.length]);

import { useState, useRef, useCallback } from "react";

export function useMiniRoundReveal() {
  const [liveEntry, setLiveEntry] = useState(null);
  const [liveMiniIdx, setLiveMiniIdx] = useState(0);
  const [animHit, setAnimHit] = useState(false);
  const [animMonsterCharge, setAnimMonsterCharge] = useState(false);
  const [animScreenShake, setAnimScreenShake] = useState(false);
  const [floatCounterDmgs, setFloatCounterDmgs] = useState([]);
  const [localHpOverride, setLocalHpOverride] = useState({});
  const [floatDmg, setFloatDmg] = useState(null);
  const [attackingIds, setAttackingIds] = useState(new Set());
  const [animCounter, setAnimCounter] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  // 目前動畫相位："player"|"cat"|"counter"|null
  const [animPhase, setAnimPhase] = useState(null);

  const timers = useRef([]);
  const activeRef = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach(t => clearTimeout(t));
    timers.current = [];
  }, []);

  const stopReveal = useCallback(() => {
    clearTimers();
    setLiveEntry(null);
    setLiveMiniIdx(0);
    setAnimHit(false);
    setAnimMonsterCharge(false);
    setAnimScreenShake(false);
    setFloatCounterDmgs([]);
    setLocalHpOverride({});
    setFloatDmg(null);
    setAttackingIds(new Set());
    setAnimCounter(false);
    setIsRevealing(false);
    setAnimPhase(null);
    activeRef.current = false;
  }, [clearTimers]);

  /**
   * startReveal — 啟動 mini-round 動畫計時器鏈
   *
   * @param {object} entry — log entry { miniRounds, ... }
   * @param {object} opts
   * @param {string} [opts.key] — 去重 key，相同 key 不重複播放
   * @param {number} [opts.attackDelay=1400] — 每攻擊 round 延遲
   * @param {number} [opts.counterDelay=2700] — 每反擊 round 延遲
   * @param {number} [opts.entryEndExtra=1500] — 結束後額外延遲
   * @param {object} [opts.members={}] — room.members（用於 HP lock）
   * @param {function} [opts.onMiniTick] — (mini, idx) => 每個 mini-round 開始時
   * @param {function} [opts.onCounterHit] — (mini, idx) => 反擊命中時
   * @param {function} [opts.onEntryEnd] — (entry) => 全部播放完時
   */
  const startReveal = useCallback((entry, opts = {}) => {
    if (!entry) return;

    const {
      key,
      attackDelay = 1400,
      counterDelay = 2700,
      entryEndExtra = 1500,
      initialDelay = 0,   // 第一個 mini 前的預備時間（可用於顯示「玩家回合」標題）
      members = {},
      onMiniTick,
      onCounterHit,
      onEntryEnd,
    } = opts;

    // 用 ref 記錄 key 避免重複啟動（同 key 不重播）
    if (key && timers.current.key === key) return;
    if (key) timers.current.key = key;

    // 無條件中止前一輪（新回合到來時直接開始，不等上一輪跑完）
    activeRef.current = false;
    clearTimers();
    activeRef.current = true;

    // 重置所有動畫狀態（避免前一輪中途狀態殘留）
    setLocalHpOverride({});
    setFloatDmg(null);
    setAttackingIds(new Set());
    setAnimCounter(false);
    setAnimHit(false);
    setAnimMonsterCharge(false);
    setAnimScreenShake(false);
    setFloatCounterDmgs([]);
    setLiveEntry(entry);
    setLiveMiniIdx(0);
    setAnimPhase(initialDelay > 0 ? "player" : null);

    // 在第一個 mini 開始前 500ms 切到 "bannerFadeOut"，讓 banner 先淡出再攻擊
    if (initialDelay > 500) {
      const tFade = setTimeout(() => {
        if (!activeRef.current) return;
        setAnimPhase("bannerFadeOut");
      }, initialDelay - 500);
      timers.current.push(tFade);
    }

    const minis = entry.miniRounds || [];
    // initialDelay 之後才開始第一個 mini-round
    let curDelay = initialDelay;

    minis.forEach((mini, idx) => {
      // 固定捕獲此次 forEach 的 delay 值（避免閉包抓到最終值的問題）
      const fireAt = curDelay;

      const t = setTimeout(() => {
        setLiveMiniIdx(idx);
        // 更新相位標籤
        // ⚠️ 玩家攻擊用 "attacking"（非 "player"），"player" 僅在 initialDelay 期間顯示 banner
        if (mini.isCounter)    setAnimPhase("counter");
        else if (mini.isCat)   setAnimPhase("cat");
        else                   setAnimPhase("attacking");

        onMiniTick?.(mini, idx);

        if (mini.isCounter) {
          const ctrLog = mini.playerLog || [];
          // 反擊前鎖 HP
          const tLock = setTimeout(() => {
            setLocalHpOverride(prev => {
              const next = { ...prev };
              ctrLog.forEach(p => {
                const mem = members[p.id];
                if (mem) next[p.id] = Math.min(mem.maxHP || 9999, (mem.hp || 0) + (p.ctr || 0));
              });
              return next;
            });
          }, 0);
          timers.current.push(tLock);

          // 怪物蓄力（600ms）
          const tCharge = setTimeout(() => setAnimMonsterCharge(true), 600);
          timers.current.push(tCharge);

          // 反擊命中（1400ms 後，相對於本 mini 開始時）
          // ⚠️ 必須用固定值 1400，不能用 curDelay（curDelay 在 forEach 結束後已是最終值）
          const tHit = setTimeout(() => {
            setAnimMonsterCharge(false);
            setAnimScreenShake(true);
            setAnimCounter(true);
            setLocalHpOverride({});

            const floats = ctrLog
              .filter(p => p.ctr > 0)
              .map(p => ({ id: Date.now() + Math.random(), memberId: p.id, text: `-${p.ctr}` }));
            if (floats.length) {
              setFloatCounterDmgs(floats);
              setTimeout(() => setFloatCounterDmgs([]), 1400);
            }

            const tEnd = setTimeout(() => { setAnimScreenShake(false); setAnimCounter(false); }, 850);
            timers.current.push(tEnd);

            onCounterHit?.(mini, idx);
          }, 1400); // ← 修正：1400ms 相對延遲（原來錯用 curDelay + 1400，curDelay 是閉包最終值）
          timers.current.push(tHit);
        } else {
          // 攻擊：200ms 後怪物閃白 + 浮動傷害
          const totalDmg = (mini.playerLog || []).reduce((s, p) => s + (p.dmg || 0), 0);
          const hasCrit = (mini.playerLog || []).some(p => (p.crits || 0) > 0);
          if (totalDmg > 0) {
            const tHit = setTimeout(() => {
              setAnimHit(true);
              setFloatDmg({ dmg: totalDmg, isCrit: hasCrit });
              const tClear = setTimeout(() => { setAnimHit(false); setFloatDmg(null); }, 2000);
              timers.current.push(tClear);
            }, 200);
            timers.current.push(tHit);
          }
        }
      }, fireAt);
      timers.current.push(t);

      curDelay += mini.isCounter ? counterDelay : attackDelay;
    });

    // 全部 mini-round 結束：清理 liveEntry + 呼叫 onEntryEnd
    const tEnd = setTimeout(() => {
      setLiveEntry(null);
      setLiveMiniIdx(0);
      activeRef.current = false;
      setIsRevealing(false);
      onEntryEnd?.(entry);
    }, curDelay + entryEndExtra);
    timers.current.push(tEnd);
  }, [clearTimers]);

  return {
    liveEntry,
    liveMiniIdx,
    animHit,
    animMonsterCharge,
    animScreenShake,
    floatCounterDmgs,
    localHpOverride,
    floatDmg,
    attackingIds,
    setAttackingIds,
    animCounter,
    animPhase,
    isPlaying: !!liveEntry,
    isRevealing,
    startReveal,
    stopReveal,
    clearTimers,
  };
}
