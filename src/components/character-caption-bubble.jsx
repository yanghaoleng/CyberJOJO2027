import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Calligraph } from "calligraph";
export { splitCharacterBubbleText } from "../character-caption-layout.js";
import { isEnglishCaption, layoutCharacterCaption, splitCharacterBubbleText } from "../character-caption-layout.js";

export function CharacterCaptionBubble({ reaction, canvasRendered = false }) {
  const [current, setCurrent] = useState(reaction);
  const [leaving, setLeaving] = useState(false);
  const bubbleRef = useRef(null);
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    if (reaction?.id === current?.id) {
      if (reaction !== current) setCurrent(reaction || null);
      return undefined;
    }
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

  const english = isEnglishCaption(current?.text || "");
  useLayoutEffect(() => {
    if (!english || !bubbleRef.current) { setLayout(null); return undefined; }
    const element = bubbleRef.current;
    let active = true;
    const measure = () => {
      if (!active) return;
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const maxWidth = Math.min(element.parentElement.clientWidth - 32, 520) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2;
      setLayout(layoutCharacterCaption(current.text, maxWidth, text => context.measureText(text).width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element.parentElement);
    document.fonts?.ready.then(measure);
    return () => { active = false; observer.disconnect(); };
  }, [current?.text, english]);

  if (!current?.text) return null;
  const lines = english ? (layout || splitCharacterBubbleText(current.text, 22)) : splitCharacterBubbleText(current.text);
  return (
    <div
      ref={bubbleRef}
      className={`character-caption-bubble ${english ? "is-english" : ""} is-${current.tone || "delighted"} ${leaving ? "is-leaving" : ""} ${canvasRendered ? "is-canvas-rendered" : ""}`}
      data-character={current.character || "jiaojiao"}
      role="status"
      aria-live="polite"
    >
      {english ? lines.map((line, index) => (
        <span className="character-caption-copy character-caption-english-line" key={index}>
          {line.split(" ").map((word, wordIndex) => <span className="character-caption-word" key={`${wordIndex}-${word}`} style={{ animationDelay: `${Math.min(wordIndex, 10) * 35}ms` }}>{word}{wordIndex < line.split(" ").length - 1 ? " " : ""}</span>)}
        </span>
      )) : lines.map((line) => (
        <Calligraph key={line} className="character-caption-copy" as="span" variant="text" animation="smooth" initial trend={-1} drift={{ x: 6, y: 5 }} stagger={0.014} autoSize={false}>
          {line}
        </Calligraph>
      ))}
    </div>
  );
}
