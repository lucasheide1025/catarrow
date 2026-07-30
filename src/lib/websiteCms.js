import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import { EMPTY_CMS_CONTENT } from "./websiteCmsSchema";
export { EMPTY_CMS_CONTENT, WEBSITE_CMS_PAGES } from "./websiteCmsSchema";
const documentRef = pageId => doc(db, "websiteContent", pageId);
const publicDocumentRef = pageId => doc(db, "publicWebsiteContent", pageId);

function parseContent(value) {
  if (!value) return { ...EMPTY_CMS_CONTENT, text: {}, images: {} };
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return {
      text: parsed?.text && typeof parsed.text === "object" ? parsed.text : {},
      images: parsed?.images && typeof parsed.images === "object" ? parsed.images : {},
    };
  } catch {
    return { ...EMPTY_CMS_CONTENT, text: {}, images: {} };
  }
}

export async function loadWebsiteContent(pageId) {
  const snap = await getDoc(documentRef(pageId));
  if (!snap.exists()) return { draft: parseContent(), published: parseContent(), hasDraft: false };
  const data = snap.data();
  return {
    draft: parseContent(data.draftJson),
    published: parseContent(data.publishedJson),
    hasDraft: !!data.draftJson,
    updatedAt: data.updatedAt || null,
    publishedAt: data.publishedAt || null,
  };
}

export async function saveWebsiteDraft(pageId, content) {
  await setDoc(documentRef(pageId), {
    pageId,
    draftJson: JSON.stringify(parseContent(content)),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || "",
  }, { merge: true });
}

export async function publishWebsiteContent(pageId, content) {
  const normalized = JSON.stringify(parseContent(content));
  const actor = auth.currentUser?.uid || "";
  await Promise.all([
    setDoc(documentRef(pageId), {
      pageId, draftJson: normalized, publishedJson: normalized,
      updatedAt: serverTimestamp(), publishedAt: serverTimestamp(), updatedBy: actor,
    }, { merge: true }),
    setDoc(publicDocumentRef(pageId), {
      pageId, publishedJson: normalized, publishedAt: serverTimestamp(), updatedBy: actor,
    }, { merge: true }),
  ]);
}

export async function uploadWebsiteImage(pageId, file, imageKey) {
  if (!file?.type?.startsWith("image/")) throw new Error("只能上傳圖片檔案");
  if (file.size > 5 * 1024 * 1024) throw new Error("圖片不可超過 5MB");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const target = ref(storage, `website-content/${pageId}/${Date.now()}-${imageKey}-${safeName}`);
  await uploadBytes(target, file, { contentType: file.type, cacheControl: "public,max-age=31536000,immutable" });
  return getDownloadURL(target);
}
