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
    request.onerror = () => reject(new Error("朋友收藏没有打开成功"));
  });
}
function read(request) { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function done(transaction) { return new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || new Error("保存已取消")); }); }

export function normalizeFriend(value, previous = null) {
  const clean = (text, max) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
  const name = clean(value.name, 24);
  if (!name) throw new Error("先给新朋友取个名字吧");
  const portraitBlob = value.portraitBlob || previous?.portraitBlob;
  if (!(portraitBlob instanceof Blob) || !portraitBlob.type.startsWith("image/") || portraitBlob.size > 2_000_000) throw new Error("请使用一张清楚的小照片");
  return {
    id: previous?.id || value.id || createFriendId(), name,
    kind: clean(value.kind, 32), appearance: clean(value.appearance, 160), childDescription: clean(value.childDescription, 240),
    portraitBlob, createdAt: previous?.createdAt || Number(value.createdAt) || Date.now(), updatedAt: Date.now(),
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
    if (!previous && count >= FRIEND_LIMIT) { await finished; throw new Error("朋友收藏已经满了，可以先整理几张名片"); }
    const record = normalizeFriend(value, previous);
    store.put(record);
    await finished;
    return record;
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
