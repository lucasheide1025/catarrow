// src/components/dungeon/DungeonExpedition.jsx
// 遠征模式主體 — 單人、手動推進
// 第 1、2 層：5×5 迷霧格子地圖（expeditionGrid.generateGridFloor）
// 第 3 層：入口 → A/B/C 三選一（鎖定）→ 3 功能房 → 休息 → 王 → 寶箱
// HP / buff 全程跨房間、跨樓層持續；功能房走「本地單人模式」不寫 Firestore

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { drawFloorMonsters, drawMixedMonsterPool, drawExpeditionBoss } from "../../lib/monsterData";
import { buildExpeditionMemberData } from "../../lib/expeditionMemberData";
import { subscribeCardCollection } from "../../lib/db";
import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";
import {
  getExcavationDifficulty,
  DUNGEON_SHOP_ITEMS,
  drawDungeonEvent,
} from "../../lib/dungeonData";
import {
  generateGridFloor,
  generateBranchFloor,
  isAdjacent,
  GRID_SIZE,
} from "../../lib/expeditionGrid";
import {
  createExpeditionBattleRoom,
  cleanupExpeditionRoom,
  broadcastExpeditionFailure,
  calculateExpeditionRewards,
  saveExpeditionRecord,
  grantExpeditionRewards,
  setActiveExpeditionProgress,
  clearActiveExpeditionProgress,
} from "../../lib/expeditionDb";
import { trySetDungeonFirstClear, addDungeonBroadcast } from "../../lib/dungeonDb";
import {
  completeExcavation,
  abandonExcavation,
  removeSavedDungeon,
} from "../../lib/dungeonExcavation";
import {
  addArrowdew,
  addChests,
  addCoins,
  addMaterials,
  addMonsterCard,
} from "../../lib/db";
import {
  buildExpeditionParty,
  collectBattleStats,
  createExpeditionKillLoot,
  emptyExpeditionLoot,
  mergeExpeditionLoot,
  mergeExpeditionStats,
} from "../../lib/expeditionRewards";
import { rollRuneDrop } from "../../lib/runeData";
import { addRune } from "../../lib/runeDb";
import { makeCoinChest, floorToMonsterTier } from "../../lib/lootTable";
import { MATERIALS } from "../../lib/monsterMaterials";
import {
  sfxTap, sfxDoorOpen, sfxPathSelect, sfxBuff, sfxDebuff,
  sfxCoinDrop, sfxPotionDrink, sfxShopBuy, sfxVictory, sfxCounter,
} from "../../lib/sound";
import DungeonBattleRoom from "./DungeonBattleRoom";
import DungeonExpeditionResult from "./DungeonExpeditionResult";
import DungeonShop from "./DungeonShop";
import DungeonTrap from "./DungeonTrap";
import DungeonEvent from "./DungeonEvent";
import DungeonChest from "./DungeonChest";
import DungeonRest from "./DungeonRest";
import DungeonTreasureRoom from "./DungeonTreasureRoom";
import { GridMapStage, BranchStage } from "./DungeonStages";

// ── 樓層名稱 ────────────────────────────────────────────
const FLOOR_LABELS = [
  { icon:"🌿", title:"第 1 層 · 探索層", desc:"迷霧籠罩的 5×5 地圖：少量怪物與大量事件，小心陷阱！" },
  { icon:"⚔️", title:"第 2 層 · 戰鬥層", desc:"迷霧更深、怪物更多，還有一隻精英怪擋路！" },
  { icon:"👑", title:"第 3 層 · 王關",   desc:"三條岔路只能選一條——盡頭是 Boss 與寶藏！" },
];


// ── 戰鬥包裝元件 ────────────────────────────────────────
function ExpeditionBattleRoom({
  memberData, memberName, monster,
  difficultyTier, floorIndex, roomType,
  arrowsPerRound, targetFmt,
  onDone, onAbandon, guestProfile,
}) {
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [battleDone, setBattleDone] = useState(false);
  const terminalHandledRef = useRef(false);
  const timerRef = useRef(null);

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
        arrowsPerRound,
        targetFmt,
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

  // 用 ref 避免 stale closure
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const memberIdRef = useRef(memberData?.id);
  memberIdRef.current = memberData?.id;

  // 監聽房間狀態變化；結束時帶回戰後成員狀態（HP/buff 跨房間持續）
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "dungeonRooms", roomId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const me = data.members?.[memberIdRef.current] || null;
      const finishBattle = (won, delay) => {
        if (terminalHandledRef.current) return;
        terminalHandledRef.current = true;
        setBattleDone(true);
        timerRef.current = setTimeout(async () => {
          await cleanupExpeditionRoom(roomId).catch(() => {});
          onDoneRef.current({ won, member: me, battle: data });
        }, delay);
      };

      // 檢測戰鬥結束
      if (data.status === "completed" && data.result === "lose") {
        finishBattle(false, 1500);
      } else if (data.status === "map_explore") {
        finishBattle(true, 300);
      }
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [roomId]);

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
      guestProfile={guestProfile}
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

// ══════════════════════════════════════════════════════════════
// ▼▼▼  主元件  ▼▼▼
// ══════════════════════════════════════════════════════════════

export default function DungeonExpedition({
  excavation,
  profile,
  onComplete,
  onAbandon: onAbandonProp,
  isGuest,
  tierCap,
}) {
  const myId = profile?.id;
  // 卡片裝備加成（世界王卡等，地下城遠征本來沒串接，2026-07-09 補上）
  const [cardColl, setCardColl] = useState({ cards: {}, wbCards: {}, equipped: [] });
  useEffect(() => {
    if (!myId) return;
    return subscribeCardCollection(myId, setCardColl);
  }, [myId]);
  const cardBonus = calcEquippedBonus(resolveEquippedCards(cardColl));
  // 難度封頂第二層防禦：訪客/兒童一律夾在 1~tierCap（不完全信任上游 GuestDungeonEntry 傳來的值）
  // 見 .trellis/tasks/07-10-guest-kid-dungeon-parity/design.md §3
  const difficultyTier = isGuest
    ? Math.min(Math.max(1, excavation?.difficulty || 1), tierCap || 2)
    : (excavation?.difficulty || 1);
  const isFromStorage = excavation?.fromStorage === true;
  const savedId = excavation?.savedId;
  const family = excavation?.family || "ghost";
  // 訪客/兒童：不信任上游傳入的 boss 物件（可能是封頂前抽出的），一律用已封頂的 difficultyTier 重新抽王，
  // 確保王關戰鬥本身也真的被夾住，不只是樓層怪物池／獎勵倍率（design.md §3 的「兩層都要夾」）
  // useMemo 鎖定同一場遠征內的王身份，避免每次 render 都重抽（family/difficultyTier 不變就不重算）
  const guestFixedBoss = useMemo(
    () => (isGuest ? drawExpeditionBoss(difficultyTier, family) : null),
    [isGuest, difficultyTier, family],
  );
  const fixedBoss = isGuest ? guestFixedBoss : (excavation?.boss || null);
  const isHidden = excavation?.isHidden || false;
  const arrowsPerRound = excavation?.arrowsPerRound === 3 ? 3 : 6;
  const targetFmt = excavation?.targetFmt || "full_110";
  // 意外離開/重整後「回到房間」：從已完成的層數（0~2）續玩，而不是被迫結算或從頭開始。
  // 戰利品本來就是打一隻入袋一次（已存帳），所以不必還原整張地圖，只要回到該層即可。
  // HP 不回滿——還原離開前保存的 HP，避免玩家靠「重整」無限回血刷關。
  const resumeFromFloor = Math.max(0, Math.min(2, Math.floor(Number(excavation?.resumeFromFloor) || 0)));
  const resumeHp = Math.max(0, Math.floor(Number(excavation?.resumeHp) || 0));
  const [phase, setPhase] = useState(isFromStorage ? "consume" : "intro");
  const [entryError, setEntryError] = useState("");

  // 從儲存槽啟動時先消耗槽位；失敗時不可進入戰鬥。
  useEffect(() => {
    if (isFromStorage && myId && savedId) {
      removeSavedDungeon(myId, savedId).then(result => {
        if (!result?.ok) {
          setEntryError(result?.reason || "無法消耗地下城儲存槽");
          setPhase("entry_error");
          return;
        }
        setPhase("intro");
      });
    }
  }, [isFromStorage, myId, savedId]);

  const [floorIndex, setFloorIndex] = useState(0);
  // 第 1、2 層：格子地圖狀態
  const [gridFloor, setGridFloor] = useState(null);
  const [playerPos, setPlayerPos] = useState(null);
  const [visitedIds, setVisitedIds] = useState(() => new Set());
  // 第 3 層：分支狀態
  const [branchFloor, setBranchFloor] = useState(null);
  const [branchChoice, setBranchChoice] = useState(null);
  const [branchStep, setBranchStep] = useState(0);
  // 進行中的房間
  const [pendingRoom, setPendingRoom] = useState(null);
  const [monsterPool, setMonsterPool] = useState({ monsters: [], elite: null, boss: null });
  const [floorsCleared, setFloorsCleared] = useState(0);
  const [wonLast, setWonLast] = useState(false);
  const [resultRewards, setResultRewards] = useState(null);
  // 玩家持續狀態（HP / buff 跨房間、跨樓層帶著走）
  const [playerState, setPlayerState] = useState(null);

  // 進度持久化：斷線/關閉瀏覽器後可在 DungeonLobby 偵測，選擇「回到房間續玩」或「結算」。
  // 一併保存目前 HP（隨 hp 變動即時更新），續玩時還原離開前的 HP，避免重整回滿血刷關。
  useEffect(() => {
    if (!myId) return;
    setActiveExpeditionProgress(myId, {
      family, difficultyTier, isHidden, floorsCleared,
      hp: playerState?.hp, maxHP: playerState?.maxHP,
    }).catch(() => {});
  }, [myId, family, difficultyTier, isHidden, floorsCleared, playerState?.hp, playerState?.maxHP]);
  const [runLoot, setRunLoot] = useState(() => emptyExpeditionLoot());
  const [runStats, setRunStats] = useState({});
  // 可變怪物佇列（每場戰鬥消耗一隻）
  const monsterQueueRef = useRef([]);
  // 樓層事件修正（怪物 HP/ATK 倍率等）
  const floorModsRef = useRef({});
  const nextFloorModsRef = useRef({});

  const coins = profile?.coins ?? 0; // profile 為即時快照，addCoins 後自動更新

  const startFloor = useCallback((fi) => {
    setFloorIndex(fi);
    setPendingRoom(null);
    floorModsRef.current = { ...nextFloorModsRef.current };
    nextFloorModsRef.current = {};
    const monsters = drawFloorMonsters(fi, difficultyTier, {
      family,
      fixedBoss,
    });
    setMonsterPool(monsters);
    monsterQueueRef.current = [...(monsters.monsters || [])];
    if (fi < 2) {
      const gen = generateGridFloor(fi, difficultyTier);
      setGridFloor(gen);
      setPlayerPos(gen.startPos);
      setVisitedIds(new Set([gen.grid[gen.startPos.y][gen.startPos.x]]));
      setBranchFloor(null);
    } else {
      setBranchFloor(generateBranchFloor());
      setBranchChoice(null);
      setBranchStep(0);
      setGridFloor(null);
    }
    setPhase("floor_intro");
  }, [difficultyTier, family, fixedBoss]);

  // 初始化玩家狀態 + 第一層
  useEffect(() => {
    if (phase === "intro") {
      const base = buildExpeditionMemberData(profile, cardBonus);
      // 續玩：HP 用離開前保存的值（夾在 1~maxHP，避免回滿刷血）；全新開始才用滿血 base.hp。
      const isResume = resumeFromFloor > 0 || resumeHp > 0;
      const startHp = isResume ? Math.max(1, Math.min(resumeHp || base.hp, base.maxHP)) : base.hp;
      setPlayerState({
        hp: startHp,
        maxHP: base.maxHP,
        atk: base.atk,
        def: base.def,
        wbBonus: base.wbBonus,
        buffs: { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: false },
      });
      if (resumeFromFloor > 0) setFloorsCleared(resumeFromFloor);
      startFloor(resumeFromFloor);
    }
  }, [phase, startFloor]); // eslint-disable-line

  const showResult = useCallback((won, cleared) => {
    setWonLast(won);
    setFloorsCleared(cleared);
    setResultRewards(calculateExpeditionRewards({
      difficultyTier,
      floorsCleared: cleared,
      won,
      family,
    }));
    // 寶箱王擊殺加碼：大量金幣+材料+寶箱+符文（隱藏地下城才會走到這裡，family 一定是 treasure）
    if (won && family === "treasure" && myId) {
      addCoins(myId, 300 + difficultyTier * 100).catch(() => {});
      const legendaryPool = MATERIALS.filter(m => m.rarity === "legendary");
      const kingMaterials = Array.from({ length: 3 }, () =>
        legendaryPool[Math.floor(Math.random() * legendaryPool.length)]
      ).filter(Boolean);
      if (kingMaterials.length > 0) addMaterials(myId, kingMaterials).catch(() => {});
      addChests(myId, [makeCoinChest(floorToMonsterTier(difficultyTier), "寶箱王掉落")]).catch(() => {});
      const droppedRune = rollRuneDrop(difficultyTier);
      if (droppedRune) addRune(myId, droppedRune.id, 1).catch(() => {});
    }
    setPhase("result");
  }, [difficultyTier, family, myId]); // eslint-disable-line

  // ── 分支序列（第 3 層）──────────────────────────────────
  const branchSeq = useMemo(() => {
    if (!branchFloor || !branchChoice) return [];
    const b = branchFloor.branches[branchChoice];
    return [...b.rooms, branchFloor.boss, branchFloor.treasure];
  }, [branchFloor, branchChoice]);

  // ── 房間清除 ────────────────────────────────────────────
  const markRoomCleared = useCallback((roomId) => {
    setGridFloor(prev => prev ? {
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? { ...r, cleared: true } : r),
    } : prev);
  }, []);

  const finishPendingRoom = useCallback(() => {
    if (pendingRoom) {
      if (floorIndex < 2) {
        markRoomCleared(pendingRoom.id);
      } else {
        setBranchStep(s => s + 1);
      }
    }
    setPendingRoom(null);
    setPhase(floorIndex < 2 ? "grid" : "branch");
  }, [pendingRoom, floorIndex, markRoomCleared]);

  // ── 本地效果套用（功能房 → 玩家狀態）────────────────────
  const applyEventEffect = useCallback((ev) => {
    const eff = ev?.effect || {};
    const r2 = v => Math.round(v * 100) / 100;
    switch (eff.type) {
      case "hp_restore_all":
        sfxBuff();
        setPlayerState(p => ({ ...p, hp: Math.min(p.maxHP, Math.round(p.hp + p.maxHP * eff.value)) }));
        break;
      case "atk_debuff_all":
      case "atk_buff_one":
        (eff.value >= 1 ? sfxBuff : sfxDebuff)();
        setPlayerState(p => ({ ...p, buffs: { ...p.buffs, atkMult: r2((p.buffs.atkMult || 1) * eff.value) } }));
        break;
      case "def_mult_all":
        sfxBuff();
        setPlayerState(p => ({ ...p, buffs: { ...p.buffs, defMult: r2((p.buffs.defMult || 1) * eff.value) } }));
        break;
      case "dmg_mult_all":
        (eff.value >= 1 ? sfxBuff : sfxDebuff)();
        setPlayerState(p => ({ ...p, buffs: { ...p.buffs, dmgMult: r2((p.buffs.dmgMult || 1) * eff.value) } }));
        break;
      case "gold_bonus":
        sfxCoinDrop();
        addCoins(myId, eff.value).catch(() => {});
        break;
      case "monster_hp_mult":
        nextFloorModsRef.current.monsterHpMult = eff.value; // 「下一層怪物」
        break;
      case "monster_atk_mult":
        floorModsRef.current.monsterAtkMult = eff.value; // 「本層怪物」
        break;
      case "gold_mult":
        floorModsRef.current.goldMult = eff.value;
        break;
      case "skip_counter":
        floorModsRef.current.skipCounter = true; // 保留欄位（單人戰鬥房暫不支援）
        break;
      default:
        break;
    }
  }, [myId]);

  const handleLocalEffect = useCallback((effect) => {
    if (!effect) return;
    switch (effect.type) {
      case "hp_loss":
        sfxCounter();
        setPlayerState(p => ({ ...p, hp: Math.max(1, p.hp - effect.value) }));
        break;
      case "buff_mult":
        sfxDebuff();
        setPlayerState(p => ({
          ...p,
          buffs: { ...p.buffs, [effect.key]: Math.round((p.buffs[effect.key] || 1) * effect.value * 100) / 100 },
        }));
        break;
      case "heal_pct":
        sfxPotionDrink();
        setPlayerState(p => ({ ...p, hp: Math.min(p.maxHP, p.hp + Math.round(p.maxHP * effect.value)) }));
        break;
      case "cure":
        sfxBuff();
        setPlayerState(p => {
          const b = p.buffs || {};
          if ((b.atkMult || 1) < 1 || (b.defMult || 1) < 1) {
            return { ...p, buffs: { ...b, atkMult: 1, defMult: 1 } };
          }
          return p;
        });
        break;
      case "coins":
        sfxCoinDrop();
        addCoins(myId, effect.value).catch(() => {});
        break;
      case "event":
        applyEventEffect(effect.event);
        break;
      default:
        break;
    }
  }, [myId, applyEventEffect]);

  // 商店本地購買：扣金幣 + 套用效果
  const handleLocalBuy = useCallback((item) => {
    sfxShopBuy();
    addCoins(myId, -item.cost).catch(() => {});
    setPlayerState(p => {
      const r2 = v => Math.round(v * 100) / 100;
      switch (item.effect) {
        case "hp_restore":
          return { ...p, hp: Math.min(p.maxHP, Math.round(p.hp + p.maxHP * item.value)) };
        case "hp_max_boost": {
          const maxHP = Math.round(p.maxHP * (1 + item.value));
          return { ...p, maxHP, hp: Math.min(maxHP, Math.round(p.hp * (1 + item.value))) };
        }
        case "atk_mult":
          return { ...p, buffs: { ...p.buffs, atkMult: r2((p.buffs.atkMult || 1) * item.value) } };
        case "def_mult":
          return { ...p, buffs: { ...p.buffs, defMult: r2((p.buffs.defMult || 1) * item.value) } };
        case "revival":
          return { ...p, buffs: { ...p.buffs, hasRevival: true } };
        default:
          return p;
      }
    });
  }, [myId]);

  // ── 進入房間 ────────────────────────────────────────────
  const enterRoom = useCallback((room) => {
    const r = { ...room };
    if (["battle", "elite_battle", "boss_battle"].includes(r.type)) {
      const mods = floorModsRef.current;
      const fallbackVariant = floorIndex === 0
        ? "weak"
        : floorIndex === 2
          ? "strong"
          : "normal";
      let mon = r.type === "elite_battle" ? monsterPool.elite
        : r.type === "boss_battle" ? monsterPool.boss
        : (monsterQueueRef.current.shift()
          || drawMixedMonsterPool(1, fallbackVariant, Math.max(1, difficultyTier))[0]);
      if (!mon) {
        // 空房間：直接視為完成
        if (floorIndex < 2) markRoomCleared(r.id);
        else setBranchStep(s => s + 1);
        return;
      }
      r.monster = {
        ...mon,
        hp:  Math.round((mon.hp  || 100) * (mods.monsterHpMult  || 1)),
        atk: Math.round((mon.atk || 10) * (mods.monsterAtkMult || 1)),
      };
      setPendingRoom(r);
      setPhase("battle");
      return;
    }
    if (r.type === "treasure") {
      setPendingRoom(r);
      setPhase("treasure");
      return;
    }
    if (r.type === "shop") {
      const shuffled = [...DUNGEON_SHOP_ITEMS].sort(() => Math.random() - 0.5);
      r.shopItems = shuffled.slice(0, 5).map(i => i.id);
    }
    if (r.type === "event") {
      r.event = drawDungeonEvent();
    }
    setPendingRoom(r);
    setPhase("func_room");
  }, [monsterPool, difficultyTier, floorIndex, markRoomCleared]);

  // ── 格子點擊移動 ────────────────────────────────────────
  const handleCellClick = useCallback((room) => {
    if (!room || !playerPos || !isAdjacent(room.pos, playerPos)) return;
    sfxTap();
    setPlayerPos({ ...room.pos });
    setVisitedIds(prev => {
      const next = new Set(prev);
      next.add(room.id);
      return next;
    });
    if (room.cleared) return;             // 已清除 → 自由通行、不再觸發
    if (room.type === "stairs") return;   // 樓梯：站上後由底部面板確認下樓
    enterRoom(room);
  }, [playerPos, enterRoom]);

  const handleDescend = useCallback(() => {
    sfxDoorOpen();
    setFloorsCleared(prev => Math.max(prev, floorIndex + 1));
    startFloor(floorIndex + 1);
  }, [floorIndex, startFloor]);

  // ── 分支操作（第 3 層）──────────────────────────────────
  const handleChooseBranch = useCallback((key) => {
    sfxPathSelect();
    setBranchChoice(key); // 選定即鎖
  }, []);

  const handleBranchNext = useCallback(() => {
    const room = branchSeq[branchStep];
    if (!room) return;
    sfxDoorOpen();
    enterRoom(room);
  }, [branchSeq, branchStep, enterRoom]);

  // ── 戰鬥結束 ────────────────────────────────────────────
  const handleBattleDone = useCallback(({ won, member, battle }) => {
    // 戰後同步 HP/buff（用 ?? 避免 0 被復活）
    if (member) {
      setPlayerState(prev => prev ? {
        ...prev,
        hp:    member.hp    ?? prev.hp,
        maxHP: member.maxHP ?? prev.maxHP,
        atk:   member.atk   ?? prev.atk,
        def:   member.def   ?? prev.def,
        buffs: { ...prev.buffs, ...(member.buffs || {}) },
      } : prev);
    }
    if (!won) {
      if (!isFromStorage) abandonExcavation(myId).catch(() => {});
      const diff = getExcavationDifficulty(difficultyTier);
      broadcastExpeditionFailure(profile?.name, diff?.label || "").catch(() => {});
      showResult(false, Math.max(floorsCleared, floorIndex));
      return;
    }
    const killLoot = createExpeditionKillLoot(battle?.monster || pendingRoom?.monster);
    if (killLoot.chests.length > 0) {
      addChests(myId, killLoot.chests).catch(() => {});
      setRunLoot(previous => mergeExpeditionLoot(previous, killLoot));
    }
    setRunStats(previous => mergeExpeditionStats(
      previous,
      collectBattleStats(battle?.log),
    ));
    finishPendingRoom();
  }, [myId, isFromStorage, floorIndex, floorsCleared, difficultyTier, profile, pendingRoom, finishPendingRoom, showResult]);

  const handleAbandon = useCallback(() => {
    if (!isFromStorage) abandonExcavation(myId).catch(() => {});
    clearActiveExpeditionProgress(myId).catch(() => {});
    onAbandonProp?.();
  }, [myId, isFromStorage, onAbandonProp]);

  // 寶藏房獎勵入袋（金幣 + 收藏品；一次性）
  const handleTreasureLoot = useCallback((loot) => {
    if (!loot) return;
    if (loot.coins > 0) addCoins(myId, loot.coins).catch(() => {});
    if (loot.arrowDew > 0) addArrowdew(myId, loot.arrowDew).catch(() => {});
    if (loot.material?.id) addMaterials(myId, [loot.material]).catch(() => {});
    if (loot.card) addMonsterCard(myId, loot.card).catch(() => {});
    const treasureChestLoot = createExpeditionKillLoot(
      fixedBoss || monsterPool.boss || {
        id: "treasure_reward",
        name: "寶藏房",
        family,
        tier: ["common","rare","elite","fierce","boss","mythic"][difficultyTier - 1] || "common",
        variant: "boss",
      },
    );
    if (treasureChestLoot.chests.length > 0) {
      addChests(myId, treasureChestLoot.chests).catch(() => {});
    }
    if (loot.extraItem?.id) {
      import("../../lib/dungeonDb").then(({ addCollectibles }) => {
        addCollectibles(myId, [{ itemId: loot.extraItem.id, qty: 1 }]).catch(() => {});
      }).catch(() => {});
    }
    setRunLoot(previous => mergeExpeditionLoot(previous, treasureChestLoot, {
      bonusCoins: loot.coins || 0,
      bonusArrowDew: loot.arrowDew || 0,
      treasure: [
        ...(loot.material ? [{ ...loot.material, kind: "material" }] : []),
        ...(loot.extraItem ? [{ ...loot.extraItem, kind: "collectible" }] : []),
        ...(loot.card ? [{ ...loot.card, kind: "card" }] : []),
        ...(loot.arrowDew > 0
          ? [{ id: "arrowdew", name: `箭露 +${loot.arrowDew}`, icon: "💧", kind: "resource" }]
          : []),
      ],
    }));
  }, [myId, fixedBoss, monsterPool.boss, family, difficultyTier]);

  // 領取獎勵 + 儲存紀錄
  const handleFinish = useCallback(() => {
    const rewards = resultRewards;
    if (!rewards) return;
    // 發放獎勵
    grantExpeditionRewards(myId, rewards).catch(() => {});
    clearActiveExpeditionProgress(myId).catch(() => {});
    // 儲存紀錄
    saveExpeditionRecord(myId, {
      family,
      difficulty: difficultyTier,
      isHidden,
      floorsCleared,
      won: wonLast,
      coins: rewards.coins,
      arrowDew: rewards.arrowDew,
      archerXP: rewards.archerXP,
    }).catch(() => {});

    // ── 遠征首殺判定 ────────────────────────────────────────
    if (wonLast) {
      const expeditionKey = `expedition_${family}_${difficultyTier}`;
      const diff = getExcavationDifficulty(difficultyTier);
      const FAMILY_MAP = { ghost:{e:"👻",l:"幽冥系"}, mountain:{e:"⛰️",l:"山嶺系"}, insect:{e:"🦋",l:"昆蟲系"}, workplace:{e:"💼",l:"職場系"}, exam:{e:"📝",l:"考試系"}, temple:{e:"🏛️",l:"神廟系"}, treasure:{e:"📦",l:"寶箱族"} };
      const f = FAMILY_MAP[family] || {e:"🏰",l:"遠征"};
      trySetDungeonFirstClear(expeditionKey, myId, profile?.name || "射手", []).then(fcResult => {
        if (fcResult.isFirst) {
          addDungeonBroadcast(expeditionKey, `遠征-${f.l}`, diff?.label || `Lv.${difficultyTier}`, f.e, [], profile?.nickname || profile?.name || "射手").catch(() => {});
        }
      }).catch(() => {});
    }

    // 重置挖掘進度
    if (!isFromStorage) completeExcavation(myId).catch(() => {});
    onComplete?.();
    return true;
  }, [resultRewards, myId, isFromStorage, difficultyTier, floorsCleared, wonLast, family, isHidden, profile, onComplete]);

  // ── 本地房間文件（功能房共用，隨 playerState 即時更新）──
  const localRoomDoc = useMemo(() => {
    if (!playerState) return null;
    return {
      members: {
        [myId]: {
          name: profile?.name || "射手",
          hp: playerState.hp,
          maxHP: playerState.maxHP,
          atk: playerState.atk,
          def: playerState.def,
          alive: playerState.hp > 0,
          role: "front",
          buffs: playerState.buffs,
        },
      },
      roomConfirms: {},
      roomChoices: {},
      shopItems: pendingRoom?.shopItems || [],
      shopPurchases: {},
      currentEvent: pendingRoom?.event || null,
      mapDungeonId: `${family}_expedition`,
      activeRoomId: pendingRoom?.id || null,
    };
  }, [playerState, pendingRoom, myId, profile, family]);

  // ── 渲染 ────────────────────────────────────────────────

  if (phase === "entry_error") {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-white"
        style={{ background:"#0a0a0f" }}>
        <div className="text-5xl">⚠️</div>
        <div className="text-lg font-black">無法開始地下城</div>
        <div className="text-sm text-rose-300 text-center">{entryError}</div>
        <button onClick={onAbandonProp}
          className="px-6 py-3 rounded-xl bg-slate-700 font-bold">
          返回地下城選單
        </button>
      </div>
    );
  }

  if (phase === "floor_intro") {
    return (
      <FloorIntro
        floorIndex={floorIndex}
        difficultyTier={difficultyTier}
        onStart={() => setPhase(floorIndex < 2 ? "grid" : "branch")}
      />
    );
  }

  if (phase === "grid" && gridFloor && playerState) {
    return (
      <GridMapStage
        gridFloor={gridFloor}
        playerPos={playerPos}
        visitedIds={visitedIds}
        floorIndex={floorIndex}
        playerState={playerState}
        coins={coins}
        onCellClick={handleCellClick}
        onDescend={handleDescend}
        onRetreat={handleAbandon}
      />
    );
  }

  if (phase === "branch" && branchFloor && playerState) {
    return (
      <BranchStage
        branchFloor={branchFloor}
        branchChoice={branchChoice}
        branchSeq={branchSeq}
        branchStep={branchStep}
        playerState={playerState}
        coins={coins}
        onChoose={handleChooseBranch}
        onEnterNext={handleBranchNext}
        onRetreat={handleAbandon}
      />
    );
  }

  // 功能房（本地單人模式）
  if (phase === "func_room" && pendingRoom && localRoomDoc) {
    const common = {
      roomId: "local",
      room: localRoomDoc,
      memberId: myId,
      isHost: true,
      localMode: true,
      onLocalEffect: handleLocalEffect,
      onLocalDone: finishPendingRoom,
    };
    switch (pendingRoom.type) {
      case "shop":
        return (
          <DungeonShop
            {...common}
            memberData={{ id: myId, coins, hp: playerState.hp, maxHP: playerState.maxHP, buffs: playerState.buffs }}
            onLocalBuy={handleLocalBuy}
          />
        );
      case "trap":
        return <DungeonTrap {...common} />;
      case "event":
        return <DungeonEvent {...common} />;
      case "chest":
        return <DungeonChest {...common} />;
      case "rest":
        return <DungeonRest {...common} />;
      default:
        // 不認得的房型：提供手動跳過（避免 render 期間觸發 setState）
        return (
          <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 text-white/60"
            style={{ background:"#0a0a0f" }}>
            <div style={{ fontSize:40 }}>🗺️</div>
            <button onClick={finishPendingRoom}
              style={{ padding:"10px 28px", borderRadius:12, border:"none", cursor:"pointer",
                background:"#334155", color:"#e2e8f0", fontWeight:800 }}>
              繼續探索
            </button>
          </div>
        );
    }
  }

  // 寶藏房（第 3 層終點）
  if (phase === "treasure") {
    return (
      <DungeonTreasureRoom
        difficultyTier={difficultyTier}
        family={family}
        onLoot={handleTreasureLoot}
        onClaim={() => { sfxVictory(); showResult(true, 3); }}
      />
    );
  }

  if (phase === "battle" && pendingRoom?.monster && playerState) {
    return (
      <ExpeditionBattleRoom
        key={pendingRoom.id}
        memberData={{
          ...buildExpeditionMemberData(profile, cardBonus),
          id: myId,
          hp: playerState.hp,
          maxHP: playerState.maxHP,
          atk: playerState.atk,
          def: playerState.def,
          wbBonus: playerState.wbBonus,
          buffs: playerState.buffs,
        }}
        memberName={profile?.name || "射手"}
        monster={pendingRoom.monster}
        difficultyTier={difficultyTier}
        floorIndex={floorIndex}
        roomType={pendingRoom.type === "boss_battle" ? "boss" : pendingRoom.type === "elite_battle" ? "elite" : "monster"}
        arrowsPerRound={arrowsPerRound}
        targetFmt={targetFmt}
        onDone={handleBattleDone}
        onAbandon={handleAbandon}
        guestProfile={isGuest ? profile : undefined}
      />
    );
  }

  // ── 結算畫面 ────────────────────────────────────────────
  if (phase === "result") {
    if (!resultRewards) return null;
    return (
      <DungeonExpeditionResult
        won={wonLast}
        family={family}
        difficultyTier={difficultyTier}
        isHidden={isHidden}
        rewards={resultRewards}
        loot={runLoot}
        party={buildExpeditionParty({
          [myId]: {
            name: profile?.name || "射手",
            alive: playerState?.hp > 0,
          },
        }, myId, runStats)}
        boss={fixedBoss || monsterPool.boss}
        floorsCleared={floorsCleared}
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
