// src/lib/villageBoardDb.js
// 貓貓村大富翁：玩家棋盤狀態 + 每日骰 + 移動 + 結算 + 事件效果。
// 規格見 docs/second_brain/village-board-spec.md。
// ⚠️ members.villageBoard 為新欄位，已加進 firestore.rules 白名單。
import { doc, getDoc, updateDoc, onSnapshot, increment, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "./firebase";
import { addCoins, addArrowdew, addGachaCoins, addMaterials, addChests, addPotions, addMonsterCards, spendCoins } from "./db";
import { rollCardGachaOne, rollCardGachaN, cardToMonsterCard, cardToView, CARD_GACHA_PAID_PRICE } from "./boardCardGacha";
import { addCatXP, addCatBond } from "./catDb";
import { CARRY_POTIONS, makeFamilyMaterialChest } from "./itemData";
import { BOARD_LAYOUT, BOARD_SIZE, BOARD_MODE_MAP, getModeTierCap, rollTileReward } from "./boardData";
import {
  JOURNEY_MAP_META, generateJourney, normalizeVillageBoard, emptyMapState,
  nextPos, applyTrapPos, applyShortcutPos, mergeBuffs, applyJourneyMultipliers,
  combineRewards, rollDice, rollJourneyDice, randomSeed, findNextTile, lockedJourneyTier,
} from "./boardJourney";
import { getNormalMaterialPool } from "./monsterEconomyCatalog";
import { soloExplorationCompletionOperation } from "./villageGoalContribution";

export const DAILY_DICE = 15;   // 每日補滿至 15（上限 15、不囤積）

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEFAULT_BOARD = { dice: DAILY_DICE, diceGrantedDate: "", boardPos: 0, lapCount: 0, boardSeed: 0, mode: "mine", tier: null, pendingEvent: null };

export function subscribeBoardState(memberId, cb) {
  if (!memberId) return () => {};
  return onSnapshot(doc(db, "members", memberId), snap => {
    // _hasVillageBoard：區分「全新玩家（無 villageBoard 文件）」與「有文件」——
    // 新 UI 靠它避免把 DEFAULT_BOARD 的 boardPos:0 當成 legacy 遷移。
    cb(snap.exists()
      ? { ...DEFAULT_BOARD, ...(snap.data().villageBoard || {}), _hasVillageBoard: Boolean(snap.data().villageBoard) }
      : { ...DEFAULT_BOARD });
  }, () => cb({ ...DEFAULT_BOARD }));
}

// 每日重置（跨過午夜 12 點才重置）：骰子補滿至 15、棋子回起點、圈數歸零。
// 當天內不重置 → boardPos/lapCount 保留，關掉再進來可從原位置續跑（記憶跑到哪）。
export async function ensureDailyDice(memberId) {
  if (!memberId) return { ok: false };
  try {
    const ref = doc(db, "members", memberId);
    const snap = await getDoc(ref);
    const vb = snap.data()?.villageBoard || {};
    const today = todayKey();
    if (vb.diceGrantedDate === today) return { ok: true, dice: vb.dice ?? DAILY_DICE, granted: false };
    await updateDoc(ref, {
      "villageBoard.dice": DAILY_DICE,
      "villageBoard.diceGrantedDate": today,
      "villageBoard.boardPos": 0,   // 每日回到起點
      "villageBoard.lapCount": 0,   // 圈數歸零（村目標貢獻另存於 goal 文件，不受影響）
    });
    return { ok: true, dice: DAILY_DICE, granted: true, reset: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 測試/後台用：補滿骰子並清除當日發放記錄（可重複補、方便測試）
export async function refillBoardDice(memberId, amount = DAILY_DICE) {
  if (!memberId) return { ok: false };
  try {
    await updateDoc(doc(db, "members", memberId), {
      "villageBoard.dice": amount,
      "villageBoard.diceGrantedDate": "",
    });
    return { ok: true, dice: amount };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function setBoardMode(memberId, modeId) {
  if (!memberId || !BOARD_MODE_MAP[modeId]) return { ok: false, reason: "模式錯誤" };
  try {
    await updateDoc(doc(db, "members", memberId), { "villageBoard.mode": modeId });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 前頁選定「採集地圖(族) + T階」進場
export async function setBoardSession(memberId, modeId, tier) {
  if (!memberId || !BOARD_MODE_MAP[modeId]) return { ok: false, reason: "模式錯誤" };
  try {
    await updateDoc(doc(db, "members", memberId), { "villageBoard.mode": modeId, "villageBoard.tier": tier || 1 });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 花 1 骰、隨機 1~6 步、前進、偵測繞圈。回傳落點資訊（獎勵由 applyBoardReward 結算）。
export async function rollAndMove(memberId) {
  if (!memberId) return { ok: false };
  try {
    const ref = doc(db, "members", memberId);
    const snap = await getDoc(ref);
    const vb = { ...DEFAULT_BOARD, ...(snap.data()?.villageBoard || {}) };
    if ((vb.dice || 0) <= 0) return { ok: false, reason: "骰子用完了，明天再來！" };
    const roll = 1 + Math.floor(Math.random() * 6);
    const from = vb.boardPos || 0;
    const to = (from + roll) % BOARD_SIZE;
    const lapped = from + roll >= BOARD_SIZE;
    await updateDoc(ref, {
      "villageBoard.dice": increment(-1),
      "villageBoard.boardPos": to,
      ...(lapped ? { "villageBoard.lapCount": increment(1), villageTotalLaps: increment(1) } : {}),
    });
    import("./worldBossDb").then(module => module.contributeWorldBossSpawnProgress({
      memberId, type:"villageDice", amount:1, operationId:`village-dice:${memberId}:${Date.now()}:${from}:${to}`,
    })).catch(() => {});
    return { ok: true, roll, from, to, lapped, tile: BOARD_LAYOUT[to], diceLeft: (vb.dice || 0) - 1 };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 直接設定棋子位置（命運/機會的 move/teleport 用）
export async function setBoardPos(memberId, pos) {
  try {
    await updateDoc(doc(db, "members", memberId), { "villageBoard.boardPos": ((pos % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function addBoardDice(memberId, delta) {
  try {
    await updateDoc(doc(db, "members", memberId), { "villageBoard.dice": increment(delta) });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ── 結算落點格獎勵 ─────────────────────────────────────────
// villageBuildings：profile.village.buildings（決定該模式階級上限）
// catId：profile.equippedCat?.catId（貓咪羈絆格用）
export async function settleBoardTile(memberId, tileType, { villageBuildings = {}, catId, partyMult = 1, scoreRatio = 0 } = {}) {
  const ref = doc(db, "members", memberId);
  const snap = await getDoc(ref);
  const vb = snap.data()?.villageBoard || {};
  const modeId = vb.mode || "mine";
  const mode = BOARD_MODE_MAP[modeId];
  const tierCap = getModeTierCap(modeId, villageBuildings);
  const reward = rollTileReward(tileType, { mode, tierCap, partyMult, scoreRatio, tier: vb.tier || tierCap });
  await applyBoardReward(memberId, reward, { catId });
  return { ok: true, reward, mode };
}

// 把 reward descriptor 套用到 Firestore（走既有 db 函式）
export async function applyBoardReward(memberId, reward, { catId } = {}) {
  if (!memberId || !reward) return { ok: false };
  try {
    const tasks = [];
    if (reward.coins > 0) tasks.push(addCoins(memberId, reward.coins));
    if (reward.arrowdew > 0) tasks.push(addArrowdew(memberId, reward.arrowdew));
    if (reward.gachaToken > 0) tasks.push(addGachaCoins(memberId, reward.gachaToken));
    if (reward.catXP > 0 && catId) tasks.push(addCatXP(memberId, catId, reward.catXP));
    if (reward.catBond > 0 && catId) tasks.push(addCatBond(memberId, catId, reward.catBond));

    // 家族素材（materialInventory：每個 id 依數量展開成陣列）
    const matArr = [];
    Object.entries(reward.familyMaterials || {}).forEach(([id, n]) => { for (let i = 0; i < n; i++) matArr.push({ id }); });
    if (matArr.length) tasks.push(addMaterials(memberId, matArr));

    // 村資源（members.village.resources.X increment）
    const resPatch = {};
    Object.entries(reward.villageResources || {}).forEach(([k, n]) => { if (n > 0) resPatch[`village.resources.${k}`] = increment(n); });
    if (Object.keys(resPatch).length) tasks.push(updateDoc(doc(db, "members", memberId), resPatch));

    // 藥水（potionInventory）
    if ((reward.potions || []).length) {
      const potionItems = reward.potions.map(() => {
        const pick = CARRY_POTIONS[Math.floor(Math.random() * CARRY_POTIONS.length)];
        return pick ? { id: pick.id, count: 1 } : null;
      }).filter(Boolean);
      if (potionItems.length) tasks.push(addPotions(memberId, potionItems));
    }

    // 寶箱（family → makeFamilyMaterialChest；universal → 通用等級箱物件）
    const chestObjs = (reward.chests || []).map(c => {
      if (c.kind === "family") return makeFamilyMaterialChest(c.family, Math.min(6, c.tier || 1), "棋盤");
      const type = (c.tier || 1) <= 2 ? "iron" : (c.tier || 1) <= 4 ? "gold" : "epic";
      return { id: `chest_board_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, family: c.family || null, tier: ["common","rare","elite","fierce","boss","mythic"][(c.tier||1)-1] || "common", from: "棋盤", ts: Date.now() };
    });
    if (chestObjs.length) tasks.push(addChests(memberId, chestObjs));

    await Promise.all(tasks.filter(Boolean));
    return { ok: true };
  } catch (e) { console.warn("applyBoardReward:", e?.message); return { ok: false, reason: e?.message }; }
}

// ── 命運/機會事件效果套用 ───────────────────────────────────
// 回傳需要 UI 反應的資訊（移動/傳送等），資源類直接套用。
export async function applyEventEffect(memberId, event, { villageBuildings = {}, catId } = {}) {
  const eff = event?.effect;
  if (!eff) return { ok: true, kind: "flavor" };
  const modeSnap = await getDoc(doc(db, "members", memberId));
  const modeId = modeSnap.data()?.villageBoard?.mode || "mine";
  const mode = BOARD_MODE_MAP[modeId];
  const tierCap = getModeTierCap(modeId, villageBuildings);
  const scale = n => Math.max(1, Math.round(n));
  const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

  switch (eff.type) {
    case "micro":
      await applyBoardReward(memberId, { coins: eff.coins || 0 }, { catId });
      return { ok: true, kind: "flavor" };
    case "gain": {
      const amt = rnd(eff.min, eff.max);
      await applyGainLose(memberId, mode, eff.resource, amt, tierCap, catId, +1);
      return { ok: true, kind: "gain", resource: eff.resource, amount: amt };
    }
    case "lose": {
      const amt = rnd(eff.min, eff.max);
      await applyGainLose(memberId, mode, eff.resource, amt, tierCap, catId, -1);
      return { ok: true, kind: "lose", resource: eff.resource, amount: amt };
    }
    case "move":     return { ok: true, kind: "move", steps: eff.steps };       // UI 觸發移動
    case "teleport": return { ok: true, kind: "teleport", tile: eff.tile };     // UI 找最近格
    case "dice":     await addBoardDice(memberId, eff.delta); return { ok: true, kind: "dice", delta: eff.delta };
    case "multiplier": return { ok: true, kind: "multiplier", next: eff.next, factor: eff.factor }; // UI 記到下一格
    case "chest":    await applyBoardReward(memberId, { chests: [{ kind: eff.kind, family: mode.family, tier: tierCap }] }, {}); return { ok: true, kind: "chest" };
    case "catBond":  await applyBoardReward(memberId, { catXP: eff.xp || 0, catBond: eff.bond || 0 }, { catId }); return { ok: true, kind: "catBond" };
    case "trigger":  return { ok: true, kind: "trigger", event: eff.event };    // UI 觸發挖礦/怪物射箭
    case "team":     return { ok: true, kind: "team", sub: eff.sub, effect: eff }; // 組隊由 team db 處理；單人退化微獎勵
    default: return { ok: true, kind: "none" };
  }
}

async function applyGainLose(memberId, mode, resource, amount, tierCap, catId, sign) {
  const n = sign > 0 ? amount : -amount;
  if (resource === "coins")      return addCoins(memberId, n);
  if (resource === "arrowdew")   return addArrowdew(memberId, n);
  if (resource === "gachaToken") return addGachaCoins(memberId, n);
  if (resource === "catXP")      return catId ? addCatXP(memberId, catId, Math.max(0, amount)) : null;
  if (resource === "material") {  // 家族素材（只加，不扣）
    if (sign > 0) {
      const reward = { familyMaterials: {} };
      const tier = Math.min(6, Math.max(1, Math.ceil(Math.random() * tierCap)));
      // 原本組舊表 id `${family}_m${tier}`，但舊表（monsterMaterials.js）只有六族、沒有寶箱族，
      // 而 BOARD_MODES 是從 GATHERING_SITES 衍生的，新增第七族後這裡會發出不存在的
      // treasure_m{tier}。改用 getNormalMaterialPool 從該族該階的 3 種一般素材隨機取一種
      // （與 boardData.js 射箭格同一套來源），寶箱族因此也能正常給素材。
      const pool = getNormalMaterialPool({ family: mode.family, exactTier: tier });
      const picked = pool[Math.floor(Math.random() * pool.length)];
      if (!picked) return null;
      reward.familyMaterials[picked.id] = amount;
      return applyBoardReward(memberId, reward, {});
    }
    return null;
  }
  // 其他村資源
  return updateDoc(doc(db, "members", memberId), { [`village.resources.${resource}`]: increment(n) });
}

// ── 探索地圖重製：per-map 旅程（08-07-village-board-journey-redesign）────
// ⚠️ 舊版單人/組隊棋盤（boardPos/lapCount/mode）**完全保留不動**——旅程寫 maps.{id}，
//    兩套並存直到 Phase 3/4 把舊版換掉。旅程進度跨日保留（ensureDailyDice 只重置骰子與
//    舊棋盤欄位，不碰 maps）。
//
// 旅程狀態：{ seed, pos, length, clears, tier, buffs }
//   length===0 表示尚未開始（startJourney 才生成）；clears＝完成次數（= 舊 lapCount 語意）；
//   buffs：本趟營地 campMult / 強化 nextShootMult / 貓夥伴 catmate，完成旅程時一併清空。

// 首次進場生成 seed（未開始才生成）；已開始只更新 tier。
// 遷移寫入邊界：舊 boardPos/lapCount/mode/boardSeed 併入 maps 後**清掉**，
// 避免 normalizeVillageBoard 每次重塞過時的 boardPos。
export async function startJourney(memberId, mapId, tier) {
  if (!memberId || !JOURNEY_MAP_META[mapId]) return { ok: false, reason: "地圖錯誤" };
  try {
    const ref = doc(db, "members", memberId);
    const snap = await getDoc(ref);
    const vb = snap.data()?.villageBoard || {};
    const norm = normalizeVillageBoard(vb);
    const cur = norm.maps[mapId];
    const patch = {};
    if (!cur || !cur.length) {
      const seed = randomSeed();
      const j = generateJourney(mapId, seed);
      patch[`villageBoard.maps.${mapId}`] = { seed, pos: 0, length: j.length, clears: 0, tier: tier || 1, buffs: {} };
    } else {
      // ⚠️ 階級鎖定（08-07）：進行中的旅程不接受改 tier——UI 已禁用選擇器，
      //    這裡是第二道防線。舊資料 cur.tier 可能為 0（遷移前未記錄），
      //    這種情況才接受新選值並從此鎖定（lockedJourneyTier）。
      patch[`villageBoard.maps.${mapId}.tier`] = lockedJourneyTier(cur, tier);
    }
    // 遷移：舊欄位已併入 maps，清掉避免重塞
    if (typeof vb.boardPos === "number") {
      patch["villageBoard.boardPos"] = deleteField();
      patch["villageBoard.lapCount"] = deleteField();
      patch["villageBoard.mode"] = deleteField();
      patch["villageBoard.boardSeed"] = deleteField();
    }
    await updateDoc(ref, patch);
    const started = patch[`villageBoard.maps.${mapId}`];
    return { ok: true, map: started || { ...cur, tier: patch[`villageBoard.maps.${mapId}.tier`] } };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 花 1 骰、隨機 1~6 步、旅程內前進（夾在終點）。回傳落點資訊（獎勵由 settleJourneyTile 結算）。
export async function rollJourney(memberId, mapId) {
  if (!memberId || !JOURNEY_MAP_META[mapId]) return { ok: false };
  try {
    const ref = doc(db, "members", memberId);
    const snap = await getDoc(ref);
    const vb = snap.data()?.villageBoard || {};
    const norm = normalizeVillageBoard(vb);
    const m = norm.maps[mapId];
    if (!m || !m.length) return { ok: false, reason: "旅程尚未開始" };
    if ((norm.dice || 0) <= 0) return { ok: false, reason: "骰子用完了，明天再來！" };
    // 🎲 多骰（強化格 diceCount buff）：一次擲 2~3 顆骰子、移動距離大增；用完即消耗。
    const diceN = m.buffs?.diceCount || 1;
    const { rolls, total } = rollJourneyDice(diceN);
    const roll = total;
    const from = m.pos || 0;
    const to = nextPos(from, roll, m.length);
    const patch = {
      "villageBoard.dice": increment(-1),
      [`villageBoard.maps.${mapId}.pos`]: to,
    };
    if (diceN > 1) patch[`villageBoard.maps.${mapId}.buffs.diceCount`] = deleteField();
    await updateDoc(ref, patch);
    import("./worldBossDb").then(module => module.contributeWorldBossSpawnProgress({
      memberId, type: "villageDice", amount: 1, operationId: `village-journey:${memberId}:${Date.now()}:${from}:${to}`,
    })).catch(() => {});
    return { ok: true, roll, rolls, from, to, reachedBoss: to === m.length - 1, diceLeft: (norm.dice || 0) - 1 };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 採集 C 三選一的獎勵組合：0＝素材、1＝資源（豐收）、2＝混合
function rollMiningRewards(choice, ctx) {
  if (choice === 0) return [rollTileReward("material", ctx)];
  if (choice === 1) return [rollTileReward("mining", { ...ctx, gatheringProgress: 140 })];
  return [rollTileReward("mining", { ...ctx, gatheringProgress: 100 }), rollTileReward("material", ctx)];
}

// 結算旅程落點。tileType 來自旅程 cells[to]。
// ctx: { villageBuildings, catId, scoreRatio, miningChoice }
// 特殊回傳：movedTo（陷阱/捷徑）、buffs（更新後）、completed（終點 Boss 完成旅程）
export async function settleJourneyTile(memberId, mapId, tileType, ctx = {}) {
  if (!memberId || !JOURNEY_MAP_META[mapId]) return { ok: false };
  const { villageBuildings = {}, catId, scoreRatio = 0, miningChoice } = ctx;
  try {
    const ref = doc(db, "members", memberId);
    const snap = await getDoc(ref);
    const vb = snap.data()?.villageBoard || {};
    const norm = normalizeVillageBoard(vb);
    const m = norm.maps[mapId];
    if (!m || !m.length) return { ok: false, reason: "旅程尚未開始" };
    const mode = JOURNEY_MAP_META[mapId];
    const tierCap = getModeTierCap(mapId, villageBuildings);
    const T = Math.max(1, Math.min(m.tier || tierCap, tierCap));
    const buffs = m.buffs || {};
    // 貓夥伴 buff：射箭完成度 +5%/層（可疊加；怪物/終點 Boss 都吃）
    // ⚠️ 舊資料 catmate:true 視為 1 層（Number(true)=1）
    const effRatio = Math.min(1, (scoreRatio || 0) + (Number(buffs.catmate) || 0) * 0.05);
    const baseCtx = { mode, tierCap, tier: T, scoreRatio: effRatio, partyMult: 1 };
    const campMult = buffs.campMult || 1;
    const shootMult = buffs.nextShootMult || 1;

    // ── buff 格：只改 buffs，不給資源 ──
    if (tileType === "camp" || tileType === "empower" || tileType === "catmate") {
      const reward = rollTileReward(tileType, baseCtx);
      const newBuffs = mergeBuffs(buffs, reward);
      await updateDoc(ref, { [`villageBoard.maps.${mapId}.buffs`]: newBuffs });
      return { ok: true, reward, buffs: newBuffs, kind: "buff" };
    }

    // ── 陷阱：多種事件（蛇咬/流沙/竊金/骰子/箭露），懲罰由 trapType 決定（下限保護）──
    if (tileType === "trap") {
      const reward = rollTileReward("trap", baseCtx);
      const newPos = applyTrapPos(m.pos, m.length, reward.back ?? 2);
      const coins = snap.data()?.coins || 0;
      const lose = Math.min(coins, reward.loseCoins || 0);
      const patch = { [`villageBoard.maps.${mapId}.pos`]: newPos };
      if (lose > 0) patch.coins = increment(-lose);
      // 箭露損失（流沙/箭露灑了）——直接扣 addArrowdew（下限 0，扣不動就 0）
      const dewLose = Math.min(reward.loseArrowdew || 0, Math.max(0, (snap.data()?.arrowdew || 0)));
      if (dewLose > 0) patch.arrowdew = increment(-dewLose);
      // 骰子被偷（dice 事件）——骰子用完了就退回金幣懲罰
      let diceLost = 0;
      if (reward.loseDice) {
        const have = norm.dice || 0;
        if (have > 0) { diceLost = Math.min(have, reward.loseDice); patch["villageBoard.dice"] = increment(-diceLost); }
      }
      await updateDoc(ref, patch);
      return { ok: true, reward: { ...reward, coins: 0, loseCoins: lose, loseArrowdew: dewLose, loseDice: diceLost }, buffs, kind: "trap", movedTo: newPos };
    }

    // ── 捷徑：前進 3~5 格（可能直達終點→由 UI 開 Boss 射箭）──
    if (tileType === "shortcut") {
      const reward = rollTileReward("shortcut", baseCtx);
      const newPos = applyShortcutPos(m.pos, m.length, reward.jumpAhead);
      await updateDoc(ref, { [`villageBoard.maps.${mapId}.pos`]: newPos });
      return { ok: true, reward, buffs, kind: "shortcut", movedTo: newPos, reachedBoss: newPos === m.length - 1 };
    }

    // ── 採集（挖礦）：不射箭，直接給資源（08-08 起不再有三選一——動畫只播不選，
    //    進度以「完成」（gatheringProgress 100 → ×1.2）結算；miningChoice 保留給舊版棋盤）──
    if (tileType === "mining") {
      if (miningChoice != null) {
        const parts = rollMiningRewards(miningChoice, baseCtx);
        const reward = combineRewards(parts[0], parts[1] || {});
        for (const part of parts) {
          await applyBoardReward(memberId, applyJourneyMultipliers(part, { campMult }), { catId });
        }
        return { ok: true, reward: applyJourneyMultipliers(reward, { campMult }), buffs, kind: "mining", choice: miningChoice };
      }
      const reward = applyJourneyMultipliers(rollTileReward("mining", { ...baseCtx, gatheringProgress: 100 }), { campMult });
      await applyBoardReward(memberId, reward, { catId });
      return { ok: true, reward, buffs, kind: "mining" };
    }

    // ── 射箭格（怪物／終點 Boss）──
    if (tileType === "monster" || tileType === "boss") {
      let reward = rollTileReward(tileType, baseCtx);
      reward = applyJourneyMultipliers(reward, { shootMult, campMult });
      if (tileType === "boss") {
        // 終點：無失敗，按分數帶給獎 → 完成探險地圖一次 → 重置換新 seed
        const clears = (m.clears || 0) + 1;
        const seed = randomSeed();
        const j = generateJourney(mapId, seed);
        // ⚠️ 階級重選（08-07）：每趟走完回選單重選 T——tier 歸 0＝未鎖定，
        //    lockedJourneyTier 接受新選（跟舊資料 tier=0 同一條路）。
        const patch = {
          [`villageBoard.maps.${mapId}`]: { seed, pos: 0, length: j.length, clears, tier: 0, buffs: {} },
        };
        await applyBoardReward(memberId, reward, { catId });
        await updateDoc(ref, patch);
        const completionId = soloExplorationCompletionOperation({
          memberId, mapId, journeySeed: m.seed, completed: true,
        });
        import("./villageGoalDb").then(m2 => m2.contributeExplorationCompletionToGoal(memberId, completionId, 1)).catch(() => {});
        return { ok: true, reward, buffs: {}, kind: "boss", completed: true, clears, newSeed: seed };
      }
      const patch = {};
      if (shootMult > 1) patch[`villageBoard.maps.${mapId}.buffs.nextShootMult`] = deleteField();
      await applyBoardReward(memberId, reward, { catId });
      if (Object.keys(patch).length) await updateDoc(ref, patch);
      return { ok: true, reward, buffs: { ...buffs, nextShootMult: 0 }, kind: "shoot" };
    }

    // ── 一般格（material/coins/arrowdew/gacha/potion/chest/catbond/start/scenery/market）──
    // 命運/機會在旅程中不翻卡：給少量金幣（避免空獎），事件卡僅舊版棋盤使用。
    const reward = applyJourneyMultipliers(
      (tileType === "fate" || tileType === "opp")
        ? { coins: 20 + Math.floor(Math.random() * 60) * T }
        : rollTileReward(tileType, baseCtx),
      { campMult }
    );
    await applyBoardReward(memberId, reward, { catId });      return { ok: true, reward, buffs, kind: "default" };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 分岔路口：玩家二選一後跳到目標格（不耗骰）。
// side "left"＝穩妥路（前方最近的素材/採集格）、"right"＝冒險路（前方最近的怪物格）。
// 回傳 { ok, movedTo, tile, reachedBoss }，UI 播移動動畫後照常結算目標格。
export async function chooseForkPath(memberId, mapId, side) {
  if (!memberId || !JOURNEY_MAP_META[mapId]) return { ok: false };
  try {
    const ref = doc(db, "members", memberId);
    const snap = await getDoc(ref);
    const vb = snap.data()?.villageBoard || {};
    const norm = normalizeVillageBoard(vb);
    const m = norm.maps[mapId];
    if (!m || !m.length) return { ok: false, reason: "旅程尚未開始" };
    const j = generateJourney(mapId, m.seed);
    const targets = side === "right" ? ["monster"] : ["material", "mining"];
    const found = findNextTile(j.cells, m.pos || 0, targets);
    // 找不到目標格（太接近終點）→ 退回固定步數
    const fallback = side === "right" ? 4 : 2;
    const movedTo = found != null ? found : Math.min(j.length - 1, (m.pos || 0) + fallback);
    await updateDoc(ref, { [`villageBoard.maps.${mapId}.pos`]: movedTo });
    return { ok: true, movedTo, tile: j.cells[movedTo], reachedBoss: movedTo === j.length - 1 };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// ── 🃏 抽卡房（08-08）：踩到抽卡房格後開抽卡 overlay ──────────
// 免費抽 1 張（不花錢）／付費抽 3 張（扣金幣 CARD_GACHA_PAID_PRICE）。
// 池＝該 T 階級普通怪卡（boardCardGacha 純函式）；入帳走既有 addMonsterCard
// （重複卡自動累計 duplicates 供升星）。回傳卡面 view 陣列供 UI 顯示。

// 單人免費抽：不花錢，抽 1 張入帳。回傳 { ok, views }（views＝卡面 view 陣列）
export async function claimCardGachaFree(memberId, mapId, tier) {
  if (!memberId || !JOURNEY_MAP_META[mapId]) return { ok: false };
  try {
    const entry = rollCardGachaOne(tier);
    if (!entry) return { ok: false, reason: "此階級尚無卡片" };
    const write = await addMonsterCards(memberId, [cardToMonsterCard(entry)]);
    if (!write.ok) return { ok:false, reason:write.reason || "卡片入庫失敗" };
    return { ok: true, views: [cardToView(entry, true)] };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 單人付費抽：扣金幣 CARD_GACHA_PAID_PRICE，抽 3 張入帳。回傳 { ok, views }
export async function claimCardGachaPaid(memberId, mapId, tier) {
  if (!memberId || !JOURNEY_MAP_META[mapId]) return { ok: false };
  try {
    const spend = await spendCoins(memberId, CARD_GACHA_PAID_PRICE);
    if (!spend?.ok) return { ok: false, reason: spend?.reason || "金幣不足" };
    const entries = rollCardGachaN(tier, 3);
    if (!entries.length) { await addCoins(memberId, CARD_GACHA_PAID_PRICE); return { ok: false, reason: "此階級尚無卡片" }; }
    const write = await addMonsterCards(memberId, entries.map(cardToMonsterCard));
    if (!write.ok) {
      await addCoins(memberId, CARD_GACHA_PAID_PRICE);
      return { ok:false, reason:write.reason || "卡片入庫失敗，金幣已退回" };
    }
    return { ok: true, views: entries.map(e => cardToView(e, true)) };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

// 組隊 claim 用：免費抽 1 張入帳（組隊結算自動化，不開付費互動）。
// 回傳 { ok, views }——由 claimBoardSettle 的 cardgacha 分支呼叫。
export async function claimCardGachaTeamFree(memberId, tier) {
  if (!memberId) return { ok: false };
  try {
    const entry = rollCardGachaOne(tier);
    if (!entry) return { ok: false, reason: "此階級尚無卡片" };
    const write = await addMonsterCards(memberId, [cardToMonsterCard(entry)]);
    if (!write.ok) return { ok:false, reason:write.reason || "卡片入庫失敗" };
    return { ok: true, views: [cardToView(entry, true)] };
  } catch (e) { return { ok: false, reason: e?.message }; }
}
