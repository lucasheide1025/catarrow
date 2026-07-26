// src/guild/ui/GuildTeamBattle.jsx
// 組隊遠征的共享戰場。回合順序（作者拍板）：
//   隊友A 射完 → 隊友B 射完 → 貓貓支援 → 怪物移動或攻擊 → 下一回合
// 這個順序由 domain/teamExpeditionFlow.processTeamRound 保證（有測試鎖住），
// 而**畫面照著同一個 log 順序播全隊的過程**——每個人都看得到隊友那幾箭打了多少。
//
// ⚠️ 動畫與共享狀態的關係（這是關鍵設計）：
//   房間文件在房主推進的那一刻就已經是「回合後」的狀態了，**動畫不參與 gate**。
//   每個 client 各自拿 `battle.log` 在本地重播一次，播多久都不影響別人 —— 沒有人在等別人的動畫。
//   （先前刻意不做動畫是怕互相等，那個顧慮只在「用動畫鎖狀態」時才成立。）
//   代價是要自己留住「上一回合的畫面狀態」(`viewRef`) 當動畫起點；中途加入/重連的人沒有上一份，
//   就直接跳到最新狀態不播動畫（正確且不會卡）。
//
// ⚠️ 防卡死（前面踩過的坑全部套用）：
//   ① 交箭寫入失敗會自動重試（在 guildTeamDb）
//   ② 動畫有保險絲：算好的狀態先扣在手上，就算 timer 被背景分頁凍結也會在切回前景時對齊
//   ③ 房主看得到「還在等誰」＋卡超過 20 秒可強制推進（不等斷線的人）
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aliveTeamTargets, aliveMemberIds } from "../domain/teamExpeditionFlow";
import {
  sfxTap, sfxArrowShoot, sfxArrowHit, sfxCritBoom, sfxMonsterDead, sfxCounter,
  sfxOrganHit, sfxSoftFail, sfxRoundEnd, sfxError, sfxVictoryFanfare, sfxDefeat, vibrate,
} from "../../lib/sound";
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

// 演出節奏（毫秒）。組隊一回合可能有 4 人 × 6 箭 = 24 箭，用單人版的 430ms 會播 10 秒——
// 所以箭的間隔是**自適應**的：總預算固定，箭越多播越快（作者：「反正過程很快」）。
const T = {
  arrowBudget: 3200,   // 所有箭加起來的總時間預算
  arrowStepMax: 300,
  arrowStepMin: 70,
  arrowFly: 260,
  catStep: 230,
  hitLinger: 320,
  monHitStep: 380,
  starveStep: 300,
  tailPause: 420,      // 播完到解鎖輸入
};
const arrowStep = n => Math.max(T.arrowStepMin, Math.min(T.arrowStepMax, T.arrowBudget / Math.max(1, n)));

const KEYFRAMES = `
@keyframes gt-shake { 0%,100%{transform:translate(-50%,-50%) scale(var(--s)) translateX(0)} 25%{transform:translate(-50%,-50%) scale(var(--s)) translateX(-5px)} 75%{transform:translate(-50%,-50%) scale(var(--s)) translateX(5px)} }
@keyframes gt-poof { 0%{opacity:1;transform:translate(-50%,-50%) scale(var(--s))} 100%{opacity:0;transform:translate(-50%,-50%) scale(calc(var(--s) * 1.5)) rotate(10deg)} }
@keyframes gt-float { 0%{opacity:0;transform:translate(-50%,0) scale(.8)} 15%{opacity:1;transform:translate(-50%,-8px) scale(1.1)} 100%{opacity:0;transform:translate(-50%,-38px) scale(1)} }
@keyframes gt-pounce { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-11px) scale(1.1)} }
@keyframes gt-hurt { 0%,100%{opacity:0} 20%{opacity:.6} }
@keyframes gt-banner { 0%{opacity:0;transform:translate(-50%,-8px)} 15%,85%{opacity:1;transform:translate(-50%,0)} 100%{opacity:0;transform:translate(-50%,-5px)} }
@keyframes gt-aim { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
`;

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
// 隊員在畫面底部的位置（動畫要知道箭從誰那裡飛出來）
function memberPos(index, len) {
  const span = Math.min(34, 12 * Math.max(1, len - 1));
  return { topPct: 88, leftPct: len <= 1 ? 50 : 50 - span + (index / (len - 1)) * span * 2 };
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
  onSubmitShots, onCommitRound, onLeave,
}) {
  // view = 目前畫面上的戰鬥狀態。動畫期間停在「回合前」，播完才跳到最新的。
  const [view, setView] = useState(battle);
  const [animating, setAnimating] = useState(false);
  const [target, setTarget] = useState(null);
  const [shots, setShots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [stuck, setStuck] = useState(false);

  // 動畫用的暫時視覺狀態
  const [hitMap, setHitMap] = useState({});        // 動畫期間先扣的傷害
  const [arrows, setArrows] = useState([]);        // 飛行中的箭
  const [floaters, setFloaters] = useState([]);    // 浮動數字
  const [shakeIds, setShakeIds] = useState([]);    // 受擊抖動的怪
  const [dying, setDying] = useState([]);          // 死亡殘影
  const [aimingId, setAimingId] = useState(null);  // 現在是誰在射（底部立繪放大）
  const [pouncing, setPouncing] = useState([]);    // 出爪的貓（memberId）
  const [hurtIds, setHurtIds] = useState([]);      // 受擊紅閃的隊員
  const [flash, setFlash] = useState(null);        // 回合摘要橫幅

  const timersRef = useRef([]);
  const seqShownRef = useRef(room?.seq || 0);
  const uidRef = useRef(0);
  const pendingRef = useRef(null);                 // 動畫途中又來新回合 → 記著，播完接上

  const seq = room?.seq || 0;
  const later = (fn, ms) => { timersRef.current.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  const uid = () => `t${uidRef.current++}`;
  useEffect(() => () => clearTimers(), []);

  const me = view?.members?.[myId];
  const iAmDown = me?.status === "down";
  const targets = useMemo(() => aliveTeamTargets(view), [view]);
  const submits = room?.submits || {};
  const mySubmit = submits[myId]?.seq === seq;
  const aliveIds = useMemo(() => aliveMemberIds(battle), [battle]);
  const waitingFor = aliveIds.filter(id => submits[id]?.seq !== seq);
  const allSubmitted = waitingFor.length === 0;
  const memberIds = view?.order || [];
  const visualHp = m => Math.max(0, m.hp - (hitMap[m.instanceId] || 0));

  const addFloater = (pos, text, color) => {
    const id = uid();
    setFloaters(f => [...f, { id, ...pos, text, color }]);
    later(() => setFloaters(f => f.filter(x => x.id !== id)), 1200);
  };
  const shakeOnce = instanceId => {
    setShakeIds(s => [...s, instanceId]);
    later(() => setShakeIds(s => s.filter(x => x !== instanceId)), 400);
  };
  const hurtOnce = memberId => {
    setHurtIds(h => [...h, memberId]);
    later(() => setHurtIds(h => h.filter(x => x !== memberId)), 520);
  };

  // ── 新回合抵達 → 本地重播整回合（全隊的過程都播）───────────────
  useEffect(() => {
    if (!battle) return;
    if (seq === seqShownRef.current) { setView(battle); return; }   // 同一回合的其他更新（例如有人交箭）
    if (animating) {
      // 還在播上一回合 → 排隊。⚠️ 只收「比正在播的更新」的回合：動畫期間隊友交箭也會讓
      // 房間文件更新（同一個 seq），若無條件排隊，播完會把同一回合再播一次。
      if (seq > (pendingRef.current?.seq || seqShownRef.current)) pendingRef.current = { seq, battle };
      return;
    }
    playRound(view, battle, seq);
  }, [seq, battle]); // eslint-disable-line

  function finishTo(next, nextSeq) {
    setHitMap({});
    setView(next);
    setAnimating(false);
    seqShownRef.current = nextSeq;
    setShots([]); setTarget(null);
    const queued = pendingRef.current;
    pendingRef.current = null;
    if (queued && queued.seq > nextSeq) playRound(next, queued.battle, queued.seq);
  }

  function playRound(from, next, nextSeq) {
    const log = next.log || [];
    // 沒有上一份畫面（中途加入/重連）或沒有 log → 直接跳到最新，不播動畫
    if (!from || !log.length) { finishTo(next, nextSeq); return; }

    clearTimers();
    setAnimating(true);
    setFlash(null);
    setHitMap({});

    // 動畫要用「回合前」的座標，先把當下畫面的位置記下來
    const preTargets = aliveTeamTargets(from);
    const monPos = {};
    preTargets.forEach((m, i) => { monPos[m.instanceId] = { ...posOf(i, preTargets.length, m.distance), icon: m.icon, monsterId: m.monsterId }; });
    const monAt = id => monPos[id] || { topPct: 40, leftPct: 50, scale: 1 };
    const order = from.order || [];
    const memAt = id => memberPos(Math.max(0, order.indexOf(id)), order.length);

    const arrowLogs = log.filter(l => l.type === "arrow");
    const catLogs = log.filter(l => l.type === "catAttack");
    const monHits = log.filter(l => l.type === "monsterAttack" || l.type === "dodge");
    const starves = log.filter(l => l.type === "starve");
    const downs = log.filter(l => l.type === "memberDown");
    const waveClear = log.find(l => l.type === "waveClear");
    const step = arrowStep(arrowLogs.length);

    let t = 0;
    // ① 全隊的箭：照 log 順序（processTeamRound 保證是「A 射完再 B」）
    for (const lg of arrowLogs) {
      const at = t;
      later(() => {
        setAimingId(lg.by);                       // 誰在射，底部那個人放大一下
        const id = uid();
        const from2 = memAt(lg.by);
        setArrows(a => [...a, { id, top: from2.topPct, left: from2.leftPct }]);
        sfxArrowShoot();
        const to = monAt(lg.target);
        later(() => setArrows(a => a.map(x => (x.id === id ? { ...x, top: to.topPct, left: to.leftPct } : x))), 20);
        later(() => {
          setArrows(a => a.filter(x => x.id !== id));
          setHitMap(h => ({ ...h, [lg.target]: (h[lg.target] || 0) + lg.dmg }));
          shakeOnce(lg.target);
          addFloater(to, `${lg.crit ? "💥" : ""}${lg.dmg}`, lg.crit ? "#fbbf24" : "#fecaca");
          if (lg.crit) { sfxCritBoom(); vibrate(30); } else sfxArrowHit();
          if (lg.killed) {
            sfxMonsterDead();
            const d = uid();
            setDying(x => [...x, { id: d, pos: to, monsterId: monPos[lg.target]?.monsterId, icon: monPos[lg.target]?.icon }]);
            later(() => setDying(x => x.filter(y => y.id !== d)), 800);
          }
        }, T.arrowFly);
      }, at);
      t = at + step;
    }
    later(() => setAimingId(null), t);
    t += T.hitLinger;

    // ② 貓貓支援
    for (const lg of catLogs) {
      const at = t;
      later(() => {
        setPouncing(p => [...p, lg.by]);
        later(() => setPouncing(p => p.filter(x => x !== lg.by)), 500);
        const to = monAt(lg.target);
        setHitMap(h => ({ ...h, [lg.target]: (h[lg.target] || 0) + lg.dmg }));
        shakeOnce(lg.target);
        addFloater(to, `🐱${lg.dmg}`, "#fcd34d");
        sfxOrganHit();
        if (lg.killed) {
          sfxMonsterDead();
          const d = uid();
          setDying(x => [...x, { id: d, pos: to, monsterId: monPos[lg.target]?.monsterId, icon: monPos[lg.target]?.icon }]);
          later(() => setDying(x => x.filter(y => y.id !== d)), 800);
        }
      }, at);
      t = at + T.catStep;
    }
    if (catLogs.length) t += T.hitLinger;

    // ③ 怪物推進 / 攻擊（誰被打誰紅閃）
    for (const lg of monHits) {
      const at = t;
      later(() => {
        if (lg.type === "dodge") {
          addFloater({ ...memAt(lg.by), topPct: 80 }, "閃避!", "#93c5fd");
          sfxSoftFail();
        } else {
          hurtOnce(lg.by);
          addFloater({ ...memAt(lg.by), topPct: 80 }, `−${lg.dmg}`, "#f87171");
          sfxCounter(); vibrate(45);
        }
      }, at);
      t = at + T.monHitStep;
    }

    // ④ 補給不足 / 倒地
    for (const lg of starves) {
      const at = t;
      later(() => { addFloater({ ...memAt(lg.by), topPct: 80 }, `🥵−${lg.dmg}`, "#fca5a5"); sfxSoftFail(); }, at);
      t = at + T.starveStep;
    }
    for (const lg of downs) {
      const at = t;
      later(() => { setFlash(`💀 ${lg.byName} 倒地了！`); sfxDefeat(); }, at);
      t = at + T.starveStep;
    }

    // ⑤ 收尾：套用真實狀態、解鎖輸入
    later(() => {
      finishTo(next, nextSeq);
      if (next.status === "won") { setFlash("🎉 討伐成功，凱旋歸來！"); sfxVictoryFanfare(); }
      else if (next.status === "lost") { setFlash(`💀 ${next.lostReason}`); sfxDefeat(); }
      else if (waveClear) { setFlash(`🌊 清空一波！第 ${waveClear.nextWave + 1} 波來了`); sfxRoundEnd(); }
      else {
        const kills = log.filter(l => (l.type === "arrow" || l.type === "catAttack") && l.killed).length;
        setFlash(`本回合擊殺 ${kills} 隻${monHits.length ? "，有人受到攻擊！" : ""}`);
        sfxRoundEnd();
      }
    }, t + T.tailPause);
  }

  // 動畫保險絲：手機切到背景會凍結 timer → 回到前景時若已落後就直接對齊（跟貓貓村同一手法）
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden || !battle) return;
      if (seqShownRef.current !== (room?.seq || 0)) { clearTimers(); finishTo(battle, room?.seq || 0); }
      setStuck(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [battle, room?.seq]); // eslint-disable-line

  // 目標死掉/換波 → 自動改鎖第一隻
  useEffect(() => {
    if (animating) return;
    if (!targets.length) { setTarget(null); return; }
    if (!targets.some(m => m.instanceId === target)) setTarget(targets[0].instanceId);
  }, [targets, target, animating]);

  // 卡住偵測：超過 20 秒沒推進 → 房主看得到強制推進
  useEffect(() => {
    setStuck(false);
    if (battle?.status !== "fighting") return;
    const t = setTimeout(() => setStuck(true), 20000);
    return () => clearTimeout(t);
  }, [seq, battle?.status]);

  // ── 房主：全員交齊就自動推進 ─────────────────────────────────
  //
  // 🐛 2026-07-26 修死鎖：原本守衛寫成 `... || busy` 但 **`busy` 不在依賴陣列裡**。
  //    死鎖過程：房主送出自己的箭 → setBusy(true) → Firestore 的本地寫入**立刻**觸發快照，
  //    最後一位隊員的箭也在此期間抵達 → allSubmitted 變 true → effect 重跑 → busy 還是 true
  //    → 直接 return。接著 setBusy(false) 時 effect **不會再跑**（busy 不是依賴）⇒ 永遠不推進。
  //    離開再回來＝重新掛載，effect 才用 busy=false 重跑——正是作者看到的症狀。
  //
  // 修法有兩層，因為「靠一次 render 剛好對上」本身就太脆弱：
  //   ① 觸發路徑**完全不看 React state**：用 ref 當 in-flight 鎖。重複推進本來就已經被
  //      擋兩道（`teamCommitRef` 比對 seq ＋ 交易裡的 `if (d.seq >= nextSeq) return`），
  //      所以 busy 對正確性毫無貢獻，只是 UI 用的。
  //   ② 加**看門狗**：戰鬥中每 2 秒重檢一次「全員交齊卻還沒推進」。這樣任何漏掉的 render
  //      都補得回來，不必再靠玩家離開重進。
  const commitInFlightRef = useRef(false);

  const commit = useCallback(async (force = false) => {
    if (commitInFlightRef.current) return;
    commitInFlightRef.current = true;
    setBusy(true);
    try {
      const res = await onCommitRound({ force });
      if (res?.ok === false && res.reason !== "還有人沒送出") { sfxError(); setMsg(`⚠️ ${res.reason || "推進失敗"}`); }
    } finally {
      commitInFlightRef.current = false;
      setBusy(false);
    }
  }, [onCommitRound]);

  useEffect(() => {
    if (!isHost || battle?.status !== "fighting" || !allSubmitted) return;
    const t = setTimeout(() => { commit(); }, 350);
    return () => clearTimeout(t);
  }, [isHost, allSubmitted, seq, battle?.status, commit]);

  // 看門狗：不依賴任何 render 時序，戰鬥中固定重檢。
  // ⚠️ 依賴陣列**不能**放 `battle`/`room.submits`——它們每次快照都是新物件，interval 會被反覆
  //    重建、2 秒永遠倒數不完。改成用 ref 讀最新值，interval 只在「開打／結束」時建立一次。
  const latestRef = useRef({ room, battle });
  latestRef.current = { room, battle };

  useEffect(() => {
    if (!isHost || battle?.status !== "fighting") return;
    const iv = setInterval(() => {
      if (commitInFlightRef.current) return;
      const { room: r, battle: b } = latestRef.current;
      if (!b || b.status !== "fighting") return;
      const subs = r?.submits || {};
      const pending = aliveMemberIds(b).filter(id => subs[id]?.seq !== (r?.seq || 0));
      if (pending.length === 0) commit();
    }, 2000);
    return () => clearInterval(iv);
  }, [isHost, battle?.status, commit]);

  const addShot = score => {
    if (animating || !target || shots.length >= arrowsPerRound || mySubmit || iAmDown) return;
    sfxArrowShoot();
    setShots(s => [...s, { targetInstanceId: target, score }]);
  };

  async function submit() {
    if (busy || mySubmit) return;
    setBusy(true);
    try {
      const res = await onSubmitShots(shots);
      if (res?.ok === false) { sfxError(); setMsg(`⚠️ ${res.reason || "送出失敗，請再按一次"}`); }
      else { sfxTap(); setMsg(""); }
    } finally { setBusy(false); }
  }

  if (!view) return null;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#0b1220", color: "#e2e8f0" }}>
      <style>{KEYFRAMES}</style>

      <div style={{ padding: "6px 12px", background: "#1a1207", fontSize: 11, fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#fcd34d" }}>
          📜 {room?.contract?.title}　第 {view.round} 回合　波 {view.waveIndex + 1}/{view.expedition?.totalWaves}
        </span>
        <button type="button" onClick={onLeave} style={{ padding: "3px 9px", borderRadius: 7, border: "none", background: "#334155", color: "#cbd5e1", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}>離開</button>
      </div>

      <div style={{ padding: "5px 12px", display: "flex", alignItems: "center", gap: 8, background: "#0f172a" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5", minWidth: 62 }}>❤️ {me?.hp ?? 0}/{me?.maxHp ?? 0}</span>
        <div style={{ flex: 1 }}><Bar cur={me?.hp ?? 0} max={me?.maxHp ?? 1} color="#22c55e" h={6} /></div>
        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>🍖{me?.supplies?.food ?? 0} 💧{me?.supplies?.water ?? 0}</span>
      </div>

      {/* 共享戰場 */}
      <div style={{ position: "relative", flex: 1, minHeight: 320, overflow: "hidden",
        ...bgLayer(fieldBg(view.expedition?.family), { overlay: "rgba(6,10,6,.42)" }) }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.15) 0%,transparent 35%,rgba(0,0,0,.68) 100%)", pointerEvents: "none" }} />

        {targets.map((m, i) => {
          const p = posOf(i, targets.length, m.distance);
          const isSel = target === m.instanceId;
          const shaking = shakeIds.includes(m.instanceId);
          return (
            <button key={m.instanceId} type="button" onClick={() => { if (!animating) { sfxTap(); setTarget(m.instanceId); } }}
              style={{ position: "absolute", top: `${p.topPct}%`, left: `${p.leftPct}%`, "--s": p.scale,
                transform: `translate(-50%,-50%) scale(${p.scale})`,
                transition: "top .45s ease-out, left .45s ease-out",
                animation: shaking ? "gt-shake .3s ease-in-out" : "none",
                background: "none", border: "none", cursor: animating ? "default" : "pointer", textAlign: "center", zIndex: Math.round(p.topPct) }}>
              <MonsterArt monsterId={m.monsterId} icon={m.icon} size={MOB_SIZE}
                style={{ filter: isSel ? "drop-shadow(0 0 9px #f59e0b)" : "drop-shadow(0 3px 6px rgba(0,0,0,.6))" }} />
              <div style={{ fontSize: 9, fontWeight: 800, color: "#fecaca", whiteSpace: "nowrap", textShadow: "0 1px 3px #000" }}>{m.name}</div>
              <div style={{ width: 56, margin: "1px auto" }}><Bar cur={visualHp(m)} max={m.maxHp} /></div>
              <div style={{ fontSize: 9, fontWeight: 900, color: m.distance <= 1 ? "#ef4444" : "#fcd34d" }}>
                {m.distance <= 0 ? "⚔️攻擊!" : `距離 ${m.distance}`}
              </div>
              {isSel && !animating && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 900 }}>▲鎖定</div>}
            </button>
          );
        })}

        {/* 死亡殘影 */}
        {dying.map(d => (
          <div key={d.id} style={{ position: "absolute", top: `${d.pos.topPct}%`, left: `${d.pos.leftPct}%`, "--s": d.pos.scale || 1,
            transform: `translate(-50%,-50%) scale(${d.pos.scale || 1})`, animation: "gt-poof .8s ease-out forwards", pointerEvents: "none", zIndex: 80 }}>
            <MonsterArt monsterId={d.monsterId} icon={d.icon} size={MOB_SIZE} />
          </div>
        ))}

        {/* 飛行中的箭（從射手的位置飛向目標）*/}
        {arrows.map(a => (
          <div key={a.id} style={{ position: "absolute", top: `${a.top}%`, left: `${a.left}%`, transform: "translate(-50%,-50%) rotate(-45deg)",
            transition: `top ${T.arrowFly}ms linear, left ${T.arrowFly}ms linear`, fontSize: 18, pointerEvents: "none", zIndex: 85 }}>
            ➶
          </div>
        ))}

        {/* 浮動數字 */}
        {floaters.map(f => (
          <div key={f.id} style={{ position: "absolute", top: `${f.topPct}%`, left: `${f.leftPct}%`, transform: "translate(-50%,0)",
            color: f.color, fontWeight: 900, fontSize: 14, textShadow: "0 2px 6px rgba(0,0,0,.85)",
            animation: "gt-float 1.2s ease-out forwards", pointerEvents: "none", zIndex: 95 }}>
            {f.text}
          </div>
        ))}

        {/* 小隊站位 */}
        <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10, alignItems: "flex-end", zIndex: 70 }}>
          {memberIds.map(id => {
            const m = view.members[id];
            const isMe = id === myId;
            const done = submits[id]?.seq === seq;
            const aiming = aimingId === id;
            return (
              <div key={id} style={{ position: "relative", textAlign: "center", opacity: m.status === "down" ? 0.42 : 1,
                animation: aiming ? "gt-aim .3s ease-out" : "none" }}>
                {hurtIds.includes(id) && (
                  <div style={{ position: "absolute", inset: -8, background: "radial-gradient(circle,#ef4444,transparent 70%)", animation: "gt-hurt .5s ease-out", pointerEvents: "none", borderRadius: 12 }} />
                )}
                {isMe
                  ? <HeroArt size={62} style={{ filter: `drop-shadow(0 4px 8px rgba(0,0,0,.65))${aiming ? " drop-shadow(0 0 8px #fbbf24)" : ""}` }} />
                  : <div style={{ fontSize: 34, filter: `drop-shadow(0 3px 6px rgba(0,0,0,.6))${aiming ? " drop-shadow(0 0 8px #fbbf24)" : ""}` }}>🏹</div>}
                <div style={{ fontSize: 9, fontWeight: 900, color: isMe ? "#93c5fd" : "#e2e8f0", whiteSpace: "nowrap" }}>
                  {m.status === "down" ? "💀 " : done ? "✅ " : ""}{m.name}
                </div>
                <div style={{ width: 46, margin: "1px auto" }}><Bar cur={m.hp} max={m.maxHp} color="#22c55e" h={4} /></div>
                {(m.cats || []).length > 0 && (
                  <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 2,
                    animation: pouncing.includes(id) ? "gt-pounce .5s ease-out" : "none" }}>
                    {m.cats.map(c => <CatArt key={c.id} catId={c.id} icon={c.icon} size={18} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {flash && (
          <div key={flash} style={{ position: "absolute", top: 8, left: "50%", background: "rgba(0,0,0,.75)", padding: "5px 14px", borderRadius: 999,
            fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", animation: "gt-banner 2.6s ease-out forwards", zIndex: 96 }}>
            {flash}
          </div>
        )}
      </div>

      {/* 操作區 */}
      <div style={{ padding: 10, background: "#0f172a", display: "flex", flexDirection: "column", gap: 8 }}>
        {animating ? (
          <div style={{ fontSize: 12, color: "#fcd34d", textAlign: "center", fontWeight: 800 }}>⚔️ 戰鬥進行中…</div>
        ) : iAmDown ? (
          <div style={{ fontSize: 12, color: "#f87171", textAlign: "center", fontWeight: 800 }}>
            💀 你已倒地——隊友還在戰鬥，撐到勝利你一樣有獎勵
          </div>
        ) : mySubmit ? (
          <div style={{ fontSize: 12, color: "#6ee7b7", textAlign: "center", fontWeight: 800 }}>
            ✅ 已送出　{waitingFor.length > 0 ? `還在等 ${waitingFor.map(id => view.members[id]?.name).join("、")}` : "結算中…"}
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

        {isHost && stuck && battle?.status === "fighting" && !allSubmitted && (
          <button type="button" disabled={busy} onClick={() => commit(true)}
            style={{ padding: "9px 0", borderRadius: 9, border: "1px solid rgba(251,191,36,.4)", background: "rgba(120,53,15,.7)", color: "#fde68a", fontSize: 11.5, fontWeight: 900, cursor: "pointer" }}>
            ⏭ 不等了，強制推進（{waitingFor.map(id => view.members[id]?.name).join("、")} 這回合視為沒射）
          </button>
        )}

        {msg && <div style={{ fontSize: 11.5, color: "#f87171" }}>{msg}</div>}
      </div>
    </div>
  );
}
