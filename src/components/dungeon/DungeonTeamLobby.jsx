// src/components/dungeon/DungeonTeamLobby.jsx
// 組隊遠征等待室 — 顯示地下城資訊 + 隊員清單 + 開始按鈕

import { useState, useEffect, useRef } from "react";
import {
  subscribeTeamExpeditionRoom,
  disbandTeamExpeditionRoom,
  cleanupTeamExpeditionRoom,
  leaveTeamExpeditionRoom,
  updateTeamExpeditionSettings,
} from "../../lib/expeditionTeamDb";
import { getExcavationDifficulty } from "../../lib/dungeonData";
import DungeonRunSettings from "./DungeonRunSettings";
import {
  DEFAULT_DUNGEON_ARROWS,
  DEFAULT_DUNGEON_TARGET,
} from "../../lib/dungeonRunSettings";

const FAMILY_LABEL = {
  ghost:     { emoji:"👻", label:"幽冥系" },
  mountain:  { emoji:"⛰️", label:"山嶺系" },
  insect:    { emoji:"🦋", label:"昆蟲系" },
  workplace: { emoji:"💼", label:"職場系" },
  exam:      { emoji:"📝", label:"考試系" },
  temple:    { emoji:"🏛️", label:"神廟系" },
  treasure:  { emoji:"📦", label:"寶箱族" },
};

export default function DungeonTeamLobby({
  roomId,
  dungeon,
  hostId,
  profile,
  onStart,     // 房主開始遠征
  onBack,      // 返回
}) {
  const myId = profile?.id;
  const isHost = myId === hostId;
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    unsubRef.current = subscribeTeamExpeditionRoom(roomId, r => {
      setRoom(r);
      // 房間被解散時自動返回
      if (!r || r.status === "completed") {
        onBack();
      }
    });
    return () => unsubRef.current?.();
  }, [roomId]); // eslint-disable-line

  const diff = getExcavationDifficulty(dungeon?.difficulty || 1);
  const family = FAMILY_LABEL[dungeon?.family] || { emoji:"🏰", label:"未知族系" };
  const memberEntries = room ? Object.entries(room.members || {}).filter(([, m]) => m !== null) : [];
  const memberCount = memberEntries.length;

  async function handleDisband() {
    setLoading(true);
    await disbandTeamExpeditionRoom(roomId, myId);
    await cleanupTeamExpeditionRoom(roomId).catch(() => {});
    setLoading(false);
    onBack();
  }

  async function handleLeave() {
    setLoading(true);
    await leaveTeamExpeditionRoom(roomId, myId);
    setLoading(false);
    onBack();
  }

  async function handleStart() {
    setLoading(true);
    const memberList = memberEntries.map(([id, m]) => ({
      memberId: id,
      name: m.name,
      hp: m.hp,
      maxHP: m.maxHP,
      atk: m.atk,
      def: m.def,
      catId: m.catId || "",
      catName: m.catName || "",
      archerStyle: m.archerStyle || "baobao",
      catAtk: m.catAtk || 0,
    }));
    const started = await onStart(memberList);
    if (started === false) setLoading(false);
  }

  async function handleSettingsChange(nextSettings) {
    if (!isHost || settingsBusy) return;
    setSettingsBusy(true);
    setSettingsError("");
    const result = await updateTeamExpeditionSettings(roomId, myId, {
      arrowsPerRound: nextSettings.arrowsPerRound
        ?? room?.arrowsPerRound
        ?? DEFAULT_DUNGEON_ARROWS,
      targetFmt: nextSettings.targetFmt
        ?? room?.targetFmt
        ?? DEFAULT_DUNGEON_TARGET,
    });
    if (!result.ok) setSettingsError(result.reason);
    setSettingsBusy(false);
  }

  return (
    <div className="min-h-full overflow-x-hidden flex flex-col text-white"
      style={{
        background:"linear-gradient(rgba(0,0,0,0.65),rgba(0,0,0,0.65)),url(/ui/page-bg.webp)",
        backgroundSize:"cover",
        backgroundPosition:"center",
        touchAction:"pan-y",
      }}>
      {/* Header */}
      <div className="text-center py-5 border-b border-white/10">
        <div className="text-3xl mb-1">👥</div>
        <div className="text-xl font-black text-white">組隊遠征等待室</div>
        {isHost && (
          <div className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-xl"
            style={{ background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)" }}>
            <span className="text-xs" style={{ color:"#a5b4fc" }}>📋 邀請碼</span>
            <span className="text-sm font-black text-white tracking-widest">{room?.code || "..."}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(room?.code || "")}
              className="min-h-11 px-2 text-xs font-bold rounded-lg hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-300"
              style={{ color:"#818cf8", touchAction:"manipulation" }}>
              複製
            </button>
          </div>
        )}
        {!isHost && (
          <div className="text-sm mt-1" style={{ color:"var(--text-secondary)" }}>
            等待房主開始遠征…
          </div>
        )}
      </div>

      {/* 地下城資訊 */}
      <div className="px-4 py-3 border-b border-white/8">
        <div className="rounded-2xl p-4 flex items-center gap-4"
          style={{
            background:"rgba(245,158,11,0.08)",
            border:"1px solid rgba(245,158,11,0.15)",
          }}>
          <div className="text-4xl">{dungeon?.isHidden ? "🎁" : family.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-black text-white">
              {dungeon?.isHidden ? "🎁 寶藏地下城" : family.label}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background:`${diff?.color || "#94a3b8"}22`, color: diff?.color || "#94a3b8" }}>
                {diff?.icon} {diff?.label}
              </span>
              {dungeon?.isHidden && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background:"rgba(251,191,36,0.2)", color:"#fbbf24" }}>🎁 隱藏</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-white/8">
        <DungeonRunSettings
          arrowsPerRound={room?.arrowsPerRound || DEFAULT_DUNGEON_ARROWS}
          targetFmt={room?.targetFmt || DEFAULT_DUNGEON_TARGET}
          onArrowsChange={arrowsPerRound => handleSettingsChange({ arrowsPerRound })}
          onTargetChange={targetFmt => handleSettingsChange({ targetFmt })}
          disabled={!isHost || loading || settingsBusy}
          readOnlyNote={isHost
            ? (settingsBusy ? "正在同步設定…" : "只有你可以修改遠征規則")
            : "由房主設定，開始後不能修改"}
        />
        {settingsError && (
          <div className="mt-2 text-xs font-bold text-rose-300" aria-live="polite">
            {settingsError}
          </div>
        )}
      </div>

      {/* 隊員清單 */}
      <div className="flex-1 px-4 py-3">
        <div className="text-xs font-bold mb-2" style={{ color:"var(--text-secondary)" }}>
          👥 隊員（{memberCount}/4）
        </div>
        <div className="space-y-2">
          {memberEntries.map(([id, m], i) => {
            const isMe = id === myId;
            const isLeader = id === hostId;
            return (
              <div key={id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background:"rgba(255,255,255,0.06)" }}>
                <span className="text-lg">{isLeader ? "⭐" : "🏹"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white">
                    {m.name}{isMe ? "（你）" : ""}
                  </div>
                  <div className="text-[10px]" style={{ color:"var(--text-muted)" }}>
                    HP {m.maxHP || "?"} · ATK {m.atk || "?"}
                  </div>
                </div>
                {isLeader && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background:"rgba(251,191,36,0.2)", color:"#fbbf24" }}>
                    房主
                  </span>
                )}
              </div>
            );
          })}
          {/* 空位提示 */}
          {Array.from({ length: Math.max(0, 4 - memberCount) }).map((_, i) => (
            <div key={`empty-${i}`} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(255,255,255,0.08)" }}>
              <span className="text-lg">⬜</span>
              <div className="text-sm" style={{ color:"var(--text-muted)" }}>等待隊友加入…</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="sticky bottom-0 z-20 px-4 pt-3 border-t border-white/10 space-y-2"
        style={{
          paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom))",
          background:"linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.99))",
          backdropFilter:"blur(12px)",
        }}
      >
        {isHost ? (
          <>
            <button type="button" onClick={handleStart} disabled={memberCount < 1 || loading || settingsBusy}
              className="min-h-12 w-full py-3 rounded-2xl font-black text-base bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg disabled:opacity-40 active:scale-95 transition-transform hover:brightness-110 focus-visible:ring-2 focus-visible:ring-amber-200"
              style={{ touchAction:"manipulation" }}>
              {loading ? "準備中…" : `⚔️ 開始遠征（${memberCount} 人）`}
            </button>
            <button type="button" onClick={handleDisband} disabled={loading}
              className="min-h-11 w-full py-2.5 rounded-2xl text-sm font-bold border hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ borderColor:"rgba(255,255,255,0.15)", color:"var(--text-secondary)", touchAction:"manipulation" }}>
              解散房間
            </button>
          </>
        ) : (
          <>
            <div className="text-center py-3 rounded-2xl text-sm"
              style={{ background:"rgba(255,255,255,0.06)", color:"var(--text-secondary)" }}>
              等待房主開始遠征…
            </div>
            <button type="button" onClick={handleLeave} disabled={loading}
              className="min-h-11 w-full py-2.5 rounded-2xl text-sm font-bold border hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ borderColor:"rgba(255,255,255,0.15)", color:"var(--text-secondary)", touchAction:"manipulation" }}>
              離開房間
            </button>
          </>
        )}
      </div>
    </div>
  );
}
