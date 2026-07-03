// src/components/dungeon/DungeonExpedition.jsx
// 遠征模式三層流程主體 — 單人、自動推進

import { useState, useEffect, useRef, useCallback } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { drawFloorMonsters, drawMixedMonsterPool } from "../../lib/monsterData";
import {
  getExcavationDifficulty,
  EXCAVATION_FLOOR_CONFIG,
} from "../../lib/dungeonData";
import {
  createExpeditionBattleRoom,
  cleanupExpeditionRoom,
  broadcastExpeditionFailure,
} from "../../lib/expeditionDb";
import {
  completeExcavation,
  abandonExcavation,
} from "../../lib/dungeonExcavation";
import DungeonBattleRoom from "./DungeonBattleRoom";

// ── 樓層名稱 ────────────────────────────────────────────
const FLOOR_LABELS = [
  { icon:"\uD83C\uDF3F", title:"第 1 層 · 探索層", desc:"少量怪物與大量事件，小心陷阱！" },
  { icon:"\u2694\uFE0F", title:"第 2 層 · 戰鬥層", desc:"怪物增加，做好準備！" },
  { icon:"\uD83D\uDC51", title:"第 3 層 · 王關",   desc:"精英、Boss，以及…寶藏！" },
];

// ── 從權重表抽房間類型 ──────────────────────────────────
function pickRoomType(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, v]) => s + v.weight, 0);
  let r = Math.random() * total;
  for (const [key, val] of entries) {
    r -= val.weight;
    if (r <= 0) return key;
  }
  return entries[0][0];
}

// ── 產生樓層房間序列 ────────────────────────────────────
function generateFloorSequence(floorIndex, config, difficultyTier) {
  if (floorIndex === 2) {
    // 第 3 層固定順序
    return [
      { type:"elite_battle", label:"精英守衛" },
      { type:"rest",        label:"休息區" },
      { type:"shop",        label:"神秘商人" },
      { type:"boss_battle", label:"Boss" },
      { type:"treasure",    label:"寶藏房" },
    ];
  }

  const weights = config.roomTypes;
  const seq = [];

  // 首個房間一定是戰鬥
  seq.push({ type:"battle", label:"入口遭遇" });

  // 中間房間：混合房間類型
  const middleCount = floorIndex === 0
    ? 1 + Math.floor(Math.random() * 2)
    : 2 + Math.floor(Math.random() * 2);

  for (let i = 0; i < middleCount; i++) {
    const roomKey = pickRoomType(weights);
    const roomMap = {
      monsters:  { type:"battle", label:"戰鬥遭遇" },
      events:    { type:"event",  label:"神秘事件" },
      traps:     { type:"trap",   label:"陷阱！" },
      merchants: { type:"shop",   label:"行腳商人" },
      chests:    { type:"chest",  label:"發現寶箱" },
    };
    seq.push(roomMap[roomKey] || { type:"battle", label:"戰鬥遭遇" });
  }

  // 尾聲：戰鬥+樓梯
  seq.push({ type:"battle", label:"最後的阻礙" });
  seq.push({ type:"stairs", label:"通往下一層" });

  return seq;
}

// ── 戰鬥包裝元件 ────────────────────────────────────────
function ExpeditionBattleRoom({
  memberData, memberName, monster,
  difficultyTier, floorIndex, roomType,
  onDone, onAbandon,
}) {
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [battleDone, setBattleDone] = useState(false);
  const roomRef = useRef(null);

  // 建立戰鬥房間
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await createExpeditionBattleRoom({
        memberId: memberData?.id,
        memberName,
        memberData,
        monster,
        difficultyTier,
        floorIndex,
        roomType: roomType || "monster",
      });
      if (cancelled) return;
      if (res.ok) {
        setRoomId(res.roomId);
        setLoading(false);
      } else {
        setError(res.reason);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // 監聽房間狀態變化
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "dungeonRooms", roomId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      roomRef.current = data;

      // 檢測戰鬥結束
      if (data.status === "completed" && data.result === "lose") {
        setBattleDone(true);
        setTimeout(async () => {
          await cleanupExpeditionRoom(roomId).catch(() => {});
          onDone({ won: false, monster: data.monster, log: data.log || [] });
        }, 1500);
      } else if (data.status === "map_explore") {
        setBattleDone(true);
        setTimeout(async () => {
          await cleanupExpeditionRoom(roomId).catch(() => {});
          onDone({ won: true, monster: data.monster, log: data.log || [] });
        }, 300);
      }
    });
    return () => unsub();
  }, [roomId]); // eslint-disable-line

  if (loading) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4"
        style={{ background:"#0a0a0f", color:"rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize:48 }}>⚔️</div>
        <div style={{ fontSize:14 }}>初始化戰鬥…</div>
      </div>
    );
  }

  if (error || !roomId) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4"
        style={{ background:"#0a0a0f", color:"rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize:48 }}>❌</div>
        <div style={{ fontSize:14 }}>戰鬥建立失敗：{error || "未知錯誤"}</div>
        <button onClick={onAbandon}
          style={{ padding:"8px 24px", borderRadius:12, background:"#334155", color:"#e2e8f0", border:"none", cursor:"pointer" }}>
          返回
        </button>
      </div>
    );
  }

  if (battleDone) {
    return (
      <div className="h-[100dvh] flex items-center justify-center"
        style={{ background:"#0a0a0f", color:"rgba(255,255,255,0.4)" }}>
        結算中…
      </div>
    );
  }

  return (
    <DungeonBattleRoom
      roomId={roomId}
      isMapMode={true}
      onReturnToMap={() => {}}
      onExit={onAbandon}
    />
  );
}

// ── 樓層過場動畫 ────────────────────────────────────────
function FloorIntro({ floorIndex, difficultyTier, onStart }) {
  const [show, setShow] = useState(false);
  const [canStart, setCanStart] = useState(false);

  useEffect(() => {
    setShow(true);
    const t = setTimeout(() => setCanStart(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const floor = FLOOR_LABELS[floorIndex] || FLOOR_LABELS[0];
  const diff = getExcavationDifficulty(difficultyTier);

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center gap-6 px-6 text-white"
      style={{ background:"linear-gradient(160deg,#0f172a,#1e1b4b)" }}>
      <div style={{
        fontSize:64,
        animation: show ? "ei-bounce 0.6s ease-out" : "none",
      }}>{floor.icon}</div>
      <div style={{
        fontSize:24, fontWeight:900,
        animation: show ? "ei-fade 0.5s 0.3s ease both" : "none",
      }}>{floor.title}</div>
      <div style={{
        fontSize:13, color:"#94a3b8", textAlign:"center", maxWidth:280,
        animation: show ? "ei-fade 0.5s 0.5s ease both" : "none",
      }}>{floor.desc}</div>
      <div style={{
        display:"flex", gap:6,
        animation: show ? "ei-fade 0.5s 0.7s ease both" : "none",
      }}>
        <span style={{ background:"rgba(255,255,255,0.08)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"#94a3b8" }}>
          {diff?.icon} {diff?.label}
        </span>
        {floorIndex === 2 && (
          <span style={{ background:"rgba(239,68,68,0.15)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"#f87171", fontWeight:700 }}>
            ⚠️ Boss 層
          </span>
        )}
      </div>
      {canStart && (
        <button onClick={onStart}
          style={{
            padding:"14px 48px", borderRadius:14, fontWeight:900, fontSize:16,
            border:"none", cursor:"pointer",
            background:"linear-gradient(90deg,#f59e0b,#d97706)",
            color:"white",
          }}>
          {floorIndex === 2 ? "⚔️ 出發！" : "🗺️ 開始探索"}
        </button>
      )}
      <style>{`
@keyframes ei-bounce{0%{transform:scale(0.3) rotate(-20deg);opacity:0}55%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes ei-fade{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

// ── 遠征失敗畫面 ────────────────────────────────────────
function ExpeditionFailed({ memberName, difficultyTier, onFinish }) {
  const diff = getExcavationDifficulty(difficultyTier);

  useEffect(() => {
    if (memberName) {
      broadcastExpeditionFailure(memberName, diff?.label || "").catch(() => {});
    }
  }, []); // eslint-disable-line

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center gap-6 px-6 text-white"
      style={{ background:"linear-gradient(160deg,#1a0a0a,#2d0a0a)" }}>
      <div style={{ fontSize:72, animation:"ef-shake 0.5s ease" }}>💀</div>
      <div style={{ fontSize:24, fontWeight:900, color:"#f87171" }}>遠征失敗</div>
      <div style={{ fontSize:13, color:"#94a3b8", textAlign:"center", maxWidth:280 }}>
        你在地下城中陣亡了…
      </div>
      <button onClick={onFinish}
        style={{
          padding:"14px 48px", borderRadius:14, fontWeight:900, fontSize:16,
          border:"none", cursor:"pointer",
          background:"linear-gradient(90deg,#64748b,#475569)",
          color:"white",
        }}>
        返回大廳
      </button>
      <style>{`
@keyframes ef-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-12px)}40%{transform:translateX(10px)}60%{transform:translateX(-8px)}80%{transform:translateX(5px)}}
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  主元件  ▼▼▼
// ══════════════════════════════════════════════════════════════

export default function DungeonExpedition({
  excavation,
  profile,
  onComplete,
  onAbandon: onAbandonProp,
}) {
  const myId = profile?.id;
  const difficultyTier = excavation?.difficulty || 1;

  const [phase, setPhase] = useState("intro");
  const [floorIndex, setFloorIndex] = useState(0);
  const [roomSeq, setRoomSeq] = useState([]);
  const [roomIdx, setRoomIdx] = useState(0);
  const [monsterPool, setMonsterPool] = useState({ monsters: [], elite: null, boss: null });

  const startFloor = useCallback((fi) => {
    const config = EXCAVATION_FLOOR_CONFIG[fi];
    if (!config) {
      setPhase("completed");
      return;
    }
    const seq = generateFloorSequence(fi, config, difficultyTier);
    const monsters = drawFloorMonsters(fi, difficultyTier);

    setFloorIndex(fi);
    setRoomSeq(seq);
    setRoomIdx(0);
    setMonsterPool(monsters);
    setPhase("floor_intro");
  }, [difficultyTier]);

  useEffect(() => {
    if (phase === "intro") {
      startFloor(0);
    }
  }, [phase, startFloor]);

  const advanceRoom = useCallback(() => {
    const nextIdx = roomIdx + 1;
    if (nextIdx >= roomSeq.length) {
      if (floorIndex < 2) {
        startFloor(floorIndex + 1);
      } else {
        setPhase("completed");
      }
      return;
    }
    setRoomIdx(nextIdx);
    setPhase(roomSeq[nextIdx].type);
  }, [roomIdx, roomSeq, floorIndex, startFloor]);

  const handleBattleDone = useCallback(({ won }) => {
    if (!won) {
      abandonExcavation(myId).catch(() => {});
      setPhase("failed");
      return;
    }
    advanceRoom();
  }, [myId, advanceRoom]);

  const handleAbandon = useCallback(() => {
    abandonExcavation(myId).catch(() => {});
    onAbandonProp?.();
  }, [myId, onAbandonProp]);

  const handleFinish = useCallback(() => {
    completeExcavation(myId).catch(() => {});
    onComplete?.();
  }, [myId, onComplete]);

  const currentRoom = roomSeq[roomIdx];

  const getBattleMonster = useCallback(() => {
    const pool = [...(monsterPool.monsters || [])];
    if (pool.length > 0) {
      return pool.shift();
    }
    return drawMixedMonsterPool(1, "normal", Math.max(1, difficultyTier))[0];
  }, [monsterPool, difficultyTier]);

  // ── 渲染 ────────────────────────────────────────────────

  if (phase === "floor_intro") {
    return (
      <FloorIntro
        floorIndex={floorIndex}
        difficultyTier={difficultyTier}
        onStart={() => {
          setPhase(roomSeq[0]?.type || "battle");
        }}
      />
    );
  }

  if (phase === "battle" || phase === "elite_battle" || phase === "boss_battle") {
    const monster = phase === "elite_battle"
      ? monsterPool.elite
      : phase === "boss_battle"
        ? monsterPool.boss
        : getBattleMonster();

    if (!monster) {
      setTimeout(() => advanceRoom(), 100);
      return (
        <div className="h-[100dvh] flex items-center justify-center text-white/40"
          style={{ background:"#0a0a0f" }}>跳過空房間…</div>
      );
    }

    return (
      <ExpeditionBattleRoom
        memberData={{ ...profile, id: myId }}
        memberName={profile?.name || "射手"}
        monster={monster}
        difficultyTier={difficultyTier}
        floorIndex={floorIndex}
        roomType={phase === "boss_battle" ? "boss" : phase === "elite_battle" ? "elite" : "monster"}
        onDone={handleBattleDone}
        onAbandon={handleAbandon}
      />
    );
  }

  // 非戰鬥房間 — 暫時跳過（後續 Phase 可擴充為實際元件）
  if (["shop", "rest", "trap", "event", "chest", "treasure", "stairs"].includes(phase)) {
    setTimeout(() => advanceRoom(), 100);
    return (
      <div className="h-[100dvh] flex items-center justify-center text-white/40"
        style={{ background:"#0a0a0f" }}>前往下一區域…</div>
    );
  }

  if (phase === "completed") {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-6 px-6 text-white"
        style={{ background:"linear-gradient(160deg,#0a1a0a,#1a2e1a)" }}>
        <div style={{ fontSize:72 }}>🏆</div>
        <div style={{ fontSize:24, fontWeight:900, color:"#4ade80" }}>遠征完成！</div>
        <div style={{ fontSize:13, color:"#94a3b8", textAlign:"center", maxWidth:280 }}>
          你成功穿越了地下城，擊敗了所有敵人！
        </div>
        <button onClick={handleFinish}
          style={{
            padding:"14px 48px", borderRadius:14, fontWeight:900, fontSize:16,
            border:"none", cursor:"pointer",
            background:"linear-gradient(90deg,#22c55e,#16a34a)",
            color:"white",
          }}>
          🎊 領取獎勵
        </button>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <ExpeditionFailed
        memberName={profile?.name}
        difficultyTier={difficultyTier}
        onFinish={handleFinish}
      />
    );
  }

  return (
    <div className="h-[100dvh] flex items-center justify-center text-white/40"
      style={{ background:"#0a0a0f" }}>
      載入遠征…
    </div>
  );
}
