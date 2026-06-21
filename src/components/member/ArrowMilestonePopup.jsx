// src/components/member/ArrowMilestonePopup.jsx
// 設計原則：不干擾戰鬥。小里程碑用頂部 toast banner；120箭才用全螢幕慶祝。
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

// 小里程碑 → 頂部 toast banner（不擋畫面，點擊或5秒後消失）
export function SmallMilestonePopup({ milestone, rewards, onClose }) {
  const [visible, setVisible] = useState(false);
  const [msg]    = useState(() => getWarmMessage());
  const tierColor = { 1:"#10b981", 2:"#3b82f6", 3:"#8b5cf6", 4:"#f59e0b" };
  const color = tierColor[milestone.tier] || "#10b981";

  useEffect(() => {
    setTimeout(() => setVisible(true), 30);
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 400); }, 5000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // 獎勵摘要字串
  const parts = [];
  if (rewards.catBoxes)  parts.push(`🐱×${rewards.catBoxes}`);
  if (rewards.mimiBoxes) parts.push(`😺×${rewards.mimiBoxes}`);
  if (rewards.gachaCoins) parts.push(`🪙×${rewards.gachaCoins}`);

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
