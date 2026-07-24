// src/components/member/CatVillageBoardTeam.jsx
// 貓貓村大富翁：組隊（Phase 1b）。全員共享一顆棋、只吃房主骰子、成員各自 claim。
// 規格見 docs/second_brain/village-board-spec.md §3。需 2 個 client 測試。
import { useState, useEffect, useRef, useCallback } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import {
  createBoardRoom, joinBoardRoom, subscribeBoardRoom, leaveBoardRoom, disbandBoardRoom,
  findReconnectableBoardRoom, setRoomMode, startBoardRoom, roomRollAndMove, roomSettleShoot, roomDrawEvent,
  roomApplyBoardEffect, claimBoardSettle, claimBoardEvent, partyMultOf,
} from "../../lib/villageBoardTeamDb";
import { ensureDailyDice, applyEventEffect, DAILY_DICE } from "../../lib/villageBoardDb";
import { BOARD_LAYOUT, BOARD_SIZE, TILE_TYPES, BOARD_MODES, getModeTierCap } from "../../lib/boardData";
import { drawBoardEvent } from "../../lib/boardEvents";
import { MATERIALS } from "../../lib/monsterMaterials";
import { RESOURCE_NAMES } from "../../lib/villageData";
import { sfxTap, sfxSuccess, sfxCast } from "../../lib/sound";

const ASSET = "/assets/board";
const MAT_BY_ID = Object.fromEntries(MATERIALS.map(m => [m.id, m]));
const RES_ICON = { ore:"⛏️", melon:"🍈", fish:"🐟", meat:"🍖", driedfish:"🐠", can:"🥫", fur:"🧶", arrowdew:"💧" };
const SCORE_PAD = [["X",10],["10",10],["9",9],["8",8],["7",7],["6",6],["5",5],["3",3],["M",0]];

function gridPos(i) {
  if (i < 8) return { row: 1, col: i + 1 };
  if (i < 15) return { row: i - 8 + 2, col: 8 };
  if (i < 22) return { row: 8, col: 7 - (i - 15) };
  return { row: 7 - (i - 22), col: 1 };
}
function tileBg(type) {
  return { start:"bg-amber-300/25", material:"bg-emerald-500/20", mining:"bg-orange-500/20", monster:"bg-rose-500/25",
    arrowdew:"bg-sky-500/20", coins:"bg-yellow-500/20", gacha:"bg-pink-500/20", potion:"bg-lime-500/20",
    chest:"bg-amber-500/25", catbond:"bg-fuchsia-500/20", fate:"bg-orange-500/25", opp:"bg-cyan-500/25" }[type] || "bg-slate-700/30";
}
function TileIcon({ type, size = 24 }) {
  const [failed, setFailed] = useState(false);
  const meta = TILE_TYPES[type] || {};
  if (!failed) return <img src={`${ASSET}/tile_${type}.webp`} alt="" width={size} height={size} onError={() => setFailed(true)} className="object-contain" draggable={false} />;
  return <span style={{ fontSize: size * 0.8 }}>{meta.icon || "❔"}</span>;
}
function describeReward(rw) {
  if (!rw) return [];
  const out = [];
  if (rw.coins) out.push({ icon:"🪙", name:"金幣", amount:rw.coins });
  if (rw.arrowdew) out.push({ icon:"💧", name:"箭露", amount:rw.arrowdew });
  if (rw.gachaToken) out.push({ icon:"🎰", name:"扭蛋幣", amount:rw.gachaToken });
  Object.entries(rw.familyMaterials || {}).forEach(([id,n]) => { const m = MAT_BY_ID[id]; out.push({ icon:m?.icon||"🧩", name:m?.name||id, amount:n }); });
  Object.entries(rw.villageResources || {}).forEach(([k,n]) => out.push({ icon:RES_ICON[k]||"📦", name:RESOURCE_NAMES[k]||k, amount:n }));
  (rw.chests||[]).forEach(() => out.push({ icon:"🎁", name:"寶箱", amount:1 }));
  if (rw.catXP) out.push({ icon:"🐱", name:"貓咪經驗", amount:rw.catXP });
  return out;
}

export default function CatVillageBoardTeam({ profile, onClose }) {
  const { role } = useAuth();
  const myId = profile?.id;
  const villageBuildings = profile?.village?.buildings || {};
  const catId = profile?.equippedCat?.catId || null;

  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [hostDice, setHostDice] = useState(0);
  const [joinCode, setJoinCode] = useState("");
  const [selMode, setSelMode] = useState(BOARD_MODES[0].id);
  const [selTier, setSelTier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [displayPos, setDisplayPos] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [diceAnim, setDiceAnim] = useState(null);
  const [shoot, setShoot] = useState(null);   // 房主射箭 { type }
  const [arrows, setArrows] = useState([]);
  const [card, setCard] = useState(null);      // { event, flipped }
  const [reward, setReward] = useState(null);
  const [toast, setToast] = useState(null);
  const lastSettleRef = useRef(0);
  const lastEventRef = useRef(0);

  const showToast = t => { setToast(t); setTimeout(() => setToast(null), 2400); };

  // 重連
  useEffect(() => {
    if (!myId) return;
    ensureDailyDice(myId);
    findReconnectableBoardRoom(myId).then(r => { if (r.room) setRoomId(r.room.id); });
  }, [myId]);

  // 訂閱房間
  useEffect(() => {
    if (!roomId) { setRoom(null); return; }
    const unsub = subscribeBoardRoom(roomId, r => {
      if (!r || r.status === "completed") { setRoomId(null); setRoom(null); return; }
      setRoom(r);
    });
    return unsub;
  }, [roomId]);

  const isHost = room && room.hostId === myId;

  // 訂閱房主骰子
  useEffect(() => {
    if (!room?.hostId) return;
    const unsub = onSnapshot(doc(db, "members", room.hostId), s => setHostDice(s.data()?.villageBoard?.dice || 0));
    return unsub;
  }, [room?.hostId]);

  // 房主擲骰動畫進行中（rolling）不可搶跑，否則 roomRollAndMove 一寫入 boardPos，
  // 棋子會在骰子還沒出數字前就瞬移到終點；rolling 收尾時再對齊最終位置。
  useEffect(() => { if (room && !rolling) setDisplayPos(room.boardPos || 0); }, [room?.boardPos, rolling]);

  // 成員自動 claim 結算獎勵
  useEffect(() => {
    if (!room?.pendingSettle || !myId) return;
    const seq = room.pendingSettle.seq;
    if ((room.settleClaims?.[myId] || 0) >= seq || lastSettleRef.current >= seq) return;
    lastSettleRef.current = seq;
    claimBoardSettle(roomId, myId, { villageBuildings, catId }).then(res => {
      if (res?.ok && res.reward) { sfxSuccess(); setReward({ items: describeReward(res.reward), band: res.reward.band }); }
    });
  }, [room?.pendingSettle?.seq, room?.settleClaims, myId, roomId, catId]);

  // 命運/機會事件卡：顯示 + 成員 claim（房主另處理共享棋效果）
  useEffect(() => {
    if (!room?.pendingEvent || !myId) return;
    const seq = room.pendingEvent.seq;
    if (lastEventRef.current >= seq) return;
    lastEventRef.current = seq;
    setCard({ event: room.pendingEvent.event, flipped: false });
    setTimeout(() => setCard(c => c && { ...c, flipped: true }), 550);
  }, [room?.pendingEvent?.seq, myId]);

  // ── 大廳動作 ──
  async function create() {
    setBusy(true); setErr("");
    const res = await createBoardRoom({ hostId: myId, hostName: profile?.name || "房主", mode: selMode, accountType: profile?.accountType, avatarId: profile?.avatarId });
    setBusy(false);
    if (res.ok) { await setRoomMode(res.roomId, myId, selMode).catch(() => {}); setRoomId(res.roomId); }
    else setErr(res.reason || "建立失敗");
  }
  async function join() {
    if (!joinCode.trim()) return;
    setBusy(true); setErr("");
    const res = await joinBoardRoom(joinCode.trim(), myId, profile?.name || "隊員", { accountType: profile?.accountType, avatarId: profile?.avatarId });
    setBusy(false);
    if (res.ok) setRoomId(res.roomId); else setErr(res.reason || "加入失敗");
  }
  async function exitRoom() {
    if (isHost) { await disbandBoardRoom(roomId, myId).catch(() => {}); }
    else { await leaveBoardRoom(roomId, myId).catch(() => {}); }
    setRoomId(null); setRoom(null);
  }

  // ── 房主：擲骰 ──
  const hostRoll = useCallback(async () => {
    if (!isHost || rolling || hostDice <= 0) return;
    setRolling(true); sfxCast();
    const res = await roomRollAndMove(roomId, myId);
    if (!res?.ok) { showToast(res?.reason || "無法擲骰"); setRolling(false); return; }
    setDiceAnim(1);
    await new Promise(r => { const end = Date.now() + 700; const iv = setInterval(() => { if (Date.now() >= end) { clearInterval(iv); setDiceAnim(res.roll); sfxSuccess(); r(); } else setDiceAnim(1 + Math.floor(Math.random() * 6)); }, 80); });
    await new Promise(r => setTimeout(r, 500)); setDiceAnim(null);
    let cur = res.from;
    for (let s = 0; s < res.roll; s++) { cur = (cur + 1) % BOARD_SIZE; setDisplayPos(cur); sfxTap(); await new Promise(r => setTimeout(r, 220)); }
    setRolling(false);
    if (res.lapped) showToast("🏁 繞完一圈！");
    // 射箭格/事件格由房主處理
    const meta = TILE_TYPES[res.tile];
    if (meta?.shooting) { setShoot({ type: res.tile }); setArrows([]); }
    else if (res.tile === "fate" || res.tile === "opp") { await roomDrawEvent(roomId, myId, drawBoardEvent(res.tile)); }
  }, [isHost, rolling, hostDice, roomId, myId]);

  const hostFinishShoot = useCallback(async () => {
    if (arrows.length < 6) return;
    const ratio = arrows.reduce((s, v) => s + v, 0) / 60;
    const t = shoot.type; setShoot(null);
    await roomSettleShoot(roomId, myId, t, ratio);
  }, [arrows, shoot, roomId, myId]);

  // 事件卡確認：成員 claim 資源；房主另套用共享棋效果（move/teleport/dice）
  const confirmCard = useCallback(async () => {
    const ev = card?.event; setCard(null);
    if (!ev) return;
    await claimBoardEvent(roomId, myId, { villageBuildings, catId });
    if (isHost) {
      const r = await applyEventEffect(myId, ev, { villageBuildings, catId }); // 只取 kind，不重複入帳（team claim 已處理資源）
      if (r.kind === "move") await roomApplyBoardEffect(roomId, myId, { pos: (((room.boardPos + r.steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE });
      else if (r.kind === "teleport") { for (let d = 1; d <= BOARD_SIZE; d++) { const idx = (room.boardPos + d) % BOARD_SIZE; if (BOARD_LAYOUT[idx] === r.tile) { await roomApplyBoardEffect(roomId, myId, { pos: idx }); break; } } }
      else if (r.kind === "dice") await roomApplyBoardEffect(roomId, myId, { diceDelta: r.delta });
    }
  }, [card, roomId, myId, isHost, room, catId]);

  // ── 大廳畫面 ──
  if (!roomId || !room) {
    const cap = getModeTierCap(selMode, villageBuildings);
    const tiers = Array.from({ length: cap }, (_, i) => i + 1);
    const m = BOARD_MODES.find(x => x.id === selMode) || BOARD_MODES[0];
    return (
      <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ backgroundColor:"#140a04", backgroundImage:`linear-gradient(rgba(18,10,4,0.85),rgba(12,7,3,0.94)), url(${ASSET}/board_bg.webp)`, backgroundSize:"cover" }}>
        <div className="w-full max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
            <div className="text-amber-100 font-black">👥 組隊探索</div>
            <div className="w-9" />
          </div>
          {err && <div className="mb-3 text-rose-300 text-xs font-bold">{err}</div>}
          <div className="rounded-2xl bg-black/30 border border-amber-500/25 p-4 mb-4">
            <div className="text-amber-200/80 text-xs font-bold mb-2">建立房間・選地圖</div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {BOARD_MODES.map(mo => (
                <button key={mo.id} onClick={() => { setSelMode(mo.id); setSelTier(1); }}
                  className={`rounded-xl p-2 text-[11px] font-bold border ${mo.id===selMode ? "border-amber-300 bg-amber-400/20 text-amber-100" : "border-amber-500/20 text-amber-100/70"}`}>{mo.icon}{mo.familyName}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tiers.map(t => <button key={t} onClick={() => setSelTier(t)} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${t===selTier?"bg-amber-400 text-slate-900 border-amber-300":"bg-black/30 text-amber-100 border-amber-500/20"}`}>T{t}</button>)}
            </div>
            <button disabled={busy || tiers.length===0} onClick={create} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black disabled:opacity-40">建立 {m.familyName} T{selTier} 房間</button>
          </div>
          <div className="rounded-2xl bg-black/30 border border-amber-500/25 p-4">
            <div className="text-amber-200/80 text-xs font-bold mb-2">用房號加入</div>
            <div className="flex gap-2">
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="房號" maxLength={6}
                className="flex-1 rounded-xl bg-black/40 border border-amber-500/25 px-3 py-2.5 text-amber-100 font-black tracking-widest text-center" />
              <button disabled={busy} onClick={join} className="px-5 rounded-xl bg-amber-500/30 border border-amber-400/30 text-amber-100 font-black disabled:opacity-40">加入</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 等待室 ──
  if (room.status === "waiting") {
    const mems = Object.entries(room.members || {}).filter(([, mm]) => mm);
    const wm = BOARD_MODES.find(x => x.id === room.mode) || BOARD_MODES[0];
    return (
      <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ backgroundColor:"#140a04", backgroundImage:`linear-gradient(rgba(18,10,4,0.85),rgba(12,7,3,0.94)), url(${ASSET}/board_bg.webp)`, backgroundSize:"cover" }}>
        <div className="w-full max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={exitRoom} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
            <div className="text-amber-100 font-black">⏳ 組隊等待室</div>
            <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {hostDice}</div>
          </div>
          <div className="rounded-2xl bg-black/30 border border-amber-500/25 p-4 mb-4 text-center">
            <div className="text-amber-200/60 text-xs">房號（給隊友輸入）</div>
            <div className="text-3xl font-black text-amber-300 tracking-[0.3em] my-1">{room.code}</div>
            <div className="text-amber-100/70 text-xs">{wm.icon}{wm.familyName}・T{room.tier || 1}</div>
          </div>
          <div className="text-amber-200/80 text-xs font-bold mb-2">隊員（{mems.length}/8）</div>
          <div className="space-y-2 mb-6">
            {mems.map(([id, mem]) => (
              <div key={id} className="flex items-center gap-2 rounded-xl bg-slate-900/70 border border-white/10 px-3 py-2.5">
                <span className="text-lg">🐱</span>
                <span className="flex-1 text-white font-bold text-sm">{mem.name}{id === room.hostId ? " 👑" : ""}{id === myId ? "（你）" : ""}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            ))}
          </div>
          {isHost ? (
            <button onClick={() => startBoardRoom(roomId, myId)} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-base shadow-lg active:scale-95">
              🎲 開始探索（{mems.length} 人）
            </button>
          ) : (
            <div className="text-center text-amber-200/70 text-sm py-3 rounded-2xl bg-black/20">等待房主開始…</div>
          )}
        </div>
      </div>
    );
  }

  // ── 團隊棋盤 ──
  const mode = BOARD_MODES.find(x => x.id === room.mode) || BOARD_MODES[0];
  const memberCount = Object.values(room.members || {}).filter(Boolean).length;
  const pMult = partyMultOf(memberCount);
  // 全員通過閘門：有待領取的步驟時，房主要等所有隊員都領完才能再擲骰
  const activeMems = Object.entries(room.members || {}).filter(([, mm]) => mm);
  const curSeq = room.seq || 0;
  const passedStep = mid => (room.settleClaims?.[mid] || 0) >= curSeq || (room.eventClaims?.[mid] || 0) >= curSeq;
  const hasPending = curSeq > 0 && ((room.pendingSettle?.seq === curSeq) || (room.pendingEvent?.seq === curSeq));
  const claimedN = activeMems.filter(([id]) => passedStep(id)).length;
  const allPassed = !hasPending || activeMems.every(([id]) => passedStep(id));
  const canRoll = isHost && !rolling && hostDice > 0 && allPassed && !shoot && !card;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto"
      style={{ backgroundColor:"#140a04", backgroundImage:`linear-gradient(rgba(18,10,4,0.72),rgba(12,7,3,0.9)), url(${ASSET}/board_bg.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}>
      <div className="w-full max-w-lg flex items-center justify-between px-4 py-3">
        <button onClick={exitRoom} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
        <div className="text-amber-100 font-black text-sm">👥 房號 {room.code}・{memberCount}人</div>
        <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {hostDice}</div>
      </div>
      <div className="w-full max-w-lg px-3 flex items-center justify-center gap-2 mb-1">
        <div className="rounded-xl bg-black/30 border border-amber-500/25 px-3 py-1 text-amber-100 text-xs font-black">{mode.icon} {mode.familyName} · T{room.tier || 1} · 加成×{pMult.toFixed(2)}</div>
      </div>

      <div className="w-full max-w-lg p-3">
        <div className="w-full rounded-[26px] p-2.5" style={{ background:"linear-gradient(145deg,#d4a017,#8a5a12)", boxShadow:"0 12px 34px rgba(0,0,0,.6), inset 0 0 0 3px rgba(253,230,138,.55), inset 0 0 0 6px rgba(120,53,15,.5)" }}>
          <div className="grid aspect-square w-full rounded-2xl p-1.5" style={{ gridTemplateColumns:"repeat(8,1fr)", gridTemplateRows:"repeat(8,1fr)", gap:4, background:"linear-gradient(160deg,#2a1a0c,#1a0f06)", boxShadow:"inset 0 0 24px rgba(0,0,0,.7)" }}>
            <div style={{ gridColumn:"2 / 8", gridRow:"2 / 8" }} className="rounded-xl overflow-hidden border border-amber-500/30">
              <div className="w-full h-full rounded-xl flex flex-col items-center justify-center text-center p-2" style={{ backgroundColor: mode.palette?.[1]||"#0f172a", backgroundImage:`linear-gradient(160deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55)), url(${ASSET}/map_${mode.id}.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}>
                <div className="text-amber-100 font-black text-lg drop-shadow">{mode.name}</div>
                <div className="text-amber-300/70 text-[11px] mt-1">已繞 {room.lapCount || 0} 圈</div>
                {isHost ? (
                  <button onClick={hostRoll} disabled={!canRoll} className="mt-3 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-sm shadow-lg disabled:opacity-40 active:scale-95">
                    {rolling ? "🎲 前進中…" : hostDice <= 0 ? "骰子用完了" : !allPassed ? `⏳ 等隊員領取 ${claimedN}/${memberCount}` : "🎲 房主擲骰"}
                  </button>
                ) : <div className="mt-3 text-amber-200/70 text-xs">{hasPending && !passedStep(myId) ? "領取你的獎勵…" : "等待房主擲骰…"}</div>}
              </div>
            </div>
            {BOARD_LAYOUT.map((type, i) => {
              const { row, col } = gridPos(i);
              const here = displayPos === i;
              return (
                <div key={i} style={{ gridColumn:col, gridRow:row }} className={`relative rounded-lg flex items-center justify-center border ${here ? "ring-2 ring-yellow-300 scale-105 z-10" : "border-amber-500/20"}`}>
                  <div className={`w-full h-full rounded-lg flex items-center justify-center ${tileBg(type)}`}>
                    <TileIcon type={type} size={24} />
                    {here && <div className="absolute -top-1 -right-1 text-base">🐱</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] rounded-2xl bg-black/85 border border-amber-400/40 px-4 py-2.5 text-amber-100 text-sm font-black">{toast}</div>}

      {diceAnim != null && (
        <div className="fixed inset-0 z-[215] flex items-center justify-center pointer-events-none">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-200 border-4 border-amber-400 flex items-center justify-center shadow-2xl animate-bounce" style={{ boxShadow:"0 0 52px rgba(251,146,60,.9)" }}>
            <span className="text-7xl font-black" style={{ color:"#c2410c" }}>{diceAnim}</span>
          </div>
        </div>
      )}

      {reward && (
        <div className="fixed inset-0 z-[215] bg-black/70 flex items-center justify-center p-4" onClick={() => setReward(null)}>
          <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <div className="text-center text-amber-200 font-black mb-2">🎁 獲得獎勵{reward.band ? `・${reward.band} 級` : ""}</div>
            <div className="space-y-1.5 my-2 max-h-[45vh] overflow-y-auto">
              {reward.items.map((it, i) => <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2"><span className="text-sm font-bold text-slate-100">{it.icon} {it.name}</span><span className="text-amber-300 font-black">×{it.amount}</span></div>)}
            </div>
            <button onClick={() => setReward(null)} className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-900 font-black">收下！</button>
          </div>
        </div>
      )}

      {shoot && isHost && (
        <div className="fixed inset-0 z-[215] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 w-full max-w-sm">
            <div className="text-center text-amber-100 font-black mb-1">{TILE_TYPES[shoot.type].icon} {TILE_TYPES[shoot.type].label}格・房主射 6 箭</div>
            <div className="flex justify-center gap-1 my-3">{Array.from({length:6}).map((_,i)=>(<div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${arrows[i]!=null?"bg-emerald-600 text-white border-emerald-400":"bg-slate-800 text-slate-500 border-slate-700"}`}>{arrows[i]!=null?arrows[i]:"?"}</div>))}</div>
            <div className="grid grid-cols-5 gap-1.5">{SCORE_PAD.map(([l,v])=>(<button key={l} disabled={arrows.length>=6} onClick={()=>{sfxTap();setArrows(a=>a.length<6?[...a,v]:a);}} className="py-2 rounded-lg bg-amber-500/20 text-amber-100 font-black text-xs border border-amber-400/30 disabled:opacity-40">{l}</button>))}</div>
            <div className="flex gap-2 mt-4"><button onClick={()=>setArrows([])} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">清除</button><button onClick={hostFinishShoot} disabled={arrows.length<6} className="flex-[2] py-2 rounded-xl bg-amber-400 text-slate-900 font-black text-sm disabled:opacity-40">結算（{arrows.length}/6）</button></div>
          </div>
        </div>
      )}

      {card && (
        <div className="fixed inset-0 z-[215] bg-black/85 flex items-center justify-center p-4" onClick={confirmCard}>
          <div className="[perspective:1000px]">
            <div className="relative w-64 h-96 transition-transform duration-500" style={{ transformStyle:"preserve-3d", transform: card.flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
              <div className="absolute inset-0 rounded-3xl border-4 flex items-center justify-center [backface-visibility:hidden]" style={{ borderColor: card.event.deck==="fate"?"#f59e0b":"#38bdf8", backgroundColor: card.event.deck==="fate"?"#431407":"#0c4a6e", backgroundImage:`url(${ASSET}/card_${card.event.deck}_back.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}><div className="text-3xl font-black" style={{ color: card.event.deck==="fate"?"#fcd34d":"#7dd3fc" }}>{card.event.deck==="fate"?"命運":"機會"}</div></div>
              <div className="absolute inset-0 rounded-3xl border-4 flex flex-col items-center justify-center p-6 text-center [backface-visibility:hidden]" style={{ transform:"rotateY(180deg)", borderColor: card.event.deck==="fate"?"#f59e0b":"#38bdf8", backgroundColor: card.event.deck==="fate"?"#fde8cf":"#d4f0fe", backgroundImage:`url(${ASSET}/card_${card.event.deck}.webp)`, backgroundSize:"cover", backgroundPosition:"center" }}>
                <div className="text-slate-900 font-black text-lg mb-2">{card.event.deck==="fate"?"命運":"機會"}</div>
                <div className="text-slate-800 font-bold text-base leading-relaxed">{card.event.text}</div>
                <div className="text-slate-700 text-xs mt-4 font-bold">（點擊繼續）</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
