const DATABASE_NAME = "cyberjojo-friends";
const STORE_NAME = "friends";
export const FRIEND_LIMIT = 200;
export const createFriendId = () => `friend-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error("本机存储暂时不可用"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("收集没有打开成功"));
  });
}
function read(request) { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function done(transaction) { return new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || new Error("保存已取消")); }); }

export function normalizeFriend(value, previous = null) {
  value = { ...previous, ...value };
  const clean = (text, max) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
  const name = clean(value.name, 24);
  if (!name) throw new Error("先给收集的物品取个名字吧");
  const status = ["pending", "processing", "failed", "ready"].includes(value.status) ? value.status : "ready";
  const stickerBlob = value.stickerBlob || (status === "ready" ? value.portraitBlob : null);
  const originalBlob = value.originalBlob || null;
  const availableImage = stickerBlob || originalBlob;
  if (!(availableImage instanceof Blob) || !availableImage.type.startsWith("image/") || availableImage.size > 4_000_000) throw new Error("请使用一张清楚的贴纸照片");
  const portraitBlob = value.portraitBlob || previous?.portraitBlob || null;
  return {
    id: previous?.id || value.id || createFriendId(), name,
    kind: clean(value.kind, 32), appearance: clean(value.appearance, 160), childDescription: clean(value.childDescription, 240),
    english: clean(value.english, 48), learning: clean(value.learning, 180),
    character: value.character === "jiaojiao" ? "jiaojiao" : value.character === "lvdou" ? "lvdou" : previous?.character || "legacy",
    sourceIdiom: clean(value.sourceIdiom, 16), sourceMeaning: clean(value.sourceMeaning, 180),
    idiom: clean(value.idiom, 24), idiomMeaning: clean(value.idiomMeaning, 180), stickerBlob,
    originalBlob, status, captureId: value.captureId || null,
    bbox: value.bbox || null, subject: clean(value.subject, 48),
    attempts: Math.max(0, Number(value.attempts) || 0), retryAt: Number(value.retryAt) || 0,
    seenAt: value.status ? Number(value.seenAt) || 0 : Date.now(),
    ...(portraitBlob ? { portraitBlob } : {}),
    createdAt: previous?.createdAt || Number(value.createdAt) || Date.now(), updatedAt: Date.now(),
    version: Number(previous?.version || 0) + 1,
  };
}
export async function loadFriends() {
  const db = await openDatabase();
  try { const tx = db.transaction(STORE_NAME, "readonly"); const finished = done(tx); const result = await read(tx.objectStore(STORE_NAME).getAll()); await finished; return result.sort((a, b) => b.createdAt - a.createdAt); }
  finally { db.close(); }
}
export async function saveFriend(value, { expectedVersion } = {}) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const finished = done(tx);
    const store = tx.objectStore(STORE_NAME);
    const previous = value.id ? await read(store.get(value.id)) : null;
    if (expectedVersion !== undefined && Number(previous?.version || 0) !== expectedVersion) { await finished; throw new Error("这张名片刚刚有了变化，请重新打开后再修改"); }
    const count = await read(store.count());
    if (!previous && count >= FRIEND_LIMIT) { await finished; throw new Error("收集已经满了，可以先整理几张贴纸"); }
    const record = normalizeFriend(value, previous);
    store.put(record);
    await finished;
    return record;
  } finally { db.close(); }
}

// Old records have no unread flag; only newly completed stickers get a badge.
export const isUnreadCollection = (record) => record.status === "ready" && record.seenAt === 0;

export async function markCollectionsSeen(ids) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite"); const finished = done(tx); const store = tx.objectStore(STORE_NAME);
    for (const id of ids) {
      const record = await read(store.get(id));
      if (record?.status === "ready" && !record.seenAt) store.put({ ...record, seenAt: Date.now() });
    }
    await finished;
  } finally { db.close(); }
}
export async function deleteFriend(id) {
  const db = await openDatabase();
  try { const tx = db.transaction(STORE_NAME, "readwrite"); const finished = done(tx); tx.objectStore(STORE_NAME).delete(id); await finished; }
  finally { db.close(); }
}

export async function imageToPortrait(value) {
  let blob = value?.blob || (value instanceof Blob ? value : null);
  if (!blob) {
    const image = typeof value === "string" ? value : value?.image;
    if (!image?.startsWith("data:image/")) throw new Error("还没有拍到新朋友");
    blob = await (await fetch(image)).blob();
  }
  if (!blob.type.startsWith("image/")) throw new Error("请使用图片作为名片封面");
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("照片没有准备好")), "image/jpeg", .82));
  } finally { URL.revokeObjectURL(url); }
}
export function blobToDataUrl(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }); }
