// src/worldboss/ui/RaidBoss.jsx
// 王 ＋ 部位熱點。討伐版式的核心：牠必須夠大，玩家才看得到自己在打哪裡。
// 王的立繪沿用既有的 WorldBossSVG（24 隻都有；教練與貓是真人真貓，不另外生圖）。
import { useEffect, useRef, useState } from "react";
import WorldBossSVG from "../../components/worldboss/WorldBossSVG";


// 弱點圈在靶面上的座標（-1~1）直接映射到立繪上——射在紙上的位置＝射在牠身上的位置。
function spotStyle(spot) {
  return { left: `${50 + spot.cx * 42}%`, top: `${50 + spot.cy * 40}%` };
}

export default function RaidBoss({
  bossKey, hp, maxHp, size = 240,
  spots = [],
  charging = false, staggered = false,
  anim = null,            // "flinch" | "roar" | "fall" | null
}) {
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

      {/* 弱點圈：跟靶面上畫的是同一組，位置一一對應 */}
      {spots.map(spot => (
        <span key={spot.key || spot.id} aria-hidden
          className={charging ? "raid-part raid-part-exposed" : "raid-part"}
          style={{
            ...spotStyle(spot), color: spot.color, pointerEvents: "none",
            width: Math.max(26, spot.radius * 190), height: Math.max(26, spot.radius * 190),
            fontSize: Math.max(12, spot.radius * 64),
          }}>
          {spot.icon}
        </span>
      ))}

    </div>
  );
}
