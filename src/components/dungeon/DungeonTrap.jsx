// src/components/dungeon/DungeonTrap.jsx — 地下城陷阱房間（重設計：25 種貓味陷阱池 + 賭大小閃避）
import { useState, useEffect, useMemo, useRef } from "react";
import { confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";
import { TRAP_EVENTS } from "../../lib/dungeonTrapPool";
import { sfxCast, sfxSuccess, sfxCounter, sfxTap, sfxDebuff } from "../../lib/sound";
import DungeonEventStage from "./DungeonEventStage";

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

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

  const members = room?.members || {};
  const aliveIds = Object.keys(members).filter(id => members[id]?.alive);
  const roomConfirms = localMode ? localConfirms : (room?.roomConfirms || {});
  const roomChoices  = localMode ? localChoices : (room?.roomChoices || {});

  // 讀取/初始化陷阱
  useEffect(() => {
    if (trapType) return;
    if (room?.trapTypeId) {
      const found = TRAP_EVENTS.find(t => t.id === room.trapTypeId);
      if (found) setTrapType(found);
      return;
    }
    // 隨機選一個陷阱
    const type = TRAP_EVENTS[Math.floor(Math.random() * TRAP_EVENTS.length)];
    setTrapType(type);

    if (!localMode && isHost && !trapPersistedRef.current) {
      trapPersistedRef.current = true;
      import("firebase/firestore").then(({ updateDoc, doc }) =>
        import("../../lib/firebase").then(({ db }) =>
          updateDoc(doc(db, "dungeonRooms", roomId), {
            trapTypeId: type.id,
            trapParams: type.effect,
          }).catch(() => {})
        )
      );
    }
  }, [room?.trapTypeId, trapType, localMode, isHost, roomId]);

  // 動畫過場
  useEffect(() => {
    if (!trapType) return;
    if (room?.roomResolution?.kind === "trap") return;
    sfxCounter();
    const t1 = setTimeout(() => setAnimPhase("trap_reveal"), 500);
    const t2 = setTimeout(() => setAnimPhase("dice_bet"), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [trapType, room?.roomResolution]);

  // 讀取結算結果
  useEffect(() => {
    const resolution = room?.roomResolution;
    if (!resolution || resolution.kind !== "trap") return;
    const resolvedType = TRAP_EVENTS.find(t => t.id === resolution.trapTypeId);
    if (resolvedType) setTrapType(resolvedType);
    setDiceValue(resolution.dice);
    setDodgeSuccess(!!resolution.success);
    setAnimPhase("done");
  }, [room?.roomResolution]);

  // 票數統計
  const tally = useMemo(() => {
    const t = { big: 0, small: 0 };
    for (const choice of Object.values(roomChoices)) {
      if (choice === "big") t.big++;
      if (choice === "small") t.small++;
    }
    return t;
  }, [roomChoices]);

  const winningBet = tally.big >= tally.small ? "big" : "small";

  async function handleChooseBet(choice) {
    if (myBet || animPhase !== "dice_bet") return;
    sfxTap();
    setMyBet(choice);
    if (localMode) {
      setLocalChoices({ [memberId]: choice });
      setLocalConfirms({ [memberId]: true });
    } else {
      await confirmNonCombatRoom(roomId, memberId, choice);
    }
  }

  async function handleRollAndResolve() {
    if (!isHost || rollStartedRef.current || !trapType) return;
    rollStartedRef.current = true;
    sfxCast();
    setAnimPhase("dice_result");

    const dice = rollDice();
    setDiceValue(dice);

    const isDiceBig = dice >= 4;
    const diceType = isDiceBig ? "big" : "small";
    const success = (winningBet === diceType);
    setDodgeSuccess(success);

    if (localMode) {
      if (!success && trapType.effect) {
        if (trapType.category === "hp") {
          onLocalEffect?.({ type: "heal_pct", value: trapType.effect.hp || -0.10 });
        } else if (trapType.category === "atk") {
          onLocalEffect?.({ type: "buff_mult", key: "atkMult", value: 1 + (trapType.effect.atk || -0.10) });
        } else if (trapType.category === "def") {
          onLocalEffect?.({ type: "buff_mult", key: "defMult", value: 1 + (trapType.effect.def || -0.10) });
        } else if (trapType.category === "gold") {
          onLocalEffect?.({ type: "coins", value: trapType.effect.gold || -20 });
        }
      }
      setTimeout(() => {
        setAnimPhase("done");
      }, 1500);
      return;
    }

    // 線上模式儲存結算
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../../lib/firebase");
      await updateDoc(doc(db, "dungeonRooms", roomId), {
        roomResolution: {
          kind: "trap",
          trapTypeId: trapType.id,
          dice,
          winningBet,
          success,
          timestamp: Date.now(),
        },
      });
    } catch (e) {
      console.warn(e);
    }
  }

  async function handleFinishTrap() {
    if (localMode) {
      onLocalDone?.();
      return;
    }
    if (onSharedDone) await onSharedDone();
    else await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  if (!trapType) return null;

  return (
    <DungeonEventStage tone="trap">
      <div className="dungeon-stage-header text-center py-4 border-b border-white/10">
        <div className="text-3xl mb-1">{trapType.icon}</div>
        <div className="text-xl font-black text-rose-300">{trapType.title}</div>
        <div className="text-xs text-slate-400 mt-1">{trapType.desc}</div>
      </div>

      <div className="dungeon-stage-main flex flex-col items-center justify-center p-6 space-y-4">
        {animPhase === "dice_bet" && (
          <div className="w-full max-w-sm bg-slate-900/90 border border-slate-700 p-5 rounded-2xl text-center space-y-4">
            <div className="text-sm font-bold text-amber-300">
              🎲 預測骰子大小以嘗試閃避陷阱！
            </div>
            <div className="text-xs text-slate-400">大 (4~6) ｜ 小 (1~3)</div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChooseBet("big")}
                className={`py-3 rounded-xl font-black text-sm border transition ${
                  myBet === "big"
                    ? "bg-rose-600 border-rose-500 text-white shadow-lg"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                }`}
              >
                🔥 押「大」
              </button>
              <button
                type="button"
                onClick={() => handleChooseBet("small")}
                className={`py-3 rounded-xl font-black text-sm border transition ${
                  myBet === "small"
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                }`}
              >
                💧 押「小」
              </button>
            </div>

            {isHost && (
              <button
                type="button"
                onClick={handleRollAndResolve}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm shadow-md mt-2"
              >
                🎲 擲骰結算
              </button>
            )}
          </div>
        )}

        {(animPhase === "dice_result" || animPhase === "done") && (
          <div className="w-full max-w-sm bg-slate-900/90 border border-slate-700 p-6 rounded-2xl text-center space-y-4 animate-fade-in">
            <div className="text-5xl font-black text-amber-400">🎲 {diceValue || "?"}</div>
            <div className="text-base font-black">
              {dodgeSuccess ? (
                <span className="text-emerald-400">✨ 閃避成功！完全不受影響</span>
              ) : (
                <span className="text-rose-400">💥 閃避失敗！受到陷阱影響</span>
              )}
            </div>
            {animPhase === "done" && (
              <button
                type="button"
                onClick={handleFinishTrap}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-sm shadow-md"
              >
                繼續探索
              </button>
            )}
          </div>
        )}
      </div>
    </DungeonEventStage>
  );
}
