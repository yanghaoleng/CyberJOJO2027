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

export function drawCharacterCaption(context, text, targetWidth, targetHeight) {
  if (!text) return;
  const isLandscape = targetWidth > targetHeight;
  const fontSize = clamp(targetWidth * (isLandscape ? 0.022 : 0.039), 22, 31);
  const maxBubbleWidth = targetWidth * (isLandscape ? 0.48 : 0.78);
  const horizontalPadding = fontSize * 0.95;
  const lineHeight = fontSize * 1.14;
  context.save();
  context.font = `700 ${fontSize}px "Mohr Rounded", "PingFang SC", sans-serif`;
  const lines = splitLines(context, text, maxBubbleWidth - horizontalPadding * 2);
  const contentWidth = Math.max(...lines.map((line) => context.measureText(line).width));
  const bubbleWidth = clamp(contentWidth + horizontalPadding * 2, fontSize * 4.4, maxBubbleWidth);
  const bubbleHeight = Math.max(fontSize * 2.12, lines.length * lineHeight + fontSize * 0.78);
  const centerX = targetWidth * (isLandscape ? 0.42 : 0.5);
  const bottom = targetHeight - targetHeight * (isLandscape ? 0.045 : 0.038);
  const left = centerX - bubbleWidth / 2;
  const top = bottom - bubbleHeight;
  const tailX = clamp(targetWidth * 0.22, left + fontSize, left + bubbleWidth - fontSize);
  const tailHeight = fontSize * 0.42;

  context.shadowColor = "rgba(22, 17, 5, 0.25)";
  context.shadowBlur = 16;
  context.fillStyle = "#fffdf6";
  context.beginPath();
  context.moveTo(tailX - fontSize * 0.38, bottom - 1);
  context.lineTo(tailX, bottom + tailHeight);
  context.lineTo(tailX + fontSize * 0.38, bottom - 1);
  context.closePath();
  context.fill();
  roundedRectPath(context, left, top, bubbleWidth, bubbleHeight, fontSize * 0.7);
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = "#ffd84d";
  context.lineWidth = Math.max(3, fontSize * 0.14);
  context.stroke();
  context.fillStyle = "#241d0b";
  context.textAlign = "center";
  context.textBaseline = "middle";
  lines.forEach((line, index) => {
    const y = top + bubbleHeight / 2 + (index - (lines.length - 1) / 2) * lineHeight;
    context.fillText(line, centerX, y, bubbleWidth - horizontalPadding * 2);
  });
  context.restore();
}

export const characterCaptionInternals = { splitLines };
