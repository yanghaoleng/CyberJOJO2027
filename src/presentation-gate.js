import { getSceneDifference } from "./scene-analysis.js";

export const PRESENTATION_SAMPLE_MS = 600;
export const PRESENTATION_WINDOW_MS = 45_000;
export const PRESENTATION_RETRY_MS = 7_000;

export function createPresentationGate(startedAt = 0) {
  return { startedAt, candidate: null, stableSamples: 0, lastRequestAt: -Infinity, attempts: 0, inFlight: false };
}

export function advancePresentationGate(state, fingerprint, now) {
  if (!fingerprint?.length || state.inFlight || now - state.startedAt > PRESENTATION_WINDOW_MS || state.attempts >= 6) {
    return { state, shouldRequest: false };
  }
  const stable = state.candidate && getSceneDifference(state.candidate, fingerprint) < 0.055;
  const next = { ...state, candidate: fingerprint, stableSamples: stable ? state.stableSamples + 1 : 1 };
  const shouldRequest = next.stableSamples >= 2 && now - state.startedAt >= 700
    && now - state.lastRequestAt >= PRESENTATION_RETRY_MS;
  if (shouldRequest) {
    next.inFlight = true;
    next.attempts += 1;
    next.lastRequestAt = now;
  }
  return { state: next, shouldRequest };
}

export function finishPresentationRequest(state) {
  return { ...state, inFlight: false };
}
