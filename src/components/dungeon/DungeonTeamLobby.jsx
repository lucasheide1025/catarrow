// src/components/dungeon/DungeonTeamLobby.jsx
// 組隊遠征遊戲等待室 — 沉浸式 RPG 戰術大廳

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
  ghost:     { emoji:"👻", label:"幽冥系", color:"#a78bfa" },
  mountain:  { emoji:"⛰️", label:"山嶺系", color:"#fbbf24" },
  insect:    { emoji:"🦋", label:"昆蟲系", color:"#4ade80" },
  workplace: { emoji:"💼", label:"職場系", color:"#f472b6" },
  exam:      { emoji:"📝", label:"考試系", color:"#60a5fa" },
  temple:    { emoji:"🏛️", label:"神廟系", color:"#38bdf8" },
  treasure:  { emoji:"📦", label:"寶箱族", color:"#f59e0b" },
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
  const [copied, setCopied] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    unsubRef.current = subscribeTeamExpeditionRoom(roomId, r => {
      setRoom(r);
      if (!r || r.status === "completed") {
        onBack();
      }
    });
    return () => unsubRef.current?.();
  }, [roomId]); // eslint-disable-line

  const diff = getExcavationDifficulty(dungeon?.difficulty || 1);
  const family = FAMILY_LABEL[dungeon?.family] || { emoji:"🏰", label:"地下城", color:"#38bdf8" };
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
      role: m.role || "front",
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

  function copyCode() {
    if (!room?.code) return;
    navigator.clipboard?.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden flex flex-col text-white relative select-none font-sans"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(7, 11, 22, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%), url(/assets/dungeon/dungeon_team_lobby_bg.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 頂部導覽列 / 房間資訊標籤 */}
      <header className="px-4 py-3 bg-slate-950/70 border-b border-amber-500/20 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95"
          >
            ←
          </button>
          <div>
            <div className="text-xs font-black text-amber-400 tracking-wider flex items-center gap-1.5">
              <span>⚔️</span> 組隊遠征戰術大廳
            </div>
            <div className="text-sm font-black text-white flex items-center gap-2">
              <span>{dungeon?.name || "遠征冒險"}</span>
            </div>
          </div>
        </div>

        {/* 邀請碼 */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/40 px-3 py-1.5 rounded-2xl shadow-lg">
          <div className="text-right">
            <div className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider">房號 CODE</div>
            <div className="text-sm font-black tracking-widest text-amber-400 font-mono">
              {room?.code || "-------"}
            </div>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="px-2.5 py-1 text-xs font-bold rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition active:scale-95"
          >
            {copied ? "已複製 ✓" : "複製"}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6">
        {/* 地下城主題橫幅卡 */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-amber-950/40 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-4xl shadow-inner shrink-0">
                {dungeon?.isHidden ? "🎁" : family.emoji}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 border border-amber-400/30 text-amber-300">
                    {dungeon?.isHidden ? "🎁 寶藏地窟" : family.label}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 border"
                    style={{
                      backgroundColor: `${diff?.color || "#94a3b8"}22`,
                      borderColor: `${diff?.color || "#94a3b8"}44`,
                      color: diff?.color || "#94a3b8",
                    }}
                  >
                    {diff?.icon} {diff?.label} (T{dungeon?.difficulty || 1})
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white mt-1">
                  {dungeon?.name || "未知地下城"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  全隊共享 HP 與技能，挑戰 3 層探索關卡與最終強大 Boss！
                </p>
              </div>
            </div>

            {/* 人數統計燈號 */}
            <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-700/60 px-4 py-2.5 rounded-2xl self-start md:self-auto shrink-0">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-bold">小隊人數</div>
                <div className="text-base font-black text-emerald-400 font-mono">
                  {memberCount} / 8 <span className="text-xs text-slate-400">位</span>
                </div>
              </div>
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
            </div>
          </div>
        </div>

        {/* 遠征規則設定區 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-md">
          <DungeonRunSettings
            arrowsPerRound={room?.arrowsPerRound || DEFAULT_DUNGEON_ARROWS}
            targetFmt={room?.targetFmt || DEFAULT_DUNGEON_TARGET}
            onArrowsChange={arrowsPerRound => handleSettingsChange({ arrowsPerRound })}
            onTargetChange={targetFmt => handleSettingsChange({ targetFmt })}
            disabled={!isHost || loading || settingsBusy}
            readOnlyNote={isHost
              ? (settingsBusy ? "正在同步遠征規則…" : "👑 房主設定：點擊可切換每回合箭數與靶面規格")
              : "🔒 遠征規則由房主設定"}
          />
          {settingsError && (
            <div className="mt-2 text-xs font-bold text-rose-400">
              ❌ {settingsError}
            </div>
          )}
        </div>

        {/* 隊員展台 (8人格子遊戲等待區) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
              <span>🛡️</span> 遠征小隊陣容 ({memberCount}/8)
            </h3>
            <span className="text-xs text-slate-400">
              {isHost ? "提示：點擊右下角按鈕隨時出發" : "等待房主發起遠征指令…"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {memberEntries.map(([id, m]) => {
              const isMe = id === myId;
              const isLeader = id === hostId;
              const mRole = m.role || "front";
              return (
                <div
                  key={id}
                  className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 flex flex-col justify-between min-h-[120px] shadow-lg ${
                    isLeader
                      ? "border-amber-400/60 bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-950 shadow-amber-500/10"
                      : isMe
                      ? "border-indigo-400/60 bg-gradient-to-b from-indigo-950/40 via-slate-900/90 to-slate-950 shadow-indigo-500/10"
                      : "border-slate-700/80 bg-slate-900/80 hover:border-slate-600"
                  }`}
                >
                  {/* 角標：房主 / 角色標籤 */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 ${
                        mRole === "front"
                          ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                          : "bg-sky-500/20 border border-sky-500/40 text-sky-300"
                      }`}
                    >
                      {mRole === "front" ? "⚔️ 前衛" : "🏹 後衛"}
                    </span>
                    {isLeader && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow">
                        ⭐ 房主
                      </span>
                    )}
                  </div>

                  {/* 玩家資訊 */}
                  <div className="space-y-1">
                    <div className="text-base font-black text-white truncate flex items-center gap-1.5">
                      <span>{m.name || "冒險者"}</span>
                      {isMe && (
                        <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded-md font-bold">
                          (你)
                        </span>
                      )}
                    </div>

                    {/* 屬性數值面板 */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-2 py-1 text-center">
                        <div className="text-[9px] text-slate-400 font-bold">HP</div>
                        <div className="text-xs font-black text-emerald-400">
                          {m.maxHP || "?"}
                        </div>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-2 py-1 text-center">
                        <div className="text-[9px] text-slate-400 font-bold">ATK</div>
                        <div className="text-xs font-black text-rose-400">
                          {m.atk || "?"}
                        </div>
                      </div>
                    </div>

                    {/* 貓貓夥伴（如果有） */}
                    {m.catName && (
                      <div className="text-[10px] text-amber-200/90 bg-amber-500/10 border border-amber-400/20 px-2 py-1 rounded-lg truncate flex items-center gap-1 mt-1">
                        <span>🐾 {m.catName}</span>
                        {m.catAtk > 0 && <span className="text-amber-400 font-bold">+{m.catAtk}</span>}
                      </div>
                    )}
                  </div>

                  {/* 準備狀態 */}
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">準備狀態</span>
                    <span className="text-emerald-400 font-black flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" /> Ready
                    </span>
                  </div>
                </div>
              );
            })}

            {/* 空位置提示腳座 */}
            {Array.from({ length: Math.max(0, 8 - memberCount) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-4 flex flex-col items-center justify-center text-center min-h-[120px] transition hover:border-slate-700"
              >
                <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-lg mb-1">
                  ➕
                </div>
                <div className="text-xs font-bold text-slate-500">等待隊友加入</div>
                <div className="text-[10px] text-slate-600">位置 {memberCount + i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 底部控制欄 */}
      <footer className="sticky bottom-0 z-30 px-4 py-3 bg-slate-950/90 border-t border-amber-500/20 backdrop-blur-xl shadow-2xl">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 hidden sm:block">
            {isHost ? "所有隊友已準備就緒，點擊按鈕發起遠征" : "等待房主發起遠征指令…"}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isHost ? (
              <>
                <button
                  type="button"
                  onClick={handleDisband}
                  disabled={loading}
                  className="px-4 py-3 rounded-2xl text-xs font-bold border border-slate-700 hover:border-rose-500/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 transition active:scale-95 shrink-0"
                >
                  解散房間
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={memberCount < 1 || loading || settingsBusy}
                  className="flex-1 sm:flex-none px-8 py-3.5 rounded-2xl font-black text-sm md:text-base bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.4)] disabled:opacity-40 active:scale-95 transition-all hover:brightness-110 flex items-center justify-center gap-2"
                >
                  {loading ? "⚔️ 傳送至地下城中…" : `⚔️ 開啟遠征 (${memberCount} 人)`}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={loading}
                  className="px-4 py-3 rounded-2xl text-xs font-bold border border-slate-700 hover:border-rose-500/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 transition active:scale-95 shrink-0"
                >
                  離開房間
                </button>
                <div className="flex-1 sm:flex-none px-8 py-3.5 rounded-2xl font-black text-xs md:text-sm bg-slate-900 border border-slate-800 text-slate-400 text-center flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                  等待房主開啟遠征…
                </div>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
