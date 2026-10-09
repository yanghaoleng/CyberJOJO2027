import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket, { WebSocketServer } from "ws";
import { startSocketHeartbeat } from "./socket-heartbeat.js";

test("quiet browsers stay connected; half-open connections are reclaimed", async t => {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" }); await once(server, "listening");
  let timeouts = 0;
  let resolveClosed;
  const serverClosed = new Promise(resolve => { resolveClosed = resolve; });
  server.on("connection", socket => {
    const stop = startSocketHeartbeat(socket, { intervalMs: 25, onTimeout: () => timeouts++ });
    socket.once("close", () => { stop(); resolveClosed(); });
  });
  const healthy = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  const dead = new WebSocket(`ws://127.0.0.1:${server.address().port}`, { autoPong: false });
  t.after(() => { healthy.terminate(); dead.terminate(); for (const socket of server.clients) socket.terminate(); server.close(); });
  await Promise.all([once(healthy, "open"), once(dead, "open")]);
  await once(dead, "close");
  await serverClosed;
  assert.equal(timeouts, 1); assert.equal(healthy.readyState, WebSocket.OPEN); assert.equal(server.clients.size, 1);
});
