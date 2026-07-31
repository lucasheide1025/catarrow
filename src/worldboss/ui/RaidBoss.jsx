// src/worldboss/ui/RaidBoss.jsx
// 王 ＋ 部位熱點。討伐版式的核心：牠必須夠大，玩家才看得到自己在打哪裡。
// 王的立繪沿用既有的 WorldBossSVG（24 隻都有；教練與貓是真人真貓，不另外生圖）。
import { useEffect, useRef, useState } from "react";
import WorldBossSVG from "../../components/worldboss/WorldBossSVG";
import { callableParts } from "../domain/weakPoints";

// 部位在立繪上的相對位置（%）。四個點刻意錯開，手指不會誤觸。
const PART_POS = {
  eye:   { left: 50, top: 24 },
  heart: { left: 38, top: 47 },
  leg:   { left: 60, top: 74 },
  tail:  { left: 22, top: 66 },
};

export default function RaidBoss({
  bossKey, hp, maxHp, size = 240,
  blocked = [], declaredId = null, onDeclare,
  charging = false, staggered = false, exposedIds = [],
  anim = null,            // "flinch" | "roar" | "fall" | null
  locked = false,         // 計分中不能改宣告
}) {
  const parts = callableParts(blocked);
  const ratio = Math.max(0, Math.min(1, maxHp ? hp / maxHp : 0));
  const [sparks, setSparks] = useState([]);
  const sparkId = useRef(0);

  // 命中時噴粒子。上限 16 顆、播完就移除節點（效能紀律）
  useEffect(() => {
    if (anim !== "flinch") return;
    const id = sparkId.current++;
    const burst = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      return {
        key: `${id}-${i}`,
        dx: `${Math.cos(angle) * (40 + Math.random() * 34)}px`,
        dy: `${Math.sin(angle) * (40 + Math.random() * 34)}px`,
        color: i % 3 === 0 ? "#fde68a" : i % 3 === 1 ? "#fbbf24" : "#fff7ed",
      };
    });
    setSparks(burst);
    const t = setTimeout(() => setSparks([]), 760);
    return () => clearTimeout(t);
  }, [anim]);

  const bossClass = [
    "raid-boss",
    anim === "fall" ? "raid-boss-fall"
      : anim === "roar" ? "raid-boss-roar"
      : anim === "flinch" ? "raid-boss-flinch"
      : staggered ? "raid-boss-stagger"
      : charging ? "raid-boss-charging"
      : "raid-boss-idle",
  ].join(" ");

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <div className={bossClass} style={{ width: "100%", height: "100%" }}>
        <WorldBossSVG bossKey={bossKey} currentHP={hp} maxHP={maxHp} size={size} />
        {/* 血量越低，裂痕越明顯 */}
        <div className="raid-crack" style={{ opacity: (1 - ratio) * 0.75 }} />
      </div>

      {/* 命中粒子 */}
      {sparks.map(s => (
        <span key={s.key} className="raid-spark"
          style={{ left: "50%", top: "45%", background: s.color, "--dx": s.dx, "--dy": s.dy }} />
      ))}

      {/* 部位熱點 */}
      {parts.map(part => {
        const pos = PART_POS[part.id];
        if (!pos) return null;
        const active = declaredId === part.id;
        const exposed = exposedIds.includes(part.id) && !part.blocked;
        const cls = [
          "raid-part",
          part.blocked ? "raid-part-blocked" : "",
          active ? "raid-part-active" : "",
          exposed && !active ? "raid-part-exposed" : "",
          declaredId && !active && !part.blocked ? "raid-part-dim" : "",
        ].filter(Boolean).join(" ");

        return (
          <button
            key={part.id} type="button" className={cls}
            disabled={part.blocked || locked}
            aria-pressed={active}
            aria-label={`宣告${part.name}（需要 ${part.threshold} 分以上）`}
            onClick={() => !part.blocked && !locked && onDeclare?.(part.id)}
            style={{ left: `${pos.left}%`, top: `${pos.top}%`, color: part.color }}
          >
            <span aria-hidden>{part.blocked ? "⛓️" : part.icon}</span>
            <span style={{
              position: "absolute", bottom: -15, fontSize: 9, fontWeight: 900,
              color: part.blocked ? "#64748b" : part.color, whiteSpace: "nowrap",
              textShadow: "0 1px 4px rgba(0,0,0,.9)",
            }}>
              {part.blocked ? "封鎖" : `≥${part.threshold}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
