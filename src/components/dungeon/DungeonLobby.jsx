// src/components/dungeon/DungeonLobby.jsx — 地下城大廳（挖掘探索 + 進入地下城 + 圖鑑 + 遠征 + 組隊）
import { useState, useEffect } from "react";
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
} from "../../lib/expeditionTeamDb";

function restoreDungeonFromTeamRoom(room) {
  return {
    id: room.dungeonSavedId || null,
    savedId: room.dungeonSavedId || null,
    family: room.dungeonFamily,
    difficulty: room.dungeonDifficulty,
    isHidden: room.dungeonIsHidden || false,
    boss: room.dungeonBoss || null,
    arrowsPerRound: room.arrowsPerRound || 6,
    targetFmt: room.targetFmt || "full_110",
  };
}

export default function DungeonLobby({ onBack, guestProfile, isGuest, tierCap }) {
  const { profile: authProfile } = useAuth();
  const profile = guestProfile || authProfile;
  const myId = profile?.id;
  const myName = profile?.name || "射手";
  const [tab, setTab] = useState(isGuest ? "enter" : "excavate");
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
  useEffect(() => {
    if (!myId) return;
    return subscribeCardCollection(myId, setCardColl);
  }, [myId]);
  const cardBonus = calcEquippedBonus(resolveEquippedCards(cardColl));
  function buildMemberData() { return buildExpeditionMemberData(profile, cardBonus); }

  // 登入地下城首頁時，找回仍包含自己的等待室、進行中遠征或未領取結算。
  useEffect(() => {
    if (!myId) return undefined;
    let cancelled = false;
    findReconnectableTeamExpedition(myId).then(result => {
      if (!cancelled && result.ok) setReconnectRoom(result.room);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  // 偵測單人遠征中斷進度（見 dungeon 穩定性任務：不做地圖復原，只提供結算）
  useEffect(() => {
    setSoloRecovery(profile?.activeExpedition || null);
  }, [profile?.activeExpedition]);

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
    const { settleAbandonedExpedition } = await import("../../lib/expeditionDb");
    await settleAbandonedExpedition(myId, soloRecovery).catch(() => {});
    setSoloRecovery(null);
    setSoloSettling(false);
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
    return (
      <DungeonExpedition
        excavation={expeditionStart}
        profile={profile}
        isGuest={isGuest}
        tierCap={tierCap}
        onComplete={() => { setExpeditionStart(null); setSelectedDungeon(null); setTeamLobby(null); }}
        onAbandon={() => { setExpeditionStart(null); setSelectedDungeon(null); setTeamLobby(null); }}
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
      {/* Header */}
      <div className="text-center py-8 relative">
        {onBack && (
          <button onClick={onBack} className="absolute left-4 top-6 text-slate-300 text-sm font-bold hover:text-white">← 返回</button>
        )}
        <div className="text-5xl mb-2">🏰</div>
        <div className="text-2xl font-black">地下城</div>
        <div className="text-sm text-slate-300 mt-1">挖掘探索，挑戰終極首領</div>
      </div>

      {/* Tab */}
      <div className="sticky top-0 z-20 px-4 pb-4"
        style={{ background:"linear-gradient(180deg,rgba(15,23,42,0.96) 0%,rgba(15,23,42,0.86) 72%,transparent 100%)" }}>
      <div className="flex bg-slate-600/90 rounded-2xl p-1 shadow-lg">
        {(isGuest ? ["enter","dex"] : ["excavate","enter","dex"]).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t !== "enter") { setSelectedDungeon(null); setShowJoinPanel(false); } }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-white/70 ${tab===t ? "bg-white/25 text-white" : "text-slate-300 hover:text-white"}`}
            style={{ touchAction:"manipulation" }}>
            {t==="excavate" ? "⛏️ 挖掘探索" : t==="enter" ? "🗺️ 進入地下城" : "🔮 圖鑑"}
          </button>
        ))}
      </div>
      </div>

      <main className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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
        {soloRecovery && (
          <section
            aria-labelledby="dungeon-solo-recovery-title"
            className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-950/80 p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">🎁</span>
              <div className="min-w-0 flex-1">
                <h2 id="dungeon-solo-recovery-title" className="text-base font-black text-amber-100">
                  偵測到中斷的單人遠征
                </h2>
                <p className="mt-1 text-sm leading-6 text-amber-100/80">
                  已完成 {soloRecovery.floorsCleared || 0} 層，點擊結算領取這部分的獎勵。
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSettleSolo}
                    disabled={soloSettling}
                    className="min-h-11 flex-1 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{ touchAction:"manipulation" }}
                  >
                    {soloSettling ? "結算中…" : "結算並領取"}
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
          <GuestDungeonEntry tierCap={tierCap} onSelect={setSelectedDungeon} />
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
                boss: selectedDungeon.boss || boss || null,
                arrowsPerRound,
                targetFmt,
              });
            }}
            onStartTeam={async (d) => {
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
