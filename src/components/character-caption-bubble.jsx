import { useEffect, useState } from "react";
import { Calligraph } from "calligraph";

export function splitCharacterBubbleText(text, lineLimit = 16) {
  const content = String(text || "").replace(/\s+/g, " ").trim();
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

export function CharacterCaptionBubble({ reaction, canvasRendered = false }) {
  const [current, setCurrent] = useState(reaction);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (reaction?.id === current?.id) return undefined;
    if (!current) {
      setCurrent(reaction || null);
      return undefined;
    }
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setCurrent(reaction || null);
      setLeaving(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [current?.id, reaction]);

  if (!current?.text) return null;
  const lines = splitCharacterBubbleText(current.text);
  return (
    <div
      className={`character-caption-bubble is-${current.tone || "delighted"} ${leaving ? "is-leaving" : ""} ${canvasRendered ? "is-canvas-rendered" : ""}`}
      data-character={current.character || "jiaojiao"}
      role="status"
      aria-live="polite"
    >
      {lines.map((line) => (
        <Calligraph key={line} className="character-caption-copy" as="span" variant="text" animation="smooth" initial trend={-1} drift={{ x: 6, y: 5 }} stagger={0.014} autoSize={false}>
          {line}
        </Calligraph>
      ))}
    </div>
  );
}
