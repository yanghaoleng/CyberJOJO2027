import assert from "node:assert/strict";
import test from "node:test";
import {
  CHARACTER_ECHO_TAIL_MS,
  endCharacterEchoGate,
  isCharacterEchoGateActive,
  startCharacterEchoGate,
} from "./voice-input-gate.js";

test("character speech blocks microphone input until its echo tail has passed", () => {
  const speaking = startCharacterEchoGate();
  assert.equal(isCharacterEchoGateActive(speaking, 100), true);
  const until = endCharacterEchoGate(1_000);
  assert.equal(isCharacterEchoGateActive(until, 1_000 + CHARACTER_ECHO_TAIL_MS - 1), true);
  assert.equal(isCharacterEchoGateActive(until, 1_000 + CHARACTER_ECHO_TAIL_MS), false);
});
