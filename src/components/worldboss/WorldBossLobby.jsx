// src/components/worldboss/WorldBossLobby.jsx — 世界大 Boss 主瀏覽頁
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeActiveWorldBoss } from "../../lib/worldBossDb";
import { WORLD_BOSSES, getBossPhase, PHASE_LABELS, getParticipantBonus } from "../../lib/worldBossData";
import WorldBossSVG from "./WorldBossSVG";
import WorldBossAttack from "./WorldBossAttack";

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

export default function WorldBossLobby({ onBack }) {
  const { profile } = useAuth();
  const [event,      setEvent]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [inBattle,   setInBattle]   = useState(false);

  const myId   = profile?.id;
  const today  = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const unsub = subscribeActiveWorldBoss(ev => {
      setEvent(ev);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        載入中…
      </div>
    );
  }

  // 進入戰鬥畫面
  if (inBattle && event) {
    return <WorldBossAttack event={event} onBack={() => setInBattle(false)} />;
  }

  // 無活躍 Boss
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

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-2">
        {onBack && <button onClick={onBack} className="text-slate-400 text-sm font-bold">← 返回</button>}
        <span className="font-black text-lg flex-1">🌍 世界大 Boss</span>
        <div className="text-xs text-slate-400">
          剩餘 <CountdownTimer endAt={event.endAt}/>
        </div>
      </div>

      {/* 可捲動主體 */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">

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
                size={140}
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

        {/* 參戰者小圖示列 */}
        {partList.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
            <div className="text-xs text-slate-400 font-bold mb-3">⚔️ 參戰勇者（{total}人）</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {partList.map(([id, p]) => (
                <ParticipantAvatar key={id} name={p.name} isGuest={p.isGuest}/>
              ))}
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
          </div>
        )}

        {/* 獎勵說明 */}
        <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl px-4 py-3">
          <div className="text-xs text-amber-300 font-bold mb-2">🎁 擊殺獎勵（全員）</div>
          <div className="space-y-1 text-xs text-slate-300">
            <div>🐱 貓貓箱 ×{event.reward?.catBoxes || 1}</div>
            <div>📦 黃金寶箱 ×{event.reward?.goldChests || 2}</div>
            <div>💰 金幣 {event.reward?.coins || 500}</div>
            <div>🃏 1% 怪物卡片掉落</div>
          </div>
          <div className="text-xs text-amber-400 font-bold mt-2">
            ⚡ 最後一擊：額外貓貓箱 + 圖片收集卡包
          </div>
          <div className="text-xs text-slate-400 mt-1">
            ※ 若未擊殺，所有參戰者仍可獲得黃金寶箱 ×1
          </div>
        </div>
      </div>

      {/* 固定底部按鈕 */}
      <div className="shrink-0 absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3"
        style={{ background: "linear-gradient(0deg, #0f172a 80%, transparent)" }}>
        <button
          onClick={() => setInBattle(true)}
          disabled={attackedToday || event.status !== "active"}
          className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-xl transition-all active:scale-95 disabled:opacity-40"
          style={{ background: attackedToday ? "#334155" : `linear-gradient(135deg, ${boss.accent || "#f59e0b"}, #ef4444)` }}>
          {attackedToday ? "✓ 今日已出戰" : "⚔️ 進入戰鬥"}
        </button>
      </div>
    </div>
  );
}
