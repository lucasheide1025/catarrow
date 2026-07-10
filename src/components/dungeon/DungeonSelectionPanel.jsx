// src/components/dungeon/DungeonSelectionPanel.jsx
// 選擇地下城後的組隊/單人選擇面板

import { useMemo, useState } from "react";
import { getExcavationDifficulty } from "../../lib/dungeonData";
import { drawExpeditionBoss, TIER_LABEL } from "../../lib/monsterData";
import { getExpeditionRewardPreview } from "../../lib/expeditionRewards";
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

export default function DungeonSelectionPanel({
  dungeon,         // { id, family, difficulty, isHidden, savedId }
  profile,
  onBack,
  onStartSolo,     // () 開始單人遠征
  onStartTeam,     // (dungeon) 建立組隊房間
  isGuest,
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [arrowsPerRound, setArrowsPerRound] = useState(DEFAULT_DUNGEON_ARROWS);
  const [targetFmt, setTargetFmt] = useState(DEFAULT_DUNGEON_TARGET);
  const myId = profile?.id;

  const diff = getExcavationDifficulty(dungeon.difficulty);
  const family = FAMILY_LABEL[dungeon.family] || { emoji:"🏰", label:"未知族系" };
  const boss = useMemo(
    () => dungeon.boss || drawExpeditionBoss(dungeon.difficulty, dungeon.family),
    [dungeon.boss, dungeon.difficulty, dungeon.family],
  );
  const rewardPreview = useMemo(() => getExpeditionRewardPreview(boss), [boss]);
  const bossTier = TIER_LABEL[boss?.tier];

  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6"
        onClick={() => setShowConfirm(false)}
        style={{
          background:"rgba(0,0,0,0.85)",
          backdropFilter:"blur(8px)",
        }}>
        <div className="text-center max-w-sm w-full max-h-[92dvh] overflow-y-auto py-4"
          onClick={e => e.stopPropagation()}>
          <div className="text-6xl mb-4">
            {dungeon.isHidden ? "🎁" : family.emoji}
          </div>
          <div className="text-2xl font-black text-white mb-1">
            {dungeon.isHidden ? "🎁 寶藏地下城" : family.label}
          </div>
          <div className="mt-2 mb-6">
            <span className="inline-block px-3 py-1 rounded-full text-sm font-black"
              style={{
                background:`${diff?.color || "#94a3b8"}33`,
                color: diff?.color || "#94a3b8",
                border:`1px solid ${diff?.color || "#94a3b8"}55`,
              }}>
              {diff?.icon} {diff?.label}
            </span>
            {dungeon.fromWorldBoss && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background:"rgba(251,146,60,0.2)", color:"#fb923c" }}>
                🌍 世界王掉落
              </span>
            )}
            {dungeon.isHidden && (
              <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background:"rgba(251,191,36,0.2)", color:"#fbbf24" }}>
                🎁 隱藏
              </span>
            )}
          </div>

          <div className="space-y-2 mb-6 text-left">
            <div className="rounded-xl px-4 py-3"
              style={{ background:"rgba(255,255,255,0.06)" }}>
              <div className="text-xs" style={{ color:"var(--text-secondary)" }}>地下城族系</div>
              <div className="text-sm font-bold text-white">{family.emoji} {family.label}</div>
            </div>
            <div className="rounded-xl px-4 py-3"
              style={{ background:"rgba(255,255,255,0.06)" }}>
              <div className="text-xs" style={{ color:"var(--text-secondary)" }}>難度等級</div>
              <div className="text-sm font-bold text-white">{diff?.icon} {diff?.label}（Lv.{dungeon.difficulty}）</div>
            </div>
            <div className="rounded-xl px-4 py-3"
              style={{ background:"rgba(255,255,255,0.06)" }}>
              <div className="text-xs" style={{ color:"var(--text-secondary)" }}>樓層結構</div>
              <div className="text-sm font-bold text-white">🏗️ 3 層（探索層 → 戰鬥層 → Boss 層）</div>
            </div>
            <div className="rounded-xl px-4 py-4"
              style={{ background:"rgba(239,68,68,0.10)", border:"1px solid rgba(239,68,68,0.24)" }}>
              <div className="text-sm font-black text-rose-300">👑 守關 BOSS</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-4xl">{boss?.icon || "👹"}</span>
                <div>
                  <div className="text-lg font-black text-white">{boss?.name || "未知首領"}</div>
                  <div className="text-sm text-slate-300 mt-1">
                    {bossTier?.label || "首領"}級 · BOSS 變體
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl px-4 py-4"
              style={{ background:"rgba(245,158,11,0.09)", border:"1px solid rgba(245,158,11,0.22)" }}>
              <div className="text-sm font-black text-amber-300">🎁 保證掉落 ×{rewardPreview?.multiplierMin || 1}~{rewardPreview?.multiplierMax || 3}（隨機）</div>
              <div className="text-sm text-white mt-2">
                {rewardPreview?.materialChest.icon || "📦"} {rewardPreview?.materialChest.name || "材料寶箱"} ×{rewardPreview?.multiplierMin || 1}~{rewardPreview?.multiplierMax || 3}
              </div>
              <div className="text-sm text-white mt-1">
                {rewardPreview?.coinChest.icon || "🪙"} {rewardPreview?.coinChest.name || "金幣寶箱"} ×{rewardPreview?.multiplierMin || 1}~{rewardPreview?.multiplierMax || 3}
              </div>
            </div>
            <DungeonRunSettings
              arrowsPerRound={arrowsPerRound}
              targetFmt={targetFmt}
              onArrowsChange={setArrowsPerRound}
              onTargetChange={setTargetFmt}
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 rounded-xl text-sm font-bold border"
              style={{ borderColor:"rgba(255,255,255,0.2)", color:"var(--text-secondary)" }}>
              返回
            </button>
            <button onClick={() => onStartSolo({ boss, arrowsPerRound, targetFmt })}
              className="flex-1 py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg active:scale-95 transition-all">
              ⚔️ 確認出發
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 返回按鈕 */}
      <button onClick={onBack}
        className="text-sm font-bold" style={{ color:"var(--text-secondary)" }}>
        ← 返回地下城選單
      </button>

      {/* 地下城資訊卡片 */}
      <div className="rounded-2xl p-6 text-center"
        style={{
          background:"linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(30,41,59,0.95) 50%)",
          border:"1px solid rgba(245,158,11,0.2)",
        }}>
        <div className="text-5xl mb-3">
          {dungeon.isHidden ? "🎁" : family.emoji}
        </div>
          <div className="text-2xl font-black text-white mb-2">
            {dungeon.isHidden ? "🎁 寶藏地下城" : family.label}
          </div>
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-sm font-bold"
            style={{
              background:`${diff?.color || "#94a3b8"}22`,
              color: diff?.color || "#94a3b8",
            }}>
            {diff?.icon} {diff?.label}
          </span>
          {dungeon.fromWorldBoss && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold"
              style={{ background:"rgba(251,146,60,0.2)", color:"#fb923c" }}>
              🌍 世界王掉落
            </span>
          )}
          {dungeon.isHidden && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background:"rgba(251,191,36,0.2)", color:"#fbbf24" }}>
              🎁 隱藏
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-4"
        style={{ background:"rgba(15,23,42,0.92)", border:"1px solid rgba(239,68,68,0.28)" }}>
        <div className="flex items-center gap-4">
          <div className="text-5xl shrink-0">{boss?.icon || "👹"}</div>
          <div className="min-w-0">
            <div className="text-sm font-black text-rose-300">王房守關 BOSS</div>
            <div className="text-xl font-black text-white mt-1">{boss?.name || "未知首領"}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full text-xs font-black"
                style={{ color:bossTier?.color || "#f87171", background:"rgba(255,255,255,0.07)" }}>
                {bossTier?.label || "首領"}級
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-black text-rose-300 bg-rose-500/10">
                BOSS 變體
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background:"rgba(245,158,11,0.09)" }}>
            <div className="text-2xl">{rewardPreview?.materialChest.icon || "📦"}</div>
            <div className="text-sm font-black text-white mt-1">
              {rewardPreview?.materialChest.name || "材料寶箱"} ×{rewardPreview?.multiplierMin || 1}~{rewardPreview?.multiplierMax || 3}
            </div>
            <div className="text-xs text-slate-400 mt-1">{family.label}材料</div>
          </div>
          <div className="rounded-xl p-3" style={{ background:"rgba(250,204,21,0.09)" }}>
            <div className="text-2xl">{rewardPreview?.coinChest.icon || "🪙"}</div>
            <div className="text-sm font-black text-white mt-1">
              {rewardPreview?.coinChest.name || "金幣寶箱"} ×{rewardPreview?.multiplierMin || 1}~{rewardPreview?.multiplierMax || 3}
            </div>
            <div className="text-xs text-slate-400 mt-1">每隻怪物均會掉落</div>
          </div>
        </div>

        <div className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background:"linear-gradient(90deg,rgba(139,92,246,0.18),rgba(245,158,11,0.15))" }}>
          <span className="text-sm font-bold text-slate-200">地下城掉落倍率</span>
          <span className="text-xl font-black text-amber-300">×{rewardPreview?.multiplierMin || 1}~{rewardPreview?.multiplierMax || 3}（隨機）</span>
        </div>
      </div>

      <DungeonRunSettings
        arrowsPerRound={arrowsPerRound}
        targetFmt={targetFmt}
        onArrowsChange={setArrowsPerRound}
        onTargetChange={setTargetFmt}
      />

      {/* 模式選擇 */}
      <div className="space-y-3">
        <div className="text-xs font-bold" style={{ color:"var(--text-secondary)" }}>
          🎯 選擇冒險模式
        </div>

        {/* 單人遠征 */}
        <button onClick={() => setShowConfirm(true)}
          className="w-full rounded-2xl p-4 text-left border transition-all active:scale-[0.98]"
          style={{
            background:"rgba(59,130,246,0.10)",
            borderColor:"rgba(59,130,246,0.25)",
          }}>
          <div className="flex items-center gap-4">
            <div className="text-3xl">🧑</div>
            <div>
              <div className="text-base font-black text-white">單人遠征</div>
              <div className="text-xs mt-0.5" style={{ color:"var(--text-secondary)" }}>
                獨自挑戰地下城三層，考驗個人實力
              </div>
            </div>
          </div>
        </button>

        {/* 組隊探索 */}
        {!isGuest && (
          <button onClick={() => onStartTeam({
            ...dungeon,
            boss,
            arrowsPerRound,
            targetFmt,
          })}
            className="w-full rounded-2xl p-4 text-left border transition-all active:scale-[0.98]"
            style={{
              background:"rgba(139,92,246,0.10)",
              borderColor:"rgba(139,92,246,0.25)",
            }}>
            <div className="flex items-center gap-4">
              <div className="text-3xl">👥</div>
              <div>
                <div className="text-base font-black text-white">組隊探索</div>
                <div className="text-xs mt-0.5" style={{ color:"var(--text-secondary)" }}>
                  建立房間邀請夥伴一起挑戰（最多 4 人）
                </div>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
