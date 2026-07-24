// src/components/dungeon/DungeonTeamLobby.jsx
// 組隊遠征遊戲等待室 — 沉浸式 RPG 戰術大廳

import { useState, useEffect, useRef } from "react";
import { getBattleMonsterSources } from "../../lib/battleAssets";
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

// 圖片載入失敗就退回 emoji（地下城外觀 / 首領怪物圖用）
function ImgOrEmoji({ src, emoji, className }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span>{emoji}</span>;
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} draggable={false} />;
}

// 守關 BOSS 立繪：依序試怪物戰鬥圖（/monsters-battle 與 /monsters 都試），全失敗才退 emoji
function BossImg({ boss, className }) {
  const id = boss?.artKey || boss?.monsterId || boss?.id;
  const sources = id ? getBattleMonsterSources(id) : [];
  const [idx, setIdx] = useState(0);
  if (idx >= sources.length) return <span className="text-3xl">{boss?.icon || "👹"}</span>;
  return <img src={sources[idx]} alt="" className={className} onError={() => setIdx(i => i + 1)} draggable={false} />;
}

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

  const dungeonFamilyKey = room?.dungeonFamily || dungeon?.family || "ghost";
  const dungeonDiffLevel = room?.dungeonDifficulty || dungeon?.difficulty || 1;
  const dungeonIsHidden = room?.dungeonIsHidden ?? dungeon?.isHidden ?? false;
  const dungeonBoss = room?.dungeonBoss || dungeon?.boss || null;
  const lootMult = room?.lootMult || 2;

  const diff = getExcavationDifficulty(dungeonDiffLevel);
  const family = FAMILY_LABEL[dungeonFamilyKey] || { emoji:"🏰", label:"地下城", color:"#38bdf8" };
  const dungeonName = dungeon?.name || `${family.label}探索地下城`;
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
        backgroundImage: `linear-gradient(180deg, rgba(7, 11, 22, 0.55) 0%, rgba(10, 15, 28, 0.7) 45%, rgba(15, 23, 42, 0.9) 100%), url(/assets/dungeon/dungeon_team_lobby_bg.jpg)`,
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
              <span>{dungeonName}</span>
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
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-amber-950/40 p-5 shadow-2xl backdrop-blur-md space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 overflow-hidden flex items-center justify-center text-4xl shadow-inner shrink-0">
                <ImgOrEmoji
                  src={`/assets/dungeon/cover_${dungeonIsHidden ? "treasure" : dungeonFamilyKey}.webp`}
                  emoji={dungeonIsHidden ? "🎁" : family.emoji}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 border border-amber-400/30 text-amber-300">
                    {dungeonIsHidden ? "🎁 寶藏地窟" : family.label}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 border"
                    style={{
                      backgroundColor: `${diff?.color || "#94a3b8"}22`,
                      borderColor: `${diff?.color || "#94a3b8"}44`,
                      color: diff?.color || "#94a3b8",
                    }}
                  >
                    {diff?.icon} {diff?.label} (T{dungeonDiffLevel})
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 border border-amber-400/40 text-amber-300">
                    🎰 寶箱掉落 ×{lootMult} 倍率
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-white mt-1">
                  {dungeonName}
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

          {/* BOSS & 掉落倍率預覽 */}
          {dungeonBoss && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-amber-500/20 relative z-10">
              <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-2xl border border-rose-500/30">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/30 border border-rose-500/30 flex items-center justify-center text-3xl shrink-0">
                  <BossImg boss={dungeonBoss} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black text-rose-300 uppercase">守關 BOSS</div>
                  <div className="text-sm font-black text-white truncate">{dungeonBoss.name || "未知首領"}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-2xl border border-amber-500/30">
                <span className="text-3xl shrink-0">📦</span>
                <div className="min-w-0">
                  <div className="text-[10px] font-black text-amber-300 uppercase">地下城掉落加成</div>
                  <div className="text-sm font-black text-amber-200">全場擊殺寶箱 ×{lootMult} 倍率</div>
                </div>
              </div>
            </div>
          )}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {memberEntries.map(([id, m]) => {
              const isMe = id === myId;
              const isLeader = id === hostId;
              const mRole = m.role || "front";
              const cos = m.battleCosmetics?.wbFrame; // 世界王卡外觀：{ color, title, stars }
              // 外框顏色：有世界王卡→用卡片色；否則房主金 / 自己紫 / 一般灰
              const frameColor = cos?.color || (isLeader ? "#fbbf24" : isMe ? "#818cf8" : "#475569");
              return (
                <div
                  key={id}
                  className="relative overflow-hidden rounded-xl border p-2.5 flex flex-col gap-1.5 bg-slate-900/85 shadow"
                  style={{ borderColor: `${frameColor}aa`, boxShadow: `0 0 0 1px ${frameColor}33, 0 4px 12px rgba(0,0,0,.4)` }}
                >
                  {/* 名稱 + 等級 */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-black text-white truncate">{m.name || "冒險者"}{isMe ? " (你)" : ""}</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ background:`${frameColor}22`, color:frameColor, border:`1px solid ${frameColor}55` }}>Lv.{m.level || 1}</span>
                  </div>

                  {/* 世界王卡稱號（有裝才顯示，外框已用卡片色） */}
                  {cos?.title && (
                    <div className="text-[10px] font-black px-1.5 py-0.5 rounded-md truncate"
                      style={{ background:`${cos.color}1f`, color:cos.color, border:`1px solid ${cos.color}55` }}>
                      🏆 {cos.title}{cos.stars ? ` ${"★".repeat(Math.min(cos.stars, 5))}` : ""}
                    </div>
                  )}

                  {/* 前衛/後衛 + 房主 */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${mRole === "front" ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-sky-500/20 text-sky-300 border border-sky-500/40"}`}>
                      {mRole === "front" ? "⚔️前衛" : "🏹後衛"}
                    </span>
                    {isLeader && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black bg-amber-500/20 text-amber-300 border border-amber-400/40">⭐房主</span>}
                  </div>

                  {/* HP / ATK / DEF 一排 */}
                  <div className="grid grid-cols-3 gap-1">
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-1 py-0.5 text-center"><div className="text-[8px] text-slate-400 font-bold">HP</div><div className="text-[11px] font-black text-emerald-400 leading-tight">{m.maxHP || "?"}</div></div>
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-1 py-0.5 text-center"><div className="text-[8px] text-slate-400 font-bold">ATK</div><div className="text-[11px] font-black text-rose-400 leading-tight">{m.atk || "?"}</div></div>
                    <div className="rounded-lg bg-slate-950/60 border border-slate-800 px-1 py-0.5 text-center"><div className="text-[8px] text-slate-400 font-bold">DEF</div><div className="text-[11px] font-black text-sky-400 leading-tight">{m.def || "?"}</div></div>
                  </div>

                  {/* 貓 + Ready */}
                  <div className="flex items-center justify-between gap-1 text-[9px]">
                    {m.catName ? <span className="text-amber-200/90 truncate">🐾 {m.catName}</span> : <span className="text-slate-600">—</span>}
                    <span className="text-emerald-400 font-black flex items-center gap-0.5 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />Ready</span>
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
