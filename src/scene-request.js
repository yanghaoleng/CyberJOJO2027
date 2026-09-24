function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason || new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function requestScene(url, body, { signal, fetchImpl = fetch, wait = waitForRetry } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, source: "explicit", includeAudio: false }), signal,
    });
    if (response.status === 429 && attempt < 2) {
      const limited = await response.json();
      const delay = Math.max(100, Number(limited.retryAfterMs) || 750);
      // Never silently sit in the old 8-second background cooldown.
      if (delay <= 1500) { await wait(delay, signal); continue; }
    }
    if (!response.ok) throw new Error(`Vision request failed (${response.status})`);
    const result = await response.json();
    if (!result?.ok) throw new Error("Vision response was not successful");
    return result;
  }
}
