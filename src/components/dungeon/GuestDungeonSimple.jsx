// src/components/dungeon/GuestDungeonSimple.jsx
// 訪客/兒童模式專用的簡化版地下城：固定3層＋固定王，不使用正式版的挖掘/遠征/卷軸系統。
// 重用既有 DungeonBattleRoom.jsx 當戰鬥核心（跟正式遠征系統走同一套 useFirestoreRound 引擎）。
import { useState, useEffect, useRef, useCallback } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { createExpeditionBattleRoom, cleanupExpeditionRoom } from "../../lib/expeditionDb";
import { MONSTERS } from "../../lib/monsterData";
import DungeonBattleRoom from "./DungeonBattleRoom";

const FIXED_BOSS_ID = "ghost_5"; // 十八王公——固定當最終王，讓每次體驗的收尾一致好記
const TIER_BY_FLOOR = ["common", "rare"]; // 第1、2層隨機挑一隻該階、任意族的怪物

function pickFloorMonster(floorIndex) {
  if (floorIndex === 2) return MONSTERS.find(m => m.id === FIXED_BOSS_ID) || MONSTERS[0];
  const pool = MONSTERS.filter(m => m.tier === TIER_BY_FLOOR[floorIndex]);
  return pool[Math.floor(Math.random() * pool.length)] || MONSTERS[0];
}

const GUEST_BASE_STATS = { hp: 300, maxHP: 300, atk: 15, def: 8 };

export default function GuestDungeonSimple({ guestOverride, onExit }) {
  const [floorIndex, setFloorIndex] = useState(0);
  const [phase, setPhase]           = useState("intro"); // intro | loading | battle | floorDone | finished
  const [roomId, setRoomId]         = useState(null);
  const [playerState, setPlayerState] = useState(GUEST_BASE_STATS);
  const [result, setResult]         = useState(null); // { won, floorsCleared }
  const terminalRef = useRef(false);

  const monster = pickFloorMonster(floorIndex);
  const isBossFloor = floorIndex === 2;

  const startFloor = useCallback(async () => {
    setPhase("loading");
    terminalRef.current = false;
    const res = await createExpeditionBattleRoom({
      memberId: guestOverride.id, memberName: guestOverride.name,
      memberData: { ...playerState },
      monster, difficultyTier: 1, floorIndex,
      roomType: isBossFloor ? "boss" : "monster",
      arrowsPerRound: 6, targetFmt: "full_110",
    });
    if (res.ok) { setRoomId(res.roomId); setPhase("battle"); }
    else { setResult({ won: false, floorsCleared: floorIndex }); setPhase("finished"); }
  }, [guestOverride, playerState, monster, floorIndex, isBossFloor]); // eslint-disable-line

  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "dungeonRooms", roomId), snap => {
      if (!snap.exists() || terminalRef.current) return;
      const data = snap.data();
      const me = data.members?.[guestOverride.id];
      if (data.status === "completed" && data.result === "lose") {
        terminalRef.current = true;
        cleanupExpeditionRoom(roomId).catch(() => {});
        setResult({ won: false, floorsCleared: floorIndex });
        setPhase("finished");
      } else if (data.status === "map_explore") {
        terminalRef.current = true;
        cleanupExpeditionRoom(roomId).catch(() => {});
        if (me) setPlayerState({ hp: me.hp ?? GUEST_BASE_STATS.hp, maxHP: me.maxHP ?? GUEST_BASE_STATS.maxHP, atk: me.atk ?? playerState.atk, def: me.def ?? playerState.def });
        if (floorIndex >= 2) { setResult({ won: true, floorsCleared: 3 }); setPhase("finished"); }
        else setPhase("floorDone");
      }
    });
    return unsub;
  }, [roomId]); // eslint-disable-line

  function nextFloor() {
    setFloorIndex(i => i + 1);
    setRoomId(null);
    setPhase("intro");
  }

  if (phase === "floorDone") {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#1e293b" }}>第 {floorIndex + 1} 層通過！</div>
        <button onClick={nextFloor}
          style={{ padding: "14px 32px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
          繼續前進
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
        <div style={{ fontSize: 56 }}>{result?.won ? "🏆" : "💀"}</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#1e293b" }}>
          {result?.won ? "恭喜通關地下城！" : "挑戰失敗"}
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          通關 {result?.floorsCleared || 0} / 3 層
        </div>
        <button onClick={() => { setFloorIndex(0); setPlayerState(GUEST_BASE_STATS); setResult(null); setPhase("intro"); }}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "#7c3aed", color: "white", fontWeight: 900, cursor: "pointer" }}>
          再挑戰一次
        </button>
        {onExit && (
          <button onClick={onExit} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>
            返回首頁
          </button>
        )}
      </div>
    );
  }

  if (phase === "battle" && roomId) {
    return (
      <DungeonBattleRoom
        roomId={roomId}
        isMapMode={true}
        expeditionMode={true}
        onReturnToMap={() => {}}
        onExit={() => { setResult({ won: false, floorsCleared: floorIndex }); setPhase("finished"); }}
      />
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
      <div style={{ fontSize: 12, letterSpacing: "0.1em", color: "#7c3aed", fontWeight: 900 }}>
        第 {floorIndex + 1} / 3 層{isBossFloor ? "・最終王" : ""}
      </div>
      <div style={{ fontSize: 48 }}>{monster.icon}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#1e293b" }}>{monster.name}</div>
      <div style={{ fontSize: 13, color: "#64748b", maxWidth: 260 }}>{monster.desc}</div>
      <button onClick={startFloor} disabled={phase === "loading"}
        style={{ padding: "14px 32px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "white", fontWeight: 900, fontSize: 15, cursor: phase === "loading" ? "default" : "pointer", opacity: phase === "loading" ? 0.6 : 1 }}>
        {phase === "loading" ? "準備中…" : (floorIndex === 0 ? "⚔️ 開始挑戰" : "⚔️ 進入下一層")}
      </button>
    </div>
  );
}
