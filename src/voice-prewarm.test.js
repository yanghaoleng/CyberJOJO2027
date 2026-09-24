import assert from "node:assert/strict";
import test from "node:test";
import { createVoicePrewarm } from "./voice-prewarm.js";

class Socket extends EventTarget {
  static instances = [];
  readyState = 0;
  sent = [];
  constructor() { super(); Socket.instances.push(this); }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.dispatchEvent(new Event("close")); }
  open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  message(data) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) })); }
}

test("cover connects silently and transfers an already-ready socket exactly once", () => {
  const warm = createVoicePrewarm("ws://test", "jiaojiao", { Socket });
  const socket = Socket.instances.at(-1); socket.open();
  assert.deepEqual(socket.sent, [{ type: "start", inputMode: "voice", character: "jiaojiao", deferGreeting: true }]);
  socket.message({ type: "ready", transport: "seeduplex" });
  const adopted = warm.take();
  assert.equal(adopted.socket, socket);
  assert.equal(adopted.startSent, true);
  assert.equal(adopted.readyMessage.transport, "seeduplex");
  assert.equal(warm.take(), null);
  warm.dispose();
  assert.equal(socket.readyState, 1, "cover cleanup must not close the adopted live session");
});

test("early click can adopt a connecting socket without sending start twice", () => {
  const warm = createVoicePrewarm("ws://test", "jiaojiao", { Socket });
  const adopted = warm.take();
  assert.equal(adopted.startSent, false);
  assert.equal(adopted.readyMessage, null);
  adopted.socket.open();
  assert.equal(adopted.socket.sent.length, 0, "new owner sends the start message");
});

test("hidden cover disposal, provider errors and expiry fall back to a fresh connection", async () => {
  for (const reason of ["hidden", "error", "expired"]) {
    const warm = createVoicePrewarm("ws://test", "jiaojiao", { Socket, ttlMs: 10 });
    const socket = Socket.instances.at(-1); socket.open();
    if (reason === "hidden") warm.dispose();
    if (reason === "error") socket.message({ type: "error" });
    if (reason === "expired") await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(socket.readyState, 3);
    assert.equal(warm.take(), null);
  }
});
