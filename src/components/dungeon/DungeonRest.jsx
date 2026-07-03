// src/components/dungeon/DungeonRest.jsx — 地下城休息區（動畫強化版）
import { useState, useEffect, useMemo, useRef } from "react";
import { confirmNonCombatRoom, resolveNonCombatRoom } from "../../lib/dungeonDb";
import { sfxPotionDrink, sfxBuff } from "../../lib/sound";

const REST_OPTIONS = [
  { id: "heal",   icon: "💤", title: "恢復全體血量", desc: "全體隊員恢復 50~100% 隨機最大血量",   color: "#4ade80" },
  { id: "cure",   icon: "✨", title: "治療異常狀態", desc: "清除全體隊員的 ATK/DEF 弱化效果",     color: "#a78bfa" },
  { id: "revive", icon: "💊", title: "復活前衛",     desc: "復活一名陣亡轉後衛的隊員（50% HP 轉回前衛）", color: "#fbbf24" },
];

// 粒子
function Particles({ count = 18, color = "rgba(167,139,250" }) {
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: 2 + Math.random() * 5, delay: Math.random() * 6,
    duration: 5 + Math.random() * 7, opacity: 0.1 + Math.random() * 0.3,
  })), [count]);
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:"absolute", left:`${p.x}%`, top:`${p.y}%`,
          width:p.size, height:p.size, borderRadius:"50%",
          background:`${color},0.5)`,
          boxShadow:`0 0 8px ${color},0.3)`,
          animation:`r-particle ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
          opacity: p.opacity,
        }}/>
      ))}
      <style>{`@keyframes r-particle{0%{transform:translateY(0) scale(1) rotate(0deg)}100%{transform:translateY(-50px) scale(1.3) rotate(180deg)}}`}</style>
    </div>
  );
}

// 治療噴泉特效
function HealEffect({ optionId, memberPositions = {} }) {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:50 }}>
      <style>{`
@keyframes r-heal-bubble{0%{opacity:0;transform:translateY(0) scale(0.3)}30%{opacity:1;transform:translateY(-20px) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(0.5)}}
@keyframes r-cure-sparkle{0%{opacity:0;transform:scale(0) rotate(0deg)}50%{opacity:1;transform:scale(1.2) rotate(180deg)}100%{opacity:0;transform:scale(0.5) rotate(360deg)}}
@keyframes r-shine-wave{0%{left:-100%}100%{left:200%}}
      `}</style>
      {optionId === "heal" && Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{
          position:"absolute", left:`${10 + Math.random()*80}%`, top:`${30 + Math.random()*50}%`,
          width:8 + Math.random()*12, height:8 + Math.random()*12, borderRadius:"50%",
          background:"rgba(74,222,128,0.5)", boxShadow:"0 0 10px rgba(74,222,128,0.4)",
          animation:`r-heal-bubble ${1.5 + Math.random()*1.5}s ease-out ${Math.random()*0.5}s forwards`,
        }}/>
      ))}
      {optionId === "cure" && Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          position:"absolute", left:`${15 + Math.random()*70}%`, top:`${25 + Math.random()*50}%`,
          fontSize:16+Math.random()*12,
          animation:`r-cure-sparkle ${1+Math.random()}s ease-out ${Math.random()*0.3}s forwards`,
        }}>✨</div>
      ))}
    </div>
  );
}

// localMode（遠征單人）：投票即定案，效果透過 onLocalEffect 回傳父層、
// 結束呼叫 onLocalDone，不寫 Firestore
export default function DungeonRest({
  roomId, room, memberId, isHost,
  localMode = false, onLocalEffect, onLocalDone,
}) {
  const [animPhase, setAnimPhase] = useState("entering"); // entering | open | voting | effect | done
  const [showHealEffect, setShowHealEffect] = useState(false);
  const [healOptionId, setHealOptionId] = useState(null);
  const [resultText, setResultText] = useState("");
  const [floatingMemberHps, setFloatingMemberHps] = useState([]);
  const [localConfirms, setLocalConfirms] = useState({});
  const [localChoices, setLocalChoices] = useState({});
  const effectTimeoutRef = useRef(null);

  const members = room?.members || {};
  const aliveIds = Object.keys(members).filter(id => members[id].alive);
  const roomConfirms = localMode ? localConfirms : (room?.roomConfirms || {});
  const roomChoices = localMode ? localChoices : (room?.roomChoices || {});
  const hasFrontFallen = useMemo(() => aliveIds.some(id => members[id]?.role === "rear"), [aliveIds, members]);
  const myChoice = roomChoices[memberId] || null;
  const allConfirmed = aliveIds.every(id => roomConfirms[id]);

  // 進場動畫
  useEffect(() => {
    const t1 = setTimeout(() => setAnimPhase("open"), 400);
    const t2 = setTimeout(() => setAnimPhase("voting"), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // 偵測全員投票完成 → 播放特效
  useEffect(() => {
    if (!allConfirmed || animPhase === "effect" || animPhase === "done") return;
    const votes = Object.values(roomChoices);
    if (votes.length === 0) return;
    const count = {};
    let bestOption = "heal";
    let bestCount = 0;
    for (const v of votes) { count[v] = (count[v] || 0) + 1; if (count[v] > bestCount) { bestCount = count[v]; bestOption = v; }}
    setHealOptionId(bestOption);
    setAnimPhase("effect");
    setShowHealEffect(true);
    // 更新浮動 HP 文字
    if (bestOption === "heal") {
      const texts = aliveIds.map(id => {
        const m = members[id];
        const pct = 0.5 + Math.random() * 0.5;
        const heal = Math.round((m.maxHP || 100) * pct);
        return { id, text: `+${heal}`, color: "#4ade80" };
      });
      setFloatingMemberHps(texts);
      setResultText("全員恢復中…");
    } else if (bestOption === "cure") {
      setResultText("淨化異常狀態！");
      setFloatingMemberHps([]);
    } else if (bestOption === "revive") {
      const target = aliveIds.find(id => members[id]?.role === "rear");
      if (target) {
        setFloatingMemberHps([{ id: target, text: "復活！", color: "#fbbf24" }]);
        setResultText("復活前衛！");
      } else {
        setResultText("無人可復活，改為全體恢復");
        const texts = aliveIds.map(id => {
          const m = members[id];
          const heal = Math.round((m.maxHP || 100) * 0.5);
          return { id, text: `+${heal}`, color: "#4ade80" };
        });
        setFloatingMemberHps(texts);
      }
    }
    if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current);
    effectTimeoutRef.current = setTimeout(() => {
      setShowHealEffect(false);
      setAnimPhase("done");
    }, 1800);
    return () => { if (effectTimeoutRef.current) clearTimeout(effectTimeoutRef.current); };
  }, [allConfirmed]); // eslint-disable-line

  const tally = useMemo(() => {
    const t = {};
    for (const choice of Object.values(roomChoices)) t[choice] = (t[choice] || 0) + 1;
    return t;
  }, [roomChoices]);

  async function handleSelect(optionId) {
    if (animPhase !== "voting" && animPhase !== "open") return;
    if (myChoice) return;
    setAnimPhase("voting");
    if (localMode) {
      (optionId === "cure" ? sfxBuff() : sfxPotionDrink());
      setLocalChoices({ [memberId]: optionId });
      setLocalConfirms({ [memberId]: true });
      return;
    }
    await confirmNonCombatRoom(roomId, memberId, optionId);
  }

  async function handleResolve() {
    if (!isHost) return;
    if (localMode) {
      // 本地單人：自己的選擇即定案，效果交給父層套用
      const bestOption = roomChoices[memberId] || "heal";
      if (bestOption === "cure") {
        onLocalEffect?.({ type:"cure" });
      } else if (bestOption === "revive") {
        // 單人無倒地前衛 → 比照多人 fallback：全體回復 50%
        onLocalEffect?.({ type:"heal_pct", value: 0.5 });
      } else {
        onLocalEffect?.({ type:"heal_pct", value: 0.5 + Math.random() * 0.5 });
      }
      onLocalDone?.();
      return;
    }
    const votes = Object.values(roomChoices);
    const count = {};
    let bestOption = "heal";
    let bestCount = 0;
    for (const v of votes) { count[v] = (count[v] || 0) + 1; if (count[v] > bestCount) { bestCount = count[v]; bestOption = v; }}
    const { updateDoc, doc } = await import("firebase/firestore");
    const { db } = await import("../../lib/firebase");
    const upd = {};
    if (bestOption === "heal") {
      const pct = 0.5 + Math.random() * 0.5;
      for (const id of aliveIds) {
        const m = members[id];
        const newHP = Math.min(m.maxHP || 100, (m.hp || 0) + Math.round((m.maxHP || 100) * pct));
        upd[`members.${id}.hp`] = newHP;
      }
    } else if (bestOption === "cure") {
      for (const id of aliveIds) {
        const b = members[id]?.buffs || {};
        if ((b.atkMult || 1) < 1 || (b.defMult || 1) < 1) {
          upd[`members.${id}.buffs.atkMult`] = 1;
          upd[`members.${id}.buffs.defMult`] = 1;
        }
      }
    } else if (bestOption === "revive") {
      const targetId = aliveIds.find(id => members[id]?.role === "rear");
      if (targetId) {
        const m = members[targetId];
        upd[`members.${targetId}.role`] = "front";
        upd[`members.${targetId}.hp`] = Math.round((m.maxHP || 100) * 0.5);
      } else {
        for (const id of aliveIds) {
          upd[`members.${id}.hp`] = Math.min(members[id].maxHP || 100, (members[id].hp || 0) + Math.round((members[id].maxHP || 100) * 0.5));
        }
      }
    }
    if (Object.keys(upd).length > 0) await updateDoc(doc(db, "dungeonRooms", roomId), upd);
    await resolveNonCombatRoom(roomId, room, memberId, room?.activeRoomId);
  }

  const canVote = (animPhase === "open" || animPhase === "voting") && !myChoice;

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white"
      style={{ background:"linear-gradient(160deg,#1a0a2e,#2d1a4e)", position:"relative" }}>
      <Particles count={22} />
      {showHealEffect && <HealEffect optionId={healOptionId} />}

      <style>{`
@keyframes r-glow{0%,100%{box-shadow:0 0 20px rgba(167,139,250,0.3)}50%{box-shadow:0 0 40px rgba(167,139,250,0.6)}}
@keyframes r-fade{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
@keyframes r-pulse{0%,100%{opacity:1}50%{opacity:0.6}}
@keyframes r-card-hover{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-4px) scale(1.03)}}
@keyframes r-vote-reveal{0%{opacity:0;transform:rotateY(90deg) scale(0.8)}100%{opacity:1;transform:rotateY(0) scale(1)}}
@keyframes r-hp-float{0%{opacity:0;transform:translateY(0) scale(0.5)}30%{opacity:1;transform:translateY(-15px) scale(1.2)}100%{opacity:0;transform:translateY(-50px) scale(0.8)}}
@keyframes r-vote-stamp{0%{transform:scale(0) rotate(-30deg)}60%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0)}}
@keyframes r-progress{0%{width:0%}100%{width:100%}}
      `}</style>

      {/* 浮動 HP 回復文字（在各成員頭像上方） */}
      {floatingMemberHps.map((f, fi) => (
        <span key={f.id} style={{
          position:"fixed", zIndex:60, pointerEvents:"none",
          fontWeight:900, fontSize:20, color:f.color,
          left:`${20 + fi * (aliveIds.length > 1 ? 70 / (aliveIds.length - 1) : 50)}%`,
          top:"52%",
          textShadow:"0 2px 12px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)",
          animation:"r-hp-float 1.5s ease-out forwards",
        }}>{f.text}</span>
      ))}

      {/* Header */}
      <div className="shrink-0 text-center py-6 border-b border-purple-500/20"
        style={animPhase === "entering" ? {animation:"r-pulse 0.8s ease infinite"} : {}}>
        <div className="text-5xl mb-2" style={{ animation: animPhase === "open" ? "r-glow 2s ease infinite" : undefined, display:"inline-block", borderRadius:"50%", padding:8 }}>
          🏕️
        </div>
        <div className="text-2xl font-black" style={{ color:"#a78bfa" }}>休息區</div>
        <div className="text-sm text-purple-300/60 mt-1">
          {animPhase === "effect" ? resultText : animPhase === "done" ? "效果已套用！" : "短暫歇息，恢復戰力"}
        </div>
      </div>

      {/* 全員狀態小卡 */}
      <div style={{ display:"flex", gap:4, padding:"6px 12px", overflowX:"auto", background:"rgba(0,0,0,0.3)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        {Object.entries(members).map(([id, m]) => {
          const hpPct = m.maxHP > 0 ? Math.max(0, Math.min(1, m.hp/m.maxHP)) : 0;
          const isFloating = floatingMemberHps.some(f => f.id === id);
          return (
            <div key={id} style={{
              flexShrink:0, minWidth:52, textAlign:"center", padding:"4px 4px 3px",
              borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.04)",
              transition:"all 0.3s ease",
              boxShadow: isFloating ? "0 0 16px rgba(74,222,128,0.4)" : undefined,
            }}>
              <div style={{ fontSize:7, color: m.alive ? (m.role==="rear"?"#a78bfa":"#4ade80") : "#f87171", fontWeight:700, marginBottom:2 }}>
                {m.alive ? (m.role==="rear"?"🛡":"⚔️") : "💀"} {(m.name||"").slice(0,5)}
              </div>
              <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.1)", overflow:"hidden", marginBottom:2 }}>
                <div style={{ height:"100%", width:`${hpPct*100}%`, background:hpPct>0.5?"#16a34a":hpPct>0.25?"#d97706":"#dc2626", transition:"width 0.5s ease" }}/>
              </div>
              <div style={{ fontSize:7, color:"#94a3b8" }}>{m.hp}/{m.maxHP}</div>
            </div>
          );
        })}
      </div>

      {/* 投票 / 效果區域 */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {(animPhase === "open" || animPhase === "voting") && !allConfirmed && (
          <div className="text-center text-sm text-purple-200/70 mb-1 font-semibold" style={{ animation:"r-fade 0.5s ease both" }}>
            🗳️ {myChoice ? "已投票，等待隊友…" : "全員投票選擇方式"}
          </div>
        )}

        {REST_OPTIONS.map((opt, i) => {
          const enabled = opt.id !== "revive" || hasFrontFallen;
          const votes = tally[opt.id] || 0;
          const isSelected = myChoice === opt.id;
          const isWinner = allConfirmed && healOptionId === opt.id;
          return (
            <div key={opt.id}
              onClick={() => enabled && canVote && handleSelect(opt.id)}
              style={{
                borderRadius:16, padding:"14px 16px",
                border:"2px solid",
                cursor: (enabled && canVote) ? "pointer" : "default",
                animation: animPhase === "open" ? `r-fade 0.4s ease ${i*0.12}s both` : undefined,
                transition:"all 0.3s ease",
                background: isWinner
                  ? `rgba(${opt.id==="heal"?"74,222,128":opt.id==="cure"?"167,139,250":"251,191,36"},0.15)`
                  : isSelected ? "rgba(255,255,255,0.1)" : enabled ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                borderColor: isWinner ? opt.color : isSelected ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)",
                opacity: enabled ? 1 : 0.4,
                boxShadow: isWinner ? `0 0 24px rgba(${opt.id==="heal"?"74,222,128":opt.id==="cure"?"167,139,250":"251,191,36"},0.3)` : isSelected ? "0 0 16px rgba(255,255,255,0.1)" : undefined,
              }}
              onMouseEnter={e => {
                if (enabled && canVote) e.currentTarget.style.transform = "translateX(6px)";
              }}
              onMouseLeave={e => {
                if (enabled && canVote) e.currentTarget.style.transform = "";
              }}>
              <div className="flex items-center gap-4">
                <div className="text-3xl" style={{ animation: isWinner ? "r-vote-reveal 0.5s ease both" : undefined }}>
                  {opt.icon}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm" style={{ color: isWinner ? "white" : isSelected ? "white" : opt.color }}>
                    {opt.title}
                    {isSelected && <span className="ml-2" style={{ animation:"r-vote-stamp 0.4s ease both" }}>✓</span>}
                    {isWinner && <span className="ml-2 text-xs font-bold" style={{ color: "#fbbf24" }}>👑 當選</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
                  {opt.id === "revive" && !hasFrontFallen && (
                    <div className="text-xs text-amber-400 mt-1">⚠️ 無前衛陣亡</div>
                  )}
                </div>
                {animPhase !== "done" && !allConfirmed && (
                  <div className="shrink-0" style={{
                    background:"rgba(255,255,255,0.08)", borderRadius:"50%", width:32, height:32,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:700, color: votes > 0 ? opt.color : "#64748b",
                  }}>
                    {votes || ""}
                  </div>
                )}
                {allConfirmed && (
                  <div style={{ fontSize:20, color: opt.color, animation:"r-vote-reveal 0.5s ease both" }}>
                    {isWinner ? "🎉" : ""}
                  </div>
                )}
              </div>
              {/* 投票進度條 */}
              {votes > 0 && !allConfirmed && (
                <div style={{ marginTop:6, height:3, borderRadius:2, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:2, background:opt.color, width:`${(votes / aliveIds.length) * 100}%`, transition:"width 0.4s ease" }}/>
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(roomConfirms).length > 0 && animPhase !== "done" && (
          <div className="flex justify-center gap-2 flex-wrap pt-2">
            {Object.keys(roomConfirms).map(id => (
              <span key={id} className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30"
                style={{ animation:"r-fade 0.3s ease both" }}>
                ✅ {members[id]?.name || id} {roomChoices[id] ? `(${REST_OPTIONS.find(o=>o.id===roomChoices[id])?.icon||"?"})` : ""}
              </span>
            ))}
          </div>
        )}

        {animPhase === "done" && (
          <div className="text-center py-4" style={{ animation:"r-fade 0.5s ease both" }}>
            <div className="text-4xl mb-2">{healOptionId === "heal" ? "💚" : healOptionId === "cure" ? "✨" : "💊"}</div>
            <div className="text-lg font-bold" style={{ color: "#a78bfa" }}>
              {REST_OPTIONS.find(o => o.id === healOptionId)?.title || "效果已套用"}
            </div>
            <div className="text-sm text-slate-400 mt-1">{resultText}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pb-6 pt-3 border-t border-purple-500/20 space-y-3">
        {animPhase === "done" && isHost ? (
          <button onClick={handleResolve}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg"
            style={{ background:"linear-gradient(90deg,#22c55e,#16a34a)", color:"white",
              animation:"r-glow 1.5s ease infinite" }}>
            🗺️ 繼續探索
          </button>
        ) : animPhase === "done" ? (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 效果已套用，等待房主繼續</div>
        ) : !myChoice && (animPhase === "open" || animPhase === "voting") ? (
          <div className="text-center text-slate-400 text-sm py-2">👆 點擊選擇上方休息方式</div>
        ) : isHost && (animPhase === "voting" || animPhase === "open") && !allConfirmed ? (
          <button onClick={handleResolve}
            className="w-full py-4 rounded-2xl font-black text-base shadow-lg"
            style={{ background:"linear-gradient(90deg,#f59e0b,#d97706)", color:"white" }}>
            👑 強制繼續（{Object.keys(roomConfirms).length}/{aliveIds.length} 已投票）
          </button>
        ) : (
          <div className="text-center text-emerald-400 text-sm py-2 font-bold">✅ 已投票，等待隊友…</div>
        )}
      </div>
    </div>
  );
}
