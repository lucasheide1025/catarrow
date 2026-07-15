import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const PARTY = "partyRooms";
const MAX_GATHERING_MEMBERS = 8;

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createGatheringPartyRoom(hostId, hostName, { siteId, tier, buildingLevel }) {
  try {
    const oldSnap = await getDocs(
      query(collection(db, PARTY), where("hostId", "==", hostId), where("type", "==", "gathering"), where("status", "==", "waiting"))
    );
    await Promise.all(oldSnap.docs.map(d => deleteDoc(d.ref)));

    const code = genCode();
    const ref = await addDoc(collection(db, PARTY), {
      code,
      type: "gathering",
      status: "waiting",
      hostId,
      siteId,
      tier,
      buildingLevel: buildingLevel || 1,
      members: {
        [hostId]: {
          name: hostName || "玩家",
          submitted: false,
          progressPct: 0,
          completionLabel: "",
          claimed: false,
          joinedAt: Date.now(),
        },
      },
      createdAt: serverTimestamp(),
      startedAt: null,
      completedAt: null,
    });
    return { ok: true, roomId: ref.id, code };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function joinGatheringPartyRoom(code, memberId, memberName) {
  try {
    const snap = await getDocs(
      query(collection(db, PARTY), where("code", "==", String(code || "").toUpperCase()), where("type", "==", "gathering"), where("status", "==", "waiting"))
    );
    if (snap.empty) return { ok: false, reason: "找不到採集房間，或房間已開始。" };
    const roomDoc = snap.docs[0];
    const room = roomDoc.data();
    const members = room.members || {};
    if (members[memberId]) return { ok: true, roomId: roomDoc.id };
    if (Object.keys(members).length >= MAX_GATHERING_MEMBERS) return { ok: false, reason: "採集房間最多 8 人。" };

    await updateDoc(doc(db, PARTY, roomDoc.id), {
      [`members.${memberId}`]: {
        name: memberName || "玩家",
        submitted: false,
        progressPct: 0,
        completionLabel: "",
        claimed: false,
        joinedAt: Date.now(),
      },
    });
    return { ok: true, roomId: roomDoc.id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export function subscribeGatheringPartyRoom(roomId, callback) {
  return onSnapshot(doc(db, PARTY, roomId), snap => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, () => callback(null));
}

export async function startGatheringPartyRoom(roomId) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      status: "active",
      startedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function submitGatheringPartyResult(roomId, memberId, result) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      [`members.${memberId}.submitted`]: true,
      [`members.${memberId}.claimed`]: true,
      [`members.${memberId}.progressPct`]: Number(result?.progressPct || 0),
      [`members.${memberId}.completionLabel`]: result?.completion?.label || "",
      [`members.${memberId}.materialCount`]: Number(result?.materialCount || 0),
      [`members.${memberId}.catXP`]: Number(result?.catXP || 0),
      [`members.${memberId}.submittedAt`]: Date.now(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function closeGatheringPartyRoom(roomId) {
  try {
    await updateDoc(doc(db, PARTY, roomId), {
      status: "completed",
      completedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
