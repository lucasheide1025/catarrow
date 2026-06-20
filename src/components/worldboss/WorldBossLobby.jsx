// src/components/worldboss/WorldBossLobby.jsx — 世界大 Boss 主瀏覽頁
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeLatestWorldBoss } from "../../lib/worldBossDb";
import { subscribePracticeLogs } from "../../lib/db";
import { WORLD_BOSSES, getBossPhase, PHASE_LABELS, getParticipantBonus } from "../../lib/worldBossData";
import WorldBossSVG from "./WorldBossSVG";
import WorldBossAttack from "./WorldBossAttack";
import WorldBossIntro from "./WorldBossIntro";
import BattleRecords from "../member/BattleRecords";
import { sfxTap } from "../../lib/sound";

function HPBar({ current, max }) {
  const pct  = max > 0 ? Math.max(0, Math.min(1, current / max)) * 100 : 0;
  const phase = getBossPhase(current, max);
  const color = phase === 4 ? "#22c55e" : phase === 3 ? "#eab308" : phase === 2 ? "#f97316" : "#ef4444";
  return (
    <div className="w-full">
      <div className="h-4 w-full rounded-full bg-white/10 overflow-hidden border border-white/20">
        <div className="h-full rounded-full transition-all duration-700 relative"
          style={{ width:`${pct}%`, background:`linear-gradient(90deg, ${color}cc, ${color})` }}>
          <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" style={{ animationDuration:"2s" }}/>
        </div>
      </div>
      <div className="flex justify-between mt-1 text-xs">
        <span style={{ color }}>{PHASE_LABELS[phase]?.label}</span>
        <span className="text-slate-400 font-mono">{current?.toLocaleString()} / {max?.toLocaleString()}</span>
      </div>
    </div>
  );
}

function ParticipantAvatar({ name, isGuest }) {
  const initial = name ? name[0] : "?";
  const colors  = ["#7c3aed","#2563eb","#059669","#d97706","#dc2626","#0891b2"];
  const color   = colors[name?.charCodeAt(0) % colors.length] || colors[0];
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 36 }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black border-2 border-white/30"
        style={{ background: isGuest ? "#64748b" : color }}>
        {isGuest ? "👤" : initial}
      </div>
      <div className="text-[9px] text-slate-400 truncate w-8 text-center">{name?.slice(0,4)}</div>
    </div>
  );
}

function CountdownTimer({ endAt }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    function calc() {
      if (!endAt) return;
      const end  = endAt.toDate ? endAt.toDate() : new Date(endAt);
      const diff = Math.max(0, end - Date.now());
      const d    = Math.floor(diff / 86400000);
      const h    = Math.floor((diff % 86400000) / 3600000);
      const m    = Math.floor((diff % 3600000) / 60000);
      setLeft(d > 0 ? `${d}天 ${h}時 ${m}分` : `${h}時 ${m}分`);
    }
    calc();
    const t = setInterval(calc, 30000);
    return () => clearInterval(t);
  }, [endAt]);
  return <span className="font-mono text-amber-300 font-bold">{left || "–"}</span>;
}

function KillScreen({ event, onClose }) {
  const boss  = event.bossData || {};
  const killer = event.lastHitBy;
  const parts  = Object.entries(event.participants || {})
    .map(([id, p]) => ({ id, name: p.name, dmg: p.totalDmg || 0, isGuest: p.isGuest }))
    .sort((a, b) => b.dmg - a.dmg);
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.97)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:24, cursor:"pointer", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", inset:0, background:"#fbbf24", opacity:0, animation:"wb-screen-flash 0.8s ease forwards", pointerEvents:"none" }}/>
      <div style={{ fontSize:"2.5rem", fontWeight:900, color:"#fbbf24", textShadow:"0 0 40px #f59e0b, 0 0 80px #f59e0b55", letterSpacing:"0.1em", marginBottom:8, animation:"wb-death-text 0.7s ease 0.15s both" }}>
        ☠️ BOSS 擊倒！
      </div>
      <div style={{ fontSize:"0.95rem", color:"#94a3b8", marginBottom:24, animation:"wb-death-killer 0.5s ease 0.7s both" }}>
        {boss.name}「{boss.title}」 已被全員討伐
      </div>
      {killer && (
        <div style={{ background:"rgba(251,191,36,0.12)", border:"1.5px solid #fbbf24", borderRadius:16, padding:"12px 28px", marginBottom:20, textAlign:"center", animation:"wb-death-killer 0.5s ease 0.95s both" }}>
          <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.45)", marginBottom:4, letterSpacing:2 }}>⚔️ 致命一擊</div>
          <div style={{ fontSize:"1.5rem", fontWeight:900, color:"#fbbf24" }}>{killer.memberName}</div>
          <div style={{ fontSize:"0.75rem", color:"#94a3b8", marginTop:2 }}>使用 {killer.weapon}</div>
        </div>
      )}
      {parts.length > 0 && (
        <div style={{ width:"100%", maxWidth:360, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, overflow:"hidden", animation:"wb-death-killer 0.5s ease 1.2s both" }}>
          <div style={{ padding:"8px 16px", fontSize:"0.65rem", color:"rgba(255,255,255,0.4)", fontWeight:700, letterSpacing:2, borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            💥 傷害貢獻排行
          </div>
          {parts.slice(0, 5).map((p, i) => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 16px", borderBottom: i < Math.min(4, parts.length - 1) ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <span style={{ width:18, fontSize:"0.85rem", fontWeight:900, color: i===0?"#fbbf24":i===1?"#94a3b8":i===2?"#cd7c2f":"#475569" }}>{i+1}</span>
              <span style={{ flex:1, fontSize:"0.85rem", color: p.id === killer?.memberId ? "#fbbf24" : "#e2e8f0" }}>
                {p.id === killer?.memberId ? "⚔️ " : ""}{p.name}
              </span>
              <span style={{ fontSize:"0.85rem", fontWeight:700, color:"#f87171" }}>{p.dmg.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop:28, fontSize:"0.7rem", color:"rgba(255,255,255,0.25)", animation:"wb-death-killer 0.4s ease 1.8s both" }}>
        點擊繼續
      </div>
    </div>
  );
}

export default function WorldBossLobby({ onBack, guestOverride, onBattleComplete }) {
  const { profile } = useAuth();

  useEffect(() => {
    if (document.querySelector("[data-wb-lobby-css]")) return;
    const s = document.createElement("style");
    s.setAttribute("data-wb-lobby-css", "1");
    s.textContent = `
      @keyframes wb-screen-flash{0%,100%{opacity:0}20%{opacity:0.9}}
      @keyframes wb-death-text{0%{opacity:0;transform:scale(0.15) rotate(-18deg)}55%{transform:scale(1.08) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
      @keyframes wb-death-killer{0%{opacity:0;transform:translateY(24px) scale(0.85)}100%{opacity:1;transform:translateY(0) scale(1)}}
    `;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  const [event,         setEvent]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [inBattle,      setInBattle]      = useState(false);
  const [wbLogs,        setWbLogs]        = useState([]);
  const [showKillScreen, setShowKillScreen] = useState(false);
  const [killEvent,     setKillEvent]     = useState(null); // 儲存被擊倒的那隻 boss
  const [replayIntro,   setReplayIntro]   = useState(false);

  const myId   = guestOverride?.id   || profile?.id;
  const today  = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const unsub = subscribeLatestWorldBoss(ev => {
      setEvent(ev);
      setLoading(false);
      if (ev?.status === "defeated") {
        const key = `wb_kill_seen_${ev.id}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          setKillEvent(ev);       // 保存正確的 defeated boss
          setShowKillScreen(true);
        }
      } else {
        // 新的 active boss 到來，或無 boss → 關掉 kill screen
        setShowKillScreen(false);
      }
    });
    const unsubLogs = myId
      ? subscribePracticeLogs(myId, logs =>
          setWbLogs(logs.filter(l => l.source === "worldboss"))
        )
      : null;
    return () => { unsub(); unsubLogs?.(); };
  }, [myId]);

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        載入中…
      </div>
    );
  }

  // 進入戰鬥畫面
  if (inBattle && event) {
    return <WorldBossAttack event={event} onBack={() => setInBattle(false)}
      guestOverride={guestOverride}
      onComplete={result => { setInBattle(false); onBattleComplete?.(result); }}
    />;
  }

  const isDefeated = event?.status === "defeated";

  // 無活躍 Boss（且非剛擊倒的 Boss）
  if (!event) {
    return (
      <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="shrink-0 flex items-center gap-3 px-4 pt-5 pb-3 border-b border-white/10">
          {onBack && <button onClick={onBack} className="text-slate-400 text-sm font-bold">← 返回</button>}
          <span className="font-black text-lg flex-1">🌍 世界大 Boss</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="text-7xl opacity-40">👾</div>
          <div className="text-xl font-black text-slate-400">目前沒有活躍的大 Boss</div>
          <div className="text-sm text-slate-500">教練開啟挑戰後會在這裡出現，並發送強制通知</div>
        </div>
      </div>
    );
  }

  const boss         = event.bossData || {};
  const participants = event.participants || {};
  const partList     = Object.entries(participants);
  const total        = event.totalParticipants || 0;
  const bonus        = getParticipantBonus(total);
  const myData       = participants[myId];
  const attackedToday = myData?.lastAttackedDate === today;

  // 傷害排行（前 5）
  const topDmg = partList
    .map(([id, p]) => ({ id, name: p.name, dmg: p.totalDmg || 0, isGuest: p.isGuest }))
    .sort((a, b) => b.dmg - a.dmg)
    .slice(0, 5);

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col text-white"
      style={{ background: `linear-gradient(180deg, ${boss.bg || "#0f172a"} 0%, #0f172a 100%)` }}>

      {showKillScreen && killEvent && (
        <KillScreen event={killEvent} onClose={() => setShowKillScreen(false)}/>
      )}
      {replayIntro && event && (
        <WorldBossIntro event={event} onClose={() => setReplayIntro(false)}/>
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-2">
        {onBack && <button onClick={onBack} className="text-slate-400 text-sm font-bold">← 返回</button>}
        <span className="font-black text-lg flex-1">🌍 世界大 Boss</span>
        <div className="text-xs text-slate-400">
          剩餘 <CountdownTimer endAt={event.endAt}/>
        </div>
      </div>

      {/* 可捲動主體 */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">

        {/* Boss 展示區 */}
        <div className="rounded-3xl overflow-hidden border border-white/10"
          style={{ background:`linear-gradient(135deg, ${boss.bg}dd, #1e293b)` }}>
          <div className="flex flex-col items-center pt-6 pb-4 gap-3">
            {/* 像素圖 */}
            <div className="relative">
              <WorldBossSVG
                bossKey={event.bossKey}
                currentHP={event.bossCurrentHP}
                maxHP={event.bossMaxHP}
                size={300}
              />
              {/* 階段標籤 */}
              {(() => {
                const ph = getBossPhase(event.bossCurrentHP, event.bossMaxHP);
                const pl = PHASE_LABELS[ph];
                return (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs font-bold px-2 py-0.5 rounded-full border"
                    style={{ color: pl.color, borderColor: pl.color, background: "#0f172a" }}>
                    {pl.label}
                  </div>
                );
              })()}
            </div>

            {/* 名稱 & 稱號 */}
            <div className="text-center mt-2">
              <div className="text-2xl font-black" style={{ color: boss.accent || "#f59e0b" }}>
                {boss.name}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">「{boss.title}」</div>
              <button onClick={() => setReplayIntro(true)}
                className="mt-2 text-xs px-3 py-1 rounded-full border border-white/20 text-slate-400 bg-white/5 active:scale-95 transition-all">
                ▶ 重播登場動畫
              </button>
            </div>

            {/* HP 條 */}
            <div className="w-full px-4">
              <HPBar current={event.bossCurrentHP} max={event.bossMaxHP}/>
            </div>

            {/* 屬性列 */}
            <div className="flex gap-4 text-center text-xs">
              <div>
                <div className="text-slate-500 mb-0.5">ATK</div>
                <div className="font-black text-rose-400">{boss.atk}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">DEF</div>
                <div className="font-black text-blue-400">{boss.def}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">參戰人數</div>
                <div className="font-black text-amber-300">{total} 人</div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">加成</div>
                <div className="font-black text-emerald-400">{bonus.label} ATK</div>
              </div>
            </div>
          </div>
        </div>

        {/* 描述 */}
        <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-300 italic leading-relaxed">
          「{boss.desc}」
        </div>

        {/* 參戰者小圖示列（最多顯示 8 個 + 餘數） */}
        {partList.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
            <div className="text-xs text-slate-400 font-bold mb-3">⚔️ 參戰勇者（{total}人）</div>
            <div className="flex gap-2 flex-wrap">
              {partList.slice(0, 8).map(([id, p]) => (
                <ParticipantAvatar key={id} name={p.name} isGuest={p.isGuest}/>
              ))}
              {partList.length > 8 && (
                <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 36 }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black border-2 border-white/20 bg-slate-700">
                    +{partList.length - 8}
                  </div>
                  <div className="text-[9px] text-slate-500">更多</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 傷害排行 */}
        {topDmg.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
            <div className="text-xs text-slate-400 font-bold mb-2">💥 傷害排行</div>
            <div className="space-y-2">
              {topDmg.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-sm w-5 text-center font-black"
                    style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "#475569" }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-slate-300 truncate">{p.name}</span>
                  <span className="text-sm font-black text-amber-300">{p.dmg.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 我的狀態 */}
        {myData && (
          <div className="bg-indigo-500/10 border border-indigo-400/30 rounded-2xl px-4 py-3">
            <div className="text-xs text-indigo-300 font-bold mb-1">你的紀錄</div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">累積傷害</span>
              <span className="font-black text-amber-300">{(myData.totalDmg || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-300">今日狀態</span>
              <span className={`font-bold text-xs ${attackedToday ? "text-rose-400" : "text-emerald-400"}`}>
                {attackedToday ? "✓ 今日已出戰" : "⚡ 可出戰"}
              </span>
            </div>
            {/* 今日出戰詳情 */}
            {attackedToday && (() => {
              const todaySession = (myData.sessions || []).slice().reverse().find(s => s.date === today);
              if (!todaySession) return null;
              return (
                <div className="mt-2 pt-2 border-t border-indigo-400/20 space-y-1">
                  <div className="text-xs text-indigo-300 font-bold">今日出戰報告</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">你的傷害</span>
                    <span className="font-bold text-rose-400">{(todaySession.playerDmg || todaySession.dmg || 0).toLocaleString()}</span>
                  </div>
                  {(todaySession.botDmg > 0) && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">機器人傷害</span>
                      <span className="font-bold text-indigo-400">{todaySession.botDmg.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">本次總傷害</span>
                    <span className="font-bold text-amber-300">{(todaySession.dmg || 0).toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* 獎勵說明 */}
        {(() => {
          const rw = event.reward || {};
          function rewardLine(r) {
            const items = [];
            if (r?.coins)      items.push(`💰 ${r.coins} 金幣`);
            if (r?.woodChests) items.push(`🪵 木箱 ×${r.woodChests}`);
            if (r?.goldChests) items.push(`📦 金箱 ×${r.goldChests}`);
            if (r?.catBoxes)   items.push(`🐱 貓貓箱 ×${r.catBoxes}`);
            if (r?.mimiBoxes)  items.push(`😺 咪咪箱 ×${r.mimiBoxes}`);
            if (r?.cardChance) items.push(`🃏 卡片 ${Math.round(r.cardChance * 100)}%`);
            return items.join("・");
          }
          const tiers = [
            { label: "🥇 第1名",  data: rw.rank1   },
            { label: "🥉 前3名",  data: rw.rank3   },
            { label: "⚡ 全員",   data: rw.rankAll },
            { label: "🛡️ 保底",  data: rw.base    },
          ].filter(t => rewardLine(t.data));
          return (
            <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl px-4 py-3">
              <div className="text-xs text-amber-300 font-bold mb-2">🎁 獎勵一覽</div>
              {tiers.length > 0 ? (
                <div className="space-y-1.5">
                  {tiers.map(t => (
                    <div key={t.label} className="flex items-start gap-2 text-xs">
                      <span className="text-amber-400 font-bold shrink-0 w-14">{t.label}</span>
                      <span className="text-slate-300">{rewardLine(t.data)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400">獎勵由教練設定</div>
              )}
            </div>
          );
        })()}

        {/* 世界王戰鬥紀錄 */}
        {!guestOverride && (
          <BattleRecords logs={wbLogs} title="📊 世界王戰鬥紀錄" maxGroups={8}/>
        )}
      </div>

      {/* 底部按鈕 */}
      <div className="shrink-0 px-4 pt-3"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))", background: "linear-gradient(0deg, #0f172a 90%, transparent)" }}>
        {isDefeated ? (
          <div className="w-full py-4 rounded-2xl font-black text-base text-center text-amber-300 border border-amber-400/30 bg-amber-500/10">
            ☠️ Boss 已被擊倒 · 等待教練開啟新 Boss
          </div>
        ) : (
          <button
            onClick={() => { sfxTap(); setInBattle(true); }}
            disabled={attackedToday}
            className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-xl transition-all active:scale-95 disabled:opacity-40"
            style={{ background: attackedToday ? "#334155" : `linear-gradient(135deg, ${boss.accent || "#f59e0b"}, #ef4444)` }}>
            {attackedToday ? "✓ 今日已出戰" : "⚔️ 進入戰鬥"}
          </button>
        )}
      </div>
    </div>
  );
}
