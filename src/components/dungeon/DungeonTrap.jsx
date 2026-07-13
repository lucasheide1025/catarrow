// src/components/dungeon/DungeonTrap.jsx — 地下城陷阱房間（重設計）
// 三種傷害類型（HP↓ / ATK↓ / DEF↓）+ 全員賭大小閃躲機制 + 動畫過場
import { useState, useEffect, useMemo, useRef } from "react";
import { confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";
import { sfxCast, sfxSuccess, sfxCounter, sfxTap } from "../../lib/sound";

// 陷阱類型
const TRAP_TYPES = [
  { id:"hp",    icon:"💥", label:"HP 傷害", color:"#ef4444", desc:"全體受到 HP 傷害" },
  { id:"atk",   icon:"⚔️", label:"ATK 弱化", color:"#f97316", desc:"全體 ATK 降低" },
  { id:"def",   icon:"🛡️", label:"DEF 弱化", color:"#60a5fa", desc:"全體 DEF 降低" },
];

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

// localMode（遠征單人）：賭大小照舊，但效果透過 onLocalEffect 回傳父層、
// 結束呼叫 onLocalDone，不寫 Firestore
export default function DungeonTrap({
  roomId, room, memberId, isHost,
  localMode = false, onLocalEffect, onLocalDone, onSharedDone,
}) {
  const [trapType,  setTrapType]  = useState(null);
  const [animPhase, setAnimPhase] = useState("entering"); // entering | trap_reveal | dice_bet | dice_result | done
  const [diceValue, setDiceValue] = useState(null);
  const [dodgeSuccess, setDodgeSuccess] = useState(null); // null | true | false
  const [myBet, setMyBet] = useState(null); // "big" | "small" | null
  const [localConfirms, setLocalConfirms] = useState({});
  const [localChoices, setLocalChoices] = useState({});
  const rollStartedRef = useRef(false);
  const trapPersistedRef = useRef(false);

  // 由 host 持久化的固定陷阱參數（所有 client 讀同一份，不使用 per-member random）
  const TRAP_PARAMS = { hpLossPct: 0.20, atkMultReduction: 0.80, defMultReduction: 0.80 };

  const members = room?.members || {};
  const aliveIds = Object.keys(members).filter(id => members[id].alive);
  const roomConfirms = localMode ? localConfirms : (room?.roomConfirms || {});
  const roomChoices  = localMode ? localChoices : (room?.roomChoices || {});
  const allConfirmed = aliveIds.length === 0 || aliveIds.every(id => roomConfirms[id]);

  // ── Read persisted trap type from Firestore (host-authoritative) ──
  useEffect(() => {
    if (trapType) return;
    if (!room?.trapTypeId) return;
    const found = TRAP_TYPES.find(t => t.id === room.trapTypeId);
    if (!found) return;
    setTrapType(found);
  }, [room?.trapTypeId, trapType]);

  // ── Host persists trap type to Firestore once, all clients read same type ──
  useEffect(() => {
    if (trapType) return;
    // Room already has a persisted trap type (e.g. written by a prior host session)
    if (room?.trapTypeId) return;
    if (localMode) {
      const type = TRAP_TYPES[Math.floor(Math.random() * TRAP_TYPES.length)];
      setTrapType(type);
      return;
    }
    // Only host picks and persists the trap type
    if (!isHost || trapPersistedRef.current) return;
    trapPersistedRef.current = true;
    const type = TRAP_TYPES[Math.floor(Math.random() * TRAP_TYPES.length)];
    setTrapType(type);
    import("firebase/firestore").then(({ updateDoc, doc }) =>
      import("../../lib/firebase").then(({ db }) =>
        updateDoc(doc(db, "dungeonRooms", roomId), {
          trapTypeId: type.id,
          trapParams: TRAP_PARAMS,
        }).catch(() => {})
      )
    );
  }, []); // eslint-disable-line

  // ── Unified animation start: fires for host (local setTrapType) and non-host (from room.trapTypeId) ──
  useEffect(() => {
    if (!trapType) return;
    if (room?.roomResolution?.kind === "trap") return; // already resolved, skip animation
    sfxCounter();
    const t1 = setTimeout(() => setAnimPhase("trap_reveal"), 500);
    const t2 = setTimeout(() => setAnimPhase("dice_bet"), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [trapType]);

  // ── Read resolution result (all clients read same data from host) ──
  useEffect(() => {
    const resolution = room?.roomResolution;
    if (!resolution || resolution.kind !== "trap") return;
    const resolvedType = TRAP_TYPES.find(type => type.id === resolution.trapTypeId);
    if (resolvedType) setTrapType(resolvedType);
    setDiceValue(resolution.dice);
    setDodgeSuccess(!!resolution.success);
    setAnimPhase("done");
  }, [room?.roomResolution]);

  // ── Read resolution result (all clients read same data from host) ──
  useEffect(() => {
    const resolution = room?.roomResolution;
    if (!resolution || resolution.kind !== "trap") return;
    const resolvedType = TRAP_TYPES.find(type => type.id === resolution.trapTypeId);
    if (resolvedType) setTrapType(resolvedType);
    setDiceValue(resolution.dice);
    setDodgeSuccess(!!resolution.success);
    setAnimPhase("done");
  }, [room?.roomResolution]);

  // 票數統計
  const tally = useMemo(() => {
    const t = { big:0, small:0 };
    for (const choice of Object.values(roomChoices)) {
      if (choice === "big") t.big++;
      if (choice === "small") t.small++;
    }
    return t;
  }, [roomChoices]);

  // 多數決決定賭注
  const majorityBet = useMemo(() => {
    return tally.big >= tally.small ? "big" : "small";
  }, [tally]);

  async function handleBet(bet) {
    if (myBet || animPhase !== "dice_bet") return;
    sfxTap();
    setMyBet(bet);
    if (localMode) {
      setLocalChoices({ [memberId]: bet });
      setLocalConfirms({ [memberId]: true });
      return;
    }
    await confirmNonCombatRoom(roomId, memberId, bet);
  }

  // 全員下注完 → 房主自動擲骰
  useEffect(() => {
    if (!isHost || animPhase !== "dice_bet") return;
    if (!allConfirmed) return;
    handleRollDice();
  }, [allConfirmed]); // eslint-disable-line

  async function handleRollDice() {
    // roomResolution 已存在表示本陷阱已結算過，跳過避免重複（防止 reconnecting host 再次觸發）
    if (!isHost || rollStartedRef.current || room?.roomResolution?.kind === "trap") return;
    if (!trapType) return;
    rollStartedRef.current = true;
    const dice = rollDice();
    setDiceValue(dice);
    setAnimPhase("dice_result");
    sfxCast();

    const isBig = dice >= 4;
    const success = majorityBet === "big" ? isBig : !isBig;
    setDodgeSuccess(success);

    // 繼續動畫（2500ms 後顯示結果）
    setTimeout(async () => {
      setAnimPhase("done");
      (success ? sfxSuccess() : sfxCounter());

      // ── 本地單人模式：效果用固定 trapParams 交給父層套用（不寫 Firestore）──
      if (localMode) {
        if (trapType && !success) {
          const m = members[memberId];
          if (trapType.id === "hp") {
            onLocalEffect?.({ type:"hp_loss", value: Math.round((m?.maxHP || 100) * TRAP_PARAMS.hpLossPct) });
          } else if (trapType.id === "atk") {
            onLocalEffect?.({ type:"buff_mult", key:"atkMult", value: TRAP_PARAMS.atkMultReduction });
          } else {
            onLocalEffect?.({ type:"buff_mult", key:"defMult", value: TRAP_PARAMS.defMultReduction });
          }
        }
        return;
      }

      // ── 多人模式：host 使用固定 trapParams 寫入 Firestore（所有 client 看到相同效果）──
      if (trapType && !success) {
        // 使用 host 事先持久化的 trapParams，若無則用常數預設值
        const tp = room?.trapParams || TRAP_PARAMS;
        const { updateDoc, doc } = await import("firebase/firestore");
        const { db } = await import("../../lib/firebase");
        const upd = {};
        for (const id of aliveIds) {
          const m = members[id];
          if (!m) continue;

          if (trapType.id === "hp") {
            const hpLoss = Math.round((m.maxHP || 100) * tp.hpLossPct);
            const newHP = Math.max(1, (m.hp || m.maxHP || 100) - hpLoss);
            upd[`members.${id}.hp`] = newHP;
          } else if (trapType.id === "atk") {
            const cur = m.buffs?.atkMult || 1;
            upd[`members.${id}.buffs.atkMult`] = Math.round(cur * tp.atkMultReduction * 100) / 100;
          } else if (trapType.id === "def") {
            const cur = m.buffs?.defMult || 1;
            upd[`members.${id}.buffs.defMult`] = Math.round(cur * tp.defMultReduction * 100) / 100;
          }
        }
        upd.roomResolution = { kind:"trap", trapTypeId:trapType.id, dice, success, resolvedAt: Date.now() };
        await updateDoc(doc(db, "dungeonRooms", roomId), upd).catch(() => {});
      } else {
        const { updateDoc, doc } = await import("firebase/firestore");
        const { db } = await import("../../lib/firebase");
        await updateDoc(doc(db, "dungeonRooms", roomId), {
          roomResolution: { kind:"trap", trapTypeId:trapType?.id || "hp", dice, success, resolvedAt: Date.now() },
        }).catch(() => {});
      }
    }, 2500);
  }

  async function handleResolve() {
    if (!isHost) return;
    if (localMode) {
      onLocalDone?.();
      return;
    }
    if (onSharedDone) {
      await onSharedDone();
      return;
    }
    await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  // 房主強制結算（當所有人都下注了但房主沒自動擲骰時）
  async function handleForceResolve() {
    if (!isHost) return;
    if (animPhase === "dice_bet") {
      await handleRollDice();
    } else {
      await handleResolve();
    }
  }

  const diceEmoji = diceValue != null ? ["⚀","⚁","⚂","⚃","⚄","⚅"][diceValue - 1] : "🎲";

  return (
    <div className="min-h-full flex flex-col text-white"
      style={{ background:"linear-gradient(160deg,#1a0a0a,#2d0a0a)" }}>
      <style>{`
@keyframes tf-flash { 0%,100%{opacity:1} 50%{opacity:0.2} }
@keyframes tf-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(3px)} }
@keyframes tf-reveal { 0%{opacity:0;transform:scale(3) rotate(-20deg)} 60%{opacity:1;transform:scale(0.85) rotate(5deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
@keyframes tf-skull { 0%{opacity:0;transform:scale(2.5)} 50%{opacity:1;transform:scale(0.9)} 100%{opacity:1;transform:scale(1)} }
@keyframes tf-shield { 0%{opacity:0;transform:translateY(20px) scale(0.5)} 100%{opacity:1;transform:translateY(0) scale(1)} }
@keyframes tf-dice-roll { 0%{transform:rotateY(0deg)} 25%{transform:rotateY(90deg)} 50%{transform:rotateY(180deg)} 75%{transform:rotateY(270deg)} 100%{transform:rotateY(360deg)} }
@keyframes tf-dice-bounce { 0%{transform:translateY(-80px) rotate(-40deg);opacity:0} 50%{transform:translateY(0) rotate(10deg);opacity:1} 70%{transform:translateY(-20px) rotate(-5deg)} 100%{transform:translateY(0) rotate(0);opacity:1} }
@keyframes tf-avoid { 0%{opacity:0;transform:scale(0.2) rotate(20deg)} 60%{opacity:1;transform:scale(1.2) rotate(-5deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
      `}</style>

      {/* Header */}
      <div className="shrink-0 text-center py-5 border-b border-red-500/20"
        style={animPhase === "entering" || animPhase === "trap_reveal" ? {animation:"tf-flash 0.4s ease infinite"} : {}}>
        <div className="text-5xl mb-1"
          style={animPhase === "trap_reveal" ? {animation:"tf-reveal 0.6s cubic-bezier(0.34,1.56,0.64,1) both"} : {}}>
          {animPhase === "entering" ? "⚡" : "🪤"}
        </div>
        <div className="text-2xl font-black" style={{ color:"#f87171" }}>
          {animPhase === "entering" ? "⚠️ 警示！" : "陷阱！"}
        </div>
        <div className="text-sm text-red-300/60 mt-0.5">
          {animPhase === "entering" ? "前方偵測到異常能量…" :
           animPhase === "trap_reveal" && trapType ? `類型：${trapType.icon} ${trapType.label}` :
           animPhase === "dice_bet" ? "全員賭注！大（456）還是小（123）？" :
           animPhase === "dice_result" ? "命運之骰…" :
           dodgeSuccess ? "成功閃避！" : "承受傷害！"}
        </div>
      </div>

      {/* Main Content */}
      <div className="px-5 py-8 flex flex-col items-center justify-center gap-5"
        style={animPhase === "trap_reveal" ? {animation:"tf-shake 0.5s ease"} : {}}>

        {/* Phase 1: Trap Reveal */}
        {animPhase === "trap_reveal" && trapType && (
          <div className="text-center" style={{animation:"tf-skull 0.6s ease both"}}>
            <div className="text-8xl mb-4">{trapType.icon}</div>
            <div className="text-xl font-black" style={{ color: trapType.color }}>{trapType.label}</div>
            <div className="text-sm text-red-300/60 mt-2 max-w-xs">{trapType.desc}</div>
            <div className="mt-6 text-xs text-slate-500 animate-pulse">⚠️ 即將觸發…</div>
          </div>
        )}

        {/* Phase 2: Bet UI */}
        {animPhase === "dice_bet" && (
          <div className="w-full max-w-sm space-y-5">
            <div className="text-center">
              <div className="text-6xl mb-3">🎲</div>
              <div className="text-sm text-amber-300 font-bold">全員投票 — 大（456）還是小（123）？</div>
              <div className="text-xs text-slate-500 mt-1">多數決，猜對即閃避陷阱！</div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleBet("small")}
                disabled={!!myBet}
                className="flex-1 py-6 rounded-2xl font-black text-lg border-2 transition-all active:scale-95"
                style={{
                  background: myBet === "small" ? "rgba(96,165,250,0.25)" : "rgba(96,165,250,0.08)",
                  borderColor: myBet === "small" ? "#60a5fa" : "rgba(96,165,250,0.3)",
                  color: myBet === "small" ? "#93c5fd" : "rgba(148,163,184,0.7)",
                  opacity: myBet && myBet !== "small" ? 0.4 : 1,
                }}>
                <div className="text-3xl mb-1">1️⃣2️⃣3️⃣</div>
                <div>小</div>
                {tally.small > 0 && <div className="text-xs mt-1 text-slate-400">({tally.small} 票)</div>}
              </button>
              <button onClick={() => handleBet("big")}
                disabled={!!myBet}
                className="flex-1 py-6 rounded-2xl font-black text-lg border-2 transition-all active:scale-95"
                style={{
                  background: myBet === "big" ? "rgba(251,191,36,0.25)" : "rgba(251,191,36,0.08)",
                  borderColor: myBet === "big" ? "#fbbf24" : "rgba(251,191,36,0.3)",
                  color: myBet === "big" ? "#fcd34d" : "rgba(148,163,184,0.7)",
                  opacity: myBet && myBet !== "big" ? 0.4 : 1,
                }}>
                <div className="text-3xl mb-1">4️⃣5️⃣6️⃣</div>
                <div>大</div>
                {tally.big > 0 && <div className="text-xs mt-1 text-slate-400">({tally.big} 票)</div>}
              </button>
            </div>

            {/* 已投票成員 */}
            {Object.keys(roomChoices).length > 0 && (
              <div className="flex justify-center gap-2 flex-wrap">
                {Object.keys(roomChoices).map(id => (
                  <span key={id} className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                    ✅ {members[id]?.name || id} {roomChoices[id] === "big" ? "4️⃣5️⃣6️⃣" : "1️⃣2️⃣3️⃣"}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phase 3: Dice Result */}
        {animPhase === "dice_result" && diceValue != null && (
          <div className="text-center space-y-5">
            <div className="text-8xl" style={{animation:"tf-dice-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) both"}}>
              {diceEmoji}
            </div>
            <div className="text-4xl font-black text-amber-300" style={{animation:"tf-avoid 0.4s 0.5s both"}}>
              {diceValue} — {diceValue >= 4 ? "大！" : "小！"}
            </div>
            <div className="text-lg font-bold" style={{animation:"tf-shield 0.5s 0.8s both"}}>
              {dodgeSuccess !== null && (
                <span style={{ color: dodgeSuccess ? "#4ade80" : "#ef4444" }}>
                  {dodgeSuccess ? "✨ 成功閃避！陷阱無效！" : `💥 閃避失敗，${trapType?.label} 發動！`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Phase 4: Done - Show effects */}
        {animPhase === "done" && (
          <div className="w-full max-w-sm space-y-4">
            <div className="text-center">
              <div className="text-6xl mb-3" style={{animation:"tf-avoid 0.5s ease both"}}>
                {dodgeSuccess ? "✨" : "💥"}
              </div>
              <div className="text-xl font-black" style={{ color: dodgeSuccess ? "#4ade80" : "#ef4444" }}>
                {dodgeSuccess ? "陷阱閃避成功！" : `陷阱命中！${trapType?.icon} ${trapType?.label}`}
              </div>
            </div>

            {!dodgeSuccess && trapType && (
              <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-4">
                <div className="text-xs font-black text-red-300 mb-3">💥 全體效果（固定規則）</div>
                {aliveIds.map(id => {
                  const m = members[id];
                  const isMe = id === memberId;
                  // 使用 host 持久化的 trapParams，不再使用 per-member random
                  const tp = room?.roomResolution?.trapParams || room?.trapParams || TRAP_PARAMS;
                  let effectText = "";
                  if (trapType.id === "hp") {
                    const pct = Math.round(tp.hpLossPct * 100);
                    effectText = `HP -${pct}%`;
                  } else if (trapType.id === "atk") {
                    const pct = Math.round((1 - tp.atkMultReduction) * 100);
                    effectText = `ATK -${pct}%`;
                  } else if (trapType.id === "def") {
                    const pct = Math.round((1 - tp.defMultReduction) * 100);
                    effectText = `DEF -${pct}%`;
                  }
                  return (
                    <div key={id}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 mb-1.5 ${isMe ? "bg-red-900/40 border border-red-500/30" : "bg-black/30"}`}>
                      <span className="text-lg">{isMe ? "👉" : "👤"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold">{m.name}{isMe ? "（你）" : ""}</div>
                        <div className="text-xs text-red-400">{effectText}</div>
                      </div>
                      <div className="text-xs text-slate-400">
                        {trapType.id === "atk" && `⚔️${Math.round((m.atk||0)*(m.buffs?.atkMult||1))}`}
                        {trapType.id === "def" && `🛡️${Math.round((m.def||0)*(m.buffs?.defMult||1))}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {dodgeSuccess && (
              <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-2">🛡️</div>
                <div className="text-sm text-emerald-300">全員成功閃避，無任何傷害！</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 border-t border-red-500/20 space-y-3">
        {animPhase === "dice_bet" && !myBet && (
          <div className="text-center text-slate-400 text-sm py-2">👆 選擇大或小來賭一把</div>
        )}
        {animPhase === "dice_bet" && isHost && allConfirmed ? (
          <div className="text-center text-amber-400 text-sm py-2 animate-pulse">🎲 全員下注完成，擲骰中…</div>
        ) : animPhase === "dice_result" ? (
          <div className="text-center text-slate-400 text-sm py-2">⏳ 結算中…</div>
        ) : animPhase === "done" && (
          <>
            {isHost ? (
              <button onClick={handleResolve}
                className="w-full py-4 rounded-2xl font-black text-base shadow-lg"
                style={{ background:dodgeSuccess ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#f59e0b,#d97706)", color:"white" }}>
                🗺️ 繼續探索
              </button>
            ) : (
              <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 等待房主繼續</div>
            )}
          </>
        )}

        {/* 房主強制按鈕 */}
        {isHost && animPhase === "dice_bet" && !allConfirmed && myBet && (
          <button onClick={handleForceResolve}
            className="w-full py-2 rounded-xl text-amber-400 text-xs font-bold bg-amber-900/30 border border-amber-500/30">
            👑 強制擲骰（{Object.keys(roomChoices).length}/{aliveIds.length} 已下注）
          </button>
        )}
      </div>
    </div>
  );
}
