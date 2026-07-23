// src/components/dungeon/DungeonStorageTab.jsx
// 已保存地下城清單 — 顯示玩家挖掘到的地下城儲存槽（最多 MAX_SAVED_DUNGEONS 個）
// 2026-07-23：儲存槽 3→6、保存卡改用每族橫向外觀封面（public/assets/dungeon/cover_<family>.webp）

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { removeSavedDungeon, MAX_SAVED_DUNGEONS } from "../../lib/dungeonExcavation";
import { getExcavationDifficulty } from "../../lib/dungeonData";

const FAMILY_LABEL = {
  ghost:     { emoji:"👻", label:"幽冥系", bg:"rgba(168,85,247,0.18)", border:"rgba(168,85,247,0.35)" },
  mountain:  { emoji:"⛰️", label:"山嶺系", bg:"rgba(74,222,128,0.18)",  border:"rgba(74,222,128,0.35)"  },
  insect:    { emoji:"🦋", label:"昆蟲系", bg:"rgba(96,165,250,0.18)",  border:"rgba(96,165,250,0.35)"  },
  workplace: { emoji:"💼", label:"職場系", bg:"rgba(251,146,60,0.18)",  border:"rgba(251,146,60,0.35)"  },
  exam:      { emoji:"📝", label:"考試系", bg:"rgba(251,191,36,0.18)",  border:"rgba(251,191,36,0.35)"  },
  temple:    { emoji:"🏛️", label:"神廟系", bg:"rgba(234,88,12,0.18)",   border:"rgba(234,88,12,0.35)"   },
  treasure:  { emoji:"📦", label:"寶箱族", bg:"rgba(251,191,36,0.18)",  border:"rgba(251,191,36,0.35)"  },
};

function SavedCard({ d, onSelect, onRemove, removing }) {
  const diff = getExcavationDifficulty(d.difficulty);
  const family = FAMILY_LABEL[d.family] || { emoji:"🏰", label:"未知", bg:"rgba(148,163,184,0.15)", border:"rgba(148,163,184,0.3)" };
  // 封面優先用「該族該階」專屬圖，缺圖退回「該族」通用圖，再缺退回 emoji
  const coverChain = [
    d.family && d.difficulty && `/assets/dungeon/cover_${d.family}_t${d.difficulty}.webp`,
    `/assets/dungeon/cover_${d.family || "ghost"}.webp`,
  ].filter(Boolean);
  const [coverIdx, setCoverIdx] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const cover = coverChain[Math.min(coverIdx, coverChain.length - 1)];
  const handleImgError = () => {
    if (coverIdx < coverChain.length - 1) setCoverIdx(coverIdx + 1);
    else setImgFailed(true);
  };
  return (
    <div className="rounded-2xl border overflow-hidden transition-all active:scale-[0.98]"
      style={{ background:"#0b1220", borderColor:family.border, boxShadow:`0 10px 22px rgba(0,0,0,.28)` }}>
      <button onClick={() => onSelect(d)} className="block w-full text-left">
        <div className="relative w-full" style={{ aspectRatio:"2 / 1" }}>
          {!imgFailed ? (
            <img src={cover} alt="" onError={handleImgError}
              className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl"
              style={{ background:family.bg }}>{d.isHidden ? "🎁" : family.emoji}</div>
          )}
          {/* 下方漸層壓字 */}
          <div className="absolute inset-0"
            style={{ background:"linear-gradient(to top, rgba(3,7,18,.94) 6%, rgba(3,7,18,.2) 52%, transparent)" }} />
          {/* 難度徽章 */}
          <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-black"
            style={{ background:`${diff?.color || "#94a3b8"}e6`, color:"#0b1220" }}>
            {diff?.icon} {diff?.label}
          </span>
          {d.isHidden && (
            <span className="absolute top-1.5 left-1.5 text-[8px] px-1.5 py-0.5 rounded-full font-black"
              style={{ background:"rgba(251,191,36,0.9)", color:"#3b2500" }}>🎁 寶藏</span>
          )}
          {d.fromWorldBoss && (
            <span className="absolute top-8 left-1.5 text-[8px] px-1.5 py-0.5 rounded-full font-black"
              style={{ background:"rgba(251,146,60,0.9)", color:"#3b1a00" }}>🌍 世界王</span>
          )}
          {/* 名稱 + 階級 */}
          <div className="absolute bottom-1.5 left-2 right-2 flex items-end justify-between gap-1">
            <div className="min-w-0">
              <div className="text-xs font-black text-white leading-tight truncate drop-shadow">
                {d.isHidden ? "寶藏地下城" : family.label}
              </div>
              <div className="text-[9px] font-bold" style={{ color:"rgba(255,255,255,0.7)" }}>T{d.difficulty}</div>
            </div>
            <span className="text-white/70 text-sm shrink-0">›</span>
          </div>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(d.id); }}
        disabled={removing === d.id}
        className="w-full py-1.5 text-center text-[9px] font-bold border-t transition-all disabled:opacity-40"
        style={{ background:"rgba(0,0,0,0.2)", color:"var(--text-muted)", borderColor:"rgba(255,255,255,0.05)" }}
      >
        {removing === d.id ? "…" : "🗑️ 移除"}
      </button>
    </div>
  );
}

export default function DungeonStorageTab({ profile, onSelectDungeon }) {
  const myId = profile?.id;
  const [saved, setSaved] = useState([]);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (!myId) return;
    const unsub = onSnapshot(doc(db, "members", myId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setSaved(data.dungeonExcavation?.savedDungeons || []);
    });
    return unsub;
  }, [myId]);

  async function handleRemove(dungeonId) {
    setRemoving(dungeonId);
    await removeSavedDungeon(myId, dungeonId);
    setRemoving(null);
  }

  return (
    <div className="space-y-3">
      {/* 儲存槽狀態 */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold" style={{ color:"var(--text-secondary)" }}>
          📦 已保存地下城（{saved.length}/{MAX_SAVED_DUNGEONS}）
        </div>
        {saved.length > 0 && (
          <div className="text-[10px]" style={{ color:"var(--text-muted)" }}>
            點擊選擇地下城開始冒險
          </div>
        )}
      </div>

      {/* MAX_SAVED_DUNGEONS 槽卡片（2×3） */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Array.from({ length: MAX_SAVED_DUNGEONS }, (_, idx) => {
          const d = saved[idx] || null;
          if (!d) {
            return (
              <div key={`empty-${idx}`}
                className="rounded-2xl border flex flex-col items-center justify-center gap-1.5"
                style={{ background:"#0b1220", borderColor:"rgba(148,163,184,0.16)", aspectRatio:"2 / 1.35" }}>
                <div className="text-2xl opacity-40">🕳️</div>
                <div className="text-[10px] font-bold" style={{ color:"rgba(255,255,255,0.25)" }}>空槽 {idx + 1}</div>
              </div>
            );
          }
          return (
            <SavedCard key={d.id} d={d} onSelect={onSelectDungeon} onRemove={handleRemove} removing={removing} />
          );
        })}
      </div>

      {/* 全空時附加說明 */}
      {saved.length === 0 && (
        <div className="text-center text-xs" style={{ color:"var(--text-muted)" }}>
          前往「⛏️ 挖掘探索」分頁挖掘地下城<br />
          完成後會自動保存到這裡（最多 {MAX_SAVED_DUNGEONS} 個）
        </div>
      )}
    </div>
  );
}
