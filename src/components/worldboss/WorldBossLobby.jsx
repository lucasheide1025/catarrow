// src/components/worldboss/WorldBossLobby.jsx — 世界大 Boss 主瀏覽頁
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { activeSpawnTypes, describeSpawnCycle, evaluateWorldBossSpawnCycle, requiredSpawnType, spawnProgressRatio, SPAWN_PROGRESS_LABEL } from "../../lib/worldBossSpawnCycle";
import { subscribeLatestWorldBoss, subscribeWorldBossSpawnCycle, subscribeWorldBossStatus, getLatestWorldBossKill, getPendingWorldBossRewards, claimWorldBossKillReward, previewWorldBossKillReward, getWorldBossAttackDateKeys, recoverWorldBossParticipation } from "../../lib/worldBossDb";
import { normalizeWorldBossState } from "../../lib/worldBossState";
import { WORLD_BOSSES, getBossPhase, PHASE_LABELS, getParticipantBonus } from "../../lib/worldBossData";
import WorldBossSVG from "./WorldBossSVG";
import WorldBossAttack from "./WorldBossAttack";
import RaidGate from "../../worldboss/RaidGate";
import MatchGate from "../../worldboss/MatchGate";
import WorldBossIntro from "./WorldBossIntro";
import RaidKillCutscene from "../../worldboss/ui/RaidKillCutscene";
import { isKillReplayForEvent, worldBossKillSeenKey } from "../../worldboss/domain/raidKill";
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

function publicParticipantName(participant) {
  return participant?.nickname || participant?.displayName || participant?.name || "匿名射手";
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

function KillScreen({ event, myReward, rewardPreview, onClose, onClaim, canClaim, replay }) {
  const boss  = event.bossData || {};
  const killer = event.lastHitBy;
  const [replayDone, setReplayDone] = useState(!replay);   // 有新版擊倒演出先播，播完才進領取面板
  // ⚠️ killReplay 寫進 status 文件比 event 文件晚一步——KillScreen 掛載時可能還沒到，
  //    到了就接上播放（否則會跳過新演出直接看舊面板）。
  useEffect(() => {
    if (replay && replayDone) setReplayDone(false);
  }, [replay]); // eslint-disable-line
  const parts  = Object.entries(event.participants || {})
    .map(([id, p]) => ({ id, name: publicParticipantName(p), dmg: p.totalDmg || 0, isGuest: p.isGuest }))
    .sort((a, b) => b.dmg - a.dmg);
  if (replay && !replayDone) {
    // ⚠️ 大廳播過新版演出也算「看過」：同步消耗 wb_kill_seen_at，
    //    不然隔天登入首頁還會被 MemberApp 全服重播再跳一次（2026-08-06）。
    try {
      if (replay?.at && Number(localStorage.getItem("wb_kill_seen_at") || 0) < replay.at) {
        localStorage.setItem("wb_kill_seen_at", String(replay.at));
      }
    } catch { /* storage 失敗不影響播放 */ }
    return (
      <div style={{ position:"fixed", inset:0, zIndex:999, background:"#05040a", overflow:"hidden" }}>
        <RaidKillCutscene payload={replay} replay onDone={() => setReplayDone(true)} />
      </div>
    );
  }
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.97)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:24, cursor:"pointer", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", inset:0, background:"#fbbf24", opacity:0, animation:"wb-screen-flash 0.8s ease forwards", pointerEvents:"none" }}/>
      <div style={{ fontSize:"2.5rem", fontWeight:900, color:"#fbbf24", textShadow:"0 0 40px #f59e0b, 0 0 80px #f59e0b55", letterSpacing:"0.1em", marginBottom:8, animation:"wb-death-text 0.7s ease 0.15s both" }}>
        {replay ? "🎉 討伐成功！" : "☠️ BOSS 擊倒！"}
      </div>
      <div style={{ fontSize:"0.95rem", color:"#94a3b8", marginBottom:24, animation:"wb-death-killer 0.5s ease 0.7s both" }}>
        {boss.name}「{boss.title}」 已被全員討伐
      </div>
      {killer && (
        <div style={{ background:"rgba(251,191,36,0.12)", border:"1.5px solid #fbbf24", borderRadius:16, padding:"12px 28px", marginBottom:20, textAlign:"center", animation:"wb-death-killer 0.5s ease 0.95s both" }}>
          <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.45)", marginBottom:4, letterSpacing:2 }}>⚔️ 致命一擊</div>
          <div style={{ fontSize:"1.5rem", fontWeight:900, color:"#fbbf24" }}>{killer.nickname || killer.displayName || killer.memberName || "匿名射手"}</div>
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
      {!myReward && canClaim && (
        <div onClick={e => e.stopPropagation()} style={{ width:"100%", maxWidth:360, marginTop:14, padding:14, borderRadius:16, background:"rgba(251,191,36,.1)", border:"1px solid rgba(251,191,36,.45)", textAlign:"center" }}>
          <div style={{ color:"#fbbf24", fontWeight:900, marginBottom:8 }}>世界王獎勵尚未領取</div>
          {rewardPreview?.reward && <div style={{ textAlign:"left", color:"#e2e8f0", fontSize:12, lineHeight:1.8, marginBottom:10 }}>
            {Object.entries(rewardPreview.reward).filter(([,v]) => v && v !== 0).map(([k,v]) => <div key={k}>{({coins:"🪙 金幣",arrowDew:"💧 箭露",archerXP:"🏹 射手經驗",catXP:"😻 貓咪經驗",bond:"💞 羈絆",coinChests:"💰 金幣寶箱",materialChests:"📦 材料寶箱",catBoxes:"🐱 貓貓箱",mimiBoxes:"😺 咪咪箱",cardPacks:"🃏 怪物卡包",scrolls:"🗺️ 召喚卷",wbCardChance:"👑 王卡機率"}[k] || k)}：{k === "wbCardChance" ? `${Math.round(v*100)}%（確認後判定）` : v}</div>)}
          </div>}
          {rewardPreview?.error && <div style={{ color:"#fca5a5", fontSize:12, marginBottom:10 }}>{rewardPreview.error}</div>}
          <button onClick={onClaim} style={{ width:"100%", padding:"10px 0", border:0, borderRadius:10, background:"linear-gradient(135deg,#fbbf24,#f59e0b)", color:"#422006", fontWeight:900, cursor:"pointer" }}>{rewardPreview ? "確認領取以上獎勵" : "查看完整獎勵"}</button>
        </div>
      )}
      {myReward && (
        <div onClick={e => e.stopPropagation()} style={{ width:"100%", maxWidth:360, marginTop:14, background:"rgba(74,222,128,0.08)", border:"1.5px solid rgba(74,222,128,0.35)", borderRadius:16, padding:"14px 16px", animation:"wb-death-killer 0.5s ease 1.4s both" }}>
          <div style={{ fontSize:"0.65rem", color:"#86efac", fontWeight:700, letterSpacing:2, marginBottom:8 }}>🎁 你的獎勵</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 14px", fontSize:"0.8rem", color:"#e2e8f0" }}>
            {myReward.reward?.coins > 0 && <span>🪙 金幣 +{myReward.reward.coins}</span>}
            {myReward.reward?.arrowDew > 0 && <span>💧 箭露 +{myReward.reward.arrowDew}</span>}
            {myReward.reward?.archerXP > 0 && <span>🏹 射手經驗 +{myReward.reward.archerXP}</span>}
            {myReward.reward?.catXP > 0 && <span>😻 貓咪經驗 +{myReward.reward.catXP}</span>}
            {myReward.reward?.bond > 0 && <span>💞 羈絆值 +{myReward.reward.bond}</span>}
            {myReward.reward?.coinChests > 0 && <span>💰 金幣寶箱 ×{myReward.reward.coinChests}</span>}
            {myReward.reward?.materialChests > 0 && <span>📦 材料寶箱 ×{myReward.reward.materialChests}</span>}
            {myReward.reward?.catBoxes > 0 && <span>🐱 貓貓箱 ×{myReward.reward.catBoxes}</span>}
            {myReward.reward?.mimiBoxes > 0 && <span>😺 咪咪箱 ×{myReward.reward.mimiBoxes}</span>}
            {myReward.reward?.cardPacks > 0 && <span>🃏 怪物卡包 ×{myReward.reward.cardPacks}</span>}
            {myReward.reward?.wbCard && <span>👑 世界王卡 ×1</span>}
            {myReward.reward?.wbCardDuplicateCoins > 0 && <span>🪙 王卡重複補償 +{myReward.reward.wbCardDuplicateCoins}</span>}
            {myReward.reward?.scrolls > 0 && <span>🗺️ 世界王地下城召喚卷 ×{myReward.reward.scrolls}</span>}
          </div>
          {myReward.trophy && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px dashed rgba(255,255,255,0.12)", fontSize:"0.8rem", color:"#fbbf24", fontWeight:700 }}>
              {myReward.trophy === "lastHit"
                ? "🏅 尾刀紀念獎盃＋額外獎勵"
                : `🏅 前${myReward.reward?.rank || ""}名紀念獎盃＋額外獎勵`}
            </div>
          )}
        </div>
      )}
      <div style={{ marginTop:28, fontSize:"0.7rem", color:"rgba(255,255,255,0.25)", animation:"wb-death-killer 0.4s ease 1.8s both" }}>
        點擊繼續
      </div>
    </div>
  );
}

export default function WorldBossLobby({ onBack, guestOverride, onBattleComplete, sharedData, worldBossStatus }) {
  const { profile } = useAuth();
  const activeProfile = guestOverride || profile;
  const isGuestMode = !!guestOverride || ["guest", "kid"].includes(activeProfile?.accountType);

  useEffect(() => {
    if (document.querySelector("[data-wb-lobby-css]")) return;
    const s = document.createElement("style");
    s.setAttribute("data-wb-lobby-css", "1");
    s.textContent = `
      @keyframes wb-screen-flash{0%,100%{opacity:0}20%{opacity:0.9}}
      @keyframes wb-death-text{0%{opacity:0;transform:scale(0.15) rotate(-18deg)}55%{transform:scale(1.08) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
      @keyframes wb-death-killer{0%{opacity:0;transform:translateY(24px) scale(0.85)}100%{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes wb-boss-float { 0%, 100% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-8px) scale(1.02); } }
      @keyframes wb-aura-pulse { 0%, 100% { box-shadow: 0 0 25px rgba(239, 68, 68, 0.4), inset 0 0 15px rgba(245, 158, 11, 0.2); } 50% { box-shadow: 0 0 50px rgba(239, 68, 68, 0.8), inset 0 0 35px rgba(245, 158, 11, 0.5); } }
      @keyframes wb-alert-flash { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.85; } }
      @keyframes wb-btn-glow { 0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.6), 0 0 40px rgba(245, 158, 11, 0.3); } 50% { box-shadow: 0 0 35px rgba(239, 68, 68, 0.9), 0 0 60px rgba(245, 158, 11, 0.6); } }
      .wb-boss-anim { animation: wb-boss-float 4.5s ease-in-out infinite; }
      .wb-aura-anim { animation: wb-aura-pulse 3s infinite; }
      .wb-alert-anim { animation: wb-alert-flash 2s ease-in-out infinite; }
      .wb-btn-anim { animation: wb-btn-glow 2.5s infinite; }
      .no-wb-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
      .no-wb-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
    `;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  const [event,         setEvent]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [inBattle,      setInBattle]      = useState(false);
  const [inMatch,       setInMatch]       = useState(false);
  const [showKillScreen, setShowKillScreen] = useState(false);
  const [killEvent,     setKillEvent]     = useState(null); // 儲存被擊倒的那隻 boss
  const [killReplay,    setKillReplay]    = useState(null); // 新版擊倒演出 payload（status 小文件帶）
  const [replayIntro,   setReplayIntro]   = useState(false);

  const myId   = activeProfile?.id;
  const [today, ...legacyTodayKeys] = getWorldBossAttackDateKeys();

  const [myReward, setMyReward] = useState(null); // claimWorldBossKillReward 回傳結果
  const [rewardPreview, setRewardPreview] = useState(null);
  const [spawnCycle, setSpawnCycle] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(()=>{
    const participant=event?.participants?.[myId];
    if(!isGuestMode&&event?.rewardSnapshot?.version===2&&participant?.participationClaimId&&!participant?.participationRewardClaimedAt){
      recoverWorldBossParticipation(myId,event).catch(()=>{});
    }
  },[event,myId,isGuestMode]);

  // 🌙 冷卻倒數 ticker：resting 期間每 30 秒更新一次（跟首頁卡片同一套做法）
  const cycleResting = spawnCycle?.status === "resting";
  useEffect(() => {
    if (!cycleResting) return;
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, [cycleResting]);

  // ⚠️ **不要把 ensureWorldBossLifecycle 放進訂閱回呼**（2026-08-03 移出）。
  //    worldBossSpawnCycles/current 這份文件在蓄力期間會**頻繁變動**
  //    （任何人射箭／通關／擲骰都會推進度），放在回呼裡等於
  //    「每次進度更新 × 每個開著大廳的人」都各叫一次雲端函式，
  //    而那支函式內部還會再讀好幾筆文件。而且 ensureCycle 自己也會寫這份文件，
  //    有機會自我觸發。
  //    掛載時叫一次就夠；週期性的部分本來就有排程 worldBossLifecycleSchedule 在跑。
  useEffect(() => subscribeWorldBossSpawnCycle(setSpawnCycle), []);

  // 新版擊倒演出：status 小文件才有 killReplay（event 文件沒有），
  // 訂閱它才能在大廳擊倒後播放新版 RaidKillCutscene（2026-08-06）。
  useEffect(() => {
    const applyStatus = ev => {
      setKillReplay(ev?.status === "defeated" && isKillReplayForEvent(ev.killReplay, ev.id) ? ev.killReplay : null);
    };
    if (worldBossStatus !== undefined) {
      applyStatus(worldBossStatus);
      return undefined;
    }
    return subscribeWorldBossStatus(applyStatus);
  }, [worldBossStatus]);

  useEffect(() => {
    const unsub = subscribeLatestWorldBoss(ev => {
      const normalized = normalizeWorldBossState(ev);
      setEvent(normalized);
      setLoading(false);
      if (normalized?.status === "defeated") {
        const key = worldBossKillSeenKey(normalized.id);
        let seen = false;
        try { seen = !!(key && localStorage.getItem(key)); } catch { /* storage unavailable */ }
        if (!seen) setKillEvent(normalized);
      } else {
        // 新的 active boss 到來，或無 boss → 關掉 kill screen
        setKillEvent(null);
        setShowKillScreen(false);
      }
    });
    return unsub;
  }, [myId, isGuestMode]);

  useEffect(() => {
    if (!killEvent?.id || showKillScreen) return;
    const key = worldBossKillSeenKey(killEvent.id);
    try { if (key && localStorage.getItem(key)) return; } catch { /* storage unavailable */ }
    const show = () => {
      try { if (key) localStorage.setItem(key, "1"); } catch { /* storage unavailable */ }
      setShowKillScreen(true);
    };
    if (isKillReplayForEvent(killReplay, killEvent.id)) {
      show();
      return;
    }
    const timer = setTimeout(show, 1500);
    return () => clearTimeout(timer);
  }, [killEvent?.id, killReplay, showKillScreen]);

  const [pendingEvent, setPendingEvent] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (isGuestMode || !myId) {
      setPendingEvent(null);
      return () => { cancelled = true; };
    }

    // The history record is only a snapshot. Confirm claimability against the
    // current event document before exposing an action that might be rejected.
    // Fallback：歷史快照可能不存在（結算沒被任何瀏覽器觸發過），
    // 若目前最新事件本身就是 defeated，直接用事件文件判定可領，不依賴歷史。
    (async () => {
      const pendingEvents = await getPendingWorldBossRewards(myId).catch(() => []);
      if (pendingEvents.length > 0) return pendingEvents[0];
      const kill = await getLatestWorldBossKill().catch(() => null);
      let candidate = (kill?.eventId && kill.participants?.[myId] && !kill.participants[myId].claimed)
        ? kill : null;
      if (!candidate && event?.status === "defeated"
          && event.participants?.[myId] && !event.participants[myId].claimed && !event.participants[myId].isGuest) {
        candidate = {
          eventId: event.id, bossKey: event.bossKey, bossData: event.bossData,
          participants: event.participants, lastHitBy: event.lastHitBy || null,
        };
      }
      if (!candidate) return null;
      const preview = await previewWorldBossKillReward(myId, candidate.eventId);
      return preview.ok ? candidate : null;
    })()
      .then(kill => { if (!cancelled) setPendingEvent(kill); })
      .catch(() => { if (!cancelled) setPendingEvent(null); });

    return () => { cancelled = true; };
  }, [myId, isGuestMode, event?.id, event?.status]);

  // ⚠️ pendingEvent 可能來自 getPendingWorldBossRewards（WB 文件，只有 id）或
  //    getLatestWorldBossKill（WBH 歷史文件，id 是「歷史紀錄 id」、eventId 才是活動 id）。
  //    所以要先取 eventId、沒有才退回 id，兩條路都對——
  //    順序反了的話 fallback 路徑會拿歷史紀錄 id 去領獎 → 「活動不存在」（2026-08-06）。
  const pendingEventId = pendingEvent?.eventId || pendingEvent?.id;

  async function claimPendingReward(eventId) {
    if (!myId || !eventId || isGuestMode) return;
    const pending = pendingEventId === eventId ? pendingEvent : null;
    if (pending && !showKillScreen) {
      setKillEvent({ ...pending, bossData: pending.bossData || WORLD_BOSSES[pending.bossKey] || {} });
      setShowKillScreen(true);
    }
    if (!rewardPreview || rewardPreview.eventId !== eventId) {
      const preview = await previewWorldBossKillReward(myId, eventId);
      if (preview.ok) {
        setRewardPreview({ eventId, ...preview });
      } else {
        setRewardPreview({ eventId, error: preview.reason || "獎勵資料讀取失敗，請重新整理後再試" });
      }
      return;
    }
    if (!window.confirm("已查看完整獎勵內容，確定要領取並放入背包嗎？")) return;
    const result = await claimWorldBossKillReward(myId, eventId);
    if (result.ok) {
      setMyReward(result);
      setRewardPreview(null);
      setPendingEvent(current => (current?.id === eventId || current?.eventId === eventId) ? null : current);
    } else if (result.reason === "already_claimed") {
      // 別台裝置已領過：收掉入口,避免一直顯示可領
      setRewardPreview({ eventId, error: "此獎勵已在其他裝置領取過" });
      setPendingEvent(current => (current?.id === eventId || current?.eventId === eventId) ? null : current);
    } else {
      setRewardPreview({ eventId, error: result.reason || "領取失敗，請稍後再試" });
    }
  }

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        載入中…
      </div>
    );
  }

  // 🏆 比賽模式：實體比賽當天的計分系統。
  // ⚠️ 跟世界王完全分開——沒有獎勵、不扣次數、不影響王的血，
  //    所以「今日已出戰」的人也進得來（比賽跟討伐是兩件事）。
  if (inMatch) {
    return <MatchGate onBack={() => setInMatch(false)} isAdmin={!isGuestMode && !!profile?.isAdmin} />;
  }

  // 進入戰鬥畫面
  if (inBattle && event) {
    // ⚠️ 訪客體驗仍走舊的 WorldBossAttack：新版討伐要靠靶面落點判弱點，
    //    訪客沒有裝備／卡片／貓，那套流程對他們沒有意義，而且舊版是免登入設計的。
    if (isGuestMode) {
      return <WorldBossAttack event={event} onBack={() => setInBattle(false)}
        guestOverride={guestOverride}
        sharedData={sharedData}
        onComplete={result => { setInBattle(false); onBattleComplete?.(result); }}
      />;
    }
    return <RaidGate event={event} onBack={() => setInBattle(false)}
      sharedData={sharedData}
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
          {spawnCycle ? (
            <div className="w-full max-w-md rounded-2xl border border-violet-400/30 bg-violet-950/40 p-4 text-left">
              {/* ⚠️ 狀態判讀走 worldBossSpawnCycle.js 的共用函式，不要在這裡自己寫
                  `Date.now() < restEndsAtMs`——重生邏輯以前就是因為到處各寫一份才變成兩套。 */}
              <div className="font-black text-violet-200 mb-2">
                {describeSpawnCycle(spawnCycle, nowMs)}
              </div>
              {(() => {
                const ev = evaluateWorldBossSpawnCycle(spawnCycle, nowMs);
                const required = requiredSpawnType(spawnCycle);
                // 🌙 冷卻中：只顯示倒數＋本輪條件，不畫全 0 的進度條
                //   （休息期所有數字都是 0，畫出來只會讓玩家以為壞了）
                if (ev.reason === "resting") {
                  const restLeftMs = Math.max(0, ev.remainingMs || 0);
                  const restH = Math.floor(restLeftMs / 3600000);
                  const restM = Math.floor((restLeftMs % 3600000) / 60000);
                  return (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-slate-300">冷卻剩餘</span>
                        <span className="text-2xl font-black text-amber-300">
                          {restH} 小時 {restM} 分
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-2">
                        {required
                          ? `⏳ 冷卻結束後行動才會累積進度。本輪條件：${SPAWN_PROGRESS_LABEL[required]}（其他行動不計）。`
                          : "⏳ 冷卻結束後，大家的行動才會開始累積誕生進度。"}
                      </div>
                    </div>
                  );
                }
                return (
                  <div>
                    {activeSpawnTypes(spawnCycle).map(key => {
                      const label = ({
                        arrows:"🏹 全體箭數", dungeonClears:"🏰 六族地下城",
                        monsterKills:"⚔️ 七族 PvE 擊倒", villageDice:"🎲 探索骰子",
                      })[key] || SPAWN_PROGRESS_LABEL[key] || key;
                      const value = spawnCycle.progress?.[key] || 0;
                      const target = spawnCycle.targets?.[key] || 1;
                      const ratio = spawnProgressRatio(spawnCycle, key);
                      return <div key={key} className="mb-2">
                        <div className="flex justify-between text-xs text-slate-300">
                          <span>{required ? `🎯 ${label}` : label}</span>
                          <span>{value.toLocaleString()} / {target.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                          <div className="h-full bg-violet-400" style={{width:`${ratio*100}%`}}/>
                        </div>
                      </div>;
                    })}
                    <div className="text-[11px] text-slate-400 mt-2">
                      {required
                        ? "🎯 這一輪的門檻是隨機抽出的，只有標記的那一項算數；達標後世界王才會降臨。"
                        : "任一條件達成即可開啟異界之門；未達標時只能由教練從後台召喚。"}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : <div className="text-sm text-slate-500">教練可從後台建立新的世界王挑戰</div>}
        </div>
      </div>
    );
  }

  const boss         = event.bossData || {};
  const bossMaxHP    = Math.max(1, Number(event.bossMaxHP) || Number(boss.hp) || 1);
  const participantDamage = Object.values(event.participants || {}).reduce((sum, participant) => sum + (Number(participant?.totalDmg) || 0), 0);
  const storedCurrentHP = Number(event.bossCurrentHP);
  const bossCurrentHP = Math.max(0, Math.min(bossMaxHP,
    Number.isFinite(storedCurrentHP) ? storedCurrentHP : bossMaxHP - participantDamage));
  const participants = event.participants || {};
  const partList     = Object.entries(participants);
  const total        = event.totalParticipants || 0;
  const bonus        = getParticipantBonus(total);
  const myData       = participants[myId];
  const attackedToday = [today, ...legacyTodayKeys].includes(myData?.lastAttackedDate);
  const currentSessionSourceId =
    activeProfile?.currentSessionSourceId ||
    activeProfile?.lastSessionSourceId ||
    activeProfile?.sessionSourceId ||
    null;
  const activityPartList = isGuestMode && currentSessionSourceId
    ? partList.filter(([, p]) => p.sessionSourceId === currentSessionSourceId)
    : [];

  // 傷害排行（前 5）
  const topDmg = partList
    .map(([id, p]) => ({ id, name: publicParticipantName(p), dmg: p.totalDmg || 0, isGuest: p.isGuest }))
    .sort((a, b) => b.dmg - a.dmg)
    .slice(0, 5);
  const activityTopDmg = activityPartList
    .map(([id, p]) => ({ id, name: publicParticipantName(p), dmg: p.totalDmg || 0, isGuest: p.isGuest }))
    .sort((a, b) => b.dmg - a.dmg)
    .slice(0, 5);

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col text-white select-none font-sans"
      style={{
        zIndex: 9999,
        backgroundImage: `linear-gradient(180deg, rgba(7, 11, 22, 0.92) 0%, rgba(15, 23, 42, 0.97) 100%), url(/assets/dungeon/dungeon_team_lobby_bg.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}>

      {showKillScreen && killEvent && (
        <KillScreen event={killEvent} myReward={myReward} rewardPreview={rewardPreview}
          replay={isKillReplayForEvent(killReplay, killEvent.id) ? killReplay : null}
          canClaim={!isGuestMode && pendingEventId === killEvent.id}
          onClaim={() => claimPendingReward(killEvent.id)} onClose={() => setShowKillScreen(false)}/>
      )}
      {replayIntro && event && (
        <WorldBossIntro event={event} onClose={() => setReplayIntro(false)}/>
      )}

      {/* 史詩殿堂頂部導覽 */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-amber-500/30 backdrop-blur-md sticky top-0 z-30 shadow-xl">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95">
              ←
            </button>
          )}
          <div>
            <div className="text-xs font-black text-amber-400 tracking-wider flex items-center gap-1.5">
              <span>🔥</span> WORLD BOSS RAID 討伐殿堂
            </div>
            <div className="text-sm font-black text-white">{boss.name}</div>
          </div>
        </div>
        <div className="text-xs font-black text-amber-300 font-mono bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-inner flex items-center gap-1.5">
          <span>⏳</span> 剩餘 <CountdownTimer endAt={event.endAt}/>
        </div>
      </header>

      {/* 可捲動主體 */}
      <div className="flex-1 min-h-0 overflow-y-auto no-wb-scrollbar p-4 md:p-6 space-y-5 pb-28"
        style={{ WebkitOverflowScrolling:"touch", touchAction:"pan-y", scrollbarWidth:"none" }}>

        {/* Boss 巨型史詩展台 */}
        <div className="relative overflow-hidden rounded-3xl border border-rose-500/50 bg-gradient-to-br from-slate-950 via-slate-900/90 to-rose-950/60 p-6 shadow-2xl backdrop-blur-md">
          {/* 背景暴怒警報光圈 */}
          <div className="absolute inset-0 bg-rose-600/10 pointer-events-none wb-alert-anim" />

          <div className="flex flex-col items-center text-center gap-4 relative z-10">
            {/* 像素圖與光環 */}
            <div className="relative p-3 bg-rose-500/10 border border-rose-500/40 rounded-3xl wb-aura-anim wb-boss-anim">
              <WorldBossSVG
                bossKey={event.bossKey}
                currentHP={bossCurrentHP}
                maxHP={bossMaxHP}
                size={280}
              />
              {/* 階段標籤 */}
              {(() => {
                const ph = getBossPhase(bossCurrentHP, bossMaxHP);
                const pl = PHASE_LABELS[ph];
                return (
                  <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-xs font-black px-3.5 py-1 rounded-full border shadow-2xl backdrop-blur-md flex items-center gap-1.5"
                    style={{ color: pl.color, borderColor: pl.color, background: "rgba(7,11,22,0.95)" }}>
                    <span className="w-2 h-2 rounded-full animate-ping" style={{ background: pl.color }} />
                    {pl.label}
                  </div>
                );
              })()}
            </div>

            {/* 名稱 & 稱號 */}
            <div className="mt-1">
              <div className="text-2xl md:text-3xl font-black tracking-wide" style={{ color: boss.accent || "#f59e0b" }}>
                {boss.name}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">「{boss.title}」</div>
              <button onClick={() => setReplayIntro(true)}
                className="mt-2.5 text-xs font-bold px-3.5 py-1 rounded-xl border border-amber-500/30 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 transition-all">
                ▶ 重播登場動畫
              </button>
            </div>

            {/* HP 條 */}
            <div className="w-full max-w-lg mt-1">
              <HPBar current={bossCurrentHP} max={bossMaxHP}/>
            </div>

            {/* 討伐面板統計 */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs w-full max-w-lg mt-2">
              <div className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
                <div className="text-slate-400 text-[10px] mb-0.5">ATK</div>
                <div className="font-mono font-black text-rose-400">{boss.atk}</div>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
                <div className="text-slate-400 text-[10px] mb-0.5">DEF</div>
                <div className="font-mono font-black text-blue-400">{boss.def}</div>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
                <div className="text-slate-400 text-[10px] mb-0.5">參戰勇者</div>
                <div className="font-mono font-black text-amber-300">{total} 人</div>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800">
                <div className="text-slate-400 text-[10px] mb-0.5">全隊加成</div>
                <div className="font-mono font-black text-emerald-400">{bonus.label}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 描述 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl px-5 py-4 text-xs text-slate-300 italic leading-relaxed backdrop-blur-md shadow-lg">
          「{boss.desc}」
        </div>

        {/* 參戰者小圖示列（最多顯示 8 個 + 餘數） */}
        {partList.length > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-md">
            <div className="text-xs font-black text-amber-300 mb-3 flex items-center justify-between">
              <span>⚔️ 全服共鬥參戰勇者 ({total}人)</span>
              <span className="text-[11px] text-emerald-400 font-normal">全隊傷害加成 ×{(bonus.atkMult || 1).toFixed(2)}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {partList.slice(0, 8).map(([id, p]) => (
                <ParticipantAvatar key={id} name={publicParticipantName(p)} isGuest={p.isGuest}/>
              ))}
              {partList.length > 8 && (
                <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 36 }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black border-2 border-white/20 bg-slate-800">
                    +{partList.length - 8}
                  </div>
                  <div className="text-[9px] text-slate-500">更多</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 本場活動榜 */}
        {activityTopDmg.length > 0 && (
          <div className="bg-slate-900/80 border border-sky-500/30 rounded-3xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-3 border-b border-sky-500/20 pb-2">
              <div className="text-xs text-sky-300 font-black flex items-center gap-1.5">
                <span>🏕️</span> 本場活動英雄榜
              </div>
              <div className="text-[11px] text-sky-200/80 font-bold">{activityPartList.length} 人參戰</div>
            </div>
            <div className="space-y-2">
              {activityTopDmg.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 rounded-2xl p-2.5 transition-all ${p.id === myId ? "bg-sky-500/20 border border-sky-400/40" : "bg-slate-950/60"}`}>
                  <span className="text-sm w-6 text-center font-black"
                    style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "#38bdf8" }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-xs font-bold text-slate-100 truncate">{p.id === myId ? "你" : p.name}</span>
                  <span className="text-xs font-mono font-black text-amber-300">{p.dmg.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 全體傷害排行 */}
        {topDmg.length > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-md">
            <div className="text-xs text-amber-300 font-black mb-3 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <span>💥</span> {isGuestMode ? "全體世界王傷害排行" : "殿堂英雄傷害排行"}
            </div>
            <div className="space-y-2">
              {topDmg.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-3 rounded-2xl p-2.5 ${p.id === myId ? "bg-amber-500/20 border border-amber-500/30" : "bg-slate-950/60"}`}>
                  <span className="text-sm w-6 text-center font-black"
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
              const todaySession = (myData.sessions || []).slice().reverse().find(s => [today, ...legacyTodayKeys].includes(s.date));
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
          if (isGuestMode) {
            return (
              <div className="bg-sky-500/10 border border-sky-400/30 rounded-2xl px-4 py-3">
                <div className="text-xs text-sky-300 font-bold mb-2">🎁 體驗版獎勵</div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  本模式保留共同討伐、參戰紀錄與傷害排行。訪客/兒童角色不領取正式世界王擊殺箱、王卡、排名獎與箭露，只會在出戰完成後取得少量體驗金幣與貓貓成長回饋。
                </div>
              </div>
            );
          }
          const snapshot=event.rewardSnapshot;
          if(snapshot?.version===2){
            const line=r=>[["coins","💰 金幣"],["arrowDew","💧 箭露"],["archerXP","🏹 射手 EXP"],["catXP","😻 貓咪 EXP"],["bond","💞 羈絆"],["materialChests","📦 材料箱"],["coinChests","🪙 金幣箱"],["mimiBoxes","😺 咪咪箱"],["cardPacks","🃏 卡包"],["scrolls","🗺️ 召喚卷"]].filter(([key])=>r?.[key]).map(([key,label])=>`${label} ${r[key]}`).join("・");
            return <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl px-4 py-3 space-y-2">
              <div className="text-xs text-amber-300 font-bold">🎁 本場固定獎勵</div>
              <div className="text-xs text-slate-300"><b className="text-emerald-300">每次有效參戰：</b>{line(snapshot.participation)}</div>
              <div className="text-xs text-slate-300"><b className="text-amber-300">共同擊殺：</b>{line(snapshot.kill)}・👑 王卡 {Math.round(snapshot.kill.wbCardChance*100)}%</div>
              <div className="text-xs text-slate-300"><b className="text-sky-300">額外分潤池：</b>{line(snapshot.effortPool)}</div>
              <div className="text-[11px] text-slate-400">前三名與尾刀為額外榮譽，可彼此疊加；尾刀不取代共同擊殺獎勵。本場數值已鎖定，重新整理不會改變。</div>
            </div>;
          }
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

      </div>

      {/* 底部固定按鈕 */}
      <div className="shrink-0 px-4 pt-3 sticky bottom-0 z-30 border-t border-slate-800/80 shadow-2xl backdrop-blur-md"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))", background: "linear-gradient(0deg, #070b16 95%, rgba(7,11,22,0.8) 100%)" }}>
        {isDefeated ? (
          <div className="space-y-2">
            {pendingEventId === event.id && !myReward && (
              <button onClick={() => claimPendingReward(event.id)}
                className="w-full py-4 rounded-2xl font-black text-base text-slate-900 shadow-xl transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>
                🎁 領取擊殺獎勵
              </button>
            )}
            <div className="w-full py-4 rounded-2xl font-black text-base text-center text-amber-300 border border-amber-400/30 bg-amber-500/10">
              ☠️ Boss 已被擊倒 · 等待教練開啟新 Boss
            </div>
          </div>
        ) : (
          <div style={{display:"flex",gap:8}}>
          <button
            onClick={() => { if (attackedToday) return; sfxTap(); setInBattle(true); }}
            disabled={attackedToday}
            className={`w-full py-4 rounded-2xl font-black text-lg text-white shadow-2xl transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 border border-rose-400/30 ${!attackedToday ? "wb-btn-anim" : ""}`}
            style={{ background: attackedToday ? "#334155" : `linear-gradient(135deg, ${boss.accent || "#f59e0b"}, #ef4444)` }}>
            <span>⚔️</span> {attackedToday ? "✓ 今日已出戰" : "進入討伐戰鬥"}
          </button>
          {pendingEvent && !myReward && event?.id !== pendingEventId && <button onClick={() => claimPendingReward(pendingEventId)} style={{flex:"0 0 42%",padding:"10px 6px",border:0,borderRadius:12,background:"#fbbf24",color:"#422006",fontWeight:900,fontSize:11,whiteSpace:"nowrap"}}>🎁 上次獎勵</button>}
          </div>
        )}

        {/* 🏆 比賽模式：實體比賽當天的計分系統。
            ⚠️ **永遠看得到**——沒有獎勵、不扣次數、不影響王的血，
               所以「今日已出戰」或王已被擊倒都還是進得去。 */}
        {!isGuestMode && (
          <button onClick={() => { sfxTap(); setInMatch(true); }}
            style={{
              width: "100%", marginTop: 8, padding: "13px 0", borderRadius: 16,
              border: "1px solid rgba(251,191,36,.45)", background: "rgba(251,191,36,.14)",
              color: "#fde68a", fontWeight: 900, fontSize: 14, cursor: "pointer",
            }}>
            🏆 比賽模式（實體比賽計分・即時排行）
          </button>
        )}
      </div>
    </div>
  );
}
