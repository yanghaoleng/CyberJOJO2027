import assert from "node:assert/strict";
import test from "node:test";
import { advancePresentationGate, createPresentationGate, finishPresentationRequest, PRESENTATION_RETRY_MS, PRESENTATION_WINDOW_MS } from "./presentation-gate.js";

test("an invitation waits for a stable frame then retries only a few times", () => {
  const pen = new Uint8Array(8 * 8 * 3).fill(120);
  let gate = createPresentationGate(0);
  let step = advancePresentationGate(gate, pen, 600);
  assert.equal(step.shouldRequest, false);
  step = advancePresentationGate(step.state, pen, 1200);
  assert.equal(step.shouldRequest, true);
  gate = finishPresentationRequest(step.state);
  step = advancePresentationGate(gate, pen, 1800);
  assert.equal(step.shouldRequest, false);
  step = advancePresentationGate(step.state, pen, 1200 + PRESENTATION_RETRY_MS);
  assert.equal(step.shouldRequest, true);
  assert.equal(advancePresentationGate(finishPresentationRequest(step.state), pen, PRESENTATION_WINDOW_MS + 1).shouldRequest, false);
  assert.equal(advancePresentationGate({ ...gate, attempts: 6 }, pen, 12_000).shouldRequest, false);
});
