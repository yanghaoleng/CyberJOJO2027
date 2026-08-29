export const TABLET_CHARACTER_SCALE_MULTIPLIER = 0.64;
export const CHARACTER_LEFT_OVERFLOW_RATIO = 0.045;

const THINKING_INDICATOR_ANCHORS = {
  portrait: { left: 23, bottom: 34 },
  landscape: { left: 28, bottom: 72 },
};

export function isTabletViewport({ width, height, isMobileDevice }) {
  if (!isMobileDevice || !Number.isFinite(width) || !Number.isFinite(height)) return false;
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  return shortEdge >= 600 && longEdge <= 1_400;
}

export function getCharacterScaleMultiplier(isTabletDevice) {
  return isTabletDevice ? TABLET_CHARACTER_SCALE_MULTIPLIER : 1;
}

export function getTabletThinkingIndicatorPosition(orientation) {
  const anchor = THINKING_INDICATOR_ANCHORS[orientation] || THINKING_INDICATOR_ANCHORS.portrait;
  const leftOrigin = -CHARACTER_LEFT_OVERFLOW_RATIO * 100;
  return {
    left: leftOrigin + (anchor.left - leftOrigin) * TABLET_CHARACTER_SCALE_MULTIPLIER,
    bottom: anchor.bottom * TABLET_CHARACTER_SCALE_MULTIPLIER,
  };
}
