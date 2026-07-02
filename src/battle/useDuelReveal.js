// src/battle/useDuelReveal.js
// 決鬥逐箭揭露 hook — 封裝 DuelRoom 的 12 步逐箭動畫計時器鏈
//
// 管理 11 個 state：
//   revealEntry, revealIdx, displayHp, floats, flashIds,
//   attackingIds, hittingIds, eventPhase, showCatRound,
//   duelCatCats, revealPhaseBanner
//
// 使用方式：
//   const duel = useDuelReveal({ room, onSoundEffect, onComplete });
//   ...
//   {duel.eventPhase && <EventOverlay onSkip={duel.skipEvent} />}
//   {duel.showCatRound && <CatRoundOverlay cats={duel.duelCatCats} />}

import { useState, useRef, useEffect, useCallback } from "react";

const ARROWS = 6;
const REVEAL_TOTAL = ARROWS * 2; // A 隊 6 箭 + B 隊 6 箭

export function useDuelReveal({
  room,
  onSoundEffect,
  onComplete,
  arrowDelayMs = 1000,
  phaseBannerDelay = 900,
  eventPauseMs = 4000,
  catOverlayMs = 2500,
} = {}) {
  // ── States ────────────────────────────────────────────
  const [revealEntry, setRevealEntry] = useState(null);
  const [revealIdx, setRevealIdx] = useState(-1);
  const [displayHp, setDisplayHp] = useState(null);
  const [floats, setFloats] = useState([]);
  const [flashIds, setFlashIds] = useState({});
  const [attackingIds, setAttackingIds] = useState(new Set());
  const [hittingIds, setHittingIds] = useState(new Set());
  const [eventPhase, setEventPhase] = useState(false);
  const [showCatRound, setShowCatRound] = useState(false);
  const [duelCatCats, setDuelCatCats] = useState([]);
  const [revealPhaseBanner, setRevealPhaseBanner] = useState(null);

  // ── Internal refs ─────────────────────────────────────
  const lastLogLenRef = useRef(0);
  const revealEntryRef = useRef(null);
  const timersRef = useRef([]);

  // 同步 ref
  useEffect(() => { revealEntryRef.current = revealEntry; }, [revealEntry]);

  // ── 清理工具 ──────────────────────────────────────────
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const stopReveal = useCallback(() => {
    clearTimers();
    setRevealEntry(null);
    setRevealIdx(-1);
    setDisplayHp(null);
    setFloats([]);
    setFlashIds({});
    setAttackingIds(new Set());
    setHittingIds(new Set());
    setEventPhase(false);
    setShowCatRound(false);
    setDuelCatCats([]);
    setRevealPhaseBanner(null);
    lastLogLenRef.current = 0;
  }, [clearTimers]);

  const isRevealing = revealIdx >= 0 && revealIdx < REVEAL_TOTAL;
  const hasRevealed = revealIdx >= REVEAL_TOTAL;

  // ── 1. 偵測新 log → 設定揭露初始狀態 ──────────────────
  useEffect(() => {
    if (!room?.log?.length) return;
    if (room.log.length <= lastLogLenRef.current) return;
    lastLogLenRef.current = room.log.length;
    const entry = room.log[room.log.length - 1];

    // 從 hpDelta 反推回合開始前的 HP（hpDelta 為負值，preHp = m.hp - hpDelta）
    const preHp = {};
    const allMembers = [
      ...Object.entries(room.teamA || {}),
      ...Object.entries(room.teamB || {}),
    ];
    allMembers.forEach(([id, m]) => {
      preHp[id] = Math.max(0, (m.hp || 0) - (entry.hpDelta?.[id] || 0));
    });

    setDisplayHp(preHp);
    setRevealEntry(entry);

    // 有事件 → 先暫停看事件畫面；無事件 → 直接開始逐箭揭露
    if (entry.event) {
      setEventPhase(true);
    } else {
      setRevealIdx(0);
    }
  }, [room?.log?.length]);

  // ── 2. 事件暫停計時器（4 秒後自動開始揭露）───────────────
  useEffect(() => {
    if (!eventPhase) return;
    const t = setTimeout(() => {
      setEventPhase(false);
      setRevealIdx(0);
    }, eventPauseMs);
    return () => clearTimeout(t);
  }, [eventPhase, eventPauseMs]);

  // ── 跳過事件暫停 ──────────────────────────────────────
  const skipEvent = useCallback(() => {
    clearTimers();
    setEventPhase(false);
    setRevealIdx(0);
  }, [clearTimers]);

  // ── 3. 逐箭揭露計時器 ──────────────────────────────────
  useEffect(() => {
    if (revealIdx < 0 || !revealEntry) return;
    if (revealIdx >= REVEAL_TOTAL) return;

    const phase = revealIdx < ARROWS ? "A" : "B";
    const arrowIdx = revealIdx % ARROWS;

    // 換邊橫幅（revealIdx === 6 時顯示「隊伍 B 反擊」）
    if (revealIdx === ARROWS) {
      setRevealPhaseBanner("B");
      const bt = setTimeout(() => setRevealPhaseBanner(null), phaseBannerDelay);
      const t = setTimeout(() => setRevealIdx(i => i + 1), phaseBannerDelay + 100);
      return () => { clearTimeout(bt); clearTimeout(t); };
    }

    // 篩選本階段的攻擊（A 攻 B 或 B 攻 A）
    const teamAIds = new Set(Object.keys(room?.teamA || {}));
    const entry = revealEntryRef.current;
    const phaseAttacks = (entry?.attacks || []).filter(a =>
      phase === "A" ? teamAIds.has(a.attackerId) : !teamAIds.has(a.attackerId)
    );

    const t = setTimeout(() => {
      // 攻守方動畫
      const lungers = phaseAttacks.filter(a => (a.arrowBreakdown?.[arrowIdx]?.dmg || 0) > 0).map(a => a.attackerId);
      const targets = phaseAttacks.filter(a => (a.arrowBreakdown?.[arrowIdx]?.dmg || 0) > 0).map(a => a.targetId);
      if (lungers.length) {
        setAttackingIds(new Set(lungers));
        setHittingIds(new Set(targets));
        const tClear = setTimeout(() => { setAttackingIds(new Set()); setHittingIds(new Set()); }, 700);
        timersRef.current.push(tClear);
      }

      // 浮動傷害 + 血條閃爍
      let hasCrit = false, hasHit = false;
      const newFloats = [];
      for (const atk of phaseAttacks) {
        const bk = atk.arrowBreakdown?.[arrowIdx];
        if (!bk || bk.dmg === 0) continue;
        if (bk.isCrit) hasCrit = true; else hasHit = true;
        newFloats.push({
          id: `${atk.attackerId}-${revealIdx}-${Date.now()}`,
          text: bk.isCrit ? `💥 ${bk.dmg}!` : `-${bk.dmg}`,
          memberId: atk.targetId,
          isCrit: bk.isCrit,
        });
        setFlashIds(prev => ({ ...prev, [atk.targetId]: true }));
        const tFlash = setTimeout(() => setFlashIds(prev => { const n = { ...prev }; delete n[atk.targetId]; return n; }), 400);
        timersRef.current.push(tFlash);
      }

      if (newFloats.length) {
        setFloats(prev => [...prev, ...newFloats]);
        const tFloat = setTimeout(() => setFloats(prev => prev.filter(f => !newFloats.find(n => n.id === f.id))), 1400);
        timersRef.current.push(tFloat);
      }

      // 音效回呼
      onSoundEffect?.(hasCrit, hasHit);

      // 逐箭扣血條
      setDisplayHp(prev => {
        if (!prev) return prev;
        const next = { ...prev };
        for (const atk of phaseAttacks) {
          const bk = atk.arrowBreakdown?.[arrowIdx];
          if (!bk || bk.dmg === 0) continue;
          next[atk.targetId] = Math.max(0, (next[atk.targetId] ?? 0) - bk.dmg);
        }
        return next;
      });

      setRevealIdx(i => i + 1);
    }, arrowDelayMs);

    return () => clearTimeout(t);
  }, [revealIdx, revealEntry, room?.teamA]); // eslint-disable-line

  // ── 4. 揭露完成 → 貓貓 overlay + 清理暫存 HP ──────────
  useEffect(() => {
    if (revealIdx < REVEAL_TOTAL || !room) return;
    setRevealPhaseBanner(null);

    const entry = revealEntryRef.current;
    const allMembersMap = { ...room.teamA, ...room.teamB };
    const catAttacks = (entry?.attacks || []).filter(a => a.isCat && (a.dmg || 0) > 0);

    if (catAttacks.length > 0) {
      const cats = catAttacks.map(a => ({
        catId: allMembersMap[a.attackerId]?.archerStyle || "baobao",
        catName: a.catName || "貓貓",
        dmg: a.dmg || 0,
      }));
      setDuelCatCats(cats);
      setShowCatRound(true);
      const t = setTimeout(() => {
        setShowCatRound(false);
        setDisplayHp(null);
        onComplete?.(entry);
      }, catOverlayMs);
      return () => clearTimeout(t);
    }

    setDisplayHp(null);
    onComplete?.(entry);
  }, [revealIdx, room]); // eslint-disable-line

  // ── Unmount 清理 ──────────────────────────────────────
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return {
    // states
    revealEntry,
    revealIdx,
    displayHp,
    floats,
    flashIds,
    attackingIds,
    hittingIds,
    eventPhase,
    showCatRound,
    duelCatCats,
    revealPhaseBanner,
    // derived
    isRevealing,
    hasRevealed,
    // methods
    skipEvent,
    stopReveal,
  };
}
