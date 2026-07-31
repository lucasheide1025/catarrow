// src/worldboss/ui/RaidKillCutscene.jsx
// 擊倒演出。**順序是固定的**（作者 2026-07-31 指定）：
//
//   ① 王先出現在畫面上  ② 射出箭矢  ③ 王倒下  ④ 噴寶箱  ⑤ 跳字＋所有參戰人的名字
//
// ⚠️ 王一定要先出現。少了這一步，觀眾根本不知道畫面上正在打誰——
//    這段演出的重點是「這隻王倒了」，不是「有人在射箭」。
//
// ⚠️ 立繪一律用 archer_*.webp（**沒有拿弓的版本**，作者 2026-07-31）：
//    shoot_*.webp 那批拿弓的生成品質不穩（弓身重疊、白邊殘影），
//    寧可不畫弓也不要放有 bug 的圖。箭矢本來就是另外畫的元素。
import { useEffect, useState } from "react";
import WorldBossSVG from "../../components/worldboss/WorldBossSVG";
import { archerForMember, raidArcherArt } from "../raidAssets";
import "./raidFx.css";

const LOOT = ["💰", "📦", "🃏", "💎", "🎁", "👑"];

// 每一幕的結束時間（毫秒，累進）
const CUE = { boss: 780, enter: 1280, fire: 1860, fall: 2420, loot: 3200, names: 5400 };

/**
 * @param payload  buildKillPayload 的結果——**其他玩家重播時只有這個**，
 *                 沒有戰鬥 state。自己打倒時可以改傳 members/killerId/style。
 */
export default function RaidKillCutscene({
  payload = null, members = [], killerId = null, style, bossKey = null, replay = false, onDone,
}) {
  // boss → enter → fire → fall → loot → names → done
  const [phase, setPhase] = useState("boss");
  const roster = payload ? (payload.cast || []) : members;
  const shownStyle = payload ? payload.style : style;
  const shownKiller = payload ? payload.killerId : killerId;
  const shownBossKey = payload ? payload.bossKey : bossKey;
  const teamSize = payload ? (payload.teamSize || roster.length || 1) : members.length;
  const solo = teamSize <= 1;
  // 組隊時最多排 5 位（8 個人全排會擠成一團，看不出在射箭）
  const cast = (roster.length ? roster : [{ memberId: "me", name: "射手" }]).slice(0, 5);
  // 名字要全部列出來，不受立繪上限影響
  const names = (payload?.names?.length ? payload.names : roster.map(m => m.name)).filter(Boolean);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("enter"), CUE.boss),
      setTimeout(() => setPhase("fire"), CUE.enter),
      setTimeout(() => setPhase("fall"), CUE.fire),
      setTimeout(() => setPhase("loot"), CUE.fall),
      setTimeout(() => setPhase("names"), CUE.loot),
      setTimeout(() => { setPhase("done"); onDone?.(); }, CUE.names),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  if (phase === "done") return null;

  const dead = phase === "fall" || phase === "loot" || phase === "names";
  const shot = phase !== "boss" && phase !== "enter";

  return (
    <div className="raid-cut" style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none" }}>
      <div className="raid-cut-dim" />

      {/* ① 王先出現——沒有這一步，觀眾不知道在打誰 */}
      <div className="raid-cut-bossbox">
        <div className={dead ? "raid-cut-boss raid-cut-boss-fall" : "raid-cut-boss raid-cut-boss-in"}>
          <WorldBossSVG bossKey={shownBossKey} currentHP={dead ? 0 : 1} maxHP={1} size={168} />
        </div>
        {payload?.bossName && !dead && (
          <div className="raid-cut-bossname">{payload.bossName}</div>
        )}
      </div>

      {/* ③ 王倒下的閃光 */}
      {phase === "fall" && <div className="raid-cut-flash" />}

      {/* 射手：站在王的正下方，這樣箭往上飛才說得通 */}
      {phase !== "boss" && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: "12%",
          display: "flex", justifyContent: "center", gap: solo ? 0 : 6, alignItems: "flex-end",
        }}>
          {cast.map((m, i) => (
            <img
              key={m.memberId || i}
              src={raidArcherArt(archerForMember(m.memberId, i))}
              alt=""
              onError={e => { e.currentTarget.style.visibility = "hidden"; }}
              className={`raid-cut-shooter ${phase === "enter" ? "raid-cut-in" : "raid-cut-draw"}`}
              style={{
                width: solo ? 128 : 82, height: solo ? 128 : 82, objectFit: "contain",
                animationDelay: `${i * 70}ms`,
                filter: m.memberId === shownKiller
                  ? "drop-shadow(0 0 12px #fbbf24) drop-shadow(0 6px 10px rgba(0,0,0,.7))"
                  : "drop-shadow(0 6px 10px rgba(0,0,0,.7))",
              }}
            />
          ))}
        </div>
      )}

      {/* ② 箭矢：從射手身上往上射，並且**往畫面中間收斂**——王在正中間，
             箭卻各射各的方向會很出戲。 */}
      {shot && !dead && cast.map((m, i) => (
        <span key={`ar${i}`} className="raid-cut-arrow"
          style={{
            left: `calc(50% + ${(i - (cast.length - 1) / 2) * (solo ? 0 : 7)}%)`,
            "--drift": `${-(i - (cast.length - 1) / 2) * (solo ? 0 : 26)}px`,
            animationDelay: `${i * 55}ms`,
          }}>➤</span>
      ))}

      {/* ④ 噴寶箱 */}
      {(phase === "loot" || phase === "names") && LOOT.map((icon, i) => (
        <span key={`lt${i}`} className="raid-cut-loot"
          style={{
            "--lx": `${(i - LOOT.length / 2) * 46}px`,
            "--ly": `${-90 - (i % 3) * 34}px`,
            animationDelay: `${i * 55}ms`,
          }}>{icon}</span>
      ))}

      {/* ⑤ 跳字：擊倒方式 ＋ 所有參戰人的名字 */}
      {(phase === "loot" || phase === "names") && shownStyle && (
        <div className="raid-cut-title" style={{ color: shownStyle.color }}>
          {replay && (
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#93c5fd", marginBottom: 2 }}>
              🌐 全服擊倒重播
            </div>
          )}
          <div style={{ fontSize: 13, letterSpacing: 3, opacity: .9 }}>
            {solo ? "單騎討伐" : `${teamSize} 人討伐`}
            {payload?.bossName ? ` ${payload.bossName}` : ""}
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 4 }}>
            {shownStyle.icon} {shownStyle.name}
          </div>
          {payload && (
            <div style={{ fontSize: 12, fontWeight: 900, color: "#e2e8f0", marginTop: 4 }}>
              {payload.killerName}{payload.byCat ? ` 的 ${payload.catName}` : ""} 給予最後一擊
            </div>
          )}

          {/* 參戰名單：一個一個跳出來 */}
          {phase === "names" && names.length > 0 && (
            <div style={{
              display: "flex", flexWrap: "wrap", justifyContent: "center",
              gap: 5, marginTop: 10, padding: "0 16px",
            }}>
              {names.map((n, i) => (
                <span key={`${n}-${i}`} className="raid-cut-name"
                  style={{ animationDelay: `${i * 90}ms` }}>{n}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
