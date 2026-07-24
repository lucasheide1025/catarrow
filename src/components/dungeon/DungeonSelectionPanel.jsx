// src/components/dungeon/DungeonSelectionPanel.jsx
// 點地下城後彈出的「單人 / 組隊」二擇一小視窗（含精簡箭數/靶面設定）。
// 2026-07-25：由整頁詳情改為彈窗，移除冗餘的地城重新顯示、單人二次確認頁。

import { useMemo, useState } from "react";
import { getExcavationDifficulty } from "../../lib/dungeonData";
import { drawExpeditionBoss, TIER_LABEL } from "../../lib/monsterData";
import { resolveDungeonBossEncounter } from "../../lib/dungeonBossEncounter";
import { getExpeditionRewardPreview } from "../../lib/expeditionRewards";
import DungeonRunSettings from "./DungeonRunSettings";
import { getBattleMonsterSources } from "../../lib/battleAssets";
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

// 守關 BOSS 立繪：依序試怪物戰鬥圖，全失敗才退回 emoji
function BossImg({ boss }) {
  const id = boss?.artKey || boss?.monsterId || boss?.id;
  const sources = id ? getBattleMonsterSources(id) : [];
  const [idx, setIdx] = useState(0);
  if (idx >= sources.length) return <span className="text-4xl shrink-0">{boss?.icon || "👹"}</span>;
  return (
    <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/30 border border-rose-500/30 flex items-center justify-center shrink-0">
      <img src={sources[idx]} alt="" onError={() => setIdx(i => i + 1)} draggable={false}
        className="w-full h-full object-cover" />
    </div>
  );
}

// 地下城外觀封面（失敗退 emoji）
function CoverImg({ family, emoji }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="text-3xl">{emoji}</span>;
  return <img src={`/assets/dungeon/cover_${family}.webp`} alt="" onError={() => setFailed(true)}
    className="w-full h-full object-cover" draggable={false} />;
}

export default function DungeonSelectionPanel({
  dungeon,         // { id, family, difficulty, isHidden, savedId }
  profile,
  onBack,
  onStartSolo,     // ({ boss, arrowsPerRound, targetFmt }) 開始單人遠征
  onStartTeam,     // (dungeon) 建立組隊房間
  isGuest,
}) {
  const [arrowsPerRound, setArrowsPerRound] = useState(DEFAULT_DUNGEON_ARROWS);
  const [targetFmt, setTargetFmt] = useState(DEFAULT_DUNGEON_TARGET);
  const myId = profile?.id;

  const diff = getExcavationDifficulty(dungeon.difficulty);
  const family = FAMILY_LABEL[dungeon.family] || { emoji:"🏰", label:"未知族系" };
  // 預覽的王必須跟遠征第 3 層打到的同一隻：兩端都走 resolveDungeonBossEncounter。
  const boss = useMemo(
    () => resolveDungeonBossEncounter(dungeon)?.monsterSnapshot
      || dungeon.boss
      || drawExpeditionBoss(dungeon.difficulty, dungeon.family),
    [dungeon],
  );
  const rewardPreview = useMemo(() => getExpeditionRewardPreview(boss), [boss]);
  const bossTier = TIER_LABEL[boss?.tier];
  const lootMin = rewardPreview?.multiplierMin || 1;
  const lootMax = rewardPreview?.multiplierMax || 3;

  // 開新關前的衝突檢查（有進行中單人/已保存組隊進度 → 確認覆蓋）。回傳是否可繼續。
  async function confirmOverwrite() {
    const activeExp = profile?.activeExpedition || (() => {
      try { const s = localStorage.getItem(`active_expedition_${myId || "guest"}`); return s ? JSON.parse(s) : null; }
      catch { return null; }
    })();
    if (activeExp) {
      const floor = (activeExp.mapState?.floorIndex || activeExp.floorsCleared || 0) + 1;
      if (!window.confirm(`⚠️ 您有未完成的【單人地下城（第 ${floor} 層）】！\n開啟新關卡會覆蓋並清除該進度。確定要繼續嗎？`)) return false;
    }
    if (profile?.teamSavedProgress) {
      const floor = (profile.teamSavedProgress.savedFloorIndex || 0) + 1;
      if (!window.confirm(`⚠️ 您有已保存的【組隊進度（第 ${floor} 層）】。\n開啟新關卡會清除/覆蓋此組隊進度。確定要繼續嗎？`)) return false;
      const { clearTeamExpeditionSavedProgress } = await import("../../lib/expeditionTeamDb");
      await clearTeamExpeditionSavedProgress(myId);
    }
    return true;
  }

  const chooseSolo = async () => { if (await confirmOverwrite()) onStartSolo({ boss, arrowsPerRound, targetFmt }); };
  const chooseTeam = async () => { if (await confirmOverwrite()) onStartTeam({ ...dungeon, boss, arrowsPerRound, targetFmt }); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      onClick={onBack} style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-sm max-h-[92dvh] overflow-y-auto rounded-3xl border border-amber-500/25 p-5 shadow-2xl"
        style={{ background:"linear-gradient(180deg,#101a2e,#0b1220)" }}>

        {/* 地城標頭：外觀圖 + 族系 + 難度 */}
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
            <CoverImg family={dungeon.isHidden ? "treasure" : dungeon.family} emoji={dungeon.isHidden ? "🎁" : family.emoji} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black text-white truncate">{dungeon.isHidden ? "🎁 寶藏地下城" : family.label}</div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black"
                style={{ background:`${diff?.color || "#94a3b8"}22`, color:diff?.color || "#94a3b8", border:`1px solid ${diff?.color || "#94a3b8"}44` }}>
                {diff?.icon} {diff?.label}（Lv.{dungeon.difficulty}）
              </span>
              {dungeon.fromWorldBoss && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(251,146,60,0.2)", color:"#fb923c" }}>🌍 世界王</span>}
            </div>
          </div>
        </div>

        {/* 守關 BOSS + 掉落倍率 */}
        <div className="mt-4 rounded-2xl p-3 flex items-center gap-3" style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.24)" }}>
          <BossImg boss={boss} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black text-rose-300 uppercase">守關 BOSS</div>
            <div className="text-sm font-black text-white truncate">{boss?.name || "未知首領"}</div>
            <div className="text-[11px] text-slate-300 mt-0.5">{bossTier?.label || "首領"}級 · 🎁 掉落 ×{lootMin}~{lootMax}（隨機）</div>
          </div>
        </div>

        {/* 精簡設定：每回合箭數 / 靶面 */}
        <div className="mt-3">
          <DungeonRunSettings
            arrowsPerRound={arrowsPerRound}
            targetFmt={targetFmt}
            onArrowsChange={setArrowsPerRound}
            onTargetChange={setTargetFmt}
          />
        </div>

        {/* 單人 / 組隊 二擇一 */}
        <div className="mt-4 text-xs font-bold" style={{ color:"var(--text-secondary)" }}>🎯 選擇冒險模式</div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button onClick={chooseSolo}
            className="rounded-2xl p-4 text-center border transition-all active:scale-95"
            style={{ background:"rgba(59,130,246,0.12)", borderColor:"rgba(59,130,246,0.3)" }}>
            <div className="text-3xl">🧑</div>
            <div className="text-sm font-black text-white mt-1">單人遠征</div>
            <div className="text-[10px] mt-0.5" style={{ color:"var(--text-secondary)" }}>獨自挑戰三層</div>
          </button>
          <button onClick={chooseTeam}
            className="rounded-2xl p-4 text-center border transition-all active:scale-95"
            style={{ background:"rgba(139,92,246,0.12)", borderColor:"rgba(139,92,246,0.3)" }}>
            <div className="text-3xl">👥</div>
            <div className="text-sm font-black text-white mt-1">{isGuest ? "團康組隊" : "組隊探索"}</div>
            <div className="text-[10px] mt-0.5" style={{ color:"var(--text-secondary)" }}>{isGuest ? "邀朋友一起" : "最多 8 人"}</div>
          </button>
        </div>

        <button onClick={onBack}
          className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold border"
          style={{ borderColor:"rgba(255,255,255,0.15)", color:"var(--text-secondary)" }}>
          返回
        </button>
      </div>
    </div>
  );
}
