// src/components/member/CatVillageBoard.jsx
// 貓貓村大富翁探索地圖（Phase 1a 單人）。全螢幕 overlay。
// 規格見 docs/second_brain/village-board-spec.md。
import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribeBoardState, ensureDailyDice, setBoardSession, rollAndMove,
  settleBoardTile, applyEventEffect, setBoardPos, refillBoardDice, DAILY_DICE,
} from "../../lib/villageBoardDb";
import { useAuth } from "../../hooks/useAuth";
import { BOARD_LAYOUT, BOARD_SIZE, TILE_TYPES, BOARD_MODES, getModeTierCap } from "../../lib/boardData";
import { drawBoardEvent } from "../../lib/boardEvents";
import { sfxTap, sfxSuccess, sfxCast } from "../../lib/sound";
import { MATERIALS } from "../../lib/monsterMaterials";
import { RESOURCE_NAMES } from "../../lib/villageData";
import { addRoundArrows } from "../../lib/db";

const MAT_BY_ID = Object.fromEntries(MATERIALS.map(m => [m.id, m]));
const RES_ICON = { ore:"⛏️", melon:"🍈", fish:"🐟", meat:"🍖", driedfish:"🐠", can:"🥫", fur:"🧶", arrowdew:"💧" };

// 把 reward descriptor 解析成 [{icon,name,amount}] 詳細清單
function describeReward(rw) {
  if (!rw) return [];
  const out = [];
  if (rw.coins) out.push({ icon: "🪙", name: "金幣", amount: rw.coins });
  if (rw.arrowdew) out.push({ icon: "💧", name: "箭露", amount: rw.arrowdew });
  if (rw.gachaToken) out.push({ icon: "🎰", name: "扭蛋幣", amount: rw.gachaToken });
  Object.entries(rw.familyMaterials || {}).forEach(([id, n]) => {
    const m = MAT_BY_ID[id];
    out.push({ icon: m?.icon || "🧩", name: m?.name || id, amount: n });
  });
  Object.entries(rw.villageResources || {}).forEach(([k, n]) => {
    out.push({ icon: RES_ICON[k] || "📦", name: RESOURCE_NAMES[k] || k, amount: n });
  });
  (rw.chests || []).forEach(() => out.push({ icon: "🎁", name: "寶箱", amount: 1 }));
  (rw.potions || []).forEach(() => out.push({ icon: "🧪", name: "藥水", amount: 1 }));
  if (rw.catXP) out.push({ icon: "🐱", name: "貓咪經驗", amount: rw.catXP });
  if (rw.catBond) out.push({ icon: "💕", name: "羈絆", amount: rw.catBond });
  return out;
}
// 累加多個 reward 成 session 總計（同名合併）
function mergeRewards(base, rw) {
  const acc = base || {};
  describeReward(rw).forEach(({ icon, name, amount }) => {
    const key = name;
    acc[key] = acc[key] ? { ...acc[key], amount: acc[key].amount + amount } : { icon, name, amount };
  });
  return acc;
}

const ASSET = "/assets/board";

// 8×8 格：邊框 28 格順時針，index 0 起點在左上。回傳 CSS grid 的 {row,col}（1-based）
function gridPos(i) {
  if (i < 8) return { row: 1, col: i + 1 };
  if (i < 15) return { row: i - 8 + 2, col: 8 };
  if (i < 22) return { row: 8, col: 7 - (i - 15) };
  return { row: 7 - (i - 22), col: 1 };
}

// tile 圖示：img + emoji fallback（作者指示少用 SVG）
function TileIcon({ type, size = 30 }) {
  const [failed, setFailed] = useState(false);
  const meta = TILE_TYPES[type] || {};
  if (!failed) {
    return <img src={`${ASSET}/tile_${type}.webp`} alt="" width={size} height={size}
      onError={() => setFailed(true)} className="object-contain" draggable={false} />;
  }
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{meta.icon || "❔"}</span>;
}

const SCORE_PAD = [["X", 10], ["10", 10], ["9", 9], ["8", 8], ["7", 7], ["6", 6], ["5", 5], ["3", 3], ["M", 0]];

export default function CatVillageBoard({ profile, onClose, onTeam }) {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const myId = profile?.id;
  const villageBuildings = profile?.village?.buildings || {};
  const catId = profile?.equippedCat?.catId || null;

  const [board, setBoard] = useState(null);
  const [selecting, setSelecting] = useState(true);      // 前頁：選採集地圖(族)+T階
  const [selMode, setSelMode] = useState(BOARD_MODES[0].id);
  const [selTier, setSelTier] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [displayPos, setDisplayPos] = useState(0);      // 動畫用的當前顯示位置
  const [toast, setToast] = useState(null);
  const [shootTile, setShootTile] = useState(null);      // 6 箭格：{type}
  const [arrows, setArrows] = useState([]);
  const [eventCard, setEventCard] = useState(null);      // { event, flipped }
  const [diceAnim, setDiceAnim] = useState(null);        // 擲骰動畫顯示的數字
  const [rewardPopup, setRewardPopup] = useState(null);  // { items:[{icon,name,amount}], band }
  const [showSummary, setShowSummary] = useState(false); // 骰子用完的總結算
  const sessionRef = useRef({});                         // 本次 session 累計獎勵
  const busyRef = useRef(false);

  // 顯示獎勵詳細 + 累加到 session
  const showReward = useCallback((reward, band) => {
    sessionRef.current = mergeRewards(sessionRef.current, reward);
    const items = describeReward(reward);
    if (items.length) setRewardPopup({ items, band });
  }, []);

  useEffect(() => {
    if (!myId) return;
    ensureDailyDice(myId);
    const unsub = subscribeBoardState(myId, s => { setBoard(s); });
    return unsub;
  }, [myId]);

  // 同步棋子位置到 Firestore；但動畫進行中（busyRef）不可搶跑，
  // 否則 rollAndMove 一寫入 boardPos，棋子會在骰子還沒出數字前就瞬移到終點。
  useEffect(() => { if (board && !busyRef.current) setDisplayPos(board.boardPos || 0); }, [board?.boardPos]);

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(null), 2600); };

  const pendingSummaryRef = useRef(false);
  const flushSummary = useCallback(() => {
    if (pendingSummaryRef.current) { pendingSummaryRef.current = false; setTimeout(() => setShowSummary(true), 700); }
  }, []);

  const settle = useCallback(async (tileType) => {
    const meta = TILE_TYPES[tileType];
    if (meta?.shooting) { setShootTile({ type: tileType }); setArrows([]); return; }
    if (tileType === "fate" || tileType === "opp") {
      const ev = drawBoardEvent(tileType);
      setEventCard({ event: ev, flipped: false });
      setTimeout(() => setEventCard(c => c && { ...c, flipped: true }), 550);
      return;
    }
    const res = await settleBoardTile(myId, tileType, { villageBuildings, catId });
    if (res?.ok) { sfxSuccess(); showReward(res.reward); }
    busyRef.current = false;
    flushSummary();
  }, [myId, villageBuildings, catId, showReward, flushSummary]);

  // 骰 → 逐格動畫 → 落點結算
  const handleRoll = useCallback(async () => {
    if (rolling || busyRef.current || !board || (board.dice || 0) <= 0) return;
    busyRef.current = true; setRolling(true); sfxCast();
    const res = await rollAndMove(myId);
    if (!res?.ok) { showToast(res?.reason || "無法擲骰"); setRolling(false); busyRef.current = false; return; }
    pendingSummaryRef.current = (res.diceLeft ?? 0) <= 0;
    // 擲骰動畫：快速跳數字 ~0.8s 定格在 res.roll
    setDiceAnim(1);
    await new Promise(resolve => {
      const end = Date.now() + 800;
      const iv = setInterval(() => {
        if (Date.now() >= end) { clearInterval(iv); setDiceAnim(res.roll); sfxSuccess(); resolve(); }
        else setDiceAnim(1 + Math.floor(Math.random() * 6));
      }, 80);
    });
    await new Promise(r => setTimeout(r, 550));
    setDiceAnim(null);
    // 逐格前進動畫
    let cur = res.from;
    for (let s = 0; s < res.roll; s++) {
      cur = (cur + 1) % BOARD_SIZE;
      setDisplayPos(cur);
      sfxTap();
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 230));
    }
    setRolling(false);
    if (res.lapped) showToast("🏁 繞完一圈！");
    // 落點停頓：讓「踩到格子上」看得清楚，才觸發事件/結算（避免一瞬間就過去）
    await new Promise(r => setTimeout(r, 750));
    await settle(res.tile);
  }, [rolling, board, myId, settle]);

  // 6 箭計分完成
  const finishShoot = useCallback(async () => {
    if (arrows.length < 6) return;
    const ratio = arrows.reduce((s, v) => s + v, 0) / (6 * 10);
    const type = shootTile.type;
    setShootTile(null);
    addRoundArrows(myId, 6).catch(() => {}); // 射箭格＝射出 6 箭，累積今日/終身箭數與里程碑
    const res = await settleBoardTile(myId, type, { villageBuildings, catId, scoreRatio: ratio });
    if (res?.ok) { sfxSuccess(); showReward(res.reward, res.reward.band); }
    busyRef.current = false;
    flushSummary();
  }, [arrows, shootTile, myId, villageBuildings, catId, showReward, flushSummary]);

  // 事件卡效果套用
  const applyEvent = useCallback(async () => {
    const ev = eventCard?.event; setEventCard(null);
    if (!ev) { busyRef.current = false; return; }
    const r = await applyEventEffect(myId, ev, { villageBuildings, catId });
    // 需要 UI 反應的效果
    if (r.kind === "move") { const np = (((board.boardPos + r.steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE; await setBoardPos(myId, np); setDisplayPos(np); await settle(BOARD_LAYOUT[np]); return; }
    if (r.kind === "teleport") { const np = nearestTile(board.boardPos, r.tile); await setBoardPos(myId, np); setDisplayPos(np); await settle(BOARD_LAYOUT[np]); return; }
    if (r.kind === "trigger") { await settle(r.event); return; }
    if (r.kind === "gain") showToast(`獲得 ${r.amount} ${resName(r.resource)}`);
    else if (r.kind === "lose") showToast(`失去 ${r.amount} ${resName(r.resource)}`);
    else if (r.kind === "dice") showToast(r.delta > 0 ? `🎲 +${r.delta} 骰` : "😴 暫停一回合");
    else if (r.kind === "flavor") showToast("😸 " + (ev.text.length > 14 ? "會心一笑" : ev.text));
    else sfxSuccess();
    busyRef.current = false;
    flushSummary();
  }, [eventCard, myId, villageBuildings, catId, board, settle, flushSummary]);

  if (!board) return null;

  // ── 前頁：選擇採集地圖(族) + T階 ──
  if (selecting) {
    const cap = getModeTierCap(selMode, villageBuildings);
    const tiers = Array.from({ length: cap }, (_, i) => i + 1);
    const m = BOARD_MODES.find(x => x.id === selMode) || BOARD_MODES[0];
    return (
      <div className="fixed inset-0 z-[200] flex flex-col overflow-y-auto"
        style={{ backgroundColor: "#140a04", backgroundImage: `linear-gradient(rgba(18,10,4,0.82),rgba(12,7,3,0.93)), url(${ASSET}/board_bg.webp)`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="w-full max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
            <div className="text-amber-100 font-black">🗺️ 選擇採集地圖</div>
            <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {board.dice}</div>
          </div>
          <div className="text-amber-200/80 text-xs font-bold mb-2">① 要刷哪一族的資源？</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {BOARD_MODES.map(mo => (
              <button key={mo.id} onClick={() => { setSelMode(mo.id); setSelTier(1); }}
                className={`rounded-2xl p-3 text-left border-2 transition ${mo.id === selMode ? "border-amber-300 scale-[1.02]" : "border-amber-500/20"}`}
                style={{ background: `linear-gradient(135deg, ${mo.palette?.[0] || "#334155"}, ${mo.palette?.[1] || "#0f172a"})` }}>
                <div className="text-white font-black text-sm">{mo.icon} {mo.familyName}</div>
                <div className="text-white/70 text-[11px] mt-0.5">{mo.name}・{mo.resourceName}</div>
              </button>
            ))}
          </div>
          <div className="text-amber-200/80 text-xs font-bold mb-2">② 進入哪個階級？<span className="text-amber-200/50 font-normal">（上限由「{m.name}」建築等級決定）</span></div>
          {tiers.length === 0 ? (
            <div className="text-rose-300/80 text-xs mb-5 bg-rose-900/20 border border-rose-500/20 rounded-xl px-3 py-2">此地圖尚未解鎖，請先在貓貓村升級「{m.name}」建築。</div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-6">
              {tiers.map(t => (
                <button key={t} onClick={() => setSelTier(t)}
                  className={`px-4 py-2 rounded-xl font-black text-sm border-2 ${t === selTier ? "bg-amber-400 text-slate-900 border-amber-300" : "bg-black/30 text-amber-100 border-amber-500/20"}`}>T{t}</button>
              ))}
            </div>
          )}
          <button disabled={tiers.length === 0} onClick={async () => { await setBoardSession(myId, selMode, selTier); sessionRef.current = {}; setSelecting(false); }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-base shadow-lg active:scale-95 disabled:opacity-40">
            🎲 進入 {m.familyName} T{selTier} 探索
          </button>
          {onTeam && (
            <button onClick={onTeam} className="w-full mt-2 py-2.5 rounded-2xl bg-black/30 border border-amber-400/30 text-amber-100 font-black text-sm active:scale-95">
              👥 改玩組隊探索
            </button>
          )}
        </div>
      </div>
    );
  }

  const mode = BOARD_MODES.find(m => m.id === board.mode) || BOARD_MODES[0];

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto"
      style={{ backgroundColor: "#140a04", backgroundImage: `linear-gradient(rgba(18,10,4,0.72),rgba(12,7,3,0.9)), url(${ASSET}/board_bg.webp)`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      {/* 頂列 */}
      <div className="w-full max-w-lg flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
        <div className="text-amber-100 font-black text-sm">🎲 貓貓村探索地圖</div>
        <div className="flex items-center gap-1.5">
          {isAdmin && (
            <button onClick={() => refillBoardDice(myId)} title="測試用：補滿骰子"
              className="rounded-lg bg-emerald-600/70 border border-emerald-400/40 px-2 py-1 text-emerald-50 text-[10px] font-black">🔄補骰</button>
          )}
          <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {board.dice}/{DAILY_DICE}</div>
        </div>
      </div>

      {/* 當前地圖 + 換地圖 */}
      <div className="w-full max-w-lg px-3 flex items-center justify-center gap-2 mb-1">
        <div className="rounded-xl bg-black/30 border border-amber-500/25 px-3 py-1 text-amber-100 text-xs font-black">{mode.icon} {mode.familyName} · T{board.tier || 1}</div>
        <button onClick={() => setSelecting(true)}
          className="rounded-xl bg-amber-500/20 border border-amber-400/30 px-2.5 py-1 text-amber-200 text-xs font-bold">🗺️ 換地圖</button>
      </div>

      {/* 8×8 棋盤（羊皮紙金框） */}
      <div className="w-full max-w-lg p-3">
        <div className="w-full rounded-[26px] p-2.5"
          style={{ background: "linear-gradient(145deg,#d4a017,#8a5a12)", boxShadow: "0 12px 34px rgba(0,0,0,.6), inset 0 0 0 3px rgba(253,230,138,.55), inset 0 0 0 6px rgba(120,53,15,.5)" }}>
          <div className="grid aspect-square w-full rounded-2xl p-1.5"
            style={{ gridTemplateColumns: "repeat(8,1fr)", gridTemplateRows: "repeat(8,1fr)", gap: 4, background: "linear-gradient(160deg,#2a1a0c,#1a0f06)", boxShadow: "inset 0 0 24px rgba(0,0,0,.7)" }}>
          {/* 中央地圖/資訊 */}
          <div style={{ gridColumn: "2 / 8", gridRow: "2 / 8" }}
            className="rounded-xl overflow-hidden border border-amber-500/30">
            <div className="w-full h-full rounded-xl flex flex-col items-center justify-center text-center p-2 relative"
              style={{ backgroundColor: mode.palette?.[1] || "#0f172a", backgroundImage: `linear-gradient(160deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55)), url(${ASSET}/map_${mode.id}.webp)`, backgroundSize: "cover", backgroundPosition: "center" }}>
              <div className="text-amber-100 font-black text-lg drop-shadow">{mode.name}</div>
              <div className="text-amber-200/80 text-xs mt-1">刷「{mode.familyName}」資源</div>
              <div className="text-amber-300/70 text-[11px] mt-2">已繞 {board.lapCount} 圈</div>
              <button onClick={handleRoll} disabled={rolling || board.dice <= 0}
                className="mt-3 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-sm shadow-lg disabled:opacity-40 active:scale-95">
                {rolling ? "🎲 前進中…" : board.dice <= 0 ? "骰子用完了" : "🎲 擲骰前進"}
              </button>
            </div>
          </div>

          {/* 28 邊框格 */}
          {BOARD_LAYOUT.map((type, i) => {
            const { row, col } = gridPos(i);
            const here = displayPos === i;
            const meta = TILE_TYPES[type];
            return (
              <div key={i} style={{ gridColumn: col, gridRow: row }}
                className={`relative rounded-lg flex items-center justify-center border ${here ? "ring-2 ring-yellow-300 scale-105 z-10" : "border-amber-500/20"}`}
                >
                <div className={`w-full h-full rounded-lg flex items-center justify-center ${tileBg(type)}`}>
                  <TileIcon type={type} size={26} />
                  {here && <div className="absolute -top-1 -right-1 text-base">🐱</div>}
                </div>
                {i === 0 && <span className="absolute bottom-0 text-[7px] text-amber-200 font-black">起</span>}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] rounded-2xl bg-black/85 border border-amber-400/40 px-4 py-2.5 text-amber-100 text-sm font-black shadow-xl max-w-[90vw] text-center">{toast}</div>}

      {/* 擲骰動畫 */}
      {diceAnim != null && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center pointer-events-none">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-200 border-4 border-amber-400 flex flex-col items-center justify-center shadow-2xl animate-bounce"
            style={{ boxShadow: "0 0 52px rgba(251,146,60,.9)" }}>
            <span className="text-7xl leading-none font-black" style={{ color: "#c2410c" }}>{diceAnim}</span>
          </div>
        </div>
      )}

      {/* 詳細獎勵彈窗 */}
      {rewardPopup && (
        <div className="fixed inset-0 z-[140] bg-black/70 flex items-center justify-center p-4" onClick={() => setRewardPopup(null)}>
          <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-5 w-full max-w-xs animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="text-center text-amber-200 font-black mb-2">🎁 獲得獎勵{rewardPopup.band ? `・${rewardPopup.band} 級` : ""}</div>
            <div className="space-y-1.5 my-2 max-h-[45vh] overflow-y-auto">
              {rewardPopup.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                  <span className="text-sm font-bold text-slate-100">{it.icon} {it.name}</span>
                  <span className="text-amber-300 font-black">×{it.amount}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setRewardPopup(null)} className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-900 font-black active:scale-95">收下！</button>
          </div>
        </div>
      )}

      {/* 骰子用完・總結算 */}
      {showSummary && (
        <div className="fixed inset-0 z-[145] bg-black/88 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-6 w-full max-w-sm">
            <div className="text-center text-4xl mb-1">🏆</div>
            <div className="text-center text-amber-200 font-black text-lg">本次探索結算</div>
            <div className="text-center text-slate-400 text-xs mb-3">骰子用完囉！這趟總共帶回：</div>
            <div className="space-y-1.5 max-h-[48vh] overflow-y-auto">
              {Object.values(sessionRef.current).length === 0
                ? <div className="text-center text-slate-500 text-sm py-4">這趟沒有帶回資源</div>
                : Object.values(sessionRef.current).map((it, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
                    <span className="text-sm font-bold text-slate-100">{it.icon} {it.name}</span>
                    <span className="text-amber-300 font-black">×{it.amount}</span>
                  </div>
                ))}
            </div>
            <button onClick={() => { setShowSummary(false); sessionRef.current = {}; onClose(); }}
              className="w-full mt-4 py-3 rounded-xl bg-amber-400 text-slate-900 font-black active:scale-95">完成・離開</button>
          </div>
        </div>
      )}

      {/* 6 箭計分 overlay */}
      {shootTile && (
        <div className="fixed inset-0 z-[135] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 w-full max-w-sm">
            <div className="text-center text-amber-100 font-black mb-1">{TILE_TYPES[shootTile.type].icon} {TILE_TYPES[shootTile.type].label}格・射 6 箭</div>
            <div className="text-center text-slate-400 text-xs mb-3">依實際命中輸入 6 箭分數（完成度決定獎勵）</div>
            <div className="flex justify-center gap-1 mb-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${arrows[i] != null ? "bg-emerald-600 text-white border-emerald-400" : "bg-slate-800 text-slate-500 border-slate-700"}`}>{arrows[i] != null ? arrows[i] : "?"}</div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {SCORE_PAD.map(([label, val]) => (
                <button key={label} disabled={arrows.length >= 6}
                  onClick={() => { sfxTap(); setArrows(a => a.length < 6 ? [...a, val] : a); }}
                  className="py-2 rounded-lg bg-amber-500/20 text-amber-100 font-black text-xs border border-amber-400/30 disabled:opacity-40">{label}</button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setArrows([])} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">清除</button>
              <button onClick={finishShoot} disabled={arrows.length < 6} className="flex-[2] py-2 rounded-xl bg-amber-400 text-slate-900 font-black text-sm disabled:opacity-40">結算（{arrows.length}/6）</button>
            </div>
          </div>
        </div>
      )}

      {/* 命運/機會 抽卡翻牌 */}
      {eventCard && (
        <div className="fixed inset-0 z-[135] bg-black/85 flex items-center justify-center p-4" onClick={applyEvent}>
          <div className="[perspective:1000px]">
            <div className="relative w-64 h-96 transition-transform duration-500"
              style={{ transformStyle: "preserve-3d", transform: eventCard.flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
              {/* 卡背 */}
              <div className="absolute inset-0 rounded-3xl border-4 flex items-center justify-center [backface-visibility:hidden]"
                style={{ borderColor: eventCard.event.deck === "fate" ? "#f59e0b" : "#38bdf8", backgroundColor: eventCard.event.deck === "fate" ? "#431407" : "#0c4a6e", backgroundImage: `url(${ASSET}/card_${eventCard.event.deck}_back.webp)`, backgroundSize: "cover", backgroundPosition: "center" }}>
                <div className="text-3xl font-black" style={{ color: eventCard.event.deck === "fate" ? "#fcd34d" : "#7dd3fc" }}>{eventCard.event.deck === "fate" ? "命運" : "機會"}</div>
              </div>
              {/* 卡面 */}
              <div className="absolute inset-0 rounded-3xl border-4 flex flex-col items-center justify-center p-6 text-center [backface-visibility:hidden]"
                style={{ transform: "rotateY(180deg)", borderColor: eventCard.event.deck === "fate" ? "#f59e0b" : "#38bdf8", backgroundColor: eventCard.event.deck === "fate" ? "#fde8cf" : "#d4f0fe", backgroundImage: `url(${ASSET}/card_${eventCard.event.deck}.webp)`, backgroundSize: "cover", backgroundPosition: "center" }}>
                <div className="rounded-2xl px-4 py-3" style={{ background:"rgba(255,255,255,0.86)", boxShadow:"0 2px 10px rgba(0,0,0,0.15)" }}>
                  <div className="text-slate-900 font-black text-lg mb-2">{eventCard.event.deck === "fate" ? "命運" : "機會"}</div>
                  <div className="text-slate-800 font-bold text-base leading-relaxed">{eventCard.event.text}</div>
                  <div className="text-slate-600 text-xs mt-3 font-bold">（點擊套用）</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function tileBg(type) {
  return {
    start: "bg-amber-300/25", material: "bg-emerald-500/20", mining: "bg-orange-500/20",
    monster: "bg-rose-500/25", arrowdew: "bg-sky-500/20", coins: "bg-yellow-500/20",
    gacha: "bg-pink-500/20", potion: "bg-lime-500/20", chest: "bg-amber-500/25",
    catbond: "bg-fuchsia-500/20", fate: "bg-orange-500/25", opp: "bg-cyan-500/25",
  }[type] || "bg-slate-700/30";
}
function resName(r) {
  return { coins: "金幣", arrowdew: "箭露", gachaToken: "扭蛋幣", material: "素材", catXP: "貓咪經驗" }[r] || r;
}
function rewardText(rw) {
  if (!rw) return "獲得獎勵";
  const p = [];
  if (rw.coins) p.push(`金幣+${rw.coins}`);
  if (rw.arrowdew) p.push(`箭露+${rw.arrowdew}`);
  if (rw.gachaToken) p.push(`扭蛋+${rw.gachaToken}`);
  const matN = Object.values(rw.familyMaterials || {}).reduce((s, n) => s + n, 0);
  if (matN) p.push(`素材×${matN}`);
  const resN = Object.values(rw.villageResources || {}).reduce((s, n) => s + n, 0);
  if (resN) p.push(`資源×${resN}`);
  if (rw.chests?.length) p.push(`寶箱×${rw.chests.length}`);
  if (rw.catXP) p.push(`貓咪XP+${rw.catXP}`);
  if (rw.potions?.length) p.push(`藥水×${rw.potions.length}`);
  return p.length ? "獲得 " + p.join("、") : "獲得獎勵";
}
// 從 pos 往前找最近的某類格 index
function nearestTile(pos, tileType) {
  for (let d = 1; d <= BOARD_SIZE; d++) {
    const idx = (pos + d) % BOARD_SIZE;
    if (BOARD_LAYOUT[idx] === tileType) return idx;
  }
  return pos;
}
