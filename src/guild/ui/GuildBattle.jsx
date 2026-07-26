// src/guild/ui/GuildBattle.jsx
// ─────────────────────────────────────────────────────────────
// 冒險者公會「2.5D 鳥瞰戰鬥」畫面（emoji + CSS 深度；日後換 ComfyUI sprite）。
// 玩法：選目標 → 射真實的箭（點分數）→ 每回合 3 箭 → 發動 → processRound。
// 純呈現層：所有規則走 domain/expeditionFlow，本檔只畫狀態 + 收集射擊 + 演出。
//
// 演出架構（重點）：`processRound` 是**瞬間**算完整回合的純函數，但玩家需要看到過程。
// 做法＝算完先把結果扣在手上（`pendingRef`），照 `next.log` 的順序排時間軸播動畫與音效，
// 播完才 `setState(next)`。動畫期間 `animating` 鎖住輸入，中途卸載會清掉所有 timer。
// 血條在動畫期間用 `hitMap`（累積傷害）先扣，數字才跟得上畫面。
// 音效全部沿用 `src/lib/sound.js`（Web Audio 合成，不需音檔）。
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { createExpeditionState, processRound, aliveTargets } from "../domain/expeditionFlow";
import {
  sfxTap, sfxArrowShoot, sfxArrowHit, sfxCritBoom, sfxMonsterDead, sfxCounter,
  sfxOrganHit, sfxSoftFail, sfxRoundEnd, sfxVictoryFanfare, sfxDefeat, vibrate,
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

// 演出節奏（毫秒）——調快慢改這裡就好。
// 2026-07-25 作者回饋「太快了」→ 整體放慢約 1.8 倍；箭要看得到飛行、貓要看得到撲上去。
const T = {
  arrowStep: 430,   // 下一箭的間隔
  arrowFly: 400,    // 箭矢飛行時間
  catStep: 360,     // 貓貓輪流出爪的間隔
  hitLinger: 460,   // 一段打完的停頓（讓數字看得完）
  dodgeStep: 300,
  monHitStep: 560,  // 怪物反擊之間（紅閃要有喘息）
  starveStep: 520,
  endPause: 700,    // 結果橫幅 → 跳結算頁
  floater: 1300,    // 浮動數字存在時間
  poof: 820,        // 死亡殘影
};

const KEYFRAMES = `
@keyframes gb-shake { 0%,100%{transform:translate(-50%,-50%) scale(var(--s)) translateX(0)} 25%{transform:translate(-50%,-50%) scale(var(--s)) translateX(-6px)} 75%{transform:translate(-50%,-50%) scale(var(--s)) translateX(6px)} }
@keyframes gb-poof { 0%{opacity:1;transform:translate(-50%,-50%) scale(var(--s))} 100%{opacity:0;transform:translate(-50%,-50%) scale(calc(var(--s) * 1.6)) rotate(12deg)} }
@keyframes gb-float { 0%{opacity:0;transform:translate(-50%,0) scale(.8)} 15%{opacity:1;transform:translate(-50%,-8px) scale(1.1)} 100%{opacity:0;transform:translate(-50%,-42px) scale(1)} }
@keyframes gb-pounce { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-14px) scale(1.12)} }
@keyframes gb-hurt { 0%,100%{opacity:0} 20%{opacity:.55} }
@keyframes gb-bowpull { 0%,100%{transform:scale(1)} 50%{transform:scale(1.14) rotate(-8deg)} }
@keyframes gb-banner { 0%{opacity:0;transform:translate(-50%,-10px)} 15%,85%{opacity:1;transform:translate(-50%,0)} 100%{opacity:0;transform:translate(-50%,-6px)} }
`;

function Bar({ cur, max, color = "#ef4444", h = 5 }) {
  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  return (
    <div style={{ height: h, width: "100%", background: "rgba(0,0,0,.4)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width .35s ease-out" }} />
    </div>
  );
}

// 怪物在 2.5D 戰場上的位置（距離＝深度）。箭矢要飛去哪也用這個算，兩邊才對得準。
// 怪物立繪基準尺寸。實際大小 = MOB_SIZE × posOf().scale（遠 0.8 ／ 貼臉 1.4）。
// 62 太小（最遠只剩 46px 根本看不清楚），拉到 92 → 74~129px。
const MOB_SIZE = 92;

// 2.5D 站位：畫面**上方＝遠**、下方＝近（玩家在最下面）。
// 🐛 舊版把 topPct 寫成 `8 + depth * 55`，depth 是「1=遠」→ 遠的怪反而被放在畫面下方、
//    近的怪跑到最上面，逼近時看起來像在後退。正解是用 (1-depth)。
function posOf(index, len, distance) {
  const depth = Math.max(0, Math.min(MAX_DIST, distance)) / MAX_DIST; // 1=最遠 0=貼臉
  const near = 1 - depth;                                            // 0=最遠 1=貼臉
  // 橫向：以中央為基準展開，怪少就別站到邊邊；越遠越向中央收（近似透視消失點）
  const halfSpan = Math.min(30, 11 * Math.max(1, len - 1)) * (0.62 + 0.38 * near);
  return {
    topPct: 12 + near * 46,                       // 遠 12% → 近 58%（再往下會壓到玩家立繪）
    leftPct: len <= 1 ? 50 : 50 - halfSpan + (index / (len - 1)) * halfSpan * 2,
    scale: 0.8 + near * 0.6,                      // 遠 0.8 → 近 1.4
  };
}
const PLAYER_POS = { topPct: 88, leftPct: 50 };

export default function GuildBattle({ expedition, guildStats, supplies, cats = [], arrowsPerRound = 3, onEnd, onArrowsShot }) {
  const [state, setState] = useState(() => createExpeditionState(expedition, guildStats, supplies, cats, { arrowsPerRound }));
  const ARROWS_PER_ROUND = state.arrowsPerRound || arrowsPerRound;
  const [target, setTarget] = useState(null);
  const [shots, setShots] = useState([]);
  const [flash, setFlash] = useState(null);        // 回合摘要橫幅
  const [animating, setAnimating] = useState(false);
  const [arrows, setArrows] = useState([]);        // 飛行中的箭 [{id, from, to, at}]
  const [floaters, setFloaters] = useState([]);    // 浮動數字 [{id, topPct,leftPct,text,color}]
  const [hitMap, setHitMap] = useState({});        // 動畫期間先扣的傷害 {instanceId: dmg}
  const [shakeIds, setShakeIds] = useState([]);    // 受擊抖動
  const [dying, setDying] = useState([]);          // 死亡殘影 [{id, pos, icon}]
  const [pouncing, setPouncing] = useState([]);    // 出爪的貓 id
  const [hurt, setHurt] = useState(false);         // 玩家受擊紅閃
  const [bowPull, setBowPull] = useState(false);   // 拉弓
  const timersRef = useRef([]);
  const seqRef = useRef(0);

  // 卸載時清掉所有排程，避免動畫跑到一半離開畫面還在 setState
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);
  const later = (fn, ms) => { timersRef.current.push(setTimeout(fn, ms)); };
  const uid = () => `f${seqRef.current++}`;

  const targets = aliveTargets(state);
  const visualHp = m => Math.max(0, m.hp - (hitMap[m.instanceId] || 0));

  const addFloater = (pos, text, color) => {
    const id = uid();
    setFloaters(f => [...f, { id, ...pos, text, color }]);
    later(() => setFloaters(f => f.filter(x => x.id !== id)), T.floater);
  };
  const shakeOnce = instanceId => {
    setShakeIds(s => [...s, instanceId]);
    later(() => setShakeIds(s => s.filter(x => x !== instanceId)), 420);
  };

  const selectTarget = id => { if (!animating) { setTarget(id); sfxTap(); } };

  const shoot = score => {
    if (animating || !target || shots.length >= ARROWS_PER_ROUND || state.status !== "fighting") return;
    if (!targets.find(t => t.instanceId === target)) return;
    setShots(s => [...s, { targetInstanceId: target, score }]);
    setBowPull(true);
    later(() => setBowPull(false), 320);
    sfxArrowShoot();
  };

  // ── 一回合的演出時間軸 ──
  const fireRound = () => {
    if (animating || state.status !== "fighting") return;
    const next = processRound(state, shots, {});
    // 射出去的箭要計進今日/終身箭數（公會遠征也是真的在射箭）
    if (shots.length) onArrowsShot?.(shots.length);
    setShots([]);
    setTarget(null);
    setAnimating(true);
    setFlash(null);

    // 動畫要用「開打前」的位置，所以先把當下畫面的座標記下來
    const posMap = {};
    targets.forEach((m, i) => { posMap[m.instanceId] = { ...posOf(i, targets.length, m.distance), icon: m.icon, monsterId: m.monsterId }; });
    const posOrCenter = id => posMap[id] || { topPct: 40, leftPct: 50, scale: 1, icon: "❓" };

    let t = 0;
    const arrowLogs = next.log.filter(l => l.type === "arrow");
    const catLogs = next.log.filter(l => l.type === "catAttack");
    const monHits = next.log.filter(l => l.type === "monsterAttack");
    const dodges = next.log.filter(l => l.type === "dodge");
    const starve = next.log.find(l => l.type === "starve");
    const waveClear = next.log.find(l => l.type === "waveClear");

    // ① 箭矢逐發飛出 → 命中 → 傷害數字 → 擊殺殘影
    for (const lg of arrowLogs) {
      const p = posOrCenter(lg.target);
      const at = t;
      later(() => {
        const id = uid();
        setArrows(a => [...a, { id, top: PLAYER_POS.topPct, left: PLAYER_POS.leftPct }]);
        later(() => setArrows(a => a.map(x => x.id === id ? { ...x, top: p.topPct, left: p.leftPct } : x)), 20);
        later(() => setArrows(a => a.filter(x => x.id !== id)), T.arrowFly + 90);
      }, at);
      later(() => {
        if (lg.crit) { sfxCritBoom(); vibrate(40); } else sfxArrowHit();
        setHitMap(h => ({ ...h, [lg.target]: (h[lg.target] || 0) + lg.dmg }));
        shakeOnce(lg.target);
        addFloater(p, `${lg.crit ? "💥" : ""}-${lg.dmg}`, lg.crit ? "#fbbf24" : "#fca5a5");
        if (lg.killed) {
          const gid = uid();
          setDying(d => [...d, { id: gid, pos: p, icon: p.icon, monsterId: p.monsterId }]);
          later(() => setDying(d => d.filter(x => x.id !== gid)), T.poof);
          sfxMonsterDead();
        }
      }, at + T.arrowFly);
      t = at + T.arrowStep;
    }

    // ② 貓貓助攻（往前彈跳 + 爪痕）
    t += arrowLogs.length ? T.hitLinger : 0;
    for (const lg of catLogs) {
      const p = posOrCenter(lg.target);
      const at = t;
      later(() => {
        setPouncing(p2 => [...p2, lg.cat]);
        later(() => setPouncing(p2 => p2.filter(x => x !== lg.cat)), 520);
        sfxCounter();
        setHitMap(h => ({ ...h, [lg.target]: (h[lg.target] || 0) + lg.dmg }));
        shakeOnce(lg.target);
        addFloater(p, `🐾-${lg.dmg}`, "#fcd34d");
        if (lg.killed) {
          const gid = uid();
          setDying(d => [...d, { id: gid, pos: p, icon: p.icon, monsterId: p.monsterId }]);
          later(() => setDying(d => d.filter(x => x.id !== gid)), T.poof);
          sfxMonsterDead();
        }
      }, at);
      t = at + T.catStep;
    }

    // ③ 閃避 / 怪物反擊（玩家紅閃）
    for (const lg of dodges) {
      const at = t;
      later(() => addFloater({ topPct: PLAYER_POS.topPct - 8, leftPct: PLAYER_POS.leftPct }, "MISS", "#93c5fd"), at);
      t = at + T.dodgeStep;
    }
    for (const lg of monHits) {
      const at = t;
      later(() => {
        sfxOrganHit(); vibrate(60);
        setHurt(true);
        later(() => setHurt(false), 520);
        addFloater({ topPct: PLAYER_POS.topPct - 10, leftPct: PLAYER_POS.leftPct }, `-${lg.dmg}`, "#ef4444");
      }, at);
      t = at + T.monHitStep;
    }

    // ④ 補給耗盡的力竭傷害
    if (starve) {
      const at = t;
      later(() => { sfxSoftFail(); addFloater({ topPct: PLAYER_POS.topPct - 18, leftPct: PLAYER_POS.leftPct }, `🍖💧 力竭 -${starve.dmg}`, "#f87171"); }, at);
      t = at + T.starveStep;
    }

    // ⑤ 收尾：套用真實狀態、清掉暫時的視覺傷害，再報結果
    later(() => {
      setHitMap({});
      setState(next);
      setAnimating(false);
      const kills = next.log.filter(l => (l.type === "arrow" || l.type === "catAttack") && l.killed).length;
      if (next.status === "won") { setFlash("🎉 討伐成功，凱旋歸來！"); sfxVictoryFanfare(); }
      else if (next.status === "lost") { setFlash(`💀 ${next.lostReason}`); sfxDefeat(); }
      else {
        if (waveClear) { setFlash(`✅ 清空一波！第 ${waveClear.nextWave + 1} 波來了`); sfxRoundEnd(); }
        else setFlash(`本回合擊殺 ${kills} 隻${catLogs.length ? "（貓貓助攻）" : ""}${monHits.length ? "，你受到攻擊！" : ""}`);
      }
      if (next.status !== "fighting") later(() => onEnd && onEnd(next), T.endPause + 1200);
    }, t + T.hitLinger);
  };

  const canAct = state.status === "fighting" && !animating;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#0a1a0a,#05100a)", color: "#e2e8f0" }}>
      <style>{KEYFRAMES}</style>

      {/* 頂列：回合 + 補給 */}
      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,.35)" }}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>第 {state.round} 回合 · 第 {state.waveIndex + 1}/{state.expedition.totalWaves} 波</div>
        <div style={{ fontSize: 11, display: "flex", gap: 10 }}>
          <span style={{ color: state.supplies.food <= 1 ? "#f87171" : undefined }}>🍖 {state.supplies.food}</span>
          <span style={{ color: state.supplies.water <= 1 ? "#f87171" : undefined }}>💧 {state.supplies.water}</span>
        </div>
      </div>
      <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.25)" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5", minWidth: 64 }}>❤️ {state.hp}/{state.maxHp}</span>
        <div style={{ flex: 1 }}><Bar cur={state.hp} max={state.maxHp} color="#22c55e" h={7} /></div>
      </div>

      {/* 2.5D 戰場 */}
      <div style={{ position: "relative", flex: 1, minHeight: 360, overflow: "hidden",
        ...bgLayer(fieldBg(state.expedition?.family || state.monsters?.[0]?.family), { overlay: "rgba(6,10,6,.42)" }) }}>
        {/* 下緣壓暗，讓玩家/貓/UI 跟地面分層 */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.15) 0%,transparent 35%,rgba(0,0,0,.65) 100%)", pointerEvents: "none" }} />

        {/* 玩家受擊紅閃 */}
        {hurt && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle,transparent 30%,#ef4444 130%)", animation: "gb-hurt .52s ease-out", pointerEvents: "none", zIndex: 90 }} />}

        {/* 怪物 */}
        {targets.map((m, i) => {
          const p = posOf(i, targets.length, m.distance);
          const isSel = target === m.instanceId;
          const shaking = shakeIds.includes(m.instanceId);
          return (
            <button key={m.instanceId} type="button" onClick={() => selectTarget(m.instanceId)}
              style={{ position: "absolute", top: `${p.topPct}%`, left: `${p.leftPct}%`,
                "--s": p.scale, transform: `translate(-50%,-50%) scale(${p.scale})`,
                transition: "top .5s ease-out, left .5s ease-out, transform .5s ease-out",
                animation: shaking ? "gb-shake .3s ease-in-out" : "none",
                background: "none", border: "none", cursor: canAct ? "pointer" : "default", textAlign: "center", zIndex: Math.round(p.topPct) }}>
              <MonsterArt monsterId={m.monsterId} icon={m.icon} size={MOB_SIZE}
                style={{ filter: isSel ? "drop-shadow(0 0 8px #f59e0b)" : "drop-shadow(0 3px 6px rgba(0,0,0,.6))" }} />
              <div style={{ fontSize: 9, fontWeight: 800, color: "#fecaca", whiteSpace: "nowrap", textShadow: "0 1px 3px #000" }}>{m.name}</div>
              <div style={{ width: 54, margin: "1px auto" }}><Bar cur={visualHp(m)} max={m.maxHp} /></div>
              <div style={{ fontSize: 9, fontWeight: 900, color: m.distance <= 1 ? "#ef4444" : "#fcd34d" }}>
                {m.distance <= 0 ? "⚔️攻擊!" : `距離 ${m.distance}`}
              </div>
              {isSel && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 900 }}>▲鎖定</div>}
            </button>
          );
        })}

        {/* 死亡殘影 */}
        {dying.map(d => (
          <div key={d.id} style={{ position: "absolute", top: `${d.pos.topPct}%`, left: `${d.pos.leftPct}%`, "--s": d.pos.scale,
            transform: `translate(-50%,-50%) scale(${d.pos.scale})`, animation: "gb-poof .82s ease-out forwards", pointerEvents: "none", zIndex: 80 }}>
            <MonsterArt monsterId={d.monsterId} icon={d.icon} size={MOB_SIZE} />
          </div>
        ))}

        {/* 飛行中的箭（從玩家位置飛向目標）*/}
        {arrows.map(a => (
          <div key={a.id} style={{ position: "absolute", top: `${a.top}%`, left: `${a.left}%`, transform: "translate(-50%,-50%) rotate(-45deg)",
            transition: `top ${T.arrowFly}ms linear, left ${T.arrowFly}ms linear`, fontSize: 20, pointerEvents: "none", zIndex: 85 }}>
            ➶
          </div>
        ))}

        {/* 浮動傷害數字 */}
        {floaters.map(f => (
          <div key={f.id} style={{ position: "absolute", top: `${f.topPct}%`, left: `${f.leftPct}%`, transform: "translate(-50%,0)",
            color: f.color, fontWeight: 900, fontSize: 15, textShadow: "0 2px 6px rgba(0,0,0,.8)",
            animation: "gb-float 1.3s ease-out forwards", pointerEvents: "none", zIndex: 95 }}>
            {f.text}
          </div>
        ))}

        {/* 玩家 + 出戰的真貓 */}
        <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 14, alignItems: "flex-end", zIndex: 70 }}>
          <HeroArt drawing={bowPull} size={72}
            style={{ animation: bowPull ? "gb-bowpull .32s ease-out" : "none", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.65))" }} />
          {(state.cats || []).map(c => (
            <div key={c.id} style={{ textAlign: "center", animation: pouncing.includes(c.id) ? "gb-pounce .52s ease-out" : "none" }}>
              <CatArt catId={c.id} icon={c.icon} size={52} style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,.6))" }} />
              <div style={{ fontSize: 9, fontWeight: 800, color: "#fcd34d", whiteSpace: "nowrap" }}>{c.name}</div>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>⚔️{c.atk}</div>
            </div>
          ))}
        </div>

        {flash && (
          <div key={flash} style={{ position: "absolute", top: 8, left: "50%", background: "rgba(0,0,0,.72)", padding: "5px 14px", borderRadius: 999,
            fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", animation: "gb-banner 3s ease-out forwards", zIndex: 96 }}>
            {flash}
          </div>
        )}
      </div>

      {/* 操作區 */}
      <div style={{ padding: "10px 12px", background: "rgba(0,0,0,.5)", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
          {state.status !== "fighting" ? "戰鬥結束"
            : animating ? "⚔️ 戰鬥進行中…"
            : target ? `已鎖定目標 · 已射 ${shots.length}/${ARROWS_PER_ROUND} 箭`
            : "點怪物選擇目標，再點分數射箭"}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
          {SCORE_BUTTONS.map(b => {
            const off = !canAct || !target || shots.length >= ARROWS_PER_ROUND;
            return (
              <button key={b.label} type="button" onClick={() => shoot(b.score)} disabled={off}
                style={{ flex: 1, minWidth: 40, padding: "8px 0", borderRadius: 8, fontWeight: 900, color: "#fff", border: "none",
                  background: b.color, opacity: off ? 0.4 : 1, cursor: off ? "not-allowed" : "pointer", transition: "opacity .2s" }}>
                {b.label}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={fireRound} disabled={!canAct}
          style={{ width: "100%", padding: "11px 0", borderRadius: 10, fontWeight: 900, fontSize: 14, color: "#fff", border: "none",
            background: animating ? "#475569" : "linear-gradient(135deg,#f59e0b,#b45309)", opacity: canAct ? 1 : 0.6, cursor: canAct ? "pointer" : "not-allowed" }}>
          {animating ? "⚔️ 交戰中…" : shots.length > 0 ? `發動回合（${shots.length} 箭）` : "跳過此回合"}
        </button>
      </div>
    </div>
  );
}
