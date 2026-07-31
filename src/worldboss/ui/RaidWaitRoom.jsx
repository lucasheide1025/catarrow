// src/worldboss/ui/RaidWaitRoom.jsx
// 等待室：出發前大家在這裡集合。
//
// ⚠️ 這個畫面最重要的不是好看，是**讓房主知道還缺誰**。
//    `view.depart.blockers` 每一條都對應到名單上的一個人，
//    所以名單本身就要標出「還沒準備」與「次數用完」——
//    房主不該需要一個一個問「你好了沒」。
//
// ⚠️ 次數用完的人**不能靠房主硬按出發帶走**（作者指定：出發前要確定
//    全隊都還有次數）。他只能被踢掉或自己離開，這在 UI 上要講明白，
//    不然房主會以為是 bug。
import { archerForMember, raidArcherArt } from "../raidAssets";
import { blockerSummary } from "../domain/raidLobby";
import { RAID_MAX_TEAM } from "../domain/raidTeam";
import { RAID_FACES, raidFaceLabel } from "../domain/raidFaces";
import { rangeMultiplier } from "../domain/raidRange";
import { RAID_LOBBY_BG } from "../raidAssets";
import "./raidFx.css";

const card = {
  background: "rgba(15,23,42,.9)", borderRadius: 14, padding: 13, marginBottom: 10,
  border: "1px solid rgba(148,163,184,.16)",
};
const label = { fontSize: 11, fontWeight: 900, color: "#c7d2fe", marginBottom: 7 };

export default function RaidWaitRoom({
  view, bossName = "世界王",
  onReady, onStart, onLeave, onDisband, onKick,
  onTargetFmt, onDistance,
  starting = false, error = "",
}) {
  if (!view) return null;
  const { code, roster, size, isHost, meReady, depart, bonus, gaugeMax } = view;
  const missing = blockerSummary(depart.blockers);
  const myFmt = view.me?.targetFmt;
  const myDist = view.me?.distanceM ?? 0;

  return (
    <div style={{
      minHeight: "100%", padding: "14px 12px 28px",
      backgroundImage: `linear-gradient(rgba(2,6,23,.88), rgba(2,6,23,.96)), url(${RAID_LOBBY_BG})`,
      backgroundSize: "cover", backgroundPosition: "center",
    }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>

        {/* 代碼：等待室唯一要「唸給隊友聽」的東西，所以放最大 */}
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800 }}>隊伍代碼</div>
          <div style={{
            fontSize: 32, fontWeight: 900, letterSpacing: 9, color: "#fde68a",
            textShadow: "0 0 22px rgba(253,230,138,.5)", lineHeight: 1.3,
          }}>{code}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            討伐目標 <b style={{ color: "#fecaca" }}>{bossName}</b>
            　{size} / {RAID_MAX_TEAM} 人
          </div>
        </div>

        {/* 組隊加成：玩家願意等人的理由 */}
        <div style={{ ...card, border: "1px solid rgba(74,222,128,.3)" }}>
          {/* ⚠️ teamStatBonus 回的是**倍率**（1.10）不是加成（0.10），
              所以直接用它自己算好的 label，不要在這裡再乘一次 100。 */}
          <div style={{ fontSize: 11.5, color: "#bbf7d0", fontWeight: 900 }}>
            👥 {size} 人　{bonus.label || "沒有隊伍加成"}
          </div>
          <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>
            破防槽 {gaugeMax} 點（人越多破防越快）
          </div>
        </div>

        {/* 名單。⚠️ 每一列都要能自己解釋為什麼卡住 */}
        <div style={card}>
          <div style={label}>隊員</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {roster.map(m => {
              const blocked = !m.canGo;
              return (
                <div key={m.memberId} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 9px", borderRadius: 10,
                  background: m.isMe ? "rgba(96,165,250,.12)" : "#1e293b",
                  border: `1px solid ${blocked ? "rgba(248,113,113,.5)"
                    : m.ready ? "rgba(74,222,128,.4)" : "rgba(148,163,184,.18)"}`,
                }}>
                  <img src={raidArcherArt(archerForMember(m.memberId))} alt=""
                    onError={e => { e.currentTarget.style.visibility = "hidden"; }}
                    style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 900, color: "#e2e8f0" }}>
                      {m.isHost && "👑 "}{m.name}{m.isMe && "（我）"}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                      Lv{m.archerLevel}　ATK {m.stats.atk}　HP {m.stats.hp}
                    </div>
                    {/* ⚠️ 靶紙與射程是各自的——名單上就要看得到，
                        不然隊友之間根本不知道彼此在打什麼條件。 */}
                    <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 1 }}>
                      🎯 {raidFaceLabel(m.targetFmt)}　📏 {m.distanceM} 米　
                      <span style={{ color: "#94a3b8", fontWeight: 800 }}>
                        ×{rangeMultiplier({ distanceM: m.distanceM, targetFmt: m.targetFmt }).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 900,
                      color: blocked ? "#f87171" : m.ready ? "#4ade80" : "#94a3b8",
                    }}>
                      {blocked ? "次數用完" : m.ready ? "✓ 準備好" : "等待中"}
                    </div>
                    {isHost && !m.isHost && (
                      <button type="button" onClick={() => onKick?.(m.memberId)} style={{
                        marginTop: 3, padding: "2px 7px", borderRadius: 6,
                        border: "1px solid #475569", background: "transparent",
                        color: "#94a3b8", fontSize: 9.5, fontWeight: 800, cursor: "pointer",
                      }}>移出</button>
                    )}
                  </div>
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, Math.min(2, RAID_MAX_TEAM - size)) }, (_, i) => (
              <div key={`slot${i}`} style={{
                padding: "11px 9px", borderRadius: 10, textAlign: "center",
                border: "1px dashed rgba(148,163,184,.28)",
                color: "#475569", fontSize: 11, fontWeight: 800,
              }}>等待隊友加入…</div>
            ))}
          </div>
        </div>

        {/* ⚠️ 靶紙與射程**每個人自己決定**（作者 2026-07-31）：
            現場有人射 5 米有人射 18 米，靶紙也不相同。
            房主統一設定等於逼所有人配合最短的那個人。 */}
        {view.me && (
          <div style={card}>
            <div style={label}>我的靶紙與射程（每個人各自決定）</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
              {RAID_FACES.map(f => (
                <button key={f.id} type="button" onClick={() => onTargetFmt?.(f.id)} style={{
                  padding: "8px 2px", borderRadius: 9, cursor: "pointer",
                  border: `2px solid ${myFmt === f.id ? "#60a5fa" : "rgba(255,255,255,.1)"}`,
                  background: myFmt === f.id ? "rgba(96,165,250,.16)" : "#1e293b",
                  color: "#e2e8f0", fontSize: 11.5, fontWeight: 900,
                }}>{f.label}</button>
              ))}
            </div>
            <input type="range" min={5} max={18} value={myDist}
              onChange={e => onDistance?.(Number(e.target.value))}
              style={{ width: "100%", marginTop: 9 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2 }}>
              <span style={{ color: "#94a3b8" }}>{myDist} 米</span>
              <span style={{ color: "#fbbf24", fontWeight: 900 }}>
                我的環境倍率 ×{rangeMultiplier({ distanceM: myDist, targetFmt: myFmt }).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ ...card, border: "1px solid rgba(248,113,113,.45)", background: "rgba(69,10,10,.5)" }}>
            <div style={{ fontSize: 11.5, color: "#fecaca", fontWeight: 800 }}>⚠️ {error}</div>
          </div>
        )}

        {/* 準備／出發 */}
        <button type="button" onClick={() => onReady?.(!meReady)} style={{
          width: "100%", padding: "13px 0", borderRadius: 11, border: "none", marginBottom: 8,
          background: meReady ? "#1e293b" : "linear-gradient(135deg,#16a34a,#15803d)",
          color: meReady ? "#94a3b8" : "#fff",
          fontWeight: 900, fontSize: 14, letterSpacing: 2, cursor: "pointer",
        }}>{meReady ? "取消準備" : "✓ 我準備好了"}</button>

        {isHost && (
          <>
            <button type="button" disabled={!depart.ok || starting} onClick={onStart} style={{
              width: "100%", padding: "15px 0", borderRadius: 12, border: "none",
              background: depart.ok ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#1e293b",
              color: depart.ok ? "#fff" : "#64748b",
              fontWeight: 900, fontSize: 16, letterSpacing: 3,
              cursor: depart.ok && !starting ? "pointer" : "not-allowed",
              boxShadow: depart.ok ? "0 6px 20px rgba(245,158,11,.35)" : "none",
            }}>{starting ? "出發中…" : "🏹 全隊出發"}</button>
            {!depart.ok && missing && (
              <div style={{ fontSize: 11, color: "#fca5a5", textAlign: "center", marginTop: 6, fontWeight: 800 }}>
                還不能出發：{missing}
              </div>
            )}
            {depart.blockers.some(b => b.code === "no_attempts") && (
              <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "center", marginTop: 4, lineHeight: 1.6 }}>
                次數用完的隊員沒辦法一起出發——請他自己離開，或由房主移出。
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
          <button type="button" onClick={onLeave} style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            border: "1px solid #334155", background: "transparent",
            color: "#94a3b8", fontWeight: 900, fontSize: 12, cursor: "pointer",
          }}>離開隊伍</button>
          {isHost && (
            <button type="button" onClick={onDisband} style={{
              flex: 1, padding: "10px 0", borderRadius: 10,
              border: "1px solid rgba(248,113,113,.4)", background: "transparent",
              color: "#f87171", fontWeight: 900, fontSize: 12, cursor: "pointer",
            }}>解散隊伍</button>
          )}
        </div>
      </div>
    </div>
  );
}
