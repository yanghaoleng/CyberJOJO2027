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

export function createConversationEntry({ role, text, character, createdAt = Date.now() }) {
  const normalizedRole = role === "assistant" ? "assistant" : "user";
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim().slice(0, 180);
  if (!normalizedText) return null;
  const randomPart = globalThis.crypto?.randomUUID?.()
    || `${createdAt}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: `dialogue-${randomPart}`,
    role: normalizedRole,
    text: normalizedText,
    character: character === "lvdou" ? "lvdou" : "jiaojiao",
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

export async function storeConversationSummary(summary) {
  const dayKey = String(summary?.dayKey || "");
  const text = String(summary?.summary || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!dayKey || !text) return false;
  const database = await openConversationDatabase();
  if (!database) return false;
  try {
    const transaction = database.transaction(SUMMARY_STORE_NAME, "readwrite");
    transaction.objectStore(SUMMARY_STORE_NAME).put({ ...summary, dayKey, summary: text });
    await transactionDone(transaction);
    return true;
  } finally {
    database.close();
  }
}

