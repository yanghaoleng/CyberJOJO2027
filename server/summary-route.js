import { summarizeConversationDays } from "./ark-summary.js";

const DEFAULT_MAX_BODY_BYTES = 680_000;
const DEFAULT_MIN_INTERVAL_MS = 2_000;

function getClientIp(request) {
  return String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function getCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request, maxBodyBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.byteLength;
    if (size > maxBodyBytes) throw Object.assign(new Error("Summary request is too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Summary request is not valid JSON"), { statusCode: 400 });
  }
}

export function createSummaryRequestHandler({
  allowedOrigins,
  arkConfig,
  summarizeDays = summarizeConversationDays,
  maxBodyBytes = Number(process.env.JOCAM_SUMMARY_MAX_BODY_BYTES || DEFAULT_MAX_BODY_BYTES),
  minIntervalMs = Number(process.env.JOCAM_SUMMARY_MIN_INTERVAL_MS || DEFAULT_MIN_INTERVAL_MS),
  now = Date.now,
} = {}) {
  const lastRequestByIp = new Map();
  const activeIps = new Set();

  return async function handleSummaryRequest(request, response) {
    const path = new URL(request.url || "/", "http://localhost").pathname;
    if (path !== "/conversation-summary") return false;

    const origin = String(request.headers.origin || "");
    if (!allowedOrigins?.has(origin)) {
      sendJson(response, 403, { ok: false, code: "ORIGIN_NOT_ALLOWED" });
      return true;
    }
    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders);
      response.end();
      return true;
    }
    if (request.method !== "POST" || !/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
      sendJson(response, 415, { ok: false, code: "JSON_REQUIRED" }, corsHeaders);
      return true;
    }

    const ip = getClientIp(request);
    const requestedAt = now();
    const waitMs = minIntervalMs - (requestedAt - (lastRequestByIp.get(ip) || 0));
    if (activeIps.has(ip) || waitMs > 0) {
      sendJson(response, 429, {
        ok: false,
        code: "SUMMARY_RATE_LIMIT",
        retryAfterMs: Math.max(750, waitMs),
      }, corsHeaders);
      return true;
    }

    activeIps.add(ip);
    lastRequestByIp.set(ip, requestedAt);
    try {
      const body = await readJsonBody(request, maxBodyBytes);
      const result = await summarizeDays(body.days, arkConfig);
      sendJson(response, 200, {
        ok: true,
        summaries: result.summaries,
        usage: result.usage ? {
          inputTokens: Number(result.usage.input_tokens || 0),
          outputTokens: Number(result.usage.output_tokens || 0),
        } : null,
      }, corsHeaders);
    } catch (error) {
      const status = Number(error.statusCode) || 502;
      console.error("Conversation summary request failed", { name: error.name, message: error.message });
      sendJson(response, status, {
        ok: false,
        code: status < 500 ? "INVALID_SUMMARY_REQUEST" : "SUMMARY_UNAVAILABLE",
      }, corsHeaders);
    } finally {
      activeIps.delete(ip);
    }
    return true;
  };
}

export const summaryRouteInternals = {
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_MIN_INTERVAL_MS,
  getClientIp,
  getCorsHeaders,
  readJsonBody,
};
