// src/components/member/ArrowMilestonePopup.jsx
import { useState, useEffect } from "react";
import { getWarmMessage, getBigMessage } from "../../lib/arrowMilestone";

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

// 小里程碑 popup（6/12/24/30箭）
export function SmallMilestonePopup({ milestone, rewards, onClose }) {
  const [msg] = useState(() => getWarmMessage());
  const tierLabels = { 1: "6箭", 2: "12箭", 3: "24箭", 4: "30箭完成！" };
  const tierBg = {
    1: "from-emerald-600 to-teal-700",
    2: "from-blue-600 to-indigo-700",
    3: "from-violet-600 to-purple-700",
    4: "from-amber-500 to-orange-600",
  };
  const bg = tierBg[milestone.tier] || "from-teal-600 to-blue-700";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <div
        className={`w-full max-w-xs rounded-3xl bg-gradient-to-b ${bg} p-5 shadow-2xl`}
        onClick={e => e.stopPropagation()}>

        {/* 頭部 */}
        <div className="text-center mb-3">
          <div className="text-4xl mb-1">🎉</div>
          <div className="text-white font-black text-lg">練箭里程碑！</div>
          <div className="text-white/80 text-sm mt-0.5">今日累積 {milestone.arrows} 支箭</div>
        </div>

        {/* 獎勵列表 */}
        <div className="flex flex-col gap-2 mb-4">
          <RewardRow label="貓貓箱" icon="🐱" count={rewards.catBoxes} />
          <RewardRow label="咪咪箱（自動開啟）" icon="😺" count={rewards.mimiBoxes} />
          <RewardRow label="扭蛋幣" icon="🪙" count={rewards.gachaCoins} />
        </div>

        {/* 暖心話語 */}
        <div className="bg-white/10 rounded-2xl px-4 py-3 mb-4">
          <p className="text-white/90 text-sm text-center leading-relaxed">{msg}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-white text-gray-800 font-black text-base active:scale-95 transition-transform">
          太好了，繼續！
        </button>
      </div>
    </div>
  );
}

// 120箭大里程碑（全螢幕）
export function BigMilestonePopup({ milestone, rewards, onClose }) {
  const [msg] = useState(() => getBigMessage(milestone.arrows));
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 50); }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}>
      <div
        className={`w-full max-w-sm mx-4 rounded-3xl bg-gradient-to-b from-yellow-500 to-orange-600 p-6 shadow-2xl
          transition-all duration-500 ${show ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>

        {/* 煙火動畫文字 */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-2 animate-bounce">🏆</div>
          <div className="text-white font-black text-2xl">百箭勇者！</div>
          <div className="text-white/90 font-bold text-base mt-1">
            今日累積 {milestone.arrows} 支箭！
            {milestone.multiple > 1 && <span className="text-yellow-200"> × {milestone.multiple}</span>}
          </div>
          <div className="flex justify-center gap-1 mt-2">
            {Array.from({ length: Math.min(milestone.multiple, 5) }).map((_, i) => (
              <span key={i} className="text-xl">⭐</span>
            ))}
          </div>
        </div>

        {/* 獎勵 */}
        <div className="flex flex-col gap-2 mb-4">
          <RewardRow label="貓貓箱" icon="🐱" count={rewards.catBoxes} />
          <RewardRow label="咪咪箱（自動開啟）" icon="😺" count={rewards.mimiBoxes} />
          <RewardRow label="扭蛋幣" icon="🪙" count={rewards.gachaCoins} />
        </div>

        {/* 圖鑑記錄提示 */}
        <div className="bg-white/20 rounded-2xl px-4 py-2 mb-4 text-center">
          <span className="text-white/80 text-xs">📖 百箭成就已記入圖鑑</span>
        </div>

        {/* 暖心話語 */}
        <div className="bg-white/10 rounded-2xl px-4 py-3 mb-4">
          <p className="text-white/90 text-sm text-center leading-relaxed">{msg}</p>
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
