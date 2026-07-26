// src/guild/ui/GuildTeamBattle.jsx
// 組隊遠征的共享戰場。回合順序（作者拍板）：
//   隊友A 射完 → 隊友B 射完 → 貓貓支援 → 怪物移動或攻擊 → 下一回合
// 這個順序由 domain/teamExpeditionFlow.processTeamRound 保證（有測試鎖住），本檔只負責
// 「收自己的箭 → 交出去 → 等房主推進 → 顯示結果」。
//
// 為什麼不做單人版那種逐箭動畫時間軸：多人是**同時**射的，硬要照 log 逐格播會讓所有人
// 卡在動畫上等彼此（貓貓村就是這樣卡死的）。這裡改成「回合摘要」——結果一到就顯示，
// 誰打了多少、誰被打，一眼看完，不阻塞任何人。
//
// ⚠️ 防卡死（前面踩過的坑全部套用）：
//   ① 交箭寫入失敗會自動重試（在 guildTeamDb）
//   ② 切回前景自動重新對齊（手機鎖屏最常見）
//   ③ 房主看得到「還在等誰」＋卡超過 20 秒可強制推進（不等斷線的人）
import { useEffect, useMemo, useRef, useState } from "react";
import { aliveTeamTargets, aliveMemberIds } from "../domain/teamExpeditionFlow";
import { sfxTap, sfxArrowShoot, sfxRoundEnd, sfxError, sfxVictoryFanfare, sfxDefeat } from "../../lib/sound";
import { MonsterArt, CatArt, HeroArt, fieldBg, bgLayer } from "./GuildArt";

const SCORE_BUTTONS = [
  { label: "X", score: 11, color: "#fbbf24" },
  { label: "10", score: 10, color: "#ef4444" },
  { label: "9", score: 9, color: "#ef4444" },
  { label: "8", score: 8, color: "#3b82f6" },
  { label: "7", score: 7, color: "#3b82f6" },
  { label: "6", score: 6, color: "#64748b" },
  { label: "M", score: 0, color: "#334155" },
];
const MAX_DIST = 6;
const MOB_SIZE = 84;

// 與單人版同一套 2.5D 站位規則（上遠下近、往中央收）
function posOf(index, len, distance) {
  const depth = Math.max(0, Math.min(MAX_DIST, distance)) / MAX_DIST;
  const near = 1 - depth;
  const halfSpan = Math.min(30, 11 * Math.max(1, len - 1)) * (0.62 + 0.38 * near);
  return {
    topPct: 12 + near * 44,
    leftPct: len <= 1 ? 50 : 50 - halfSpan + (index / (len - 1)) * halfSpan * 2,
    scale: 0.8 + near * 0.55,
  };
}

function Bar({ cur, max, color = "#ef4444", h = 5 }) {
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
  return (
    <div style={{ width: "100%", height: h, background: "rgba(0,0,0,.55)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .3s" }} />
    </div>
  );
}

export default function GuildTeamBattle({
  room, battle, myId, isHost, arrowsPerRound,
  onSubmitShots, onCommitRound, onForceAdvance, onLeave,
}) {
  const [target, setTarget] = useState(null);
  const [shots, setShots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [stuck, setStuck] = useState(false);
  const lastSeqRef = useRef(0);

  const seq = room?.seq || 0;
  const me = battle?.members?.[myId];
  const iAmDown = me?.status === "down";
  const targets = useMemo(() => aliveTeamTargets(battle), [battle]);
  const submits = room?.submits || {};
  const mySubmit = submits[myId]?.seq === seq;
  const aliveIds = useMemo(() => aliveMemberIds(battle), [battle]);
  const waitingFor = aliveIds.filter(id => submits[id]?.seq !== seq);
  const allSubmitted = waitingFor.length === 0;

  // 換回合 → 清空本地暫存（新的一回合要重新選目標與射箭）
  useEffect(() => {
    if (lastSeqRef.current === seq) return;
    lastSeqRef.current = seq;
    setShots([]); setTarget(null); setMsg(""); setStuck(false);
    if (seq > 1) sfxRoundEnd();
  }, [seq]);

  // 目標死掉/換波 → 自動改鎖第一隻，玩家不必再點一次
  useEffect(() => {
    if (!targets.length) { setTarget(null); return; }
    if (!targets.some(m => m.instanceId === target)) setTarget(targets[0].instanceId);
  }, [targets, target]);

  // 卡住偵測：全員都交了卻沒推進（或有人遲交）超過 20 秒 → 房主看得到強制推進
  useEffect(() => {
    setStuck(false);
    if (battle?.status !== "fighting") return;
    const t = setTimeout(() => setStuck(true), 20000);
    return () => clearTimeout(t);
  }, [seq, battle?.status]);

  // 房主：全員交齊就自動推進（不用手動按，這是「不要再叫玩家按更新」的同一個原則）
  useEffect(() => {
    if (!isHost || battle?.status !== "fighting" || !allSubmitted || busy) return;
    const t = setTimeout(() => { commit(); }, 400);   // 給最後一個人的畫面一點喘息
    return () => clearTimeout(t);
  }, [isHost, allSubmitted, seq, battle?.status]); // eslint-disable-line

  // 切回前景 → 重新讀一次自己的暫存狀態（手機鎖屏後最常見的「看起來卡住」）
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) setStuck(false); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  async function commit(force = false) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await onCommitRound({ force });
      if (res?.ok === false) { sfxError(); setMsg(`⚠️ ${res.reason || "推進失敗"}`); }
    } finally { setBusy(false); }
  }

  const addShot = score => {
    if (!target || shots.length >= arrowsPerRound || mySubmit || iAmDown) return;
    sfxArrowShoot();
    setShots(s => [...s, { targetInstanceId: target, score }]);
  };

  async function submit() {
    if (busy || mySubmit) return;
    setBusy(true);
    try {
      const res = await onSubmitShots(shots);
      if (res?.ok === false) { sfxError(); setMsg(`⚠️ ${res.reason || "送出失敗，請再按一次"}`); }
      else sfxTap();
    } finally { setBusy(false); }
  }

  // 結束畫面交給上層（GuildTestApp 的結算頁），這裡只播音效提示
  useEffect(() => {
    if (battle?.status === "won") sfxVictoryFanfare();
    if (battle?.status === "lost") sfxDefeat();
  }, [battle?.status]);

  if (!battle) return null;
  const memberIds = battle.order || [];

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#0b1220", color: "#e2e8f0" }}>
      {/* 抬頭 */}
      <div style={{ padding: "6px 12px", background: "#1a1207", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#fcd34d" }}>
          📜 {room?.contract?.title}　第 {battle.round} 回合　波 {battle.waveIndex + 1}/{battle.expedition?.totalWaves}
        </span>
        <button type="button" onClick={onLeave} style={{ padding: "3px 9px", borderRadius: 7, border: "none", background: "#334155", color: "#cbd5e1", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>離開</button>
      </div>

      {/* 我的狀態 */}
      <div style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: 8, background: "#0f172a" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5", minWidth: 62 }}>❤️ {me?.hp ?? 0}/{me?.maxHp ?? 0}</span>
        <div style={{ flex: 1 }}><Bar cur={me?.hp ?? 0} max={me?.maxHp ?? 1} color="#22c55e" h={6} /></div>
        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>🍖{me?.supplies?.food ?? 0} 💧{me?.supplies?.water ?? 0}</span>
      </div>

      {/* 共享戰場 */}
      <div style={{ position: "relative", flex: 1, minHeight: 300, overflow: "hidden",
        ...bgLayer(fieldBg(battle.expedition?.family), { overlay: "rgba(6,10,6,.42)" }) }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.15) 0%,transparent 35%,rgba(0,0,0,.68) 100%)", pointerEvents: "none" }} />

        {targets.map((m, i) => {
          const p = posOf(i, targets.length, m.distance);
          const isSel = target === m.instanceId;
          return (
            <button key={m.instanceId} type="button" onClick={() => { sfxTap(); setTarget(m.instanceId); }}
              style={{ position: "absolute", top: `${p.topPct}%`, left: `${p.leftPct}%`,
                transform: `translate(-50%,-50%) scale(${p.scale})`, transition: "top .45s ease-out, left .45s ease-out",
                background: "none", border: "none", cursor: "pointer", textAlign: "center", zIndex: Math.round(p.topPct) }}>
              <MonsterArt monsterId={m.monsterId} icon={m.icon} size={MOB_SIZE}
                style={{ filter: isSel ? "drop-shadow(0 0 9px #f59e0b)" : "drop-shadow(0 3px 6px rgba(0,0,0,.6))" }} />
              <div style={{ fontSize: 9, fontWeight: 800, color: "#fecaca", whiteSpace: "nowrap", textShadow: "0 1px 3px #000" }}>{m.name}</div>
              <div style={{ width: 56, margin: "1px auto" }}><Bar cur={m.hp} max={m.maxHp} /></div>
              <div style={{ fontSize: 9, fontWeight: 900, color: m.distance <= 1 ? "#ef4444" : "#fcd34d" }}>
                {m.distance <= 0 ? "⚔️攻擊!" : `距離 ${m.distance}`}
              </div>
              {isSel && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 900 }}>▲鎖定</div>}
            </button>
          );
        })}

        {/* 小隊站位（自己在中間，隊友左右排開）*/}
        <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10, alignItems: "flex-end", zIndex: 70 }}>
          {memberIds.map(id => {
            const m = battle.members[id];
            const isMe = id === myId;
            const done = submits[id]?.seq === seq;
            return (
              <div key={id} style={{ textAlign: "center", opacity: m.status === "down" ? 0.42 : 1 }}>
                {isMe
                  ? <HeroArt size={62} style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,.65))" }} />
                  : <div style={{ fontSize: 34, filter: "drop-shadow(0 3px 6px rgba(0,0,0,.6))" }}>🏹</div>}
                <div style={{ fontSize: 9, fontWeight: 900, color: isMe ? "#93c5fd" : "#e2e8f0", whiteSpace: "nowrap" }}>
                  {m.status === "down" ? "💀 " : done ? "✅ " : ""}{m.name}
                </div>
                <div style={{ width: 46, margin: "1px auto" }}><Bar cur={m.hp} max={m.maxHp} color="#22c55e" h={4} /></div>
                {(m.cats || []).length > 0 && (
                  <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 2 }}>
                    {m.cats.map(c => <CatArt key={c.id} catId={c.id} icon={c.icon} size={18} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 上一回合摘要 */}
      {(battle.log || []).length > 0 && (
        <div style={{ padding: "6px 12px", background: "rgba(0,0,0,.55)", fontSize: 10.5, color: "#cbd5e1", maxHeight: 74, overflowY: "auto" }}>
          {battle.log.slice(-6).map((l, i) => (
            <div key={i}>
              {l.type === "arrow" && `🏹 ${l.byName} 命中 ${l.crit ? "暴擊 " : ""}${l.dmg}${l.killed ? "（擊倒！）" : ""}`}
              {l.type === "catAttack" && `🐱 ${l.name} 支援 ${l.dmg}${l.killed ? "（擊倒！）" : ""}`}
              {l.type === "monsterAttack" && `💥 ${l.byName} 受擊 ${l.dmg}`}
              {l.type === "dodge" && `💨 ${l.byName} 閃過了攻擊`}
              {l.type === "starve" && `🥵 ${l.byName} 補給不足 −${l.dmg}`}
              {l.type === "memberDown" && `💀 ${l.byName} 倒地了！`}
              {l.type === "waveClear" && `🌊 清空一波！第 ${l.nextWave + 1} 波來了`}
            </div>
          ))}
        </div>
      )}

      {/* 操作區 */}
      <div style={{ padding: 10, background: "#0f172a", display: "flex", flexDirection: "column", gap: 8 }}>
        {iAmDown ? (
          <div style={{ fontSize: 12, color: "#f87171", textAlign: "center", fontWeight: 800 }}>
            💀 你已倒地——隊友還在戰鬥，撐到勝利你一樣有獎勵
          </div>
        ) : mySubmit ? (
          <div style={{ fontSize: 12, color: "#6ee7b7", textAlign: "center", fontWeight: 800 }}>
            ✅ 已送出（{shots.length} 箭）　{waitingFor.length > 0 ? `還在等 ${waitingFor.map(id => battle.members[id]?.name).join("、")}` : "結算中…"}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                {target ? `鎖定：${targets.find(m => m.instanceId === target)?.name || "—"}` : "先點一隻怪"}
              </span>
              <span style={{ fontSize: 11, fontWeight: 900, color: "#fcd34d" }}>🏹 {shots.length}/{arrowsPerRound}</span>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {SCORE_BUTTONS.map(b => (
                <button key={b.label} type="button" disabled={!target || shots.length >= arrowsPerRound}
                  onClick={() => addShot(b.score)}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none", background: b.color,
                    color: "#fff", fontSize: 13, fontWeight: 900, opacity: !target || shots.length >= arrowsPerRound ? 0.4 : 1,
                    cursor: !target || shots.length >= arrowsPerRound ? "not-allowed" : "pointer" }}>
                  {b.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" disabled={!shots.length} onClick={() => { sfxTap(); setShots(s => s.slice(0, -1)); }}
                style={{ padding: "9px 12px", borderRadius: 9, border: "none", background: "#334155", color: "#cbd5e1", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                ↩ 退一箭
              </button>
              <button type="button" disabled={busy || shots.length < arrowsPerRound} onClick={submit}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 900, color: "#fff",
                  background: shots.length < arrowsPerRound ? "#475569" : "linear-gradient(135deg,#f59e0b,#b45309)",
                  cursor: shots.length < arrowsPerRound ? "not-allowed" : "pointer" }}>
                {busy ? "送出中…" : shots.length < arrowsPerRound ? `還要 ${arrowsPerRound - shots.length} 箭` : "⚔️ 送出這回合"}
              </button>
            </div>
          </>
        )}

        {/* 房主的卡死救援：等太久就不等了（斷線的人這回合視為沒射） */}
        {isHost && stuck && battle.status === "fighting" && !allSubmitted && (
          <button type="button" disabled={busy} onClick={() => commit(true)}
            style={{ padding: "9px 0", borderRadius: 9, border: "1px solid rgba(251,191,36,.4)", background: "rgba(120,53,15,.7)", color: "#fde68a", fontSize: 11.5, fontWeight: 900, cursor: "pointer" }}>
            ⏭ 不等了，強制推進（{waitingFor.map(id => battle.members[id]?.name).join("、")} 這回合視為沒射）
          </button>
        )}

        {msg && <div style={{ fontSize: 11.5, color: "#f87171" }}>{msg}</div>}
      </div>
    </div>
  );
}
