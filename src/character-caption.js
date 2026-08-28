function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function splitLines(context, text, maxWidth) {
  const characters = Array.from(String(text || "").trim()).slice(0, 42);
  const lines = [""];
  for (const character of characters) {
    const current = lines.at(-1);
    if (!current || context.measureText(current + character).width <= maxWidth) {
      lines[lines.length - 1] = current + character;
    } else if (lines.length < 2) {
      lines.push(character);
    } else {
      lines[1] += character;
    }
  }
  while (lines.length === 2 && context.measureText(`${lines[1]}…`).width > maxWidth && lines[1].length > 1) {
    lines[1] = lines[1].slice(0, -1);
  }
  if (lines.join("").length < characters.length && lines.length === 2) lines[1] += "…";
  return lines;
}

export function drawCharacterCaption(
  context,
  text,
  targetWidth,
  targetHeight,
  { isTabletDevice = false } = {},
) {
  if (!text) return;
  const isLandscape = targetWidth > targetHeight;
  const baseFontSize = clamp(targetWidth * (isLandscape ? 0.022 : 0.039), 22, 31);
  const fontSize = baseFontSize * (isTabletDevice ? 0.78 : 1);
  const maxBubbleWidth = targetWidth * (isLandscape ? 0.48 : 0.78) * (isTabletDevice ? 0.84 : 1);
  const horizontalPadding = fontSize * (isTabletDevice ? 1.35 : 0.95);
  const verticalPadding = fontSize * (isTabletDevice ? 0.72 : 0.39);
  const lineHeight = fontSize * 1.14;
  context.save();
  context.font = `700 ${fontSize}px "Mohr Rounded", "PingFang SC", sans-serif`;
  const lines = splitLines(context, text, maxBubbleWidth - horizontalPadding * 2);
  const contentWidth = Math.max(...lines.map((line) => context.measureText(line).width));
  const bubbleWidth = clamp(contentWidth + horizontalPadding * 2, fontSize * 4.4, maxBubbleWidth);
  const bubbleHeight = Math.max(fontSize * 2.12, lines.length * lineHeight + verticalPadding * 2);
  const centerX = targetWidth * (isLandscape
    ? (isTabletDevice ? 0.31 : 0.37)
    : (isTabletDevice ? 0.36 : 0.42));
  const bottom = targetHeight - targetHeight * (isLandscape ? 0.1 : 0.09);
  const left = centerX - bubbleWidth / 2;
  const top = bottom - bubbleHeight;
  const tailX = clamp(targetWidth * 0.2, left + fontSize * 0.7, left + bubbleWidth - fontSize * 0.7);
  const tailHeight = fontSize * 0.48;

  context.shadowColor = "rgba(0, 0, 0, 0.2)";
  context.shadowBlur = 14;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(tailX - fontSize * 0.4, top + 1);
  context.lineTo(tailX, top - tailHeight);
  context.lineTo(tailX + fontSize * 0.4, top + 1);
  context.closePath();
  context.fill();
  roundedRectPath(context, left, top, bubbleWidth, bubbleHeight, bubbleHeight / 2);
  context.fill();
  context.shadowColor = "transparent";
  context.fillStyle = "#111111";
  context.textAlign = "center";
  context.textBaseline = "middle";
  lines.forEach((line, index) => {
    const y = top + bubbleHeight / 2 + (index - (lines.length - 1) / 2) * lineHeight;
    context.fillText(line, centerX, y, bubbleWidth - horizontalPadding * 2);
  });
  context.restore();
}

export const characterCaptionInternals = { splitLines };
