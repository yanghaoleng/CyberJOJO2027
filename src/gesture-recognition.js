export const CAMERA_GESTURES = Object.freeze({
  THUMBS_UP: "thumbs_up",
  VICTORY: "victory",
  OK: "ok",
  // A two-hand heart is deliberately distinct from a single-hand finger
  // heart: they have different on-camera feedback placements.
  HEART: "heart_large",
  FINGER_HEART: "heart_small",
});

const DEFAULT_TRACKER = Object.freeze({
  candidate: null,
  stableFrames: 0,
  releaseFrames: 0,
  latched: null,
  cooldownUntil: 0,
});

function distance(first, second) {
  if (!first || !second) return Number.POSITIVE_INFINITY;
  return Math.hypot(first.x - second.x, first.y - second.y, (first.z || 0) - (second.z || 0));
}

function jointAngle(first, middle, last) {
  if (!first || !middle || !last) return 0;
  const firstVector = { x: first.x - middle.x, y: first.y - middle.y, z: (first.z || 0) - (middle.z || 0) };
  const lastVector = { x: last.x - middle.x, y: last.y - middle.y, z: (last.z || 0) - (middle.z || 0) };
  const firstLength = Math.hypot(firstVector.x, firstVector.y, firstVector.z);
  const lastLength = Math.hypot(lastVector.x, lastVector.y, lastVector.z);
  if (!firstLength || !lastLength) return 0;
  const cosine = (
    firstVector.x * lastVector.x
    + firstVector.y * lastVector.y
    + firstVector.z * lastVector.z
  ) / (firstLength * lastLength);
  return Math.acos(Math.min(1, Math.max(-1, cosine))) * (180 / Math.PI);
}

function isFingerExtended(landmarks, mcpIndex, pipIndex, tipIndex) {
  return jointAngle(landmarks[mcpIndex], landmarks[pipIndex], landmarks[tipIndex]) >= 145;
}

function palmWidth(landmarks) {
  return distance(landmarks?.[5], landmarks?.[17]);
}

/**
 * A two-hand heart has two close "joins": the index fingertips form the top
 * notch and the thumb fingertips form the bottom point. Distances are scaled
 * by each child's actual palm size instead of image pixels, so this holds up
 * when hands are near or far from the camera.
 */
export function isTwoHandHeart(hands = []) {
  if (hands.length < 2) return false;
  const [first, second] = hands;
  const scale = (palmWidth(first) + palmWidth(second)) / 2;
  if (!Number.isFinite(scale) || scale < 0.04) return false;
  const indexJoin = distance(first[8], second[8]) / scale;
  const thumbJoin = distance(first[4], second[4]) / scale;
  const palmGap = distance(first[0], second[0]) / scale;
  return indexJoin <= 1.05 && thumbJoin <= 1.05 && palmGap >= 0.85 && palmGap <= 4.8;
}

export function classifyCameraGesture(result) {
  const hands = (result?.landmarks || []).filter((hand) => hand?.[0] && hand?.[4] && hand?.[8]);
  // A complete two-hand shape is more specific than one hand's canned label.
  if (isTwoHandHeart(hands)) return CAMERA_GESTURES.HEART;

  const cannedGesture = result?.gestures?.[0]?.[0];
  if (cannedGesture?.categoryName === "Thumb_Up" && cannedGesture.score >= 0.62) {
    return CAMERA_GESTURES.THUMBS_UP;
  }
  if (cannedGesture?.categoryName === "Victory" && cannedGesture.score >= 0.62) {
    return CAMERA_GESTURES.VICTORY;
  }

  const landmarks = hands[0];
  if (!landmarks?.[0] || !landmarks?.[4] || !landmarks?.[8]) return null;
  const width = palmWidth(landmarks);
  if (!Number.isFinite(width) || width < 0.04) return null;
  const pinchRatio = distance(landmarks[4], landmarks[8]) / width;
  if (pinchRatio > 0.43) return null;

  const extendedFingers = [
    isFingerExtended(landmarks, 9, 10, 12),
    isFingerExtended(landmarks, 13, 14, 16),
    isFingerExtended(landmarks, 17, 18, 20),
  ].filter(Boolean).length;

  if (extendedFingers >= 2) return CAMERA_GESTURES.OK;
  if (extendedFingers === 0) return CAMERA_GESTURES.FINGER_HEART;
  return null;
}

export function advanceGestureTracker(
  previous = DEFAULT_TRACKER,
  candidate,
  now,
  { requiredStableFrames = 3, requiredReleaseFrames = 2, cooldownMs = 4_800 } = {},
) {
  const state = { ...DEFAULT_TRACKER, ...previous };
  if (!candidate) {
    const releaseFrames = state.releaseFrames + 1;
    return {
      state: {
        ...state,
        candidate: releaseFrames >= requiredReleaseFrames ? null : state.candidate,
        stableFrames: releaseFrames >= requiredReleaseFrames ? 0 : state.stableFrames,
        releaseFrames,
        latched: releaseFrames >= requiredReleaseFrames ? null : state.latched,
      },
      trigger: null,
    };
  }

  const sameCandidate = candidate === state.candidate;
  const next = {
    ...state,
    candidate,
    stableFrames: sameCandidate ? state.stableFrames + 1 : 1,
    releaseFrames: 0,
  };
  if (
    next.stableFrames < requiredStableFrames
    || next.latched === candidate
    // Let a newly completed two-hand heart supersede a one-hand finger heart
    // without making the child wait out the short single-heart cooldown.
    || (now < next.cooldownUntil && !(candidate === CAMERA_GESTURES.HEART && next.latched === CAMERA_GESTURES.FINGER_HEART))
  ) return { state: next, trigger: null };

  return {
    state: {
      ...next,
      latched: candidate,
      cooldownUntil: now + cooldownMs,
    },
    trigger: candidate,
  };
}

export function createGestureTracker() {
  return { ...DEFAULT_TRACKER };
}
