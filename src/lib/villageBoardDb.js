// src/lib/villageBoardDb.js
// 貓貓村大富翁：玩家棋盤狀態 + 每日骰 + 移動 + 結算 + 事件效果。
// 規格見 docs/second_brain/village-board-spec.md。
// ⚠️ members.villageBoard 為新欄位，已加進 firestore.rules 白名單。
import { doc, getDoc, updateDoc, onSnapshot, increment, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { addCoins, addArrowdew, addGachaCoins, addMaterials, addChests, addPotions } from "./db";
import { addCatXP, addCatBond } from "./catDb";
import { CARRY_POTIONS, makeFamilyMaterialChest } from "./itemData";
import { BOARD_LAYOUT, BOARD_SIZE, BOARD_MODE_MAP, getModeTierCap, rollTileReward } from "./boardData";

export const DAILY_DICE = 15;   // 每日補滿至 15（上限 15、不囤積）

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEFAULT_BOARD = { dice: DAILY_DICE, diceGrantedDate: "", boardPos: 0, lapCount: 0, boardSeed: 0, mode: "mine", pendingEvent: null };

export function subscribeBoardState(memberId, cb) {
  if (!memberId) return () => {};
  return onSnapshot(doc(db, "members", memberId), snap => {
    cb(snap.exists() ? { ...DEFAULT_BOARD, ...(snap.data().villageBoard || {}) } : { ...DEFAULT_BOARD });
  }, () => cb({ ...DEFAULT_BOARD }));
}

// 每日補滿骰子（跨日才補；上限 DAILY_DICE、不疊加）
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
    });
    return { ok: true, dice: DAILY_DICE, granted: true };
  } catch (e) { return { ok: false, reason: e?.message }; }
}

export async function setBoardMode(memberId, modeId) {
  if (!memberId || !BOARD_MODE_MAP[modeId]) return { ok: false, reason: "模式錯誤" };
  try {
    await updateDoc(doc(db, "members", memberId), { "villageBoard.mode": modeId });
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
      ...(lapped ? { "villageBoard.lapCount": increment(1) } : {}),
    });
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
  const modeId = snap.data()?.villageBoard?.mode || "mine";
  const mode = BOARD_MODE_MAP[modeId];
  const tierCap = getModeTierCap(modeId, villageBuildings);
  const reward = rollTileReward(tileType, { mode, tierCap, partyMult, scoreRatio });
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
      reward.familyMaterials[`${mode.family}_m${tier}`] = amount;
      return applyBoardReward(memberId, reward, {});
    }
    return null;
  }
  // 其他村資源
  return updateDoc(doc(db, "members", memberId), { [`village.resources.${resource}`]: increment(n) });
}
