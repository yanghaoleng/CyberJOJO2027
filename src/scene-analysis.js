export const SCENE_SAMPLE_INTERVAL_MS = 1_600;
export const SCENE_INITIAL_DELAY_MS = 3_200;
export const SCENE_MIN_REQUEST_INTERVAL_MS = 12_000;
export const SCENE_STABLE_SAMPLE_COUNT = 2;
export const SCENE_STABLE_DIFFERENCE = 0.045;
export const SCENE_NEW_CONTENT_DIFFERENCE = 0.115;
export const SCENE_REPEAT_COOLDOWN_MS = 75_000;

export function createSceneGate(startedAt = 0) {
  return {
    startedAt,
    candidate: null,
    stableSamples: 0,
    lastAnalyzed: null,
    lastRequestAt: -Infinity,
    inFlight: false,
  };
}

export function createSceneFingerprint(imageData, gridSize = 8) {
  const { data, width, height } = imageData || {};
  if (!data?.length || !width || !height) return new Uint8Array();
  const fingerprint = new Uint8Array(gridSize * gridSize * 3);
  const cellWidth = width / gridSize;
  const cellHeight = height / gridSize;

  for (let cellY = 0; cellY < gridSize; cellY += 1) {
    for (let cellX = 0; cellX < gridSize; cellX += 1) {
      const startX = Math.floor(cellX * cellWidth);
      const endX = Math.max(startX + 1, Math.floor((cellX + 1) * cellWidth));
      const startY = Math.floor(cellY * cellHeight);
      const endY = Math.max(startY + 1, Math.floor((cellY + 1) * cellHeight));
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;

      for (let y = startY; y < Math.min(endY, height); y += 1) {
        for (let x = startX; x < Math.min(endX, width); x += 1) {
          const offset = (y * width + x) * 4;
          red += data[offset];
          green += data[offset + 1];
          blue += data[offset + 2];
          count += 1;
        }
      }

      const target = (cellY * gridSize + cellX) * 3;
      fingerprint[target] = Math.round(red / Math.max(1, count));
      fingerprint[target + 1] = Math.round(green / Math.max(1, count));
      fingerprint[target + 2] = Math.round(blue / Math.max(1, count));
    }
  }

  return fingerprint;
}

export function getSceneDifference(left, right) {
  if (!left?.length || left.length !== right?.length) return 1;
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += Math.abs(left[index] - right[index]);
  }
  return total / left.length / 255;
}

export function advanceSceneGate(state, fingerprint, now) {
  if (!fingerprint?.length) return { state, shouldRequest: false, fingerprint: null };
  const next = { ...state };
  const stableDifference = getSceneDifference(state.candidate, fingerprint);

  if (!state.candidate || stableDifference > SCENE_STABLE_DIFFERENCE) {
    next.candidate = fingerprint;
    next.stableSamples = 1;
  } else {
    next.candidate = fingerprint;
    next.stableSamples = state.stableSamples + 1;
  }

  const initialDelayComplete = now - state.startedAt >= SCENE_INITIAL_DELAY_MS;
  const requestCooldownComplete = now - state.lastRequestAt >= SCENE_MIN_REQUEST_INTERVAL_MS;
  const sceneIsStable = next.stableSamples >= SCENE_STABLE_SAMPLE_COUNT;
  const sceneIsNew = !state.lastAnalyzed
    || getSceneDifference(state.lastAnalyzed, fingerprint) >= SCENE_NEW_CONTENT_DIFFERENCE;
  const shouldRequest = initialDelayComplete
    && requestCooldownComplete
    && sceneIsStable
    && sceneIsNew
    && !state.inFlight;

  if (shouldRequest) {
    next.inFlight = true;
    next.lastRequestAt = now;
  }

  return { state: next, shouldRequest, fingerprint: shouldRequest ? fingerprint : null };
}

export function finishSceneRequest(state, fingerprint, succeeded) {
  return {
    ...state,
    inFlight: false,
    lastAnalyzed: succeeded && fingerprint?.length ? fingerprint : state.lastAnalyzed,
  };
}

export function shouldShowSceneReaction(reactionHistory, repeatKey, now) {
  const key = String(repeatKey || "").trim();
  if (!key) return false;
  const lastShownAt = reactionHistory.get(key);
  return !Number.isFinite(lastShownAt) || now - lastShownAt >= SCENE_REPEAT_COOLDOWN_MS;
}

export function getVisionCaptureSize(width, height, maxEdge = 640) {
  if (!width || !height) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
