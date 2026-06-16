// src/lib/catDb.js — 貓貓陪練系統 Firestore 操作
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  onSnapshot, serverTimestamp, arrayUnion, increment,
} from "firebase/firestore";
import { db } from "./firebase";
import { CAT_IDS, CATS, drawRandomCat } from "./catData";

// subcollection 路徑：members/{memberId}/cats/{catId}
function catRef(memberId, catId) {
  return doc(db, "members", memberId, "cats", catId);
}
function catColRef(memberId) {
  return collection(db, "members", memberId, "cats");
}

// ── 訂閱我的貓咪收藏 ─────────────────────────────────────────
export function subscribeMyCats(memberId, cb) {
  return onSnapshot(catColRef(memberId), snap => {
    const cats = {};
    snap.docs.forEach(d => { cats[d.id] = { catId: d.id, ...d.data() }; });
    cb(cats);
  }, () => cb({}));
}

// ── 取得我的貓咪 IDs ─────────────────────────────────────────
export async function getOwnedCatIds(memberId) {
  try {
    const snap = await getDocs(catColRef(memberId));
    return snap.docs.map(d => d.id);
  } catch { return []; }
}

// ── 領取免費起始貓（限一次，沒有任何貓時可用）────────────────
export async function claimStarterCat(memberId) {
  try {
    const owned = await getOwnedCatIds(memberId);
    if (owned.length > 0) return { ok: false, reason: "已有貓咪，無法再領取" };

    const catId = CAT_IDS[Math.floor(Math.random() * CAT_IDS.length)];
    const cat   = CATS[catId];
    await setDoc(catRef(memberId, catId), {
      catId,
      name:        cat.name,
      color:       cat.color,
      bond:        0,
      type:        "allround",   // 預設全能型，可之後更換
      chapter:     1,
      unlockedChs: [1],
      isStarter:   true,
      obtainedAt:  serverTimestamp(),
    });
    return { ok: true, catId, catName: cat.name };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 開啟貓貓箱 ───────────────────────────────────────────────
export async function openCatBox(memberId) {
  try {
    const owned = await getOwnedCatIds(memberId);
    const catId = drawRandomCat(owned);

    if (!catId) {
      // 已集齊全部 → 轉換成羈絆經驗（加給裝備中的貓）
      const memberSnap = await getDoc(doc(db, "members", memberId));
      const equipped   = memberSnap.data()?.equippedCat?.catId;
      if (equipped) {
        await updateDoc(catRef(memberId, equipped), { bond: increment(20) });
        return { ok: true, isDuplicate: true, bondAdded: 20 };
      }
      return { ok: true, isDuplicate: true, bondAdded: 0 };
    }

    const cat = CATS[catId];
    await setDoc(catRef(memberId, catId), {
      catId,
      name:        cat.name,
      color:       cat.color,
      bond:        0,
      type:        "allround",
      chapter:     1,
      unlockedChs: [1],
      isStarter:   false,
      obtainedAt:  serverTimestamp(),
    });
    return { ok: true, catId, catName: cat.name, isDuplicate: false };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 更換貓咪類型 ─────────────────────────────────────────────
export async function setCatType(memberId, catId, type) {
  try {
    await updateDoc(catRef(memberId, catId), { type });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 裝備貓咪（寫入 members/{id}.equippedCat）────────────────
export async function equipCat(memberId, catId, type) {
  try {
    const cat = CATS[catId];
    if (!cat) return { ok: false, reason: "貓咪不存在" };
    const catSnap = await getDoc(catRef(memberId, catId));
    const bond = catSnap.exists() ? (catSnap.data().bond || 0) : 0;
    await updateDoc(doc(db, "members", memberId), {
      equippedCat: { catId, name: cat.name, type, color: cat.color, bond },
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 卸下貓咪 ─────────────────────────────────────────────────
export async function unequipCat(memberId) {
  try {
    await updateDoc(doc(db, "members", memberId), { equippedCat: null });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 增加羈絆值（戰鬥結束後呼叫）────────────────────────────
// source: "dungeon" +2 | "party" +2 | "worldboss" +3 | "monster" +1
export async function addCatBond(memberId, catId, source = "monster") {
  const bonusMap = { monster: 1, dungeon: 2, party: 2, worldboss: 3 };
  const amount   = bonusMap[source] || 1;
  try {
    await updateDoc(catRef(memberId, catId), { bond: increment(amount) });
    // 若此貓正在裝備中，同步更新 equippedCat.bond
    const memberSnap = await getDoc(doc(db, "members", memberId));
    if (memberSnap.data()?.equippedCat?.catId === catId) {
      const newBond = (memberSnap.data()?.equippedCat?.bond || 0) + amount;
      await updateDoc(doc(db, "members", memberId), { "equippedCat.bond": newBond });
    }
    return { ok: true, amount };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 解鎖章節 ─────────────────────────────────────────────────
export async function unlockChapter(memberId, catId, chNum) {
  try {
    await updateDoc(catRef(memberId, catId), {
      unlockedChs: arrayUnion(chNum),
      chapter:     chNum,
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 留下祝福（第 11 章紀念章）────────────────────────────────
export async function addBlessing(memberId, memberName, catId, text) {
  try {
    await updateDoc(catRef(memberId, catId), {
      "ch11Blessings": arrayUnion({
        memberId, memberName,
        text: text.slice(0, 200),
        createdAt: new Date().toISOString(),
      }),
    });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── 取得某隻貓的第 11 章祝福（跨玩家）──────────────────────
// 由於祝福儲存在各自的 cats subcollection，需要查所有人
// 暫時設計：由admin collection 統一收集（簡化版：存在管理用的獨立 collection）
export async function getBlessingsForCat(catId) {
  try {
    // 暫以查詢 catBlessings collection 為設計（管理員可聚合）
    // 實際上玩家的祝福儲存在自己的 cats subcollection 中
    // 此函式留作之後擴充
    return [];
  } catch { return []; }
}
