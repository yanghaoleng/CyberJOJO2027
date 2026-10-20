import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBDatabase } from "fake-indexeddb";
import { loadMediaCaptures, storeMediaCapture, sortMediaCaptures, toStoredMediaCapture } from "./media-library.js";

test("media captures are shown newest first", () => {
  const captures = sortMediaCaptures([
    { id: "old", createdAt: 10 },
    { id: "new", createdAt: 30 },
    { id: "middle", createdAt: 20 },
  ]);
  assert.deepEqual(captures.map(({ id }) => id), ["new", "middle", "old"]);
});

test("temporary object URLs are never persisted", () => {
  const stored = toStoredMediaCapture({
    id: "photo-1",
    type: "photo",
    blob: { size: 12 },
    url: "blob:temporary",
    createdAt: 10,
  });
  assert.equal("url" in stored, false);
  assert.equal(stored.id, "photo-1");
  assert.equal(stored.type, "photo");
});

test("photos are committed and reloaded after closing the database, with captions and no transient URLs", async (t) => {
  const original = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  t.after(() => { globalThis.indexedDB = original; });
  const blob = new Blob(["thumbs-up-image"], { type: "image/jpeg" });
  const photo = { id: "like-one", type: "photo", createdAt: 10, blob, source: "gesture:thumbs_up", captionText: "叫叫和新用户礼貌互赞", url: "blob:temporary" };
  assert.equal(await storeMediaCapture(photo), true);
  const reloaded = await loadMediaCaptures();
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].captionText, photo.captionText);
  assert.equal(reloaded[0].source, "gesture:thumbs_up");
  assert.equal(await reloaded[0].blob.text(), "thumbs-up-image");
  assert.equal("url" in reloaded[0], false);
});

test("concurrent writes and an idempotent retry preserve the most recent 30 unique captures", async (t) => {
  const original = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  t.after(() => { globalThis.indexedDB = original; });
  const photos = Array.from({ length: 35 }, (_, createdAt) => ({ id: `like-${createdAt}`, createdAt, blob: new Blob([`${createdAt}`]) }));
  assert.ok((await Promise.all(photos.map(photo => storeMediaCapture(photo)))).every(Boolean));
  await storeMediaCapture(photos[34]);
  const reloaded = await loadMediaCaptures();
  assert.equal(reloaded.length, 30);
  assert.equal(new Set(reloaded.map(photo => photo.id)).size, 30);
  assert.equal(reloaded[0].id, "like-34"); assert.equal(reloaded.at(-1).id, "like-5");
});

test("an IndexedDB transaction abort cannot be acknowledged as a saved photo", async (t) => {
  const original = globalThis.indexedDB, originalTransaction = IDBDatabase.prototype.transaction;
  globalThis.indexedDB = new IDBFactory();
  t.after(() => { globalThis.indexedDB = original; IDBDatabase.prototype.transaction = originalTransaction; });
  await storeMediaCapture({ id: "existing", createdAt: 1, blob: new Blob(["one"]) });
  IDBDatabase.prototype.transaction = function (...args) {
    const transaction = originalTransaction.apply(this, args);
    if (args[1] === "readwrite") queueMicrotask(() => transaction.abort());
    return transaction;
  };
  await assert.rejects(storeMediaCapture({ id: "lost", createdAt: 2, blob: new Blob(["two"]) }));
  IDBDatabase.prototype.transaction = originalTransaction;
  assert.deepEqual((await loadMediaCaptures()).map(photo => photo.id), ["existing"]);
});

test("browsers without IndexedDB do not claim to persist photos", async (t) => {
  const original = globalThis.indexedDB;
  globalThis.indexedDB = undefined;
  t.after(() => { globalThis.indexedDB = original; });
  assert.equal(await storeMediaCapture({ id: "missing" }), false);
  assert.deepEqual(await loadMediaCaptures(), []);
});
