export const AUTO_CAPTURE_COOLDOWN_MS = 12_000;

export function getTopicCaptureChange(previousTitle, caption) {
  if (caption?.kind !== "subject") return { title: previousTitle, reason: "" };
  const title = String(caption.text || "");
  const reason = previousTitle && title !== previousTitle && caption.secondLine !== "聊聊天"
    ? `topic:${title}` : "";
  return { title, reason };
}
