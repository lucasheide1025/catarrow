// src/components/dungeon/DungeonStorageTab.jsx
// 已保存地下城清單 — 顯示玩家挖掘到的地下城儲存槽（最多 3 個）

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { removeSavedDungeon } from "../../lib/dungeonExcavation";
import { getExcavationDifficulty } from "../../lib/dungeonData";

const FAMILY_LABEL = {
  ghost:     { emoji:"👻", label:"幽冥系", bg:"rgba(168,85,247,0.12)", border:"rgba(168,85,247,0.25)" },
  mountain:  { emoji:"⛰️", label:"山嶺系", bg:"rgba(74,222,128,0.12)",  border:"rgba(74,222,128,0.25)"  },
  insect:    { emoji:"🦋", label:"昆蟲系", bg:"rgba(96,165,250,0.12)",  border:"rgba(96,165,250,0.25)"  },
  workplace: { emoji:"💼", label:"職場系", bg:"rgba(251,146,60,0.12)",  border:"rgba(251,146,60,0.25)"  },
  exam:      { emoji:"📝", label:"考試系", bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.25)"  },
  temple:    { emoji:"🏛️", label:"神廟系", bg:"rgba(234,88,12,0.12)",   border:"rgba(234,88,12,0.25)"   },
  treasure:  { emoji:"📦", label:"寶箱族", bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.25)"  },
};

const EMPTY_COLOR = { bg:"rgba(255,255,255,0.05)", border:"rgba(255,255,255,0.1)" };

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
          📦 已保存地下城（{saved.length}/3）
        </div>
        {saved.length > 0 && (
          <div className="text-[10px]" style={{ color:"var(--text-muted)" }}>
            點擊選擇地下城開始冒險
          </div>
        )}
      </div>

      {/* 固定 3 槽卡片 */}
      <div className="flex gap-2">
        {[0, 1, 2].map(idx => {
          const d = saved[idx] || null;
          if (!d) {
            // 空格
            return (
              <div key={`empty-${idx}`}
                className="flex-1 min-w-0 rounded-2xl border flex flex-col items-center justify-center gap-2"
                style={{
                  background:"rgba(255,255,255,0.04)",
                  borderColor:"rgba(255,255,255,0.1)",
                  padding:"20px 8px",
                }}>
                <div className="text-3xl">🕳️</div>
                <div className="text-[10px] font-bold" style={{ color:"rgba(255,255,255,0.25)" }}>
                  空槽 {idx + 1}
                </div>
              </div>
            );
          }
          const diff = getExcavationDifficulty(d.difficulty);
          const family = FAMILY_LABEL[d.family] || EMPTY_COLOR;
          return (
            <div key={d.id}
              className="flex-1 min-w-0 rounded-2xl border overflow-hidden transition-all active:scale-[0.97]"
              style={{ background:family.bg, borderColor:family.border }}>
              <button
                onClick={() => onSelectDungeon(d)}
                className="w-full text-left"
              >
                <div className="flex flex-col items-center gap-1 px-3 py-4">
                  <div className="text-3xl">
                    {d.isHidden ? "🎁" : (family.emoji || "🏰")}
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-black text-white leading-tight">
                      {d.isHidden ? "寶藏地下城" : (family.label || "未知")}
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{
                          background:`${diff?.color || "#94a3b8"}22`,
                          color: diff?.color || "#94a3b8",
                        }}>
                        {diff?.icon} {diff?.label}
                      </span>
                      {d.isHidden && (
                        <span className="text-[8px] px-1 py-0.5 rounded-full font-bold"
                          style={{ background:"rgba(251,191,36,0.2)", color:"#fbbf24" }}>
                          🎁
                        </span>
                      )}
                      {d.fromWorldBoss && (
                        <span className="text-[8px] px-1 py-0.5 rounded-full font-bold"
                          style={{ background:"rgba(251,146,60,0.2)", color:"#fb923c" }}>
                          🌍
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs" style={{ color:"var(--text-muted)" }}>›</div>
                </div>
              </button>
              {/* 移除按鈕 */}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(d.id); }}
                disabled={removing === d.id}
                className="w-full py-1.5 text-center text-[9px] font-bold border-t transition-all disabled:opacity-40"
                style={{
                  background:"rgba(0,0,0,0.15)",
                  color:"var(--text-muted)",
                  borderColor:"rgba(255,255,255,0.05)",
                }}
              >
                {removing === d.id ? "…" : "🗑️"}
              </button>
            </div>
          );
        })}
      </div>

      {/* 全空時附加說明 */}
      {saved.length === 0 && (
        <div className="text-center text-xs" style={{ color:"var(--text-muted)" }}>
          前往「⛏️ 挖掘探索」分頁挖掘地下城<br />
          完成後會自動保存到這裡（最多 3 個）
        </div>
      )}
    </div>
  );
}
