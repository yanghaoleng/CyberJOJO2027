function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getUserSpeechBubbleSizing({ targetWidth, targetHeight, isTabletDevice = false }) {
  const isLandscape = targetWidth > targetHeight;
  const baseFontSize = clamp(targetWidth * (isLandscape ? 0.021 : 0.038), 22, 31);
  const fontSize = baseFontSize * (isTabletDevice ? 0.78 : 1);
  const baseMaxBubbleWidth = clamp(targetWidth * (isLandscape ? 0.42 : 0.68), 330, 610);
  return {
    fontSize,
    maxBubbleWidth: baseMaxBubbleWidth * (isTabletDevice ? 0.84 : 1),
    horizontalPadding: fontSize * (isTabletDevice ? 1.4 : 1.1),
    verticalPadding: fontSize * (isTabletDevice ? 0.72 : 0.46),
  };
}

export function getUserSpeechBubblePlacement({
  facingMode,
  anchor,
  targetWidth,
  targetHeight,
  bubbleWidth,
  bubbleHeight,
  tailHeight,
  fontSize,
}) {
  const isLandscape = targetWidth > targetHeight;

  if (facingMode === "environment") {
    const edgeMargin = isLandscape ? 22 : 18;
    const bottomMargin = isLandscape ? 20 : 24;
    return {
      bubbleX: targetWidth - bubbleWidth / 2 - edgeMargin,
      bubbleY: targetHeight - bubbleHeight / 2 - tailHeight - bottomMargin,
      tailTipOffset: 0,
      placement: "rear-bottom-right",
    };
  }

  if (!anchor) return null;

  const mouthX = anchor.x * targetWidth;
  const mouthY = anchor.y * targetHeight;
  const eyeY = anchor.eyeY * targetHeight;
  const direction = anchor.x < 0.5 ? 1 : -1;
  const captionSafeY = isLandscape ? 88 : 195;
  const bubbleX = clamp(
    mouthX + direction * targetWidth * (isLandscape ? 0.22 : 0.24),
    bubbleWidth / 2 + 18,
    targetWidth - bubbleWidth / 2 - 18,
  );
  const verticalOffset = targetHeight * (isLandscape ? 0.28 : 0.27);
  const desiredBubbleY = mouthY - verticalOffset;
  const eyeSafeBubbleY = eyeY - bubbleHeight / 2 - tailHeight - fontSize * 1.08;
  return {
    bubbleX,
    bubbleY: clamp(
      Math.min(desiredBubbleY, eyeSafeBubbleY),
      captionSafeY + bubbleHeight / 2,
      targetHeight - bubbleHeight / 2 - tailHeight - 30,
    ),
    tailTipOffset: 0,
    placement: "front-mouth",
  };
}
