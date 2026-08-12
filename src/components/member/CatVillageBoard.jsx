// src/components/member/CatVillageBoard.jsx
// 貓貓村探索地圖重製（08-07-village-board-journey-redesign）：7 張直線旅程地圖。
// 地圖選單 → 蜿蜒捲動旅程（橫向捲動大畫布、path 絕對定位、棋子自動追蹤）。
// 規格見 .trellis/tasks/08-07-village-board-journey-redesign/design.md。
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ensureDailyDice, startJourney, rollJourney,
  settleJourneyTile, chooseForkPath, refillBoardDice, addBoardDice, DAILY_DICE,
  claimCardGachaFree, claimCardGachaPaid,
} from "../../lib/villageBoardDb";
import { useAuth } from "../../hooks/useAuth";
import { TILE_TYPES, BOARD_MODES, getModeTierCap, JOURNEY_BUFF_INFO, buffActive, buffValueLabel } from "../../lib/boardData";
import { JOURNEY_MAP_META, JOURNEY_SHOOTING_TILES, generateJourney, normalizeVillageBoard, emptyMapState, findNextTile, lockedJourneyTier } from "../../lib/boardJourney";
import { getObstacleForTier } from "../../lib/councilMonsters";
import {
  sfxTap, sfxCast,
  sfxBoardDiceRoll, sfxBoardDiceLand, sfxBoardStep, sfxBoardLand, sfxBoardLap, sfxBoardTile,
} from "../../lib/sound";
import BoardRewardPopup from "./BoardRewardPopup";
import TileDemo from "./TileDemo";
import BossDuel from "./BossDuel";
import CardGachaRoom from "./CardGachaRoom";
import EventScene from "./EventScene";
import BoardGuide from "./BoardGuide";
import { MATERIALS } from "../../lib/monsterMaterials";
import { NORMAL_MATERIALS } from "../../lib/monsterEconomyCatalog";
import { RESOURCE_NAMES } from "../../lib/villageData";
import { addRoundArrows, useCoinShopSpecialTicket } from "../../lib/db";
import { getCatSpeech } from "../cat/catSpeeches";
import CatVillageNavArt from "./CatVillageNavArt";

// 新怪材料（無 icon）＋舊材料（有 icon）；舊材料覆蓋同 id 以保留 icon
const MAT_BY_ID = { ...Object.fromEntries(NORMAL_MATERIALS.map(m => [m.id, m])), ...Object.fromEntries(MATERIALS.map(m => [m.id, m])) };
const RES_ICON = { ore: "⛏️", melon: "🍈", fish: "🐟", meat: "🍖", driedfish: "🐠", can: "🥫", fur: "🧶", arrowdew: "💧" };

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
function mergeRewards(base, rw) {
  const acc = base || {};
  describeReward(rw).forEach(({ icon, name, amount }) => {
    const key = name;
    acc[key] = acc[key] ? { ...acc[key], amount: acc[key].amount + amount } : { icon, name, amount };
  });
  return acc;
}

const ASSET = "/assets/board";
const CELL_W = 88;   // 格子間距（橫）——2026-08-07 二次放大：手機上也要看得清 2.5D 細節
const CELL_H = 96;   // 格子間距（縱）——5 行總高 506px，靠鏡頭垂直跟隨（overflow-auto）
const TILE = 76;    // 旅程格子盒（放大：原 40px 在手機上看不清 2.5D 細節）

// tile 圖示：族專屬 2.5D 圖（tile_<mapId>_<type>.webp）→ 共用圖（tile_<type>.webp）→ emoji
// mapId 不傳＝只用共用圖（舊棋盤/組隊版路徑）
function TileIcon({ type, size = 30, mapId = null }) {
  const [useBase, setUseBase] = useState(false);
  const [failed, setFailed] = useState(false);
  const meta = TILE_TYPES[type] || {};
  const src = useBase || !mapId ? `${ASSET}/tile_${type}.webp` : `${ASSET}/tile_${mapId}_${type}.webp`;
  if (!failed) {
    return <img src={src} alt="" width={size} height={size}
      onError={() => { if (mapId && !useBase) setUseBase(true); else setFailed(true); }}
      className="object-contain" draggable={false} />;
  }
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{meta.icon || "❔"}</span>;
}

const TILE_FX_COLOR = {
  start: "rgba(251,191,36,.9)", material: "rgba(74,222,128,.9)", mining: "rgba(148,163,184,.9)",
  monster: "rgba(248,113,113,.9)", arrowdew: "rgba(103,232,249,.9)", coins: "rgba(250,204,21,.95)",
  gacha: "rgba(232,121,249,.9)", potion: "rgba(129,140,248,.9)", chest: "rgba(251,146,60,.95)",
  catbond: "rgba(244,114,182,.9)", fate: "rgba(192,132,252,.9)", opp: "rgba(192,132,252,.9)",
  camp: "rgba(74,222,128,.9)", empower: "rgba(103,232,249,.9)", catmate: "rgba(244,114,182,.9)",
  trap: "rgba(248,113,113,.9)", shortcut: "rgba(52,211,153,.9)", market: "rgba(251,146,60,.95)",
  scenery: "rgba(163,230,53,.9)", fork: "rgba(192,132,252,.9)", boss: "rgba(248,113,113,1)",
  cardgacha: "rgba(232,121,249,1)",
};
const BURST_TILES = new Set(["chest", "coins", "material", "gacha", "arrowdew", "boss"]);
const SCORE_PAD = [["X", 10], ["10", 10], ["9", 9], ["8", 8], ["7", 7], ["6", 6], ["5", 5], ["3", 3], ["M", 0]];

// 🏗️ 怪物格／終點 Boss＝該採集點的「採集任務障礙」（08-07 玩家要求：冒險遊戲的角色怪物
//    出現在採集場景很突兀——改用議會廳採集同一套 COUNCIL_MONSTERS 生活障礙）。

export default function CatVillageBoard({ profile, onClose, onTeam }) {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const myId = profile?.id;
  const villageBuildings = profile?.village?.buildings || {};
  const catId = profile?.equippedCat?.catId || null;

  // useAuth already keeps the member document live. Reuse that snapshot instead
  // of opening a second listener for the same members/{id} document here.
  const board = useMemo(() => ({
    ...(profile?.villageBoard || {}),
    _hasVillageBoard: Boolean(profile?.villageBoard),
  }), [profile?.villageBoard]);
  const [selecting, setSelecting] = useState(true);   // 地圖選單
  // 旅程完成（Boss 打敗）後待回選單：等獎勵 popup 關閉才跳，避免 popup 被選單蓋住。
  const pendingMenuRef = useRef(false);
  const [selMode, setSelMode] = useState(BOARD_MODES[0].id);
  const [selTier, setSelTier] = useState(1);
  const [entering, setEntering] = useState(false);    // startJourney in-flight
  const [mapId, setMapId] = useState(null);           // 當前旅程地圖
  const [journey, setJourney] = useState(null);       // generateJourney 結果
  const [rolling, setRolling] = useState(false);
  const [displayPos, setDisplayPos] = useState(0);
  const [toast, setToast] = useState(null);
  const [shootTile, setShootTile] = useState(null);   // {type} 怪物/終點 Boss
  const [arrows, setArrows] = useState([]);
  const [tileDemo, setTileDemo] = useState(null);     // 格子動作演示：null＝關、"mining"/"material"/"chest"/"arrowdew"
  const [cardGacha, setCardGacha] = useState(false);  // 🃏 抽卡房 overlay（踩到抽卡房格開啟）
  const [boardEvent, setBoardEvent] = useState(null); // 🎴 命運/機會事件場景 overlay（{event,reward,detail,movedTo,tile,deck}）
  const [fork, setFork] = useState(null);             // 分岔路口：{left,right} 兩路預覽
  const [diceAnim, setDiceAnim] = useState(null);
  const [diceLocked, setDiceLocked] = useState(false);
  const [landFx, setLandFx] = useState(null);
  const [hopNonce, setHopNonce] = useState(0);
  const [rewardPopup, setRewardPopup] = useState(null);
  const [catBondPop, setCatBondPop] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [buffs, setBuffs] = useState({});
  const [buffHelp, setBuffHelp] = useState(false);   // 加成說明彈窗（buff chips 點開）
  const [boardGuide, setBoardGuide] = useState(false);   // 📖 探索地圖說明書（完整玩法總覽）
  const sessionRef = useRef({});
  const scrollRef = useRef(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const setBusyBoth = useCallback(value => { busyRef.current = value; setBusy(value); }, []);

  // 標準化棋盤資料（UI 讀取用）。全新玩家沒有舊棋盤欄位 → 別觸發 legacy 遷移。
  const norm = useMemo(() => {
    const vb = board || {};
    if (!vb._hasVillageBoard) {
      return normalizeVillageBoard({ dice: vb.dice, diceGrantedDate: vb.diceGrantedDate, maps: vb.maps, pendingEvent: vb.pendingEvent });
    }
    return normalizeVillageBoard(vb);
  }, [board]);
  const curMap = mapId ? (norm.maps[mapId] || emptyMapState()) : emptyMapState();

  const showReward = useCallback((reward, band, tileType) => {
    sessionRef.current = mergeRewards(sessionRef.current, reward);
    const items = describeReward(reward);
    if (items.length) setRewardPopup({ items, band, tileType });
  }, []);

  useEffect(() => {
    if (!myId) return;
    ensureDailyDice(myId);
  }, [myId]);

  // 旅程 = 同 seed 確定性生成；seed/pos 變了就跟著重算
  useEffect(() => {
    if (!board || !mapId) return;
    const m = norm.maps[mapId] || emptyMapState();
    if (!m.length) return;
    setJourney(generateJourney(mapId, m.seed));
    if (!busyRef.current) setDisplayPos(m.pos || 0);
    setBuffs(m.buffs || {});
  }, [board, mapId, norm]); // norm 每 render 重算，但 seed 同值時 generateJourney 恆等、無副作用

  // 落格特效播完就清掉
  useEffect(() => {
    if (!landFx) return undefined;
    const t = setTimeout(() => setLandFx(null), 700);
    return () => clearTimeout(t);
  }, [landFx]);

  // 棋子自動捲動追蹤（尊重 prefers-reduced-motion）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !journey) return;
    const p = journey.path[displayPos];
    if (!p) return;
    // 雙軸跟隨：格子放大後 5 排高出手機視窗，鏡頭同時追蹤 x/y 置中目前位置
    const x = p.x * CELL_W + CELL_W / 2 - el.clientWidth / 2;
    const y = p.y * CELL_H + CELL_H / 2 - el.clientHeight / 2;
    const maxY = Math.max(0, el.scrollHeight - el.clientHeight);   // 顯式上限（舊 WebKit scrollTo 夾取保險）
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    el.scrollTo({ left: Math.max(0, x), top: Math.min(maxY, Math.max(0, y)), behavior: reduce ? "auto" : "smooth" });
  }, [displayPos, journey]);

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(null), 2600); };
  const pendingSummaryRef = useRef(false);
  const flushSummary = useCallback(() => {
    if (pendingSummaryRef.current) { pendingSummaryRef.current = false; setTimeout(() => setShowSummary(true), 700); }
  }, []);

  // 統一結算：呼叫 DB settleJourneyTile 並處理特殊回傳（移動/buff/完成旅程）
  const settleAt = useCallback(async (tileType, extra = {}) => {
    const res = await settleJourneyTile(myId, mapId, tileType, { villageBuildings, catId, ...extra });
    if (!res?.ok) { showToast(res?.reason || "結算失敗"); setBusyBoth(false); flushSummary(); return; }
    sfxBoardTile(tileType);
    if (res.movedTo != null && res.movedTo !== displayPos) {
      setDisplayPos(res.movedTo);
      setHopNonce(n => n + 1);
      setLandFx({ index: res.movedTo, type: tileType, nonce: Date.now() });
    }
    if (res.kind === "shortcut" && res.reachedBoss) {   // 捷徑直達終點 → 打 Boss
      setShootTile({ type: "boss" });
      setBusyBoth(false);
      return;
    }
    if (res.kind === "buff") {
      const b = res.buffs || {};   // res.buffs＝疊加後的新狀態；超過單次基礎值＝重複踩到（疊加）
      const parts = [];
      if (b.campMult) parts.push(`🏕️ 營地${b.campMult > 1.2 ? "疊加" : ""}！村莊資源 ×${b.campMult}`);
      if (b.nextShootMult) parts.push(`✨ 強化${b.nextShootMult > 2 ? "疊加" : ""}！下次打怪/決戰 ×${b.nextShootMult}`);
      if (b.diceCount > 1) parts.push(`🎲 多骰！下一次擲骰骰 ${b.diceCount} 顆`);
      if (b.catmate) parts.push(`🐾 貓夥伴${(Number(b.catmate) || 1) > 1 ? "疊加" : ""}！射箭分數 +${Math.round((Number(b.catmate) || 1) * 5)}%`);
      showToast(parts.join("  ") || "✨ 獲得加成");
    } else if (res.kind === "trap") {
      // 多種陷阱事件（08-08）：蛇咬/流沙/竊金/骰子/箭露——toast 帶上事件名與描述
      const ev = res.reward || {};
      const parts = [`${ev.icon || "🕳️"} ${ev.label || "陷阱！"}${ev.back != null && ev.back !== 2 ? `（後退 ${ev.back} 格）` : ""}`];
      if (ev.loseCoins) parts.push(`損失 ${ev.loseCoins} 金幣`);
      if (ev.loseArrowdew) parts.push(`損失 ${ev.loseArrowdew} 箭露`);
      if (ev.loseDice) parts.push(`少 ${ev.loseDice} 顆骰子`);
      showToast(parts.join("，"));
    } else if (res.kind === "shortcut") {
      showToast(`🌉 捷徑！前進 ${res.reward?.jumpAhead ?? 3} 格`);
    }
    const items = describeReward(res.reward);
    if (items.length) {
      if (tileType === "catbond" && catId) {
        sessionRef.current = mergeRewards(sessionRef.current, res.reward);
        setCatBondPop({
          catId,
          name: profile?.equippedCat?.name || "貓貓",
          speech: getCatSpeech(catId, "encourage"),
          catXP: res.reward.catXP || 0,
          catBond: res.reward.catBond || 0,
        });
      } else {
        showReward(res.reward, res.reward.band, tileType);
      }
    }
    if (res.kind === "boss" && res.completed) {
      // 🏁 旅程完成（08-07）：不再自動重開同階級新一趟——回選單讓玩家重選 T
      //    （maps.tier 已歸 0＝未鎖定，選單顯示階級選擇器）。
      //    獎勵 popup 還開著就等它關閉再跳（popup z-140 < 選單 z-200，直接跳會被蓋住）；
      //    沒獎勵可看（items 空）就直接回選單。
      setBuffs({});
      sfxBoardLap();
      showToast(`🎉 完成旅程！第 ${res.clears} 次通關，回到選單重新選階級`);
      if (items.length) {
        pendingMenuRef.current = true;
      } else {
        setMapId(null);
        setSelecting(true);
        sessionRef.current = {};
      }
    }
    setBusyBoth(false);
    flushSummary();
  }, [myId, mapId, villageBuildings, catId, displayPos, showReward, flushSummary, setBusyBoth, profile]);

  // 落點結算入口：射箭格（只有怪物/終點 Boss）開 overlay、採集格開演示、
  // 分岔路開二選一模態、其餘直接結算
  const settle = useCallback(async (tileType) => {
    if (JOURNEY_SHOOTING_TILES.has(tileType)) { setShootTile({ type: tileType }); setArrows([]); return; }
    // 挖礦/採集素材/寶箱/箭露都要「動手」的感覺：開對應的動作演示（08-08 起全部有演出）
    if (tileType === "mining" || tileType === "material" || tileType === "chest" || tileType === "arrowdew") {
      setTileDemo(tileType);
      return;
    }
    if (tileType === "cardgacha") { setCardGacha(true); return; }   // 🃏 抽卡房：開抽卡 overlay（免費 1 張／付費 3 張）
    if (tileType === "fate" || tileType === "opp") {
      // 🎴 命運/機會（08-08 恢復）：抽事件卡 → 開事件場景 overlay（含移動/觸發鏈）
      const res = await settleJourneyTile(myId, mapId, tileType, { villageBuildings, catId });
      if (!res?.ok) { showToast(res?.reason || "事件結算失敗"); setBusyBoth(false); flushSummary(); return; }
      sfxBoardTile(tileType);
      setBoardEvent(res);
      return;
    }
    if (tileType === "fork") {
      // 預覽兩條路：左路＝前方最近素材/採集格、右路＝前方最近怪物格
      const cells = journey?.cells || [];
      const pos = displayPos;
      const li = findNextTile(cells, pos, ["material", "mining"]);
      const ri = findNextTile(cells, pos, ["monster"]);
      setFork({
        left: li != null ? { pos: li, tile: cells[li], dist: li - pos } : null,
        right: ri != null ? { pos: ri, tile: cells[ri], dist: ri - pos } : null,
      });
      return;
    }
    await settleAt(tileType, {});
  }, [settleAt, journey, displayPos, myId, mapId, villageBuildings, catId, flushSummary, setBusyBoth]);

  // 分岔路二選一：跳到目標格 → 照常結算該格（素材直接領、採集開演示、怪物開 6 箭）
  const chooseFork = useCallback(async (side) => {
    setFork(null);
    const res = await chooseForkPath(myId, mapId, side);
    if (!res?.ok) { showToast(res?.reason || "無法前進"); setBusyBoth(false); flushSummary(); return; }
    sfxBoardLand();
    setDisplayPos(res.movedTo);
    setHopNonce(n => n + 1);
    setLandFx({ index: res.movedTo, type: res.tile, nonce: Date.now() });
    if (res.reachedBoss) { setShootTile({ type: "boss" }); setBusyBoth(false); return; }
    await new Promise(r => setTimeout(r, 600));
    await settle(res.tile);
  }, [myId, mapId, settle, setBusyBoth, flushSummary]);

  // 骰 → 逐格動畫 → 落點結算
  const handleRoll = useCallback(async () => {
    if (rolling || busyRef.current || !board || !mapId || (board.dice || 0) <= 0) return;
    const m = norm.maps[mapId] || emptyMapState();
    if (!m.length) { showToast("請先選擇地圖"); return; }
    setBusyBoth(true); setRolling(true); sfxCast(); sfxBoardDiceRoll();
    const res = await rollJourney(myId, mapId);
    if (!res?.ok) { showToast(res?.reason || "無法擲骰"); setRolling(false); setBusyBoth(false); return; }
    pendingSummaryRef.current = (res.diceLeft ?? 0) <= 0;
    // 擲骰動畫：快速跳數字 ~0.8s 定格在 res.roll
    setDiceAnim(1); setDiceLocked(false);
    await new Promise(resolve => {
      const end = Date.now() + 800;
      const iv = setInterval(() => {
        if (Date.now() >= end) { clearInterval(iv); setDiceAnim(res.rolls?.length > 1 ? res.rolls.join("+") : res.roll); setDiceLocked(true); sfxBoardDiceLand(); resolve(); }
        else setDiceAnim(1 + Math.floor(Math.random() * 15));
      }, 80);
    });
    await new Promise(r => setTimeout(r, 550));
    setDiceAnim(null);
    // 逐格前進動畫（from+1 … to，骰過頭時夾在終點）
    for (let cur = res.from + 1; cur <= res.to; cur += 1) {
      setDisplayPos(cur);
      setHopNonce(n => n + 1);
      if (cur === res.to) {
        sfxBoardLand();
        setLandFx({ index: cur, type: journey?.cells?.[cur], nonce: Date.now() });
      } else sfxBoardStep(cur - res.from, res.roll);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 230));
    }
    setRolling(false);
    if (res.reachedBoss) sfxBoardLap();
    await new Promise(r => setTimeout(r, 750));   // 落點停頓
    await settle(journey?.cells?.[res.to] || "material");
  }, [rolling, board, mapId, myId, norm, journey, settle, setBusyBoth]);

  // 6 箭計分完成（怪物 / 終點 Boss）
  const finishShoot = useCallback(async () => {
    if (arrows.length < 6) return;
    const ratio = arrows.reduce((s, v) => s + v, 0) / (6 * 10);
    const type = shootTile.type;
    setShootTile(null);
    addRoundArrows(myId, 6).catch(() => {});
    await settleAt(type, { scoreRatio: ratio });
  }, [arrows, shootTile, myId, settleAt]);

  // 格子動作演示完成：不再有選擇（挖礦/採集/寶箱/箭露都是播完直接結算）
  const tileDemoDone = useCallback(async () => {
    const gv = tileDemo;
    setTileDemo(null);
    await settleAt(gv, {});
  }, [settleAt, tileDemo]);

  // 進入地圖
  const enterMap = useCallback(async (modeId, tier) => {
    if (entering) return;
    setEntering(true);
    const res = await startJourney(myId, modeId, tier);
    setEntering(false);
    if (!res?.ok) { showToast(res?.reason || "無法進入地圖"); return; }
    sessionRef.current = {};
    setMapId(modeId);
    setSelecting(false);
  }, [myId, entering]);

  if (!board) return null;

  // ── 地圖選單：7 張旅程卡片 ──
  if (selecting) {
    const cap = getModeTierCap(selMode, villageBuildings);
    const tiers = Array.from({ length: cap }, (_, i) => i + 1);
    const m = BOARD_MODES.find(x => x.id === selMode) || BOARD_MODES[0];
    // 階級鎖定（08-07）：旅程已開走的地圖，T 固定到走完——選單不能再改、按鈕顯示「繼續」。
    // ⚠️ 舊資料（遷移自舊 28 格棋盤）length>0 但 tier=0：不鎖定，讓玩家首次選階級（lockedJourneyTier 接受一次新選）
    const selMapState = norm.maps[selMode] || emptyMapState();
    const selInProgress = selMapState.length > 0;
    const selTierLocked = selInProgress && selMapState.tier > 0;
    const selLockedTier = lockedJourneyTier(selMapState, selTier);
    return (
      <div className="fixed inset-0 z-[200] flex flex-col overflow-y-auto"
        style={{ backgroundColor: "#140a04", backgroundImage: `linear-gradient(rgba(18,10,4,0.82),rgba(12,7,3,0.93)), url(${ASSET}/board_bg.webp)`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="w-full max-w-lg mx-auto p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
            <div className="text-amber-100 font-black">選擇探索地圖</div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setBoardGuide(true)} title="探索地圖說明書：完整玩法總覽"
                className="rounded-lg bg-sky-600/60 border border-sky-400/40 px-2 py-1 text-sky-50 text-[10px] font-black active:scale-95">📖 說明</button>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button onClick={() => addBoardDice(myId, 1)} title="測試用：＋1 骰"
                    className="rounded-lg bg-emerald-600/70 border border-emerald-400/40 px-1.5 py-1 text-emerald-50 text-[10px] font-black active:scale-95">＋1</button>
                  <button onClick={() => refillBoardDice(myId)} title="測試用：重置為每日上限"
                    className="rounded-lg bg-emerald-600/70 border border-emerald-400/40 px-1.5 py-1 text-emerald-50 text-[10px] font-black active:scale-95">🔄重置</button>
                </div>
              )}
              <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {board.dice}</div>
            </div>
          </div>
          <div className="relative isolate overflow-hidden rounded-3xl border border-amber-300/35 mb-5 min-h-[150px] shadow-xl">
            <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#160b04]/90 via-[#241207]/45 to-transparent" />
            <div className="relative flex min-h-[150px] items-center gap-3 p-5">
              <CatVillageNavArt name="tasks" size={72} />
              <div>
                <div className="text-xl font-black text-amber-50">今天要走哪條旅程？</div>
                <div className="mt-1 max-w-[240px] text-xs font-bold leading-relaxed text-amber-100/75">
                  每張地圖是一趟 100~200 格的隨機路線，進度會保存、明天繼續。骰子全地圖共用。
                </div>
              </div>
            </div>
          </div>
          <div className="text-amber-200/80 text-xs font-bold mb-2">① 選擇地圖（進度各自保存）</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {BOARD_MODES.map(mo => {
              const st = norm.maps[mo.id] || emptyMapState();
              const pct = st.length ? Math.round(((st.pos || 0) / (st.length - 1)) * 100) : 0;
              const inProgress = st.length > 0;
              const activeBuffs = JOURNEY_BUFF_INFO.filter(b => buffActive(st.buffs || {}, b.field));   // 進行中加成（骰子用完不消失）
              return (
                <button key={mo.id} onClick={() => { setSelMode(mo.id); setSelTier(lockedJourneyTier(st, 1)); }}
                  className={`relative isolate min-h-[118px] overflow-hidden rounded-2xl border-2 p-3 text-left shadow-lg transition active:scale-[.98] ${mo.id === selMode ? "border-amber-300 scale-[1.02] ring-2 ring-amber-200/25" : "border-amber-500/20"}`}>
                  <img src={`${ASSET}/map_${mo.id}.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/5" />
                  {mo.id === selMode && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-amber-300 text-xs font-black text-amber-950 shadow-md">✓</span>}
                  {inProgress && <span className="absolute left-2 top-2 rounded-full bg-amber-400/95 px-1.5 py-0.5 text-[9px] font-black text-amber-950 shadow">{st.tier > 0 ? `T${st.tier}・進行中` : "進行中・待選 T"}</span>}
                  <span className="relative flex min-h-[92px] flex-col justify-end">
                    <span className="text-sm font-black text-white drop-shadow-md">{mo.familyName}</span>
                    <span className="mt-0.5 text-[11px] font-bold text-amber-100/80">{mo.name}</span>
                    <span className="mt-1 flex items-center gap-1">
                      <span className="h-1.5 flex-1 rounded-full bg-white/15 overflow-hidden">
                        <span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: `${pct}%` }} />
                      </span>
                      <span className="text-[9px] font-black text-amber-200/90">{st.length ? `${pct}%` : "未開始"}</span>
                    </span>
                    <span className="mt-0.5 text-[9px] font-bold text-amber-200/60">
                      {st.length
                        ? `進度 ${st.pos || 0}/${st.length}${st.clears ? `・完成 ${st.clears} 趟` : ""}`
                        : "尚未完成過"}
                      {activeBuffs.length > 0 && `・${activeBuffs.map(b => `${b.icon}${buffValueLabel(st.buffs || {}, b.field)}`).join(" ")}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-amber-200/80 text-xs font-bold mb-2">
            ② {selTierLocked ? "本趟階級（已鎖定）" : "進入哪個階級？"}
            {!selTierLocked && <span className="text-amber-200/50 font-normal">（上限由「{m.name}」建築等級決定）</span>}
          </div>
          {selTierLocked ? (
            <div className="flex items-center gap-2 mb-6 rounded-xl bg-black/30 border border-amber-500/25 px-3 py-2.5">
              <span className="rounded-lg bg-amber-400 text-slate-900 font-black text-sm px-2.5 py-1">T{selLockedTier}</span>
              <span className="text-amber-200/65 text-[11px] font-bold leading-snug">
                這張地圖的旅程正在進行中，階級已固定——走完這趟（抵達終點）前不能更換。
              </span>
            </div>
          ) : tiers.length === 0 ? (
            <div className="text-rose-300/80 text-xs mb-5 bg-rose-900/20 border border-rose-500/20 rounded-xl px-3 py-2">此地圖尚未解鎖，請先在貓貓村升級「{m.name}」建築。</div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-6">
              {selInProgress && (
                <div className="w-full text-[11px] font-bold text-amber-200/60 mb-1">
                  🔄 這張地圖的旅程已走完（或尚未選過階級），選好 T 就開始新一趟，走完前鎖定。
                </div>
              )}
              {tiers.map(t => (
                <button key={t} onClick={() => setSelTier(t)}
                  className={`px-4 py-2 rounded-xl font-black text-sm border-2 ${t === selTier ? "bg-amber-400 text-slate-900 border-amber-300" : "bg-black/30 text-amber-100 border-amber-500/20"}`}>T{t}</button>
              ))}
            </div>
          )}
          <button disabled={tiers.length === 0 || entering} onClick={() => enterMap(selMode, selLockedTier)}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-base shadow-lg active:scale-95 disabled:opacity-40">
            {entering ? "生成旅程中…" : selTierLocked ? `🎲 繼續 ${m.familyName} T${selLockedTier} 旅程` : `🎲 進入 ${m.familyName} T${selTier} 旅程`}
          </button>
          {onTeam && (
            <button onClick={onTeam} className="relative isolate w-full mt-3 min-h-[82px] overflow-hidden rounded-2xl border border-emerald-300/35 text-left shadow-lg active:scale-[.98]">
              <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-950/95 via-emerald-950/75 to-slate-950/35" />
              <span className="relative flex items-center gap-3 px-4 py-3">
                <CatVillageNavArt name="village" size={58} />
                <span>
                  <span className="block text-base font-black text-emerald-50">進入組隊探索大廳</span>
                  <span className="mt-0.5 block text-[11px] font-bold text-emerald-100/70">搜尋現有隊伍，或建立自己的房間</span>
                </span>
                <span className="ml-auto text-xl text-emerald-100">›</span>
              </span>
            </button>
          )}
        </div>
        {/* 📖 探索地圖說明書（選單也可開啟） */}
        {boardGuide && <BoardGuide onClose={() => setBoardGuide(false)} />}
      </div>
    );
  }

  if (!mapId || !journey) return null;
  const meta = JOURNEY_MAP_META[mapId];
  const tierShown = curMap.tier || getModeTierCap(mapId, villageBuildings);
  const progressPct = journey.length > 1 ? Math.round((displayPos / (journey.length - 1)) * 100) : 0;
  const shootMon = (shootTile?.type === "monster" || shootTile?.type === "boss")
    ? getObstacleForTier(mapId, tierShown)
    : null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col"
      style={{ backgroundColor: "#140a04", backgroundImage: `linear-gradient(rgba(18,10,4,0.72),rgba(12,7,3,0.9)), url(${ASSET}/board_bg.webp)`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      {/* 頂列 */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between gap-2 flex-wrap px-4 py-3">
        <button onClick={() => { pendingMenuRef.current = false; setMapId(null); setSelecting(true); sessionRef.current = {}; }} className="w-9 h-9 rounded-full bg-black/40 text-amber-200 font-black">←</button>
        <div className="text-amber-100 font-black text-sm">{meta.icon} {meta.familyName}・旅程</div>
        <div className="flex items-center gap-1.5">
          {isAdmin && (
            <div className="flex items-center gap-1">
              <button onClick={() => addBoardDice(myId, 1)} title="測試用：＋1 骰"
                className="rounded-lg bg-emerald-600/70 border border-emerald-400/40 px-1.5 py-1 text-emerald-50 text-[10px] font-black active:scale-95">＋1</button>
              <button onClick={() => refillBoardDice(myId)} title="測試用：重置為每日上限"
                className="rounded-lg bg-emerald-600/70 border border-emerald-400/40 px-1.5 py-1 text-emerald-50 text-[10px] font-black active:scale-95">🔄重置</button>
            </div>
          )}
          <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-2.5 py-1 text-amber-200 text-xs font-black">🎲 {board.dice}/{DAILY_DICE}</div>
        </div>
      </div>

      {/* 地圖資訊 + buff chips + 進度條 */}
      <div className="w-full max-w-lg mx-auto px-4 mb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="rounded-xl bg-black/30 border border-amber-500/25 px-3 py-1 text-amber-100 text-xs font-black">T{tierShown}・{meta.name}</div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button onClick={() => setBoardGuide(true)} title="探索地圖說明書：完整玩法總覽"
              className="rounded-full bg-sky-600/40 border border-sky-400/40 px-2 py-0.5 text-[10px] font-black text-sky-100 active:scale-95">📖 說明</button>
            <button onClick={() => setBuffHelp(true)} title="查看加成說明"
              className="rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-[10px] font-black text-slate-200 active:scale-95">❓ 加成</button>
            {buffActive(buffs, "campMult") && <button onClick={() => setBuffHelp(true)} className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-black text-emerald-200 active:scale-95">🏕️ 資源 ×{buffs.campMult}</button>}
            {buffActive(buffs, "nextShootMult") && <button onClick={() => setBuffHelp(true)} className="rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 text-[10px] font-black text-cyan-200 active:scale-95">✨ 下次打怪/決戰 ×{buffs.nextShootMult}</button>}
            {buffActive(buffs, "diceCount") && <button onClick={() => setBuffHelp(true)} className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-200 active:scale-95">🎲 下次擲 {buffs.diceCount} 骰</button>}
            {buffActive(buffs, "catmate") && <button onClick={() => setBuffHelp(true)} className="rounded-full bg-pink-500/20 border border-pink-400/40 px-2 py-0.5 text-[10px] font-black text-pink-200 active:scale-95">🐾 射箭 +{Math.round((Number(buffs.catmate) || 1) * 5)}%</button>}
            {curMap.clears > 0 && <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-200">🏆 {curMap.clears} 趟</span>}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-black text-amber-200/70">{displayPos}/{journey.length - 1}</span>
          <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-300 bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-[10px] font-black text-amber-200/70">{progressPct}%</span>
        </div>
      </div>

      {/* 旅程大畫布：橫向捲動、蜿蜒 path 絕對定位 */}        <div ref={scrollRef} className="flex-1 overflow-auto w-full"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(251,191,36,.4) transparent" }}>
        <div className="min-w-max mx-auto" style={{ position: "relative", width: (journey.length + 2) * CELL_W, height: 5 * CELL_H + 26 }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            <polyline
              points={journey.path.map(p => `${p.x * CELL_W + CELL_W / 2},${p.y * CELL_H + CELL_H / 2}`).join(" ")}
              fill="none" stroke="rgba(251,191,36,.30)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {journey.cells.map((type, i) => {
            const p = journey.path[i];
            const here = displayPos === i;
            const landed = landFx?.index === i;
            const metaT = TILE_TYPES[type] || {};
            return (
              <div key={i}
                style={{ position: "absolute", left: p.x * CELL_W + (CELL_W - TILE) / 2, top: p.y * CELL_H + (CELL_H - TILE) / 2, width: TILE, height: TILE, "--board-fx": TILE_FX_COLOR[type] || "rgba(251,191,36,.9)" }}
                className={`relative rounded-xl flex items-center justify-center border ${here ? "ring-2 ring-yellow-300 scale-110 z-10" : "border-amber-500/20"} ${landed ? "board-land-flash" : ""}`}>
                <span className={`w-full h-full rounded-xl flex items-center justify-center ${tileBg(type)}`}>
                  <TileIcon type={type} size={type === "boss" ? 66 : 58} mapId={mapId} />
                </span>
                {type === "boss" && <span className="absolute -bottom-3 text-[11px] text-rose-300 font-black drop-shadow">終點</span>}
                {i === 0 && <span className="absolute -bottom-3 text-[11px] text-amber-200 font-black">起點</span>}
                {here && <div key={hopNonce} className="absolute -top-4 -right-2 text-3xl board-hop z-20">🐱</div>}
                {landed && BURST_TILES.has(type) && <span key={landFx.nonce} className="board-burst" />}
                {metaT.label && <span className="absolute top-1 left-1.5 text-[11px] text-amber-100/70 font-black">{metaT.label}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部：骰子 */}
      <div className="w-full max-w-lg mx-auto px-4 py-3">
        <button onClick={handleRoll} disabled={rolling || busy || (board.dice || 0) <= 0}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-base shadow-lg disabled:opacity-40 active:scale-95">
          {rolling ? "🎲 前進中…" : busy ? "⏳ 結算中…" : (board.dice || 0) <= 0 ? "骰子用完了" : "🎲 擲骰前進"}
        </button>
        {(board.dice || 0) <= 0 && (
          <button type="button" disabled={!profile?.specialItems?.boardDiceTicket}
            onClick={() => useCoinShopSpecialTicket(profile.id, "boardDiceTicket")}
            className="mt-2 w-full min-h-10 rounded-xl bg-indigo-400 px-3 text-xs font-black text-slate-950 disabled:bg-slate-700 disabled:text-slate-500">
            🎟️ 使用探索骰子券 +3（持有 {profile?.specialItems?.boardDiceTicket || 0}）
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[130] rounded-2xl bg-black/85 border border-amber-400/40 px-4 py-2.5 text-amber-100 text-sm font-black shadow-xl max-w-[90vw] text-center">{toast}</div>}

      {/* 擲骰動畫 */}
      {diceAnim != null && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center pointer-events-none">
          <div className={`w-32 h-32 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-200 border-4 border-amber-400 flex flex-col items-center justify-center shadow-2xl ${diceLocked ? "board-dice-settle" : "board-dice-tumble"}`}
            style={{ boxShadow: "0 0 52px rgba(251,146,60,.9)" }}>
            <span className={`leading-none font-black ${String(diceAnim).length > 8 ? "text-2xl" : String(diceAnim).length > 4 ? "text-4xl" : "text-7xl"}`} style={{ color: "#c2410c" }}>{diceAnim}</span>
          </div>
        </div>
      )}

      {/* 詳細獎勵彈窗 */}
      <BoardRewardPopup
        reward={rewardPopup}
        tileType={rewardPopup?.tileType}
        onClose={() => {
          setRewardPopup(null);
          // 旅程完成後待回選單：popup 關了就跳（tier 已歸 0，選單可重選階級）
          if (pendingMenuRef.current) {
            pendingMenuRef.current = false;
            setMapId(null);
            setSelecting(true);
            sessionRef.current = {};
          }
        }}
        zIndex={140}
      />

      {/* 分岔路口：二選一（不耗骰） */}
      {fork && (
        <div className="fixed inset-0 z-[138] bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border-2 border-amber-400/40 bg-slate-900 p-5 animate-[fx-pop-in_0.3s_cubic-bezier(.34,1.56,.64,1)]">
            <div className="text-center">
              <div className="text-3xl mb-1">🔀</div>
              <div className="text-amber-100 font-black text-lg">分岔路口</div>
              <div className="text-slate-400 text-xs mt-1 mb-4">前方出現兩條路，選一條繼續（不耗骰）</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => chooseFork("left")} disabled={!fork.left}
                className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-center active:scale-95 transition-transform hover:border-emerald-300/80 disabled:opacity-40">
                <div className="text-3xl">🌿</div>
                <div className="mt-1 text-sm font-black text-emerald-100">左路・穩妥</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-200/70 leading-tight">
                  {fork.left ? `前方 ${fork.left.dist} 格 → ${TILE_TYPES[fork.left.tile]?.icon} ${TILE_TYPES[fork.left.tile]?.label}` : "前方沒有素材格"}
                </div>
              </button>
              <button onClick={() => chooseFork("right")} disabled={!fork.right}
                className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-center active:scale-95 transition-transform hover:border-rose-300/80 disabled:opacity-40">
                <div className="text-3xl">⚔️</div>
                <div className="mt-1 text-sm font-black text-rose-100">右路・冒險</div>
                <div className="mt-1 text-[11px] font-bold text-rose-200/70 leading-tight">
                  {fork.right ? `前方 ${fork.right.dist} 格 → 👾 怪物戰（獎勵更高）` : "前方沒有怪物格"}
                </div>
              </button>
            </div>
            <button onClick={() => { setFork(null); setBusyBoth(false); flushSummary(); }}
              className="mt-3 w-full py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-bold active:scale-95">留在原地</button>
          </div>
        </div>
      )}

      {/* 格子動作演示：挖礦／採集素材／寶箱／箭露（08-08：全部都有演出、全部播完直接結算） */}
      {tileDemo && (
        <TileDemo meta={meta} tier={tierShown} variant={tileDemo}
          onDone={tileDemoDone}
          onCancel={() => { setTileDemo(null); setBusyBoth(false); flushSummary(); }} />
      )}

      {/* 🃏 抽卡房：免費抽 1 張／付費抽 3 張（池＝該 T 階級普通怪卡） */}
      {cardGacha && (
        <CardGachaRoom meta={meta} tier={tierShown}
          onFree={async () => {
            const r = await claimCardGachaFree(myId, mapId, tierShown);
            if (!r?.ok) { showToast(r?.reason || "抽卡失敗"); return []; }
            return r.views || [];
          }}
          onPaid={async () => {
            const r = await claimCardGachaPaid(myId, mapId, tierShown);
            if (!r?.ok) { showToast(r?.reason || "付費抽卡失敗"); return []; }
            return r.views || [];
          }}
          onClose={() => { setCardGacha(false); setBusyBoth(false); flushSummary(); }}
          zIndex={138} />
      )}

      {/* 🎴 命運/機會事件場景：顯示場景圖＋文案＋效果；關閉後處理移動/觸發鏈 */}
      {boardEvent && (
        <EventScene event={boardEvent.event} deck={boardEvent.deck} detail={boardEvent.detail}
          onClose={async () => {
            const ev = boardEvent;
            setBoardEvent(null);
            if (ev.movedTo != null && ev.movedTo !== displayPos) {
              setDisplayPos(ev.movedTo);
              setHopNonce(n => n + 1);
              setLandFx({ index: ev.movedTo, type: ev.tile || ev.deck, nonce: Date.now() });
              sfxBoardLand();
              await new Promise(r => setTimeout(r, 700));
              if (ev.tile) {
                if (JOURNEY_SHOOTING_TILES.has(ev.tile)) { setShootTile({ type: ev.tile }); setBusyBoth(false); return; }
                if (ev.tile === "mining" || ev.tile === "material" || ev.tile === "chest" || ev.tile === "arrowdew") { setTileDemo(ev.tile); return; }
                await settle(ev.tile);
                return;
              }
            }
            const items = describeReward(ev.reward);
            if (items.length) setRewardPopup({ items, band: ev.deck || "fate", tileType: ev.tile || ev.deck });
            setBusyBoth(false);
            flushSummary();
          }}
          zIndex={139} />
      )}

      {/* 貓貓羈絆格：陪練貓說句話 */}
      {catBondPop && (
        <div className="fixed inset-0 z-[142] bg-black/75 flex items-center justify-center p-4" onClick={() => setCatBondPop(null)}>
          <div className="bg-gradient-to-b from-fuchsia-950/90 to-slate-900 border-2 border-fuchsia-400/50 rounded-3xl p-5 w-full max-w-xs text-center animate-[fx-pop-in_0.35s_cubic-bezier(.34,1.56,.64,1)]" onClick={e => e.stopPropagation()}>
            <img src={`/cats/portraits/${catBondPop.catId}.webp`} alt={catBondPop.name}
              className="w-24 h-24 rounded-2xl object-cover mx-auto border-2 border-fuchsia-300/40 shadow-lg"
              onError={e => { e.currentTarget.style.display = "none"; }} />
            <div className="mt-2 text-fuchsia-200 font-black">{catBondPop.name}</div>
            <div className="mt-2 mb-3 rounded-2xl bg-white/90 text-slate-800 font-bold text-sm px-3 py-2 leading-relaxed">「{catBondPop.speech}」</div>
            <div className="flex justify-center gap-3 mb-4">
              {catBondPop.catXP > 0 && <div className="rounded-xl bg-black/30 px-3 py-1.5 text-amber-200 text-sm font-black">✨ 經驗 +{catBondPop.catXP}</div>}
              {catBondPop.catBond > 0 && <div className="rounded-xl bg-black/30 px-3 py-1.5 text-fuchsia-200 text-sm font-black">💖 羈絆 +{catBondPop.catBond}</div>}
            </div>
            <button onClick={() => setCatBondPop(null)} className="w-full py-2.5 rounded-xl bg-fuchsia-400 text-slate-900 font-black active:scale-95">摸摸貓！</button>
          </div>
        </div>
      )}

      {/* 📖 探索地圖說明書（選單與遊戲中都可開啟） */}
      {boardGuide && <BoardGuide onClose={() => setBoardGuide(false)} />}

      {/* 加成說明（點 ❓ 或任一 buff chip 打開） */}
      {buffHelp && (
        <div className="fixed inset-0 z-[146] bg-black/85 flex items-center justify-center p-4" onClick={() => setBuffHelp(false)}>
          <div className="w-full max-w-sm rounded-3xl border-2 border-amber-400/40 bg-slate-900 p-5 animate-[fx-pop-in_0.3s_cubic-bezier(.34,1.56,.64,1)]" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-1">✨</div>
              <div className="text-amber-100 font-black text-lg">本趟加成效果</div>
              <div className="text-slate-400 text-xs mt-1">踩到「營地／強化／多骰／貓夥伴」格子獲得，完成旅程後全部重置</div>
            </div>
            <div className="space-y-2">
              {JOURNEY_BUFF_INFO.map(b => {
                const on = buffActive(buffs, b.field);
                const val = buffValueLabel(buffs, b.field);
                return (
                  <div key={b.field} className={`rounded-2xl border p-3 ${on ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-white/5"}`}>
                    <div className="flex items-center gap-1.5 text-sm font-black text-amber-100">
                      <span>{b.icon}</span><span>{b.name}</span>
                      {on && <span className="ml-auto rounded-full bg-amber-400/20 border border-amber-300/40 px-2 py-0.5 text-[9px] font-black text-amber-200">啟用中{val && `・${val}`}</span>}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-300 leading-relaxed">{b.desc}</div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setBuffHelp(false)} className="w-full mt-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 font-black active:scale-95">知道了</button>
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

      {/* 🏁 終點 Boss：專屬決戰（登場→血條→討伐成功） */}
      {shootTile?.type === "boss" && (
        <BossDuel obstacle={shootMon} tier={tierShown}
          onFinish={bossArrows => {
            setShootTile(null);
            addRoundArrows(myId, 6).catch(() => {});
            const ratio = bossArrows.reduce((s, v) => s + v, 0) / 60;
            settleAt("boss", { scoreRatio: ratio });
          }}
          zIndex={135} />
      )}

      {/* 射箭格（怪物）：6 箭計分；怪物用既有立繪 */}
      {shootTile?.type === "monster" && (
        <div className="fixed inset-0 z-[135] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 w-full max-w-sm">
            <div className="text-center text-amber-100 font-black mb-1">{TILE_TYPES[shootTile.type].icon} {TILE_TYPES[shootTile.type].label}・射 6 箭</div>
            {shootMon && (
              <div className="relative mx-auto mb-2 w-24 h-24 rounded-2xl overflow-hidden border-2 border-rose-400/40 shadow-inner flex items-center justify-center" style={{ background: shootMon.bgColor || "#1e293b" }}>
                <span className="text-5xl drop-shadow-md">{shootMon.emoji || "👾"}</span>
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-center text-[10px] font-black text-rose-100 py-0.5">{shootMon.name}</span>
              </div>
            )}
            <div className="text-center text-slate-400 text-xs mb-1">{shootTile.type === "boss" ? "終點決戰：完成度越高獎勵越大（不會輸）" : "依實際命中輸入 6 箭分數（完成度決定獎勵）"}</div>
            {shootMon?.action && <div className="text-center text-[10px] font-bold text-rose-200/60 mb-2">🛠️ {shootMon.action}</div>}
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
    </div>
  );
}

function tileBg(type) {
  return {
    start: "bg-amber-300/25", material: "bg-emerald-500/20", mining: "bg-orange-500/20",
    monster: "bg-rose-500/25", arrowdew: "bg-sky-500/20", coins: "bg-yellow-500/20",
    gacha: "bg-pink-500/20", potion: "bg-lime-500/20", chest: "bg-amber-500/25",
    catbond: "bg-fuchsia-500/20", fate: "bg-orange-500/25", opp: "bg-cyan-500/25",
    camp: "bg-emerald-500/20", empower: "bg-cyan-500/20", catmate: "bg-pink-500/20",
    trap: "bg-rose-500/25", shortcut: "bg-teal-500/20", market: "bg-amber-500/25",
    scenery: "bg-lime-500/20", fork: "bg-purple-500/25", boss: "bg-rose-600/30",
    cardgacha: "bg-fuchsia-500/25",
  }[type] || "bg-slate-700/30";
}
