// Keep the original and intermediate recognition in durable storage before
// doing expensive work. Retries never take a fresh camera frame.
export async function runCollectionJob(record, { observe, matte, save, onUpdate, signal }) {
  const publish = async (patch) => { const next = await save({ id: record.id, ...patch }); onUpdate(next); record = next; return next; };
  await publish({ status: "processing" });
  try {
    if (!record.bbox) {
      const observation = await observe(record, signal);
      if (!observation.evaluable || !observation.label || !observation.bbox) throw new Error("这张原图还没看清主体");
      await publish({ name: observation.label, kind: observation.category, english: observation.english, learning: observation.learning, bbox: observation.bbox });
    }
    const stickerBlob = await matte(record.originalBlob, record.bbox, { signal });
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    return await publish({ stickerBlob, status: "ready", retryAt: 0, seenAt: 0 });
  } catch (error) {
    const attempts = record.attempts + (error.name === "AbortError" && signal?.aborted ? 0 : 1);
    await publish({ status: attempts < 3 ? "pending" : "failed", attempts, retryAt: Date.now() + (attempts < 2 ? 4000 : 15000) });
    throw error;
  }
}
