export function createMattingRequestHandler({ allowedOrigins, fetchImpl = fetch, now = Date.now } = {}) {
  const clients = new Map();
  let active = 0;
  return async (request, response) => {
    if (!["/matting", "/api/matting"].includes(new URL(request.url, "http://localhost").pathname)) return false;
    const origin = String(request.headers.origin || "");
    const send = (status, data, type = "application/json") => {
      response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", Vary: "Origin", ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}) });
      response.end(Buffer.isBuffer(data) ? data : JSON.stringify(data));
    };
    if (!allowedOrigins.has(origin)) { send(403, { code: "ORIGIN_NOT_ALLOWED" }); return true; }
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }); response.end(); return true;
    }
    if (request.method !== "POST" || !/^image\/(jpeg|png)$/.test(request.headers["content-type"] || "")) { send(415, { code: "IMAGE_REQUIRED" }); return true; }
    const ip = String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
    const at = now();
    for (const [key, value] of clients) if (at - value > 60_000) clients.delete(key);
    if (active >= 2 || at - (clients.get(ip) ?? -Infinity) < 1500) { send(429, { code: "MATTING_BUSY" }); return true; }
    clients.set(ip, at); active++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const closed = () => { if (!response.writableEnded) controller.abort(); };
    response.once("close", closed);
    try {
      if (Number(request.headers["content-length"]) > 2_000_000) throw Object.assign(new Error(), { status: 413 });
      const chunks = []; let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 2_000_000) throw Object.assign(new Error(), { status: 413 });
        chunks.push(chunk);
      }
      if (!size) throw Object.assign(new Error(), { status: 400 });
      const upstream = await fetchImpl("http://127.0.0.1:8790/matte", { method: "POST", headers: { "Content-Type": request.headers["content-type"] }, body: Buffer.concat(chunks), signal: controller.signal });
      if (!upstream.ok) { send(upstream.status === 503 ? 429 : 422, { code: upstream.status === 503 ? "MATTING_BUSY" : "MATTING_UNCLEAR" }); }
      else send(200, Buffer.from(await upstream.arrayBuffer()), "image/png");
    } catch (error) {
      if (!response.destroyed) send(error.status || 502, { code: "MATTING_UNAVAILABLE" });
    } finally { clearTimeout(timer); active--; response.off("close", closed); }
    return true;
  };
}
