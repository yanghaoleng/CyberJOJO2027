import { assessGameplay, validateGameplayRequest } from "./gameplay-vision.js";

export function createGameplayRequestHandler({
  allowedOrigins, arkConfig, assess = assessGameplay, now = Date.now,
  maxBodyBytes = 260_000, minIntervalMs = 1_500, maxRequestsPerMinute = 16,
} = {}) {
  const clients = new Map();
  const active = new Set();
  const send = (response, status, payload, origin = "", extra = {}) => {
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Vary: "Origin",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}), ...extra,
    });
    response.end(payload === null ? "" : JSON.stringify(payload));
  };
  return async function handleGameplayRequest(request, response) {
    const path = new URL(request.url || "/", "http://localhost").pathname;
    if (!["/gameplay", "/api/gameplay"].includes(path)) return false;
    const origin = String(request.headers.origin || "");
    if (!allowedOrigins?.has(origin)) { send(response, 403, { ok: false, code: "ORIGIN_NOT_ALLOWED" }); return true; }
    if (request.method === "OPTIONS") {
      send(response, 204, null, origin, { "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600" });
      return true;
    }
    if (request.method !== "POST" || !/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
      send(response, 415, { ok: false, code: "JSON_REQUIRED" }, origin); return true;
    }
    const ip = String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
    const timestamp = now();
    for (const [key, state] of clients) if (!active.has(key) && timestamp - state.last > 60_000) clients.delete(key);
    const state = clients.get(ip) || { last: -Infinity, requests: [] };
    state.requests = state.requests.filter((time) => timestamp - time < 60_000);
    const wait = Math.max(0, minIntervalMs - (timestamp - state.last), state.requests.length >= maxRequestsPerMinute ? 60_000 - (timestamp - state.requests[0]) : 0);
    if (active.has(ip) || wait > 0) {
      const retryAfterMs = Math.max(1_000, Math.ceil(wait));
      send(response, 429, { ok: false, code: "GAMEPLAY_RATE_LIMIT", retryAfterMs }, origin, { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) });
      return true;
    }
    active.add(ip);
    const controller = new AbortController();
    const onAborted = () => controller.abort();
    request.once?.("aborted", onAborted);
    const onClosed = () => { if (!response.writableEnded) controller.abort(); };
    response.once?.("close", onClosed);
    try {
      if (Number(request.headers["content-length"]) > maxBodyBytes) throw Object.assign(new Error("Body too large"), { statusCode: 413 });
      let length = 0;
      const chunks = [];
      for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        length += bytes.byteLength;
        if (length > maxBodyBytes) throw Object.assign(new Error("Body too large"), { statusCode: 413 });
        chunks.push(bytes);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("Invalid JSON"), { statusCode: 400 }); }
      const normalized = validateGameplayRequest(body);
      state.last = timestamp;
      state.requests.push(timestamp);
      clients.set(ip, state);
      const result = await assess(normalized, arkConfig, { signal: controller.signal });
      if (!controller.signal.aborted) send(response, 200, { ...result, ok: true, source: normalized.source, roundId: normalized.roundId, frameId: normalized.frameId }, origin);
    } catch (error) {
      if (!controller.signal.aborted) send(response, [400, 413].includes(error.statusCode) ? error.statusCode : 502,
        { ok: false, code: [400, 413].includes(error.statusCode) ? "INVALID_GAMEPLAY_REQUEST" : "GAMEPLAY_UNAVAILABLE" }, origin);
    } finally {
      active.delete(ip);
      request.off?.("aborted", onAborted);
      response.off?.("close", onClosed);
    }
    return true;
  };
}
