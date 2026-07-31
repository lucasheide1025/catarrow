// src/worldboss/ui/RaidKillCutscene.jsx
// 擊倒演出：射手衝出來 → 拉弓 → 箭飛過去 → 王倒下 → 寶物噴出來。
//
// ⚠️ 單人跟組隊要長得不一樣（作者 2026-07-31）：
//   單人＝一隻貓跑出來射一箭；組隊＝好幾個人一起射，箭雨過去。
//   這是「誰打倒的」最直觀的呈現——比一行字有力得多。
//
// 射手用 shoot_*.webp（**唯一需要弓的素材**，用側身拉弓的姿勢生的）。
// 隊伍列的 archer_*.webp 刻意沒有弓（那個模型畫弓成功率低），兩套不要混用。
import { useEffect, useState } from "react";
import { RAID_SHOOTERS, raidShooterArt } from "../raidAssets";
import "./raidFx.css";

// 依 memberId 穩定挑一個射手姿勢——同一個人每次都一樣
function shooterFor(memberId, index = 0) {
  const key = String(memberId || index);
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return RAID_SHOOTERS[h % RAID_SHOOTERS.length];
}

const LOOT = ["💰", "📦", "🃏", "💎", "🎁", "👑"];

/**
 * @param payload  buildKillPayload 的結果——**其他玩家重播時只有這個**，
 *                 沒有戰鬥 state。自己打倒時可以改傳 members/killerId/style。
 */
export default function RaidKillCutscene({
  payload = null, members = [], killerId = null, style, replay = false, onDone,
}) {
  const [phase, setPhase] = useState("enter");   // enter → fire → fall → loot → done
  const roster = payload ? (payload.cast || []) : members;
  const shownStyle = payload ? payload.style : style;
  const shownKiller = payload ? payload.killerId : killerId;
  const teamSize = payload ? (payload.teamSize || roster.length || 1) : members.length;
  const solo = teamSize <= 1;
  // 組隊時最多排 5 位（8 個人全排會擠成一團，看不出在射箭）
  const cast = (roster.length ? roster : [{ memberId: "me", name: "射手" }]).slice(0, 5);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("fire"), 620),
      setTimeout(() => setPhase("fall"), 1180),
      setTimeout(() => setPhase("loot"), 1720),
      setTimeout(() => { setPhase("done"); onDone?.(); }, 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  if (phase === "done") return null;

  return (
    <div className="raid-cut" style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none" }}>
      <div className="raid-cut-dim" />

      {/* 王倒下的閃光與衝擊 */}
      {phase !== "enter" && <div className="raid-cut-flash" />}

      {/* 射手：單人一位置中偏左，組隊排成一列 */}
      <div style={{
        position: "absolute", left: 0, bottom: "16%",
        display: "flex", gap: solo ? 0 : 6, alignItems: "flex-end",
        paddingLeft: solo ? "14%" : "6%",
      }}>
        {cast.map((m, i) => (
          <img
            key={m.memberId || i}
            src={raidShooterArt(shooterFor(m.memberId, i))}
            alt=""
            onError={e => { e.currentTarget.style.visibility = "hidden"; }}
            className={`raid-cut-shooter ${phase === "enter" ? "raid-cut-in" : "raid-cut-draw"}`}
            style={{
              width: solo ? 132 : 84, height: solo ? 132 : 84, objectFit: "contain",
              animationDelay: `${i * 70}ms`,
              filter: m.memberId === shownKiller
                ? "drop-shadow(0 0 12px #fbbf24) drop-shadow(0 6px 10px rgba(0,0,0,.7))"
                : "drop-shadow(0 6px 10px rgba(0,0,0,.7))",
            }}
          />
        ))}
      </div>

      {/* 箭：從射手身上**往上**射向王。單人一支、組隊一排。 */}
      {(phase === "fire" || phase === "fall") && cast.map((m, i) => (
        <span key={`ar${i}`} className="raid-cut-arrow"
          style={{
            left: solo ? "20%" : `${9 + i * 15}%`,
            animationDelay: `${i * 60}ms`,
          }}>➤</span>
      ))}

      {/* 寶物噴出來 */}
      {phase === "loot" && LOOT.map((icon, i) => (
        <span key={`lt${i}`} className="raid-cut-loot"
          style={{
            "--lx": `${(i - LOOT.length / 2) * 46}px`,
            "--ly": `${-90 - (i % 3) * 34}px`,
            animationDelay: `${i * 55}ms`,
          }}>{icon}</span>
      ))}

      {/* 擊倒方式的字卡 */}
      {(phase === "fall" || phase === "loot") && shownStyle && (
        <div className="raid-cut-title" style={{ color: shownStyle.color }}>
          {replay && (
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#93c5fd", marginBottom: 2 }}>
              🌐 全服擊倒重播
            </div>
          )}
          <div style={{ fontSize: 13, letterSpacing: 3, opacity: .9 }}>
            {solo ? "單騎討伐" : `${teamSize} 人討伐`}
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 4 }}>
            {shownStyle.icon} {shownStyle.name}
          </div>
          {payload && (
            <div style={{ fontSize: 12, fontWeight: 900, color: "#e2e8f0", marginTop: 4 }}>
              {payload.killerName}{payload.byCat ? ` 的 ${payload.catName}` : ""} 給予最後一擊
            </div>
          )}
        </div>
      )}
    </div>
  );
}
