import { Calligraph } from "calligraph";

export function CharacterCaptionBubble({ reaction, canvasRendered = false }) {
  if (!reaction?.text) return null;
  return (
    <div
      key={reaction.id}
      className={`character-caption-bubble is-${reaction.tone || "delighted"} ${canvasRendered ? "is-canvas-rendered" : ""}`}
      data-character={reaction.character || "jiaojiao"}
      role="status"
      aria-live="polite"
    >
      <Calligraph
        className="character-caption-copy"
        as="span"
        variant="text"
        animation="smooth"
        initial
        trend={1}
        drift={{ x: 7, y: 7 }}
        stagger={0.015}
        autoSize={false}
      >
        {reaction.text}
      </Calligraph>
    </div>
  );
}
