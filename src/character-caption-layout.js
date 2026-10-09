export function isEnglishCaption(text) {
  return /[A-Za-z]/.test(text) && !/[\u3400-\u9fff]/.test(text);
}

// Both the DOM caption and exported camera recording use this word boundary
// rule. Even an unusually long word stays intact instead of becoming letters.
export function layoutCharacterCaption(text, maxWidth, measure) {
  const content = String(text || "").replace(/\s+/g, " ").trim();
  if (!content) return [];
  const english = isEnglishCaption(content);
  const tokens = english ? content.split(" ") : [...content];
  const separator = english ? " " : "";
  const lines = [""];
  for (let i = 0; i < tokens.length; i++) {
    const candidate = lines.at(-1) + (lines.at(-1) ? separator : "") + tokens[i];
    if (!lines.at(-1) || measure(candidate) <= maxWidth) lines[lines.length - 1] = candidate;
    else if (lines.length < 2) lines.push(tokens[i]);
    else {
      const remaining = english ? lines[1].split(" ") : [...lines[1]];
      while (remaining.length > 1 && measure(remaining.join(separator) + "…") > maxWidth) remaining.pop();
      lines[1] = remaining.join(separator) + "…";
      break;
    }
  }
  return lines;
}

export function splitCharacterBubbleText(text, lineLimit = 16) {
  const content = String(text || "").replace(/\s+/g, " ").trim();
  if (isEnglishCaption(content)) return layoutCharacterCaption(content, lineLimit * 2, line => line.length);
  if (content.length <= lineLimit) return [content];
  const visible = content.slice(0, lineLimit * 2 - 1);
  let breakAt = lineLimit;
  for (let index = Math.min(lineLimit + 4, visible.length - 1); index >= Math.max(6, lineLimit - 5); index -= 1) {
    if (/[，。！？；、,!?]/.test(visible[index])) { breakAt = index + 1; break; }
  }
  const first = visible.slice(0, breakAt).trim();
  const remainder = visible.slice(breakAt).trim().replace(/^[，。！？；、,!?]+/, "");
  return [first, `${remainder}${content.length > visible.length ? "…" : ""}`].filter(Boolean);
}

