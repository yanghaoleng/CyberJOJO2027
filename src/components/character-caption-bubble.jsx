import { Calligraph } from "calligraph";

export function CharacterCaptionBubble({ reaction, canvasRendered = false }) {
  if (!reaction?.text) return null;
  const style = reaction.anchor ? {
    left: `${reaction.anchor.x * 100}%`,
    top: `calc(${reaction.anchor.y * 100}% + 14px)`,
    bottom: "auto",
    "--character-tail-x": "50%",
  } : undefined;
  return (
    <div
      key={reaction.id}
      className={`character-caption-bubble is-${reaction.tone || "delighted"} ${canvasRendered ? "is-canvas-rendered" : ""}`}
      data-character={reaction.character || "jiaojiao"}
      role="status"
      aria-live="polite"
      style={style}
    >
      <Calligraph
        className="character-caption-copy"
        as="span"
        variant="text"
        animation="smooth"
        initial
        trend={-1}
        drift={{ x: 8, y: 6 }}
        stagger={0.014}
        autoSize={false}
      >
        {reaction.text}
      </Calligraph>
    </div>
  );
}
