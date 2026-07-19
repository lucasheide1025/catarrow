// src/components/member/ArrowMilestonePopup.jsx
// 設計原則：不干擾戰鬥。小里程碑用頂部 toast banner；120箭才用全螢幕慶祝。
import { useState, useEffect } from "react";
import {
  getWarmMessage, getBigMessage, FINAL_MILESTONE_ARROWS, REST_MESSAGE, describeMilestoneRewards,
} from "../../lib/arrowMilestone";
import { CHEST_TYPES } from "../../lib/itemData";
import { COIN_CHEST_TIERS } from "../../lib/lootTable";
import { getVillagePack } from "../../lib/villagePack";
import { RESOURCE_NAMES } from "../../lib/villageData";
import { sfxLevelUp, sfxVictoryFanfare } from "../../lib/sound";
import Confetti from "../shared/Confetti";

function RewardRow({ label, icon, count }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
      <span className="text-xl">{icon}</span>
      <span className="text-white font-bold text-sm flex-1">{label}</span>
      <span className="text-yellow-300 font-black text-sm">×{count}</span>
    </div>
  );
}

// 敘述來源統一在 arrowMilestone.describeMilestoneRewards（下課頁的 MilestoneBoard 也用同一支）
const rewardRowsOf = (rewards = {}) =>
  describeMilestoneRewards(rewards, { CHEST_TYPES, COIN_CHEST_TIERS, getVillagePack });

// 建築包開出的材料明細（領取時就地開包，這裡只負責顯示）
function PackMaterials({ rolledPack }) {
  const materials = rolledPack?.materials;
  if (!materials || !Object.keys(materials).length) return null;
  return (
    <div className="bg-white/10 rounded-2xl px-3 py-2.5">
      <div className="text-white/70 text-[11px] font-bold mb-1.5">
        🏗️ 建築包開出（已存入貓貓村）
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(materials).map(([key, amount]) => (
          <span key={key} className="text-[11px] font-bold text-white bg-black/25 rounded-lg px-2 py-1">
            {RESOURCE_NAMES[key] || key} ×{amount}
          </span>
        ))}
      </div>
    </div>
  );
}

// 小里程碑 → 頂部 toast banner（不擋畫面，點擊或5秒後消失）
export function SmallMilestonePopup({ milestone, rewards, onClose }) {
  const [visible, setVisible] = useState(false);
  const [msg]    = useState(() => getWarmMessage());
  const tierColor = { 1:"#10b981", 2:"#3b82f6", 3:"#8b5cf6", 4:"#f59e0b" };
  const color = tierColor[milestone.tier] || "#10b981";

  useEffect(() => {
    sfxLevelUp(); // 小里程碑：輕快升級音（不用全螢幕慶祝，遵守「不干擾戰鬥」）
    setTimeout(() => setVisible(true), 30);
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 400); }, 5000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // 獎勵摘要字串（與大彈窗共用同一份敘述來源）
  const parts = rewardRowsOf(rewards).map(row => `${row.icon}×${row.count}`);

  return (
    <div
      onClick={() => { setVisible(false); setTimeout(onClose, 400); }}
      className="fixed top-4 left-0 right-0 z-[300] flex justify-center px-4 pointer-events-none">
      <div
        className="pointer-events-auto max-w-sm w-full rounded-2xl shadow-2xl px-4 py-3 transition-all duration-400"
        style={{
          background: `linear-gradient(135deg, ${color}dd, ${color}99)`,
          backdropFilter: "blur(12px)",
          border: `1px solid ${color}66`,
          transform: visible ? "translateY(0)" : "translateY(-80px)",
          opacity: visible ? 1 : 0,
        }}>
        <div className="flex items-center gap-3">
          <div className="text-2xl">🎉</div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-black text-sm">今日 {milestone.arrows} 支箭！里程碑達成</div>
            <div className="text-white/80 text-xs mt-0.5">{parts.join("  ")}  ・  {msg}</div>
          </div>
          <div className="text-white/50 text-xs shrink-0">點擊關閉</div>
        </div>
      </div>
    </div>
  );
}

// 120箭大里程碑（全螢幕）
export function BigMilestonePopup({ milestone, rewards, onClose }) {
  const [msg] = useState(() => getBigMessage(milestone.arrows));
  const [show, setShow] = useState(false);
  const [confetti, setConfetti] = useState(true);
  useEffect(() => {
    sfxVictoryFanfare(); // 百箭大里程碑：凱旋號角 + 彩帶
    setTimeout(() => setShow(true), 50);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}>
      {confetti && <Confetti onDone={() => setConfetti(false)} />}
      <div
        /* ⚠️ 一定要能捲動：獎勵改版後這張卡多了寶箱列與建築包材料，內容一長，
           「太棒了！！」按鈕就會被推出畫面，而彈窗蓋住整個畫面又點不到下面的東西 ——
           使用者實測就是卡死在這裡。 */
        className={`w-full max-w-sm mx-4 max-h-[90dvh] overflow-y-auto rounded-3xl bg-gradient-to-b from-yellow-500 to-orange-600 p-6 shadow-2xl
          transition-all duration-500 ${show ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>

        {/* 煙火動畫文字 */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-2 animate-bounce">🏆</div>
          <div className="text-white font-black text-2xl">{milestone.label || "里程碑達成！"}</div>
          <div className="text-white/90 font-bold text-base mt-1">
            今日累積 {milestone.arrows} 支箭！
          </div>
        </div>

        {/* 獎勵：全部走同一份敘述來源，寶箱名稱直接取自定義表 */}
        <div className="flex flex-col gap-2 mb-3">
          {rewardRowsOf(rewards).map(row => (
            <RewardRow key={row.key} label={row.label} icon={row.icon} count={row.count} />
          ))}
        </div>

        {/* 建築包開出的材料 */}
        <div className="mb-4">
          <PackMaterials rolledPack={milestone.rolledPack} />
        </div>

        {/* 暖心話語；最後一階改成「你該休息了」 */}
        <div className="bg-white/10 rounded-2xl px-4 py-3 mb-4">
          <p className="text-white/90 text-sm text-center leading-relaxed">
            {milestone.arrows >= FINAL_MILESTONE_ARROWS ? REST_MESSAGE : msg}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-white text-gray-800 font-black text-base active:scale-95 transition-transform">
          太棒了！！
        </button>
      </div>
    </div>
  );
}

// 主控制器：依序顯示多個里程碑
export default function ArrowMilestonePopup({ milestones, rewardsList, onAllClose }) {
  const [idx, setIdx] = useState(0);

  if (!milestones?.length || idx >= milestones.length) return null;

  const ms  = milestones[idx];
  const rws = rewardsList[idx] || {};
  const next = () => {
    if (idx + 1 >= milestones.length) onAllClose?.();
    else setIdx(i => i + 1);
  };

  return ms.type === "big"
    ? <BigMilestonePopup milestone={ms} rewards={rws} onClose={next} />
    : <SmallMilestonePopup milestone={ms} rewards={rws} onClose={next} />;
}
