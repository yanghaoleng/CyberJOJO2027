import { getLocalDayKey } from "./daily-timeline.js";

export const CONVERSATION_ENTRY_LIMIT = 240;

const DATABASE_NAME = "jocam-conversation-journal";
const DATABASE_VERSION = 1;
const ENTRY_STORE_NAME = "entries";
const SUMMARY_STORE_NAME = "summaries";

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Conversation journal transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("Conversation journal transaction was aborted"));
  });
}

function openConversationDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ENTRY_STORE_NAME)) {
        const entries = database.createObjectStore(ENTRY_STORE_NAME, { keyPath: "id" });
        entries.createIndex("createdAt", "createdAt");
      }
      if (!database.objectStoreNames.contains(SUMMARY_STORE_NAME)) {
        database.createObjectStore(SUMMARY_STORE_NAME, { keyPath: "dayKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Conversation journal could not be opened"));
  });
}

function readAll(request, errorMessage) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error(errorMessage));
  });
}

function readRecentEntries(store, limit) {
  return new Promise((resolve, reject) => {
    const entries = [];
    const request = store.index("createdAt").openCursor(null, "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || entries.length >= limit) {
        resolve(entries.reverse());
        return;
      }
      entries.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error("Conversation entries could not be read"));
  });
}

function readStaleEntryIds(store, limit) {
  return new Promise((resolve, reject) => {
    const staleIds = [];
    let position = 0;
    const request = store.index("createdAt").openKeyCursor(null, "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(staleIds);
        return;
      }
      if (position >= limit) staleIds.push(cursor.primaryKey);
      position += 1;
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error("Conversation entries could not be pruned"));
  });
}

export function createConversationEntry({ id, role, text, character, source, sessionId = "", createdAt = Date.now() }) {
  const normalizedRole = role === "assistant" ? "assistant" : "user";
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!normalizedText) return null;
  const randomPart = globalThis.crypto?.randomUUID?.()
    || `${createdAt}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: String(id || `dialogue-${randomPart}`).slice(0, 100),
    role: normalizedRole,
    text: normalizedText,
    character: character === "lvdou" ? "lvdou" : "jiaojiao",
    source: ["child_speech", "character_reply", "scene_comment", "gameplay"].includes(source)
      ? source : normalizedRole === "user" ? "child_speech" : "character_reply",
    sessionId: String(sessionId).slice(0, 100),
    createdAt: Number(createdAt) || Date.now(),
  };
}

export async function loadConversationEntries(limit = CONVERSATION_ENTRY_LIMIT) {
  const database = await openConversationDatabase();
  if (!database) return [];
  try {
    const transaction = database.transaction(ENTRY_STORE_NAME, "readonly");
    const entries = await readRecentEntries(transaction.objectStore(ENTRY_STORE_NAME), limit);
    await transactionDone(transaction);
    return entries;
  } finally {
    database.close();
  }
}

export async function loadConversationSummaries() {
  const database = await openConversationDatabase();
  if (!database) return [];
  try {
    const transaction = database.transaction(SUMMARY_STORE_NAME, "readonly");
    const summaries = await readAll(
      transaction.objectStore(SUMMARY_STORE_NAME).getAll(),
      "Conversation summaries could not be read",
    );
    await transactionDone(transaction);
    return summaries;
  } finally {
    database.close();
  }
}

export async function storeConversationEntry(entry, limit = CONVERSATION_ENTRY_LIMIT) {
  const database = await openConversationDatabase();
  if (!database || !entry) return false;
  try {
    const transaction = database.transaction(ENTRY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(ENTRY_STORE_NAME);
    store.put(entry);
    const staleIds = await readStaleEntryIds(store, limit);
    for (const staleId of staleIds) store.delete(staleId);
    await transactionDone(transaction);
    return true;
  } finally {
    database.close();
  }
}

export async function storeConversationSummary(summary, { expectedRevision } = {}) {
  const dayKey = String(summary?.dayKey || "");
  const text = String(summary?.summary || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!dayKey) return false;
  const database = await openConversationDatabase();
  if (!database) return false;
  try {
    const transaction = database.transaction(SUMMARY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SUMMARY_STORE_NAME);
    const previous = await readAll(store.get(dayKey), "Could not read journal revision");
    if (expectedRevision !== undefined && Number(previous?.revision || 0) !== expectedRevision) {
      await transactionDone(transaction);
      return false;
    }
    store.put(mergeJournalSummary(previous, { ...summary, dayKey, summary: text }));
    await transactionDone(transaction);
    return true;
  } finally {
    database.close();
  }
}

export function mergeJournalSummary(previous = {}, incoming = {}) {
  const suppressed = new Set(previous?.suppressedEntryIds || []);
  const processed = new Set(incoming.processedEntryIds || []);
  const moments = new Map((previous?.moments || []).filter((moment) => moment.userEdited || !moment.sourceEntryIds?.some((id) => processed.has(id)))
    .map((moment) => [moment.id, moment]));
  for (const moment of incoming.moments || []) {
    if (!moment?.id || moment.sourceEntryIds?.some((id) => suppressed.has(id))) continue;
    if (!moments.get(moment.id)?.userEdited) moments.set(moment.id, moment);
  }
  const retained = [...moments.values()].slice(-60);
  const keepDialogue = previous?.source === "dialogue" && incoming.source === "captures";
  return {
    ...previous, ...incoming,
    source: keepDialogue ? previous.source : incoming.source,
    summary: retained.length ? summarizeMoments(retained)
      : keepDialogue ? previous.summary : incoming.summary || "",
    moments: retained,
    revision: Number(previous?.revision || 0),
    suppressedEntryIds: [...suppressed],
  };
}

export function summarizeMoments(moments = []) {
  return moments.map((moment) => [moment.event, moment.feeling, moment.thought].filter(Boolean).join("，"))
    .filter(Boolean).join("；").slice(0, 600);
}

async function mutateJournalMoment(dayKey, momentId, patch) {
  const database = await openConversationDatabase();
  if (!database) throw new Error("本机存储暂时不可用");
  try {
    const transaction = database.transaction([SUMMARY_STORE_NAME, ENTRY_STORE_NAME], "readwrite");
    const summaries = transaction.objectStore(SUMMARY_STORE_NAME);
    const record = await readAll(summaries.get(dayKey), "Could not load journal");
    const target = record?.moments?.find((moment) => moment.id === momentId);
    if (!target) { await transactionDone(transaction); return null; }
    const removedEntryIds = target.sourceEntryIds || [];
    const moments = patch === null ? record.moments.filter((moment) => moment.id !== momentId)
      : record.moments.map((moment) => moment.id !== momentId ? moment : {
        ...moment,
        ...Object.fromEntries(["event", "feeling", "thought"].map((key) => [key, String(patch[key] ?? moment[key] ?? "").trim().slice(0, 240)])),
        evidenceQuote: "", userEdited: true, updatedAt: Date.now(),
      });
    for (const id of removedEntryIds) transaction.objectStore(ENTRY_STORE_NAME).delete(id);
    const next = {
      ...record, moments, summary: summarizeMoments(moments),
      revision: Number(record.revision || 0) + 1,
      suppressedEntryIds: [...new Set([...(record.suppressedEntryIds || []), ...removedEntryIds])],
      updatedAt: Date.now(),
    };
    summaries.put(next);
    await transactionDone(transaction);
    return { record: next, removedEntryIds };
  } finally { database.close(); }
}

export const updateJournalMoment = (dayKey, momentId, patch) => mutateJournalMoment(dayKey, momentId, patch);
export const forgetJournalMoment = (dayKey, momentId) => mutateJournalMoment(dayKey, momentId, null);

export function buildJournalContext(records = {}, entries = []) {
  const days = Object.values(records).sort((a, b) => b.dayKey.localeCompare(a.dayKey));
  const suppressed = new Set(days.flatMap((day) => day.suppressedEntryIds || []));
  return {
    entries: entries.filter((entry) => !suppressed.has(entry.id) && entry.source !== "scene_comment" && entry.source !== "gameplay"
      && !(entry.role === "assistant" && records[getLocalDayKey(entry.createdAt)]?.revision > 0))
      .slice(-16).map(({ id, role, text, createdAt }) => ({ id, role, text, createdAt })),
    moments: days.slice(0, 7).flatMap((day) => (day.moments || []).map((moment) => ({
      id: moment.id, dayKey: day.dayKey, event: moment.event, feeling: moment.feeling || "", thought: moment.thought || "",
    }))).slice(0, 20),
  };
}
