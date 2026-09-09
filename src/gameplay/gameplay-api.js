export function getGameplayApiUrl() {
  if (import.meta.env?.VITE_JOCAM_GAMEPLAY_URL) return import.meta.env.VITE_JOCAM_GAMEPLAY_URL;
  const vision = import.meta.env?.VITE_JOCAM_VISION_URL;
  if (vision && /\/vision\/?$/.test(vision)) return vision.replace(/\/vision\/?$/, "/gameplay");
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://127.0.0.1:8787/gameplay";
  return `${window.location.origin}${import.meta.env?.BASE_URL || "/"}api/gameplay`;
}

export async function requestGameplay(payload, { signal, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 23_000);
  try {
    const response = await fetchImpl(getGameplayApiUrl(), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    let result;
    try { result = await response.json(); } catch { throw new Error("暂时没连上，点一下再试试"); }
    if (!response.ok || !result?.ok) {
      const limited = response.status === 429;
      throw Object.assign(new Error(limited ? "叫叫正在看，稍等一下再试" : "暂时没看清，点一下再试试"), {
        status: response.status,
        retryAfterMs: limited ? Math.max(1_000, Math.min(60_000, Number(result.retryAfterMs) || 1_500)) : 0,
      });
    }
    if (result.source !== payload.source || result.roundId !== payload.roundId || result.frameId !== payload.frameId) {
      throw new Error("这一轮已经换了，再看一次吧");
    }
    return result;
  } catch (error) {
    if (error instanceof TypeError) throw new Error("暂时没连上，检查网络后再试试");
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
}
