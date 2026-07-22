// src/components/dungeon/DungeonLobby.jsx — 地下城大廳（挖掘探索 + 進入地下城 + 圖鑑 + 遠征 + 組隊）
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import DungeonDex from "./DungeonDex";
import DungeonExcavationTab from "./DungeonExcavationTab";
import DungeonStorageTab from "./DungeonStorageTab";
import DungeonSelectionPanel from "./DungeonSelectionPanel";
import DungeonTeamLobby from "./DungeonTeamLobby";
import GuestDungeonEntry from "./GuestDungeonEntry";
import DungeonExpedition from "./DungeonExpedition";
import TeamExpeditionBattle from "./TeamExpeditionBattle";
import { buildExpeditionMemberData } from "../../lib/expeditionMemberData";
import { subscribeCardCollection } from "../../lib/db";
import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";
import {
  createTeamExpeditionRoom,
  findReconnectableTeamExpedition,
  joinTeamExpeditionRoom,
  subscribeTeamExpeditionRoom,
  subscribeOpenTeamExpeditionRooms,
  startTeamExpeditionRoom,
  clearTeamExpeditionSavedProgress,
} from "../../lib/expeditionTeamDb";
import { getExcavationDifficulty } from "../../lib/dungeonData";
import { normalizeDungeonRunSettings } from "../../lib/dungeonRunSettings";
import dungeonLobbyImage from "../../assets/dungeon/lobby-gate.webp";
import excavationImage from "../../assets/dungeon/excavation.webp";
import entranceImage from "../../assets/dungeon/entrance.webp";
import codexImage from "../../assets/dungeon/codex.webp";

const TAB_HERO = {
  excavate: { image:excavationImage, eyebrow:"DISCOVERY", title:"挖掘探索", desc:"累積挖掘進度，揭露新的地下城線索" },
  enter: { image:entranceImage, eyebrow:"EXPEDITION", title:"整備並進入地下城", desc:"從保存的遺跡中選擇目的地，確認隊伍設定" },
  dex: { image:codexImage, eyebrow:"ARCHIVE", title:"探險圖鑑", desc:"查閱已發現的收藏品與探索紀錄" },
};

function restoreDungeonFromTeamRoom(room) {
  const settings = normalizeDungeonRunSettings(room);
  return {
    id: room.dungeonSavedId || null,
    savedId: room.dungeonSavedId || null,
    family: room.dungeonFamily,
    difficulty: room.dungeonDifficulty,
    isHidden: room.dungeonIsHidden || false,
    boss: room.dungeonBoss || null,
    expansionRunId: room.expansionRunId || null,
    bossEncounter: room.bossEncounter || null,
    ...settings,
  };
}

export default function DungeonLobby({ onBack, guestProfile, isGuest, tierCap, autoReconnectRoomId = null }) {
  const { profile: authProfile } = useAuth();
  const profile = guestProfile || authProfile;
  const myId = profile?.id;
  const myName = profile?.nickname || profile?.name || "射手";
  const [tab, setTab] = useState(() => {
    if (isGuest) return "enter";
    try {
      const initial = sessionStorage.getItem("dungeon_initial_tab");
      sessionStorage.removeItem("dungeon_initial_tab");
      return initial === "dex" ? "dex" : "excavate";
    } catch { return "excavate"; }
  });
  const [expeditionStart, setExpeditionStart] = useState(null);
  // 進入地下城選單狀態
  const [selectedDungeon, setSelectedDungeon] = useState(null);
  // 組隊狀態
  const [teamLobby, setTeamLobby] = useState(null); // { roomId, dungeon, hostId }
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinErr, setJoinErr] = useState("");
  const [openTeamRooms, setOpenTeamRooms] = useState([]);
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const [reconnectRoom, setReconnectRoom] = useState(null);
  const [soloRecovery, setSoloRecovery] = useState(null); // profile.activeExpedition | null
  const [soloSettling, setSoloSettling] = useState(false);

  // 卡片裝備加成（世界王卡等，地下城遠征本來沒串接，2026-07-09 補上）
  const [cardColl, setCardColl] = useState({ cards: {}, wbCards: {}, equipped: [] });
  const [cardReady, setCardReady] = useState(() => isGuest || !myId);
  useEffect(() => {
    if (!myId || isGuest) {
      setCardReady(true);
      return undefined;
    }
    setCardReady(false);
    return subscribeCardCollection(myId, data => {
      setCardColl(data);
      setCardReady(true);
    });
  }, [myId, isGuest]);
  const cardBonus = calcEquippedBonus(resolveEquippedCards(cardColl));
  function buildMemberData() { return buildExpeditionMemberData(profile, cardBonus, cardColl); }

  // 登入地下城首頁時，找回仍包含自己的等待室、進行中遠征或未領取結算。
  useEffect(() => {
    if (!myId) return undefined;
    let cancelled = false;
    findReconnectableTeamExpedition(myId).then(result => {
      if (cancelled || !result.ok) return;
      const room = result.room;
      setReconnectRoom(room);
      // 從主程式的斷線保護入口回來時，直接以房主的 Firestore 房間
      // 狀態重建畫面；不使用本機快取，因此樓層、地圖與戰鬥進度永遠以房主為準。
      if (room && room.id === autoReconnectRoomId) {
        setTeamLobby({
          roomId: room.id,
          dungeon: restoreDungeonFromTeamRoom(room),
          hostId: room.hostId,
        });
        if (room.status === "expedition_active" || room.expeditionPhase === "result") {
          setExpeditionStart({
            teamMode: true,
            teamRoomId: room.id,
            hostId: room.hostId,
          });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [myId, autoReconnectRoomId]);

  // 偵測單人遠征中斷進度（即時訂閱 members/{myId} + 本地 localStorage 雙重保障）
  useEffect(() => {
    let localData = null;
    try {
      const localSave = localStorage.getItem(`active_expedition_${myId || "guest"}`);
      if (localSave) {
        localData = JSON.parse(localSave);
        setSoloRecovery(localData);
      } else if (profile?.activeExpedition) {
        setSoloRecovery(profile.activeExpedition);
      }
    } catch {}

    if (!myId || isGuest) return;
    const unsub = onSnapshot(doc(db, "members", myId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.activeExpedition) {
        setSoloRecovery(data.activeExpedition);
      } else if (!localData) {
        // 只有當雲端為空且本機 localStorage 也沒有進度時，才設為 null
        setSoloRecovery(null);
      }
    });
    return unsub;
  }, [myId, isGuest, profile?.activeExpedition]);

  // 訂閱開放的組隊房間
  useEffect(() => {
    const unsub = subscribeOpenTeamExpeditionRooms(setOpenTeamRooms);
    return unsub;
  }, []);

  // 監聽遠征開始事件（單人用）
  useEffect(() => {
    function handler(e) {
      setExpeditionStart(e.detail || {});
    }
    window.addEventListener("expedition-start", handler);
    return () => window.removeEventListener("expedition-start", handler);
  }, []);

  // ── 非房主：訂閱組隊房間，偵測房主開始遠征 ────────────────
  useEffect(() => {
    if (!teamLobby?.roomId) return;
    // 非房主才需要偵測；房主透過 handleTeamStart 直接觸發
    if (teamLobby.hostId === myId) return;
    const unsub = subscribeTeamExpeditionRoom(teamLobby.roomId, (room) => {
      if (!room) return;
      // 房主開始遠征後先進同步地圖，不必等到建立第一個戰鬥房。
      if (room.status === "expedition_active"
        || room.currentBattleRoomId
        || room.expeditionMapState) {
        setExpeditionStart({
          teamMode: true,
          teamRoomId: teamLobby.roomId,
          hostId: room.hostId,
        });
      }
      // 偵測到房間被解散
      if (room.status === "completed" || room.result === "disbanded") {
        setTeamLobby(null);
        setExpeditionStart(null);
      }
    });
    return () => unsub();
  }, [teamLobby?.roomId, teamLobby?.hostId, myId]);

  // ── 組隊房間（房主按下開始遠征）─────────────────────────
  async function handleTeamStart(_memberList) {
    if (!teamLobby) return;
    const startRes = await startTeamExpeditionRoom(teamLobby.roomId, myId);
    if (!startRes.ok) {
      alert(startRes.reason);
      return false;
    }
    const dungeon = teamLobby.dungeon;
    setExpeditionStart({
      family: dungeon.family,
      difficulty: dungeon.difficulty,
      isHidden: dungeon.isHidden,
      fromStorage: true,
      savedId: dungeon.savedId,
      boss: dungeon.boss || null,
      teamMode: true,
      teamRoomId: teamLobby.roomId,
    });
    return true;
  }

  // ── 用邀請碼加入 ──────────────────────────────────────────
  async function handleJoinByCode() {
    if (!joinCode.trim() || !myId) return;
    setJoinLoading(true);
    setJoinErr("");
    const res = await joinTeamExpeditionRoom(
      joinCode.trim(), myId, myName, buildMemberData()
    );
    if (res.ok) {
      setReconnectRoom(null);
      setTeamLobby({
        roomId: res.roomId,
        dungeon: res.dungeon,
        hostId: res.hostId,
      });
      setJoinCode("");
      setShowJoinPanel(false);
    } else {
      setJoinErr(res.reason);
    }
    setJoinLoading(false);
  }

  function handleReconnect() {
    if (!reconnectRoom) return;
    const restoredLobby = {
      roomId: reconnectRoom.id,
      dungeon: restoreDungeonFromTeamRoom(reconnectRoom),
      hostId: reconnectRoom.hostId,
    };
    setReconnectRoom(null);
    setTeamLobby(restoredLobby);
    if (reconnectRoom.status === "expedition_active"
      || reconnectRoom.expeditionPhase === "result") {
      setExpeditionStart({
        teamMode: true,
        teamRoomId: reconnectRoom.id,
        hostId: reconnectRoom.hostId,
      });
    }
  }

  async function handleSettleSolo() {
    if (!soloRecovery || soloSettling) return;
    setSoloSettling(true);
    try { localStorage.removeItem(`active_expedition_${myId || "guest"}`); } catch {}
    const { settleAbandonedExpedition } = await import("../../lib/expeditionDb");
    await settleAbandonedExpedition(myId, soloRecovery).catch(() => {});
    setSoloRecovery(null);
    setSoloSettling(false);
  }

  // 回到房間續玩：從已完成的層數重新進入，還原離開前的 HP（不回滿，防重整刷血）。
  // 戰利品打一隻就已入袋，故不需還原整張地圖。
  function handleResumeSolo() {
    if (!soloRecovery || soloSettling) return;
    const settings = normalizeDungeonRunSettings(soloRecovery);
    setSoloRecovery(null);
    setExpeditionStart({
      family: soloRecovery.family,
      difficulty: soloRecovery.difficultyTier,
      isHidden: soloRecovery.isHidden,
      resumeFromFloor: soloRecovery.floorsCleared || 0,
      resumeHp: soloRecovery.hp || 0,
      expansionRunId: soloRecovery.expansionRunId || null,
      bossEncounter: soloRecovery.bossEncounter || null,
      mapState: soloRecovery.mapState || null,
      ...settings,
    });
  }

  // ── 遠征模式 ─────────────────────────────────────────────
  if (expeditionStart) {
    if (expeditionStart.teamMode) {
      // 組隊遠征 → 走 TeamExpeditionBattle
      return (
        <TeamExpeditionBattle
          teamRoomId={expeditionStart.teamRoomId}
          profile={profile}
          isHost={teamLobby?.hostId === myId}
          onComplete={() => { setExpeditionStart(null); setSelectedDungeon(null); setTeamLobby(null); }}
          onAbandon={() => { setExpeditionStart(null); setSelectedDungeon(null); setTeamLobby(null); }}
        />
      );
    }
    // 單人遠征
    const handleExitExpedition = () => {
      setExpeditionStart(null);
      setSelectedDungeon(null);
      setTeamLobby(null);
      // 即時重新抓取本地/雲端存檔狀態以更新大廳 UI
      try {
        const localSave = localStorage.getItem(`active_expedition_${myId || "guest"}`);
        if (localSave) {
          setSoloRecovery(JSON.parse(localSave));
        } else if (profile?.activeExpedition) {
          setSoloRecovery(profile.activeExpedition);
        }
      } catch {}
    };

    return (
      <DungeonExpedition
        excavation={expeditionStart}
        profile={profile}
        isGuest={isGuest}
        tierCap={tierCap}
        onComplete={handleExitExpedition}
        onAbandon={handleExitExpedition}
      />
    );
  }

  // ── 組隊等待室 ───────────────────────────────────────────
  if (teamLobby) {
    return (
      <DungeonTeamLobby
        roomId={teamLobby.roomId}
        dungeon={teamLobby.dungeon}
        hostId={teamLobby.hostId}
        profile={profile}
        onStart={handleTeamStart}
        onBack={() => setTeamLobby(null)}
      />
    );
  }

  // ── 主畫面 ───────────────────────────────────────────────
  return (
    <div
      className="min-h-full overflow-x-hidden text-white"
      style={{
        backgroundImage:"linear-gradient(rgba(0,0,0,0.6),rgba(0,0,0,0.6)),url(/ui/page-bg.webp)",
        backgroundSize:"cover",
        backgroundPosition:"center",
        touchAction:"pan-y",
      }}>
      {/* Illustrated expedition base — navigation and copy remain real DOM content. */}
      <div className="relative mx-3 mt-3 min-h-[210px] overflow-hidden rounded-[28px] border border-amber-200/20 shadow-2xl">
        <img src={dungeonLobbyImage} alt="" aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/25 to-slate-950/95" />
        {onBack && (
          <button onClick={onBack} className="absolute left-3 top-3 z-10 min-h-11 rounded-full border border-white/20 bg-slate-950/70 px-4 text-sm font-bold text-white backdrop-blur-md">← 返回</button>
        )}
        <div className="absolute inset-x-0 bottom-0 p-5 text-left">
          <div className="mb-1 text-[10px] font-black tracking-[0.24em] text-amber-300">CAT SQUAD EXPEDITION</div>
          <h1 className="text-3xl font-black text-white drop-shadow-lg">地下城遠征基地</h1>
          <p className="mt-1 text-sm text-slate-200">整理裝備、挖掘遺跡，選擇下一場冒險</p>
        </div>
      </div>

      {/* Tab */}
      <div className="sticky top-0 z-20 px-4 py-3"
        style={{ background:"linear-gradient(180deg,rgba(5,9,20,0.98) 0%,rgba(5,9,20,0.9) 78%,transparent 100%)" }}>
      <div className={`grid ${isGuest ? "grid-cols-2" : "grid-cols-3"} gap-1 rounded-2xl border border-white/10 bg-slate-950/90 p-1.5 shadow-xl backdrop-blur-xl`}>
        {(isGuest ? ["enter","dex"] : ["excavate","enter","dex"]).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t !== "enter") { setSelectedDungeon(null); setShowJoinPanel(false); } }}
            className={`min-h-12 rounded-xl px-2 py-2 text-xs font-black transition-colors focus-visible:ring-2 focus-visible:ring-white/70 ${tab===t ? "bg-amber-300 text-slate-950 shadow-lg" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
            style={{ touchAction:"manipulation" }}>
            <span className="block text-base" aria-hidden="true">{t==="excavate" ? "⛏️" : t==="enter" ? "🗺️" : "📚"}</span>
            {t==="excavate" ? "挖掘探索" : t==="enter" ? "進入地下城" : "探險圖鑑"}
          </button>
        ))}
      </div>
      </div>

      <main className="px-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {(() => {
          const hero = TAB_HERO[tab] || TAB_HERO.enter;
          return (
            <section className="relative mb-4 min-h-[150px] overflow-hidden rounded-2xl border border-white/10 shadow-xl">
              <img src={hero.image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/62 to-slate-950/10" />
              <div className="relative flex min-h-[150px] max-w-[72%] flex-col justify-end p-4">
                <div className="text-[9px] font-black tracking-[0.22em] text-amber-300">{hero.eyebrow}</div>
                <h2 className="mt-1 text-xl font-black text-white">{hero.title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-200">{hero.desc}</p>
              </div>
            </section>
          );
        })()}
        {reconnectRoom && (
          <section
            aria-labelledby="dungeon-reconnect-title"
            className="mb-4 rounded-2xl border border-cyan-300/30 bg-cyan-950/80 p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">🔗</span>
              <div className="min-w-0 flex-1">
                <h2 id="dungeon-reconnect-title" className="text-base font-black text-cyan-100">
                  找到尚未完成的組隊地下城
                </h2>
                <p className="mt-1 text-sm leading-6 text-cyan-100/80">
                  {reconnectRoom.expeditionPhase === "result"
                    ? "戰鬥已結束，返回查看報告並領取獎勵。"
                    : reconnectRoom.status === "expedition_active"
                      ? "遠征仍在進行中，可以重新連結回戰鬥。"
                      : "隊伍仍在等待室，可以返回繼續準備。"}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleReconnect}
                    className="min-h-11 flex-1 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{ touchAction:"manipulation" }}
                  >
                    {reconnectRoom.expeditionPhase === "result"
                      ? "返回結算"
                      : reconnectRoom.status === "expedition_active"
                        ? "重新連結"
                        : "返回等待室"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReconnectRoom(null)}
                    className="min-h-11 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{ touchAction:"manipulation" }}
                  >
                    稍後
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
        {profile?.teamSavedProgress && (
          <section
            aria-labelledby="dungeon-team-saved-title"
            className="mb-4 rounded-2xl border border-blue-400/40 bg-blue-950/80 p-4 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl" aria-hidden="true">📜</span>
              <div className="min-w-0 flex-1">
                <h2 id="dungeon-team-saved-title" className="text-base font-black text-blue-200">
                  您有保存的組隊進度 (第 {(profile.teamSavedProgress.savedFloorIndex || 0) + 1} 層)
                </h2>
                <p className="mt-1 text-sm leading-6 text-blue-200/80">
                  地下城：<b className="text-amber-300">{
                    {
                      ghost: "👻 幽冥系",
                      mountain: "⛰️ 山嶺系",
                      insect: "🦋 昆蟲系",
                      workplace: "💼 職場系",
                      exam: "📝 考試系",
                      temple: "🏛️ 神廟系",
                      treasure: "📦 寶箱族",
                    }[profile.teamSavedProgress.family] || profile.teamSavedProgress.family || "未知"
                  } (T{profile.teamSavedProgress.difficulty || 1})</b><br />
                  點擊下方按鈕即可創建新房間，邀請夥伴從此進度繼續挑戰！
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await createTeamExpeditionRoom({
                        hostId: myId,
                        hostName: myName,
                        dungeon: {
                          family: profile.teamSavedProgress.family,
                          difficulty: profile.teamSavedProgress.difficulty,
                          isHidden: profile.teamSavedProgress.isHidden,
                          boss: profile.teamSavedProgress.boss,
                          expansionRunId: profile.teamSavedProgress.expansionRunId,
                          bossEncounter: profile.teamSavedProgress.bossEncounter,
                          lootMult: profile.teamSavedProgress.lootMult,
                          savedFloorIndex: profile.teamSavedProgress.savedFloorIndex,
                          savedMapState: profile.teamSavedProgress.savedMapState,
                          arrowsPerRound: profile.teamSavedProgress.arrowsPerRound,
                          targetFmt: profile.teamSavedProgress.targetFmt,
                        },
                        memberData: buildMemberData(),
                      });
                      if (res.ok) {
                        setTeamLobby({
                          roomId: res.roomId,
                          dungeon: restoreDungeonFromTeamRoom({
                            dungeonFamily: profile.teamSavedProgress.family,
                            dungeonDifficulty: profile.teamSavedProgress.difficulty,
                            dungeonIsHidden: profile.teamSavedProgress.isHidden,
                            dungeonBoss: profile.teamSavedProgress.boss,
                            expansionRunId: profile.teamSavedProgress.expansionRunId,
                            bossEncounter: profile.teamSavedProgress.bossEncounter,
                            arrowsPerRound: profile.teamSavedProgress.arrowsPerRound,
                            targetFmt: profile.teamSavedProgress.targetFmt,
                          }),
                          hostId: myId,
                        });
                        setTab("enter");
                        setSelectedDungeon(null);
                      } else {
                        alert(`建立房間失敗：${res.reason}`);
                      }
                    }}
                    className="min-h-11 flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{ touchAction:"manipulation" }}
                  >
                    ⚔️ 載入存檔建立房間
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm("確定要棄用/刪除這份組隊進度嗎？此操作無法復原。")) {
                        await clearTeamExpeditionSavedProgress(myId);
                      }
                    }}
                    className="min-h-11 rounded-xl border border-red-400/30 px-4 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{ touchAction:"manipulation" }}
                  >
                    放棄進度
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
        {/* 🗺️ 單人地下城續戰通知卡片 */}
        {soloRecovery && (
          <section
            aria-labelledby="dungeon-solo-recovery-title"
            className="mb-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 p-4 shadow-2xl backdrop-blur-md animate-pulse"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl animate-bounce" aria-hidden="true">🗺️</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 id="dungeon-solo-recovery-title" className="text-base font-black text-amber-200">
                    偵測到進行中的單人地下城
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                    第 {(soloRecovery.mapState?.floorIndex || soloRecovery.floorsCleared || 0) + 1} 層
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-amber-200/80">
                  地下城：<b className="text-amber-300">{
                    {
                      ghost: "👻 幽冥系",
                      mountain: "⛰️ 山嶺系",
                      insect: "🦋 昆蟲系",
                      workplace: "💼 職場系",
                      exam: "📝 考試系",
                      temple: "🏛️ 神廟系",
                      treasure: "📦 寶箱族",
                    }[soloRecovery.family] || soloRecovery.family || "探索中"
                  } (T{soloRecovery.difficultyTier || 1})</b><br />
                  地圖狀態已完好保存！隨時可以回到地圖繼續探索。
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleResumeSolo}
                    disabled={soloSettling}
                    className="min-h-11 flex-1 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-4 py-2.5 text-sm font-black text-slate-950 shadow-lg transition-all hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{ touchAction:"manipulation" }}
                  >
                    🗺️ 繼續地下城冒險
                  </button>
                  <button
                    type="button"
                    onClick={handleSettleSolo}
                    disabled={soloSettling}
                    className="min-h-11 rounded-xl border border-amber-300/40 px-4 py-2.5 text-sm font-bold text-amber-200 transition-colors hover:bg-amber-400/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{ touchAction:"manipulation" }}
                  >
                    {soloSettling ? "結算中…" : "放棄並結算"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
        {tab === "excavate" ? (
          <DungeonExcavationTab profile={profile} />
        ) : tab === "dex" ? (
          <DungeonDex guestProfile={guestProfile} />
        ) : tab === "enter" && !selectedDungeon && isGuest ? (
          <div className="space-y-4">
            <GuestDungeonEntry tierCap={tierCap} onSelect={setSelectedDungeon} />
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background:"rgba(255,255,255,0.08)" }} />
              <span className="text-[10px] font-bold" style={{ color:"var(--text-muted)" }}>或</span>
              <div className="flex-1 h-px" style={{ background:"rgba(255,255,255,0.08)" }} />
            </div>
            <button onClick={() => setShowJoinPanel(!showJoinPanel)}
              className="w-full py-4 rounded-2xl font-black text-base border transition-all active:scale-95"
              style={{
                background:"rgba(99,102,241,0.08)",
                borderColor:"rgba(99,102,241,0.25)",
                color:"#a5b4fc",
              }}>
              👥 加入團康地下城
            </button>
            {showJoinPanel && (
              <div className="rounded-2xl p-4 space-y-4"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.10)" }}>
                <div>
                  <div className="text-sm font-black text-white mb-2">輸入邀請碼</div>
                  <div className="flex gap-2">
                    <input
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="輸入 6 碼邀請碼"
                      maxLength={6}
                      className="flex-1 min-h-11 px-4 rounded-xl bg-slate-900/70 border border-white/10 text-white font-black tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button
                      onClick={handleJoinByCode}
                      disabled={joinLoading || !joinCode.trim()}
                      className="min-h-11 px-4 rounded-xl bg-indigo-500 text-white text-sm font-black disabled:opacity-40"
                    >
                      加入
                    </button>
                  </div>
                  {joinErr && <div className="text-xs text-rose-300 font-bold mt-2">{joinErr}</div>}
                </div>

                {openTeamRooms.length > 0 && (
                  <div>
                    <div className="text-sm font-black text-white mb-2">開放中的地下城房間</div>
                    <div className="space-y-2">
                      {openTeamRooms.map(room => {
                        const diff = getExcavationDifficulty(room.dungeonDifficulty || 1);
                        return (
                          <div key={room.id} className="rounded-xl p-3 flex items-center gap-3"
                            style={{ background:"rgba(15,23,42,0.7)", border:"1px solid rgba(255,255,255,0.08)" }}>
                            <div className="text-2xl">{diff?.icon || "🏰"}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-black text-white truncate">{room.hostName || "射手"} 的地下城</div>
                              <div className="text-xs text-slate-400">{diff?.label || "地下城"} · {room.memberCount || 1}/8 人</div>
                            </div>
                            <button onClick={async () => {
                              setJoinLoading(true);
                              setJoinErr("");
                              const res = await joinTeamExpeditionRoom(
                                room.code,
                                myId,
                                myName,
                                buildMemberData(),
                              );
                              if (res.ok) {
                                setReconnectRoom(null);
                                setTeamLobby({ roomId: res.roomId, dungeon: res.dungeon, hostId: res.hostId });
                                setShowJoinPanel(false);
                              } else {
                                setJoinErr(res.reason);
                              }
                              setJoinLoading(false);
                            }} disabled={joinLoading}
                              className="px-4 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-40">
                              加入
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : tab === "enter" && !selectedDungeon ? (
          <div className="space-y-4">
            <DungeonStorageTab
              profile={profile}
              onSelectDungeon={setSelectedDungeon}
            />
            {/* 分隔線 */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background:"rgba(255,255,255,0.08)" }} />
              <span className="text-[10px] font-bold" style={{ color:"var(--text-muted)" }}>或</span>
              <div className="flex-1 h-px" style={{ background:"rgba(255,255,255,0.08)" }} />
            </div>
            {/* 加入地下城 */}
            <button onClick={() => setShowJoinPanel(!showJoinPanel)}
              className="w-full py-4 rounded-2xl font-black text-base border transition-all active:scale-95"
              style={{
                background:"rgba(99,102,241,0.08)",
                borderColor:"rgba(99,102,241,0.25)",
                color:"#a5b4fc",
              }}>
              🔍 加入地下城
            </button>
            {showJoinPanel && (
              <div className="space-y-3">
                {/* 邀請碼輸入 */}
                <div className="rounded-2xl p-4 border"
                  style={{ background:"rgba(255,255,255,0.04)", borderColor:"rgba(255,255,255,0.1)" }}>
                  <div className="text-xs font-bold mb-2" style={{ color:"var(--text-secondary)" }}>
                    🔑 輸入邀請碼
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={joinCode}
                      onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinErr(""); }}
                      aria-label="地下城邀請碼"
                      name="dungeon-invite-code"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="例如 ABC123…"
                      maxLength={6}
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm font-bold text-white tracking-widest focus-visible:ring-2 focus-visible:ring-indigo-300"
                      style={{
                        background:"rgba(255,255,255,0.08)",
                        border:"1px solid rgba(255,255,255,0.15)",
                      }}
                    />
                    <button onClick={handleJoinByCode} disabled={joinLoading || joinCode.length < 4}
                      className="px-5 py-2.5 rounded-xl font-black text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white disabled:opacity-40 active:scale-95 transition-all">
                      {joinLoading ? "加入中…" : "加入"}
                    </button>
                  </div>
                  {joinErr && (
                    <div className="mt-2 text-xs font-bold" style={{ color:"#f87171" }}>{joinErr}</div>
                  )}
                </div>

                {/* 開放中的組隊房間 */}
                {openTeamRooms.length > 0 && (
                  <div>
                    <div className="text-xs font-bold mb-2" style={{ color:"var(--text-secondary)" }}>
                      🏠 開放中的房間
                    </div>
                    <div className="space-y-2">
                      {openTeamRooms.filter(r => r.hostId !== myId).map(r => {
                        const hostName = r.hostName || r.hostId;
                        return (
                          <div key={r.id} className="rounded-2xl px-4 py-3 flex items-center gap-3 border"
                            style={{ background:"rgba(139,92,246,0.06)", borderColor:"rgba(139,92,246,0.15)" }}>
                            <span className="text-xl">👥</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-white">
                                遠征 Lv.{r.dungeonDifficulty}{r.dungeonIsHidden ? " 🎁" : ""}
                              </div>
                              <div className="text-[10px]" style={{ color:"var(--text-muted)" }}>
                                👤 {r.memberCount}/4 · 房主：{hostName.slice(0, 6)}…
                              </div>
                            </div>
                            <button onClick={async () => {
                              setJoinLoading(true);
                              const res = await joinTeamExpeditionRoom(
                                r.code, myId, myName, buildMemberData()
                              );
                              if (res.ok) {
                                setReconnectRoom(null);
                                setTeamLobby({ roomId: res.roomId, dungeon: res.dungeon, hostId: r.hostId });
                                setShowJoinPanel(false);
                              } else {
                                setJoinErr(res.reason);
                              }
                              setJoinLoading(false);
                            }} disabled={joinLoading}
                              className="px-4 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-40">
                              加入
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : tab === "enter" && selectedDungeon ? (
          <DungeonSelectionPanel
            dungeon={selectedDungeon}
            profile={profile}
            isGuest={isGuest}
            onBack={() => setSelectedDungeon(null)}
            onStartSolo={({ boss, arrowsPerRound, targetFmt }) => {
              setExpeditionStart({
                family: selectedDungeon.family,
                difficulty: selectedDungeon.difficulty,
                isHidden: selectedDungeon.isHidden,
                // 訪客/兒童的地下城是 GuestDungeonEntry 就地生成，非儲存槽，不消耗/寫入 savedDungeons
                fromStorage: !isGuest,
                savedId: selectedDungeon.id,
                id: selectedDungeon.id,        // resolveDungeonBossEncounter 需要 id 推導 runId（savedId 不吃）
                bossRunId: selectedDungeon.bossRunId,
                revealedAt: selectedDungeon.revealedAt,
                // ⚠️ 優先用預覽算出的正確王；selectedDungeon.boss 是舊欄位的雜兵，只當最後防呆
                boss: boss || selectedDungeon.boss || null,
                arrowsPerRound,
                targetFmt,
              });
            }}
            onStartTeam={async (d) => {
              if (!cardReady) {
                alert("正在讀取卡片加成，請稍候再開始地下城。");
                return;
              }
              // 建立組隊房間
              const res = await createTeamExpeditionRoom({
                hostId: myId,
                hostName: myName,
                dungeon: d,
                memberData: buildMemberData(),
              });
              if (res.ok) {
                setReconnectRoom(null);
                setTeamLobby({
                  roomId: res.roomId,
                  dungeon: d,
                  hostId: myId,
                });
              } else {
                alert(res.reason);
              }
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
