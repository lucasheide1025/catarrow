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
import { attackRangeLabel, combatRoleLabel, combatStatLabel, counterConditionLabel, targetPolicyLabel } from "../domain/guildCombatLabels";
import { vibrate } from "../../lib/sound";
import { guildBattleSound as sound } from "./guildBattleSound";
import {
  GUILD_TARGET_FACE_OPTIONS,
  guildScoreButtons,
} from "./guildTargetFace";
import { MonsterArt, CatArt, fieldBg, bgLayer } from "./GuildArt";
import { GuildPlayerAppearance } from "./GuildItemArt";
import GuildDefenseLine from "./GuildDefenseLine";
import { buildBattleTimeline, guildBattleFinalizeDelay, retargetPendingShots } from "../domain/guildBattlePresentation";
const MAX_DIST = 10;

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
  eventStep: 700,
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
@keyframes gb-lunge { 0%,100%{transform:translate(-50%,-50%) scale(var(--s))} 45%{transform:translate(-50%,-30%) scale(calc(var(--s) * 1.18))} }
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
// 格位（lane, depth）→ 畫面座標。移動演出也用同一份公式，不要各算一次。
function gridPosAt(lane, depth) {
  const near = 1 - Math.min(MAX_DIST, Math.max(0, depth)) / MAX_DIST;
  return { topPct: 12 + near * 46, leftPct: 25 + lane * 25, scale: 0.8 + near * 0.6 };
}
function gridPosOf(monster, index, len) {
  if (!monster.position) return posOf(index, len, monster.distance);
  return gridPosAt(monster.position.lane, monster.position.depth);
}
const PLAYER_POS = { topPct: 88, leftPct: 50 };

// resumeState：斷線/關頁後回來續戰用（由上層從 localStorage 取出）。
// onPersist：每回合結束把最新狀態往上報，上層負責存檔——這樣「防斷線」的責任在一個地方，
//            戰鬥畫面本身不用知道存哪裡。
export default function GuildBattle({
  expedition,
  guildStats,
  supplies,
  cats = [],
  arrowsPerRound = 3,
  appearanceId = "tabby_ranger",
  targetFormat: lockedTargetFormat = "full_110",
  onEnd,
  onWaveClear,
  onTemporaryLeave,
  onArrowsShot,
  resumeState = null,
  onPersist,
  pauseBetweenWaves = false,
  missionMode = "assault",
}) {
  const [state, setState] = useState(() => resumeState || createExpeditionState(expedition, guildStats, supplies, cats, {
    arrowsPerRound, targetFormat: lockedTargetFormat, combatV2: true, missionMode,
  }));
  const ARROWS_PER_ROUND = state.arrowsPerRound || arrowsPerRound;
  const [target, setTarget] = useState(null);
  const [shots, setShots] = useState([]);
  const targetFormat = state.targetFormat || lockedTargetFormat;
  const scoreButtons = guildScoreButtons(targetFormat);
  const [flash, setFlash] = useState(null);        // 回合摘要橫幅
  const [animating, setAnimating] = useState(false);
  const [arrows, setArrows] = useState([]);        // 飛行中的箭 [{id, from, to, at}]
  const [floaters, setFloaters] = useState([]);    // 浮動數字 [{id, topPct,leftPct,text,color}]
  const [hitMap, setHitMap] = useState({});        // 動畫期間先扣的傷害 {instanceId: dmg}
  const [shakeIds, setShakeIds] = useState([]);    // 受擊抖動
  const [dying, setDying] = useState([]);          // 死亡殘影 [{id, pos, icon}]
  // 動畫期間已倒下的怪物 id。舊版整場都用開打前的 aliveTargets(state) 畫怪，被打死的
  // 會一直站到回合結束才整批消失，於是「已確認全部敵人陣亡」會在怪物還在場上時就先跳出來。
  const [downed, setDowned] = useState([]);
  const [pouncing, setPouncing] = useState([]);
  const [lunging, setLunging] = useState([]);      // 正在對玩家出手的怪物 id
  // 動畫期間的位置覆寫。畫面平常吃 state 的位置，但 state 要等回合結束才更新，
  // 所以推進要靠這份覆寫 + CSS transition 讓怪物滑過去。
  const [movedPos, setMovedPos] = useState({});    // 出爪的貓 id
  const [hurt, setHurt] = useState(false);         // 玩家受擊紅閃
  const [bowPull, setBowPull] = useState(false);   // 拉弓
  const [showTactics, setShowTactics] = useState(false);
  const [eventGate, setEventGate] = useState(() => resumeState?.eventGate || null);
  const timersRef = useRef([]);
  const seqRef = useRef(0);

  // 卸載時清掉所有排程，避免動畫跑到一半離開畫面還在 setState
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);
  const later = (fn, ms) => { timersRef.current.push(setTimeout(fn, ms)); };
  // 擊殺：立刻把怪物從場上移除，同時留一個殘影播消散動畫
  const killOnField = (instanceId, pos, dropOnField) => {
    dropOnField(instanceId);
    const gid = uid();
    setDying(d => [...d, { id: gid, pos, icon: pos.icon, monsterId: pos.monsterId }]);
    later(() => setDying(d => d.filter(x => x.id !== gid)), T.poof);
    sound.monsterDown();
  };
  const uid = () => `f${seqRef.current++}`;

  // targets＝state 上仍存活的怪，位置計算一律用這份完整清單（gridPosOf 的 fallback
  // posOf(index, len) 會吃 index 與長度，若邊播邊從清單移除，活著的怪會跳位）。
  // 動畫期間「已倒下」只在渲染時跳過，不從清單移除。
  const targets = aliveTargets(state);
  // 詞綴「夜戰」：距離超過 visionDepth 的敵人只看得到輪廓，不顯示名稱與血量。
  // 仍然可以鎖定——你知道那裡有東西，只是不知道是什麼，這才是壓力來源；
  // 全部藏起來會變成無法出手，那是懲罰不是設計。
  const visionDepth = Number(state.affixMods?.visionDepth) || 0;
  // 單挑：場上只有一隻，畫大一點才有壓迫感（同一個引擎，只是呈現不同）
  const isDuel = !!state.expedition?.isDuel;
  const isVeiled = m => visionDepth > 0 && (m.distance ?? 0) > visionDepth;
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

  const selectTarget = id => {
    if (!animating) {
      setTarget(id);
      setShots(current => retargetPendingShots(current, id));
      sound.tap();
    }
  };

  const shoot = scoreButton => {
    if (animating || !target || shots.length >= ARROWS_PER_ROUND || state.status !== "fighting") return;
    if (!targets.find(t => t.instanceId === target)) return;
    setShots(s => [...s, { targetInstanceId: target, score: scoreButton.score, rawScore: scoreButton.rawScore, scoreLabel: scoreButton.label, targetFormat }]);
    setBowPull(true);
    later(() => setBowPull(false), 320);
    sound.shoot();
  };

  // ── 一回合的演出時間軸 ──
  const fireRound = () => {
    if (animating || eventGate || state.status !== "fighting") return;
    const next = processRound(state, shots, { pauseBetweenWaves });
    // 射出去的箭要計進今日/終身箭數（公會遠征也是真的在射箭）
    if (shots.length) onArrowsShot?.(shots.length);
    setShots([]);
    setTarget(null);
    setAnimating(true);
    setFlash(null);
    setDowned([]);
    setMovedPos({});

    // 動畫要用「開打前」的位置，所以先把當下畫面的座標記下來
    const posMap = {};
    targets.forEach((m, i) => { posMap[m.instanceId] = { ...gridPosOf(m, i, targets.length), icon: m.icon, monsterId: m.monsterId }; });
    const posOrCenter = id => posMap[id] || { topPct: 40, leftPct: 50, scale: 1, icon: "❓" };

    // ── 依 log 原始順序播，不再按 type 分桶 ──────────────────────────────
    // domain 已經把技能反制／結算夾在對應那一箭之後、閃避與怪物攻擊逐隻交錯，
    // 分桶會把因果拆散（見 guildBattlePresentation.buildBattleTimeline 的註解）。
    const { timeline, totalMs } = buildBattleTimeline(next.log);
    const waveClear = next.log.find(l => l.type === "waveClear");
    const travelEvent = next.log.find(l => l.type === "travelEvent");
    const villagerAssist = next.log.find(l => l.type === "villagerAssist");
    const catAssisted = next.log.some(l => l.type === "catAttack");
    const gotHit = next.log.some(l => l.type === "monsterAttack");

    const dropOnField = id => setDowned(d => (d.includes(id) ? d : [...d, id]));

    for (const { entry: lg, at } of timeline) {
      switch (lg.type) {
        // ── 箭矢：飛行 → 命中 → 傷害數字 → 擊殺 ──
        case "arrow": {
          const p = posOrCenter(lg.target);
          later(() => {
            const id = uid();
            setArrows(a => [...a, { id, top: PLAYER_POS.topPct, left: PLAYER_POS.leftPct, extra: !!lg.extra }]);
            later(() => setArrows(a => a.map(x => x.id === id ? { ...x, top: p.topPct, left: p.leftPct } : x)), 20);
            later(() => setArrows(a => a.filter(x => x.id !== id)), T.arrowFly + 90);
          }, at);
          later(() => {
            if (lg.crit) { sound.critical(); vibrate(40); } else sound.hit();
            setHitMap(h => ({ ...h, [lg.target]: (h[lg.target] || 0) + lg.dmg }));
            shakeOnce(lg.target);
            // 爆擊＝LUK 的回饋，明講「幸運」玩家才知道那點 LUK 有用；
            // 額外箭＝AGI 的回饋，要標出來否則看起來只是多一發不明所以的箭。
            const tag = lg.extra ? "💨額外箭 " : lg.crit ? "🍀幸運 💥" : "";
            addFloater(p, `${tag}-${lg.dmg}`, lg.extra ? "#93c5fd" : lg.crit ? "#fbbf24" : "#fca5a5");
            if (lg.extra) setFlash("💨 敏捷發動：追加一箭！");
            if (lg.killed) killOnField(lg.target, p, dropOnField);
          }, at + T.arrowFly);
          break;
        }
        // ── 貓貓助攻 ──
        case "catAttack": {
          const p = posOrCenter(lg.target);
          later(() => {
            setPouncing(p2 => [...p2, lg.cat]);
            later(() => setPouncing(p2 => p2.filter(x => x !== lg.cat)), 520);
            sound.enemyAttack();
            setHitMap(h => ({ ...h, [lg.target]: (h[lg.target] || 0) + lg.dmg }));
            shakeOnce(lg.target);
            addFloater(p, `🐾-${lg.dmg}`, "#fcd34d");
            if (lg.killed) killOnField(lg.target, p, dropOnField);
          }, at);
          break;
        }
        // ── 怪物推進：讓玩家看見牠們一步步逼近 ──
        case "monsterMove":
          later(() => {
            setMovedPos(m => ({ ...m, [lg.id]: gridPosAt(lg.lane, lg.to) }));
            if (lg.to === 0) { sound.hazard(); vibrate(24); }   // 逼到貼身要有警訊
          }, at);
          break;
        case "dodge":
          later(() => addFloater({ topPct: PLAYER_POS.topPct - 8, leftPct: PLAYER_POS.leftPct }, "MISS", "#93c5fd"), at);
          break;
        // ── 怪物攻擊：要看得出「誰打的、從多近」──
        // 舊版只有玩家身上一個 -N 紅字，玩家不知道是哪隻怪、也感覺不到距離差異。
        case "monsterAttack": {
          const from = posOrCenter(lg.from);
          later(() => {
            // 發動者往玩家方向撲一下（近戰貼身時幅度最大）
            setLunging(l => [...l, lg.from]);
            later(() => setLunging(l => l.filter(x => x !== lg.from)), 480);
            shakeOnce(lg.from);
            addFloater(from, lg.contact ? "‼️ 貼身" : `距離 ${lg.distance}`, lg.contact ? "#f87171" : "#fbbf24");
            lg.contact ? sound.critical() : sound.catAssist();
            vibrate(lg.contact ? 90 : 60);
            setHurt(true);
            later(() => setHurt(false), 520);
            addFloater(
              { topPct: PLAYER_POS.topPct - 10, leftPct: PLAYER_POS.leftPct },
              `${lg.contact ? "‼️" : ""}-${lg.dmg}`,
              lg.contact ? "#dc2626" : "#ef4444",
            );
          }, at);
          break;
        }
        case "starve":
          later(() => {
            sound.hazard();
            addFloater({ topPct: PLAYER_POS.topPct - 18, leftPct: PLAYER_POS.leftPct }, `🍖💧 力竭 -${lg.dmg}`, "#f87171");
          }, at);
          break;
        // ── 清波後旅途事件：補給／HP 變化要看得見，否則像資源憑空消失 ──
        case "travelEvent": {
          const deltas = [
            lg.food ? `🍖${lg.food > 0 ? "+" : ""}${lg.food}` : "",
            lg.water ? `💧${lg.water > 0 ? "+" : ""}${lg.water}` : "",
            lg.hp ? `❤️${lg.hp > 0 ? "+" : ""}${lg.hp}` : "",
          ].filter(Boolean).join(" ");
          later(() => {
            lg.hp < 0 ? sound.hazard() : sound.waveClear();
            setFlash(`🧭 ${lg.label}${deltas ? `　${deltas}` : ""}`);
          }, at);
          break;
        }
        case "villagerAssist":
          later(() => { sound.waveClear(); setFlash(`🏘️ ${lg.label}：${lg.summary || "協助完成"}`); }, at);
          break;
        // ── 強技能預告：spec 要求「提前一個射擊階段預告」，舊版完全沒演出 ──
        case "skillIntent": {
          const p = posOrCenter(lg.monsterId);
          later(() => {
            sound.hazard(); vibrate(30);
            shakeOnce(lg.monsterId);
            addFloater(p, "⚠️", "#fbbf24");
            const counter = lg.intent?.counter ? `　破解：${counterConditionLabel(lg.intent.counter)}` : "";
            setFlash(`⚠️ 敵方蓄力：${lg.intent?.name || "強力技能"}（下回合發動）${counter}`);
          }, at);
          break;
        }
        case "skillResolve":
          later(() => {
            sound.hazard();
            setFlash(`💥 ${lg.skill} 發動${lg.damage ? `，造成 ${lg.damage} 傷害` : ""}`);
          }, at);
          break;
        case "counterSuccess":
          later(() => { sound.waveClear(); setFlash(`✅ 反制成功：${lg.skill}`); }, at);
          break;
        case "effectRemove":
          later(() => setFlash(`狀態解除：${combatStatLabel(lg.effect?.stat)}`), at);
          break;
        case "effectApply":
        case "effectReplace":
          later(() => setFlash(`狀態變化：${combatStatLabel(lg.effect?.stat)} ${lg.effect?.value > 0 ? "+" : ""}${lg.effect?.value || ""}`), at);
          break;
        default:
          break;  // travelSupply/defenseSpawn 等不需要獨立演出
      }
    }

    const visualEnd = totalMs + T.hitLinger;
    // 勝利確認橫幅必須等場上真的清空才跳——舊版在怪物還站著時就先喊「已確認全部敵人陣亡」
    if (next.status === "won") {
      later(() => setFlash("✅ 已確認全部敵人陣亡"), visualEnd);
    }
    // ── 收尾 ──
    later(() => {
      setHitMap({});
      setDowned([]);
      setMovedPos({});
      setState(next);
      onPersist?.(next);          // 每回合落地一次：關掉 App 再回來能從這一回合續戰
      setAnimating(false);
      if (villagerAssist) setEventGate(villagerAssist);
      const kills = next.log.filter(l => (l.type === "arrow" || l.type === "catAttack") && l.killed).length;
      if (next.status === "won") { setFlash("🎉 討伐成功，凱旋歸來！"); sound.victory(); }
      else if (next.status === "lost") { setFlash(`💀 ${next.lostReason}`); sound.defeat(); }
      else {
        if (waveClear && !travelEvent) { setFlash(`✅ 清空一波！第 ${waveClear.nextWave + 1} 波來了`); sound.waveClear(); }
        else setFlash(`本回合擊殺 ${kills} 隻${catAssisted ? "（貓貓助攻）" : ""}${gotHit ? "，你受到攻擊！" : ""}`);
      }
      if (next.status === "waveCleared") {
        later(() => onWaveClear?.(next), T.endPause + 500);
      } else if (next.status !== "fighting") {
        later(() => onEnd?.(next), T.endPause + 1200);
      }
    }, guildBattleFinalizeDelay(next.status, visualEnd));
  };

  const canAct = state.status === "fighting" && !animating && !eventGate;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#0a1a0a,#05100a)", color: "#e2e8f0" }}>
      <style>{KEYFRAMES}</style>

      {/* 頂列：回合 + 補給 */}
      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,.35)" }}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>第 {state.round} 回合 · {
          missionMode === "assault"
            ? `第 ${state.waveIndex + 1}/${state.expedition.totalWaves} 波`
            : missionMode === "defense"
              ? "據點防守中"
              : state.waveIndex + 1 >= state.expedition.totalWaves ? "最終遠征目標" : "隨機戰鬥事件"
        }</div>
        <div style={{ fontSize: 11, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: state.supplies.food <= 1 ? "#f87171" : undefined }}>🍖 {state.supplies.food}</span>
          <span style={{ color: state.supplies.water <= 1 ? "#f87171" : undefined }}>💧 {state.supplies.water}</span>
          <button
            type="button"
            disabled={animating}
            title={shots.length ? "尚未發動的箭不會計入回合" : "保存進度並回到公會"}
            onClick={() => onTemporaryLeave?.(state)}
            style={{ padding: "4px 8px", borderRadius: 7, border: "1px solid rgba(255,255,255,.12)", background: "#334155", color: "#e2e8f0", fontSize: 10, fontWeight: 800, cursor: animating ? "not-allowed" : "pointer", opacity: animating ? .5 : 1 }}
          >
            暫時離開
          </button>
        </div>
      </div>
      <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,.25)" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fca5a5", minWidth: 64 }}>❤️ {state.hp}/{state.maxHp}</span>
        <div style={{ flex: 1 }}><Bar cur={state.hp} max={state.maxHp} color="#22c55e" h={7} /></div>
      </div>
      {Object.values(state.effects || {}).filter(effect => effect.targetId === "player").length > 0 && (
        <div style={{ padding: "4px 12px", display: "flex", gap: 5, background: "rgba(15,23,42,.92)" }}>
          {Object.values(state.effects).filter(effect => effect.targetId === "player").map((effect, index) => (
            <span key={`${effect.stat}-${index}`} style={{ padding: "2px 6px", borderRadius: 999, fontSize: 9.5,
              background: effect.value > 0 ? "rgba(34,197,94,.22)" : "rgba(239,68,68,.22)",
              color: effect.value > 0 ? "#86efac" : "#fca5a5" }}>
              {effect.value > 0 ? "▲" : "▼"} {combatStatLabel(effect.stat)} {effect.value > 0 ? "+" : ""}{effect.value}・剩餘 {effect.duration} 回合
            </span>
          ))}
        </div>
      )}
      {missionMode === "defense" && state.defense && (
        <div style={{ padding: "6px 12px", display: "flex", justifyContent: "space-between", gap: 10, background: "rgba(69,10,10,.72)", fontSize: 10 }}>
          <b>防守時間 {state.defense.clock}/{state.defense.duration}</b>
          <span style={{ color: "#cbd5e1" }}>視距外敵軍 {state.defense.queue.length}</span>
        </div>
      )}

      {/* 2.5D 戰場 */}
      <div style={{ position: "relative", flex: 1, minHeight: 360, overflow: "hidden",
        ...bgLayer(fieldBg(state.expedition?.family || state.monsters?.[0]?.family), { overlay: "rgba(6,10,6,.42)" }) }}>
        {/* 下緣壓暗，讓玩家/貓/UI 跟地面分層 */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.15) 0%,transparent 35%,rgba(0,0,0,.65) 100%)", pointerEvents: "none" }} />
        {state.combatVersion === 2 && (
          <div style={{ position: "absolute", top: "9%", left: "12.5%", right: "12.5%", height: "52%", display: "grid",
            gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(6,1fr)", pointerEvents: "none", opacity: .22 }}>
            {Array.from({ length: 18 }, (_, index) => <div key={index} style={{ border: "1px solid #cbd5e1" }} />)}
          </div>
        )}
        <button type="button" onClick={() => setShowTactics(true)} disabled={animating}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 97, padding: "6px 9px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,.2)", background: "rgba(15,23,42,.9)", color: "#e2e8f0", fontSize: 10, fontWeight: 900 }}>
          📋 怪物情報
        </button>

        {/* 玩家受擊紅閃 */}
        {hurt && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle,transparent 30%,#ef4444 130%)", animation: "gb-hurt .52s ease-out", pointerEvents: "none", zIndex: 90 }} />}

        {/* 怪物 */}
        {targets.map((m, i) => {
          if (downed.includes(m.instanceId)) return null;   // 動畫中已倒下：不渲染，但保留它的索引位置
          const p = movedPos[m.instanceId] || gridPosOf(m, i, targets.length);
          const isSel = target === m.instanceId;
          const shaking = shakeIds.includes(m.instanceId);
          const veiled = isVeiled(m);
          return (
            <button key={m.instanceId} type="button" onClick={() => selectTarget(m.instanceId)}
              style={{ position: "absolute", top: `${p.topPct}%`, left: `${p.leftPct}%`,
                "--s": p.scale, transform: `translate(-50%,-50%) scale(${p.scale})`,
                transition: "top .5s ease-out, left .5s ease-out, transform .5s ease-out",
                animation: lunging.includes(m.instanceId) ? "gb-lunge .48s ease-out"
                  : shaking ? "gb-shake .3s ease-in-out" : "none",
                background: "none", border: "none", cursor: canAct ? "pointer" : "default", textAlign: "center", zIndex: Math.round(p.topPct) }}>
              {veiled ? (
                <div style={{ width: MOB_SIZE, height: MOB_SIZE, display: "grid", placeItems: "center",
                  fontSize: MOB_SIZE * 0.5, color: "#1e293b",
                  filter: "drop-shadow(0 0 10px rgba(129,140,248,.55))" }}>❔</div>
              ) : (
                <MonsterArt monsterId={m.monsterId} icon={m.icon} size={isDuel ? Math.round(MOB_SIZE * 1.6) : MOB_SIZE}
                  style={{ filter: isSel ? "drop-shadow(0 0 8px #f59e0b)" : "drop-shadow(0 3px 6px rgba(0,0,0,.6))" }} />
              )}
              <div style={{ fontSize: 9, fontWeight: 800, color: veiled ? "#818cf8" : "#fecaca", whiteSpace: "nowrap", textShadow: "0 1px 3px #000" }}>
                {veiled ? "？？？" : m.name}
              </div>
              {!veiled && <div style={{ width: 54, margin: "1px auto" }}><Bar cur={visualHp(m)} max={m.maxHp} /></div>}
              <div style={{ fontSize: 9, fontWeight: 900, color: m.distance === 0 ? "#dc2626" : m.distance <= 1 ? "#ef4444" : "#fcd34d" }}>
                {veiled ? "🌙 視線之外"
                  : m.distance === 0 ? "‼️貼身（重擊）"
                  : m.distance <= (m.attackRange || 0) ? `⚔️射程內（距離 ${m.distance}）`
                  : `距離 ${m.distance} 公尺`}
              </div>
              {m.combatRole && <div style={{ fontSize: 8.5, color: "#bfdbfe", fontWeight: 800 }}>
                {combatRoleLabel(m.combatRole)}・移動 {m.moveSpeed}・射程 {attackRangeLabel(m.attackRange)}
              </div>}
              {m.intent && <div style={{ marginTop: 2, padding: "2px 5px", borderRadius: 999, background: "#991b1b", color: "#fee2e2", fontSize: 8.5, fontWeight: 900 }}>
                ⚠️ {m.intent.name}<br />破解：{counterConditionLabel(m.intent.counter, targetFormat)}
              </div>}
              {Object.values(state.effects || {}).filter(effect => effect.targetId === m.instanceId).map((effect, index) => (
                <div key={`${effect.stat}-${index}`} style={{ fontSize: 8, color: effect.value > 0 ? "#86efac" : "#fca5a5" }}>
                  {effect.value > 0 ? "▲" : "▼"}{combatStatLabel(effect.stat)}・剩餘 {effect.duration} 回合
                </div>
              ))}
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
            transition: `top ${T.arrowFly}ms linear, left ${T.arrowFly}ms linear`, fontSize: 20, pointerEvents: "none", zIndex: 85,
            color: a.extra ? "#93c5fd" : undefined,
            filter: a.extra ? "drop-shadow(0 0 6px #60a5fa)" : undefined }}>
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

        {missionMode === "defense" && <GuildDefenseLine defense={state.defense} />}

        {/* 玩家 + 出戰的真貓 */}
        <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 14, alignItems: "flex-end", zIndex: 70 }}>
          <GuildPlayerAppearance appearanceId={appearanceId} size={72}
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
        {showTactics && (
          <div role="dialog" aria-modal="true" aria-label="怪物情報"
            style={{ position: "absolute", inset: 0, zIndex: 110, background: "rgba(2,6,23,.88)", padding: 14, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <b style={{ color: "#fbbf24" }}>📋 戰場怪物情報</b>
              <button type="button" onClick={() => setShowTactics(false)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#334155", color: "#fff" }}>關閉</button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {targets.slice().sort((a, b) => a.distance - b.distance).map(monster => (
                <button key={monster.instanceId} type="button" onClick={() => { selectTarget(monster.instanceId); setShowTactics(false); }}
                  style={{ padding: 10, borderRadius: 10, border: `1px solid ${target === monster.instanceId ? "#f59e0b" : "rgba(255,255,255,.12)"}`,
                    background: "#111827", color: "#e2e8f0", textAlign: "left" }}>
                  <div style={{ fontWeight: 900 }}>{monster.icon} {monster.name}</div>
                  <div style={{ marginTop: 4, fontSize: 10.5, color: "#cbd5e1" }}>
                    類型：{combatRoleLabel(monster.combatRole)}　路線 {(monster.position?.lane ?? 0) + 1}　距離 {monster.distance} 公尺<br />
                    移動 {monster.moveSpeed || 1} 格　攻擊射程 {attackRangeLabel(monster.attackRange)}　目標：{targetPolicyLabel(monster.targetPolicy)}<br />
                    生命 {monster.hp}/{monster.maxHp}　攻擊 {monster.atk}　防禦 {monster.def}
                  </div>
                  {monster.intent && <div style={{ marginTop: 5, padding: 7, borderRadius: 8, background: "rgba(127,29,29,.45)", color: "#fecaca", fontSize: 10 }}>
                    <b>準備發動：{monster.intent.name}</b><br />
                    目標：{targetPolicyLabel(monster.intent.target)}・結果：{monster.intent.consequence}<br />
                    破解：{counterConditionLabel(monster.intent.counter, targetFormat)}
                  </div>}
                  <div style={{ marginTop: 5, color: monster.distance <= (monster.attackRange || 0) ? "#fca5a5" : "#93c5fd", fontSize: 10, fontWeight: 800 }}>
                    {monster.distance <= (monster.attackRange || 0) ? "⚠️ 下一次行動可攻擊" : `➡️ 預計前進 ${monster.moveSpeed || 1} 格`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {eventGate && (
          <div role="dialog" aria-modal="true" style={{ position: "absolute", inset: 0, zIndex: 120, background: "rgba(2,6,23,.9)",
            display: "grid", placeItems: "center", padding: 20 }}>
            <div style={{ maxWidth: 360, padding: 18, borderRadius: 16, background: "#172033", border: "1px solid #fbbf24", textAlign: "center" }}>
              <div style={{ fontSize: 30 }}>🏘️</div>
              <div style={{ marginTop: 6, color: "#fbbf24", fontWeight: 900, fontSize: 17 }}>{eventGate.label}</div>
              <div style={{ marginTop: 7, color: "#cbd5e1", fontSize: 11, lineHeight: 1.6 }}>
                {eventGate.summary || "村民已完成這次協助。"}
              </div>
              {eventGate.targets?.length > 0 && (
                <div style={{ marginTop: 10, display: "grid", gap: 6, textAlign: "left" }}>
                  {eventGate.targets.map(result => (
                    <div key={result.instanceId} style={{ padding: "7px 9px", borderRadius: 8, background: "rgba(15,23,42,.8)", fontSize: 11 }}>
                      <b>{result.name}</b>
                      <span style={{ float: "right", color: result.defeated ? "#fca5a5" : "#fde68a", fontWeight: 900 }}>{result.defeated ? "擊倒" : `-${result.damage}`}</span>
                      <div style={{ marginTop: 3, color: "#94a3b8" }}>生命 {result.hpBefore} → {result.hpAfter}{result.pushed ? `・擊退 ${result.pushed} 格` : ""}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 9, color: "#94a3b8", fontSize: 10.5 }}>協助結束後村民已離場；確認前戰鬥保持暫停。</div>
              <button type="button" onClick={() => {
                const cleared = { ...state, eventGate: null };
                setState(cleared);
                setEventGate(null);
                onPersist?.(cleared);
              }}
                style={{ marginTop: 14, width: "100%", padding: 10, borderRadius: 10, border: "none", background: "#b45309", color: "#fff", fontWeight: 900 }}>
                確認結果・繼續防守
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 操作區 */}
      <div style={{ padding: "10px 12px", background: "rgba(0,0,0,.5)", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9, color: "#64748b", marginBottom: 2 }}>本次遠征鎖定靶紙</div>
            <select value={targetFormat} disabled
              style={{ width: "100%", minHeight: 36, borderRadius: 9, border: "1px solid rgba(255,255,255,.15)", background: "#1e293b", color: "#f8fafc", padding: "0 9px", fontWeight: 800, opacity: .82 }}>
              {GUILD_TARGET_FACE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          <div style={{ padding: "7px 9px", borderRadius: 10, background: "rgba(255,255,255,.06)", textAlign: "center" }}>
            <div style={{ color: "#fcd34d", fontSize: 14, fontWeight: 900 }}>{shots.length}/{ARROWS_PER_ROUND}</div>
            <div style={{ color: "#64748b", fontSize: 8 }}>箭數</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 7 }}>
          {state.status !== "fighting" ? "戰鬥結束"
            : animating ? "⚔️ 戰鬥進行中…"
            : target ? `已鎖定目標 · 已射 ${shots.length}/${ARROWS_PER_ROUND} 箭`
            : "點怪物選擇目標，再點分數射箭"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(42px,1fr))", gap: 5, marginBottom: 9 }}>
          {scoreButtons.map(b => {
            const off = !canAct || !target || shots.length >= ARROWS_PER_ROUND;
            return (
              <button key={b.label} type="button" onClick={() => shoot(b)} disabled={off}
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
