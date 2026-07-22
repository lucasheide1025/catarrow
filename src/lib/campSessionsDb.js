import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const CAMP_SESSIONS_COLLECTION = "campSessions";

function newestFirst(snapshot) {
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((left, right) => (
      (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0)
    ));
}

export async function getCampSessions() {
  const snapshot = await getDocs(collection(db, CAMP_SESSIONS_COLLECTION));
  return newestFirst(snapshot);
}

export function subscribeCampSessions(callback) {
  return onSnapshot(collection(db, CAMP_SESSIONS_COLLECTION), (snapshot) => {
    callback(newestFirst(snapshot));
  });
}

export async function createCampSession(data, operatorId) {
  const ref = await addDoc(collection(db, CAMP_SESSIONS_COLLECTION), {
    name: data.name || "",
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    active: data.active !== undefined ? data.active : true,
    createdBy: operatorId || null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCampSession(id, patch) {
  await updateDoc(doc(db, CAMP_SESSIONS_COLLECTION, id), patch);
}

export async function deleteCampSession(id) {
  await deleteDoc(doc(db, CAMP_SESSIONS_COLLECTION, id));
}
