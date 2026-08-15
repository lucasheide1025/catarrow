// src/battle/useDuelReveal.js
// 決鬥逐箭揭露 hook — 封裝 DuelRoom 的逐箭動畫計時器鏈
//
// 決鬥 2.1（A1箭/B1箭 有來有回）：
//   logEntry.attacks 每個元素＝一支箭（attackerTeam 標記誰出手），
//   揭露就照 attacks 的順序一箭一箭跑，步數 = attacks.length（可中途結束）。
//   舊 log（一包 6 箭、A 全射完換 B）經 entrySteps() 展開成 12 步相容。
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
import { PVP_STATUS_RULES } from "../lib/duelCombat";

const ARROWS = 6;
const POP_MS = 1200;      // 徽章停留時間
const POP_STAGGER = 450;  // 多個徽章的間隔

// 把 log entry 轉成逐箭步驟陣列（每步一個 attack 物件）。
// 新版 attacks 每元素＝一支箭；舊版是一包 6 箭（A→B），展開成 12 步。
function entrySteps(entry) {
  if (!entry) return [];
  if (entry.format === "interleave") return entry.attacks || [];
  const attacks = entry.attacks || [];
  const out = [];
  for (let i = 0; i < ARROWS * 2; i++) {
    const phase = i < ARROWS ? "A" : "B";
    const arrowIdx = i % ARROWS;
    for (const atk of attacks) {
      const isATeam = atk.attackerTeam === "A";
      if ((phase === "A") === isATeam && atk.arrowBreakdown?.[arrowIdx]) {
        out.push({ ...atk, _legacy: true, _bk: atk.arrowBreakdown[arrowIdx] });
        break;
      }
    }
  }
  return out;
}

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
  const [statusPops, setStatusPops] = useState([]); // 效果獨立播報徽章

  // 播放一組效果徽章（依序交錯彈出，startDelay 毫秒後開始）
  const playPops = useCallback((pops, startDelay = 0) => {
    pops.forEach((pop, i) => {
      const t = setTimeout(() => {
        const id = `${pop.kind}-${pop.memberId}-${Date.now()}-${i}-${Math.random()}`;
        setStatusPops(prev => [...prev, { ...pop, id }]);
        const t2 = setTimeout(() => {
          setStatusPops(prev => prev.filter(p => p.id !== id));
        }, POP_MS);
        timersRef.current.push(t2);
      }, startDelay + i * POP_STAGGER);
      timersRef.current.push(t);
    });
  }, []);

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
    setStatusPops([]);
    lastLogLenRef.current = 0;
  }, [clearTimers]);

  // 揭露步數是動態的：這回合實際射出的箭數（中途擊殺會少於 12）
  const totalSteps = entrySteps(revealEntryRef.current).length;
  const isRevealing = revealIdx >= 0 && revealIdx < totalSteps;
  const hasRevealed = revealIdx >= totalSteps;

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

    // 回合開始的效果（DoT 跳傷／凍結麻痺）獨立播報
    const startPops = (entry.statusEvents || []).filter(e => e.phase === "start" && e.memberId);
    if (startPops.length) {
      playPops(startPops.map(e => ({
        memberId: e.memberId, icon: e.icon,
        text: e.kind === "stun" ? "無法行動！" : `-${e.value}`,
        value: e.value, kind: e.kind || "status",
      })), 150);
    }

    // 有事件 → 先暫停看事件畫面；無事件 → 直接開始逐箭揭露
    if (entry.event) {
      setEventPhase(true);
    } else {
      setRevealIdx(0);
    }
  }, [room?.log?.length]); // eslint-disable-line

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

  // ── 3. 逐箭揭露計時器（照 attacks 順序跑，步數可變）──────
  useEffect(() => {
    if (revealIdx < 0 || !revealEntry) return;
    const steps = entrySteps(revealEntry);
    if (revealIdx >= steps.length) return;
    const step = steps[revealIdx];
    const bk = step._bk || step.arrowBreakdown?.[0];

    // 第 0 步前：先手橫幅（A 或 B）
    if (revealIdx === 0) {
      const teamAIds = new Set(Object.keys(room?.teamA || {}));
      const first = step.attackerTeam || (teamAIds.has(step.attackerId) ? "A" : "B");
      setRevealPhaseBanner(first);
      const bt = setTimeout(() => setRevealPhaseBanner(null), phaseBannerDelay);
      const t = setTimeout(() => setRevealIdx(i => i + 1), phaseBannerDelay + 100);
      return () => { clearTimeout(bt); clearTimeout(t); };
    }

    const t = setTimeout(() => {
      // 無箭資料（stun / 貓貓）→ 快跳，不佔動畫時間
      if (!bk) {
        setRevealIdx(i => i + 1);
        return;
      }

      const dmg = bk.dmg || 0;

      // 攻守方動畫
      if (dmg > 0) {
        setAttackingIds(new Set([step.attackerId]));
        setHittingIds(new Set([step.targetId]));
        const tClear = setTimeout(() => { setAttackingIds(new Set()); setHittingIds(new Set()); }, 700);
        timersRef.current.push(tClear);
      }

      // 浮動傷害 + 血條閃爍
      const hasCrit = !!bk.isCrit;
      const hasHit = dmg > 0 && !bk.isCrit;
      const hasShield = Number(bk.shieldTake) > 0;
      if (dmg > 0) {
        const f = {
          id: `${step.attackerId}-${revealIdx}-${Date.now()}`,
          text: bk.isCrit ? `💥 ${dmg}!` : `-${dmg}`,
          memberId: step.targetId,
          isCrit: bk.isCrit,
        };
        setFloats(prev => [...prev, f]);
        const tFloat = setTimeout(() => setFloats(prev => prev.filter(x => x.id !== f.id)), 1400);
        timersRef.current.push(tFloat);
        setFlashIds(prev => ({ ...prev, [step.targetId]: true }));
        const tFlash = setTimeout(() => setFlashIds(prev => { const n = { ...prev }; delete n[step.targetId]; return n; }), 400);
        timersRef.current.push(tFlash);
      }

      // 音效回呼（hasCrit 暴擊 / hasHit 命中 / hasShield 護盾抵擋）
      onSoundEffect?.(hasCrit, hasHit, hasShield);

      // 護盾擋格徽章（打在目標頭上）
      if (Number(bk.shieldTake) > 0) {
        const pid = `shield-${step.targetId}-${revealIdx}-${Date.now()}`;
        setStatusPops(prev => [...prev, { id: pid, memberId: step.targetId, icon: "🛡️", text: `擋下 ${bk.shieldTake}`, value: bk.shieldTake, kind: "shield" }]);
        const t2 = setTimeout(() => setStatusPops(prev => prev.filter(p => p.id !== pid)), POP_MS);
        timersRef.current.push(t2);
      }
      // 荊棘/堅盾反彈徽章（彈回攻擊者頭上）
      if ((step.reflect || 0) > 0) {
        const pid = `reflect-${step.attackerId}-${revealIdx}-${Date.now()}`;
        setStatusPops(prev => [...prev, { id: pid, memberId: step.attackerId, icon: "🌵", text: `反彈 ${step.reflect}`, value: step.reflect, kind: "reflect" }]);
        const t2 = setTimeout(() => setStatusPops(prev => prev.filter(p => p.id !== pid)), POP_MS);
        timersRef.current.push(t2);
      }
      // 異常施加徽章（施加到目標頭上；atk.statusHit 只記實際生效的）
      if (step.statusHit) {
        const rule = PVP_STATUS_RULES[step.statusHit.id];
        const pid = `inflict-${step.targetId}-${revealIdx}-${Date.now()}`;
        setStatusPops(prev => [...prev, {
          id: pid, memberId: step.targetId, icon: rule?.icon || "☠️",
          text: `${rule?.name || step.statusHit.id}！`, kind: "inflict",
        }]);
        const t2 = setTimeout(() => setStatusPops(prev => prev.filter(p => p.id !== pid)), POP_MS);
        timersRef.current.push(t2);
      }

      // 逐箭扣血條
      setDisplayHp(prev => {
        if (!prev) return prev;
        const next = { ...prev };
        if (dmg > 0) next[step.targetId] = Math.max(0, (next[step.targetId] ?? 0) - dmg);
        return next;
      });

      setRevealIdx(i => i + 1);
    }, arrowDelayMs);

    return () => clearTimeout(t);
  }, [revealIdx, revealEntry, room?.teamA]); // eslint-disable-line

  // ── 4. 揭露完成 → 貓貓 overlay + 清理暫存 HP ──────────
  useEffect(() => {
    const entry = revealEntryRef.current;
    if (!room || !entry) return;
    const steps = entrySteps(entry);
    if (revealIdx < steps.length) return;
    setRevealPhaseBanner(null);

    const allMembersMap = { ...room.teamA, ...room.teamB };
    const catAttacks = (entry.attacks || []).filter(a => a.isCat && (a.dmg || 0) > 0);

    // 回合末的效果（回血）獨立播報
    const endPops = (entry.statusEvents || []).filter(e => e.phase === "end" && e.memberId && e.value != null);
    if (endPops.length) {
      playPops(endPops.map(e => ({ memberId: e.memberId, icon: e.icon, text: `+${e.value}`, value: e.value, kind: "heal" })), 0);
    }

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
    statusPops,
    // derived
    isRevealing,
    hasRevealed,
    // methods
    skipEvent,
    stopReveal,
  };
}
