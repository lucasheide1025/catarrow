// src/worldboss/ui/RaidSoloRoom.jsx
// 單人房＝出擊前的準備室，也是整個世界王的**入口**。
//
// 這個畫面要一眼回答四件事：
//   ① 這隻王是誰、還剩多少血（血是全服共享的，別人打過的都算）
//   ② 我今天還能不能打（次數）
//   ③ 我要用什麼靶、退多遠（環境倍率＝距離 × 靶紙，直接算給他看）
//   ④ 一個人打，還是揪團
//
// ⚠️ 出發鈕被擋住時**一定要寫出原因**。玩家看到灰掉的按鈕卻不知道為什麼，
//    只會以為是壞掉了——`soloDepart().blockers` 就是為了這個而存在。
import { RAID_FACES, faceMultiplier } from "../domain/raidFaces";
import { RAID_MAX_TEAM } from "../domain/raidTeam";
import {
  RAID_DISTANCES, distanceMultiplier, rangeLabel, rangeMultiplier,
} from "../domain/raidRange";
import { rookieMultiplier } from "../domain/raidRookie";
import { RAID_LOBBY_BG } from "../raidAssets";
import WorldBossSVG from "../../components/worldboss/WorldBossSVG";
import "./raidFx.css";

const card = {
  background: "rgba(15,23,42,.88)", borderRadius: 14, padding: 13, marginBottom: 10,
  border: "1px solid rgba(148,163,184,.16)",
};
const label = { fontSize: 11, fontWeight: 900, color: "#c7d2fe", marginBottom: 7 };

function pill(active, color) {
  return {
    padding: "9px 2px", borderRadius: 9, cursor: "pointer",
    border: `2px solid ${active ? color : "rgba(255,255,255,.1)"}`,
    background: active ? `${color}28` : "#1e293b",
    color: "#e2e8f0", fontSize: 12, fontWeight: 900,
  };
}

export default function RaidSoloRoom({
  bossKey, bossName, bossHp = 1, bossMaxHp = 1, bossDesc = "",
  stats = { atk: 0, def: 0, hp: 0 }, archerLevel = 1, catName = null,
  targetFmt, distanceM, onTargetFmt, onDistance,
  depart = { ok: true, blockers: [], left: 1 },
  resume = null, onResume, onDiscardResume,
  onDepart, onCreateRoom, onJoinRoom, onExit,
  // ⚠️ 作者 2026-07-31：**房間直接顯示，不要用組隊碼進入**。
  //    要人先開房、把六碼唸給對方、對方再打字——射箭場現場沒人想這樣做。
  openRooms = [], myRoom = null, onReturnRoom = null,
  joining = false, roomError = "",
}) {
  const ratio = Math.max(0, Math.min(1, bossMaxHp ? bossHp / bossMaxHp : 0));
  const mult = rangeMultiplier({ distanceM, targetFmt });
  const lab = rangeLabel(mult);
  const rookie = rookieMultiplier(archerLevel);

  return (
    <div style={{
      minHeight: "100%", padding: "14px 12px 28px",
      backgroundImage: `linear-gradient(rgba(2,6,23,.86), rgba(2,6,23,.96)), url(${RAID_LOBBY_BG})`,
      backgroundSize: "cover", backgroundPosition: "center",
    }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>

        {/* ① 王 */}
        <div style={{ ...card, textAlign: "center", paddingTop: 8 }}>
          <div className="raid-boss-idle" style={{ display: "inline-block" }}>
            <WorldBossSVG bossKey={bossKey} currentHP={bossHp} maxHP={bossMaxHp} size={132} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#fecaca", letterSpacing: 2, marginTop: 2 }}>
            {bossName}
          </div>
          {bossDesc && (
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3, lineHeight: 1.6 }}>{bossDesc}</div>
          )}
          <div style={{
            height: 11, borderRadius: 6, background: "#1e293b", overflow: "hidden",
            marginTop: 9, border: "1px solid rgba(148,163,184,.25)",
          }}>
            <div style={{
              width: `${ratio * 100}%`, height: "100%",
              background: ratio > .5 ? "linear-gradient(90deg,#22c55e,#16a34a)"
                : ratio > .2 ? "linear-gradient(90deg,#f59e0b,#d97706)"
                : "linear-gradient(90deg,#ef4444,#b91c1c)",
              transition: "width .4s",
            }} />
          </div>
          <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>
            {Math.round(bossHp).toLocaleString()} / {Math.round(bossMaxHp).toLocaleString()}
            　<span style={{ color: "#64748b" }}>血量全服共享</span>
          </div>
        </div>

        {/* 續戰：斷線或重整都接得回來 */}
        {resume && (
          <div style={{ ...card, border: "1px solid #60a5fa" }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: "#93c5fd", marginBottom: 4 }}>
              🔌 有一場沒打完的討伐
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>{resume.label}</div>
            <div style={{ display: "flex", gap: 7 }}>
              <button type="button" onClick={onResume} style={{
                flex: 1, padding: "10px 0", borderRadius: 9, border: "none",
                background: "linear-gradient(135deg,#2563eb,#1e40af)", color: "#fff",
                fontWeight: 900, fontSize: 13, cursor: "pointer",
              }}>接續戰鬥</button>
              <button type="button" onClick={onDiscardResume} style={{
                padding: "10px 14px", borderRadius: 9, border: "1px solid #475569",
                background: "transparent", color: "#94a3b8", fontWeight: 900, fontSize: 12, cursor: "pointer",
              }}>放棄</button>
            </div>
          </div>
        )}

        {/* ② 我 */}
        <div style={card}>
          <div style={label}>我的狀態</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, textAlign: "center" }}>
            {[["Lv", archerLevel, "#e2e8f0"], ["ATK", stats.atk, "#fbbf24"],
              ["DEF", stats.def, "#60a5fa"], ["HP", stats.hp, "#4ade80"]].map(([k, v, c]) => (
              <div key={k} style={{ background: "#1e293b", borderRadius: 9, padding: "7px 0" }}>
                <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 800 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 8 }}>
            <span style={{ color: "#94a3b8" }}>{catName ? `🐾 陪練 ${catName}` : "🐾 沒有帶貓"}</span>
            <span style={{ color: depart.left > 0 ? "#4ade80" : "#f87171", fontWeight: 900 }}>
              今日剩餘 {depart.left} 次
            </span>
          </div>
          {rookie > 1 && (
            <div style={{
              marginTop: 8, padding: "7px 9px", borderRadius: 9,
              background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.35)",
              fontSize: 10.5, color: "#bbf7d0", lineHeight: 1.6,
            }}>
              🌱 新手扶助 ×{rookie.toFixed(2)}——50 級以下傷害額外加成，等級越低越多。
            </div>
          )}
        </div>

        {/* ③ 靶紙與射程 */}
        <div style={card}>
          <div style={label}>靶紙</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {RAID_FACES.map(f => (
              <button key={f.id} type="button" onClick={() => onTargetFmt?.(f.id)}
                style={pill(targetFmt === f.id, "#60a5fa")}>
                {f.label}
                <div style={{ fontSize: 8.5, color: "#94a3b8", fontWeight: 700 }}>×{f.mult.toFixed(1)}</div>
              </button>
            ))}
          </div>

          <div style={{ ...label, marginTop: 12 }}>射程</div>
          <input type="range" min={RAID_DISTANCES[0]} max={RAID_DISTANCES[RAID_DISTANCES.length - 1]}
            value={distanceM} onChange={e => onDistance?.(Number(e.target.value))}
            style={{ width: "100%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 2 }}>
            <span style={{ color: "#94a3b8" }}>{distanceM} 米</span>
            <span style={{ color: lab.color, fontWeight: 900 }}>環境倍率 ×{mult.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
            距離 ×{distanceMultiplier(distanceM).toFixed(2)} × 靶紙 ×{faceMultiplier(targetFmt).toFixed(1)}
            　　5 米半靶＝基準 ×1.00
          </div>
        </div>

        {/* ④ 出擊 */}
        {!depart.ok && depart.blockers.length > 0 && (
          <div style={{
            ...card, border: "1px solid rgba(248,113,113,.45)", background: "rgba(69,10,10,.5)",
          }}>
            {depart.blockers.map((b, i) => (
              <div key={b.code || i} style={{ fontSize: 11.5, color: "#fecaca", fontWeight: 800 }}>
                ⛔ {b.text}
              </div>
            ))}
          </div>
        )}

        <button type="button" disabled={!depart.ok} onClick={onDepart} style={{
          width: "100%", padding: "15px 0", borderRadius: 12, border: "none",
          background: depart.ok ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#1e293b",
          color: depart.ok ? "#fff" : "#64748b",
          fontWeight: 900, fontSize: 16, letterSpacing: 3,
          cursor: depart.ok ? "pointer" : "not-allowed", marginBottom: 10,
          boxShadow: depart.ok ? "0 6px 20px rgba(245,158,11,.35)" : "none",
        }}>🏹 單人出擊</button>

        {/* 揪團：單人房與等待室是同一條動線的兩端。
            ⚠️ 沒有給 onCreateRoom 就整塊不畫——組隊還沒接線時不要放一顆按了沒反應的鈕。 */}
        {onCreateRoom && (
        <div style={card}>
          <div style={label}>或者揪團（最多 {RAID_MAX_TEAM} 人＝射箭場容量．各扣各的次數）</div>
          <button type="button" onClick={onCreateRoom} disabled={joining} style={{
            width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff",
            fontWeight: 900, fontSize: 13, cursor: joining ? "wait" : "pointer", marginBottom: 8,
          }}>👥 建立討伐隊</button>
          {/* 我已經在某個房裡：回去，而不是再開一個 */}
          {myRoom && (
            <button type="button" onClick={onReturnRoom} style={{
              width: "100%", padding: "11px 0", borderRadius: 10, marginBottom: 8,
              border: "1px solid #fbbf24", background: "rgba(251,191,36,.15)",
              color: "#fde68a", fontWeight: 900, fontSize: 12.5, cursor: "pointer",
            }}>↩️ 回到我的隊伍（{myRoom.size} 人）</button>
          )}

          {/* 開著的房直接列出來，點一下就進去 */}
          {openRooms.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {openRooms.map(r => (
                <button key={r.roomId} type="button" disabled={joining}
                  onClick={() => onJoinRoom?.(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "9px 11px", borderRadius: 10, textAlign: "left",
                    border: "1px solid rgba(96,165,250,.4)", background: "#1e293b",
                    color: "#e2e8f0", cursor: joining ? "wait" : "pointer",
                  }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 900 }}>
                      👑 {r.hostName} 的隊伍
                      <span style={{ color: "#94a3b8", fontWeight: 800, marginLeft: 6 }}>
                        {r.size}/{RAID_MAX_TEAM} 人
                      </span>
                    </div>
                    <div style={{
                      fontSize: 10, color: "#64748b", marginTop: 2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{r.memberNames.join("、")}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 900, color: "#60a5fa", flexShrink: 0 }}>加入 →</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{
              padding: "12px 10px", borderRadius: 10, textAlign: "center",
              border: "1px dashed rgba(148,163,184,.28)",
              color: "#64748b", fontSize: 11, fontWeight: 800,
            }}>目前沒有人開隊——按上面「建立討伐隊」，隊友就看得到你了</div>
          )}
          {roomError && (
            <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 7, fontWeight: 800 }}>⚠️ {roomError}</div>
          )}
        </div>
        )}

        {onExit && (
          <button type="button" onClick={onExit} style={{
            width: "100%", padding: "10px 0", borderRadius: 10,
            border: "1px solid #334155", background: "transparent",
            color: "#94a3b8", fontWeight: 900, fontSize: 12, cursor: "pointer",
          }}>離開討伐</button>
        )}
      </div>
    </div>
  );
}
