import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Calligraph } from 'calligraph';

const EVENT_NAME = 'mengmeng:bubble-text';
const SKIP_EVENT_NAME = 'mengmeng:bubble-skip';
const DEFAULT_TEXT = '我在认真听。';
const mountedTargets = new WeakSet();
const splitText = value => {
  if (typeof Intl?.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), item => item.segment);
  }
  return Array.from(value);
};

function matchesBubble(detail, bubbleKey) {
  return detail?.key ? detail.key === bubbleKey : bubbleKey === 'lab';
}

function bubbleNodesForKey(bubbleKey) {
  return [...document.querySelectorAll('[data-bubble-key]')]
    .filter(node => node.dataset.bubbleKey === bubbleKey);
}

export function setSpeechBubbleText(bubbleKey, text, options = {}) {
  const value = String(text || '').trim();
  for (const node of bubbleNodesForKey(bubbleKey)) {
    const shell = node.matches('[data-bubble-shell]') ? node : node.closest('[data-bubble-shell]');
    if (shell) {
      shell.dataset.text = value;
      if (value) shell.setAttribute('aria-label', value);
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: { key: bubbleKey, text: value, ...options },
  }));
}

export function skipSpeechBubble(bubbleKey) {
  window.dispatchEvent(new CustomEvent(SKIP_EVENT_NAME, { detail: { key: bubbleKey } }));
}

function updateBubbleSize(shell, characters) {
  if (!shell) return;
  const style = getComputedStyle(shell);
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  const padding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
  const maxLineCharacters = Math.max(8, Number(shell.dataset.bubbleMaxChars) || 24);
  const visibleCharacters = Math.max(3, Math.min(characters.length, maxLineCharacters));
  const targetWidth = Math.ceil(padding + visibleCharacters * fontSize * 1.06);
  shell.style.setProperty('--bubble-content-width', `${targetWidth}px`);
  shell.dataset.bubbleLines = characters.length > maxLineCharacters ? '2' : '1';
}

function restartBubbleEntrance(shell, reduced) {
  if (!shell) return () => {};
  shell.classList.remove('is-entering');
  if (reduced) return () => {};
  let secondFrame = 0;
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(() => shell.classList.add('is-entering'));
  });
  return () => {
    cancelAnimationFrame(firstFrame);
    cancelAnimationFrame(secondFrame);
  };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const update = event => setReduced(event.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

// Calligraph owns the glyph transitions. The invisible CSS sizing glyph keeps
// every character's place reserved while characters arrive, so lines never hop.
function EntranceText({ text, instant = false, delay = 0, step = 22 }) {
  const reduced = useReducedMotion();
  const settled = instant || reduced;
  const characters = useMemo(() => splitText(text), [text]);
  const previous = useRef({ characters: [], count: 0 });
  const [visibleCount, setVisibleCount] = useState(settled ? characters.length : 0);
  useLayoutEffect(() => {
    let prefix = 0;
    while (prefix < characters.length && characters[prefix] === previous.current.characters[prefix]) prefix++;
    const startCount = settled ? characters.length : Math.min(prefix, previous.current.count);
    previous.current = { characters, count: startCount };
    setVisibleCount(startCount);
    if (settled || startCount === characters.length) return undefined;
    const startAt = performance.now() + delay;
    const interval = Math.min(step, 650 / Math.max(1, characters.length - startCount));
    let frame;
    const tick = now => {
      const next = Math.min(characters.length, startCount + Math.max(0, Math.floor((now - startAt) / interval) + 1));
      if (next !== previous.current.count) {
        previous.current.count = next;
        setVisibleCount(next);
      }
      if (next < characters.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [characters, settled, delay, step]);
  return <span className="calligraph-text" aria-hidden="true">{characters.map((char, index) => (
    <span className="calligraph-glyph" data-glyph={char} key={`${index}:${char}`}>
      <Calligraph key={settled ? 'settled' : 'animated'} animation="smooth" initial={!settled}
        autoSize={false} drift={{ x: 0, y: 3 }} trend={1}
        style={{ gridArea: '1 / 1', display: 'inline', minWidth: 0 }} aria-hidden="true">
        {settled || index < visibleCount ? char : ''}
      </Calligraph>
    </span>
  ))}</span>;
}

export function createTextMotion(target) {
  const root = createRoot(target);
  let text = '', options = {}, disposed = false;
  target.dataset.textMotion = 'calligraph';
  const paint = () => { if (!disposed) flushSync(() => root.render(<EntranceText text={text} {...options} />)); };
  return {
    setText(value, nextOptions = {}) { text = String(value ?? ''); options = nextOptions; paint(); },
    finish() { options = { ...options, instant: true }; paint(); },
    destroy() { if (!disposed) { root.unmount(); disposed = true; } },
  };
}

function BubbleLetters({ initialText, bubbleKey, target }) {
  const [message, setMessage] = useState({ text: initialText, complete: true, instant: false, revision: 0, entranceRevision: 0 });
  const reduced = useReducedMotion();
  const characters = useMemo(() => splitText(message.text), [message.text]);
  const shell = target.closest('[data-bubble-shell]') || target.parentElement;

  useEffect(() => {
    const receive = event => {
      if (!matchesBubble(event.detail, bubbleKey)) return;
      const text = String(event.detail?.text || DEFAULT_TEXT);
      setMessage(current => ({
        text,
        complete: Boolean(event.detail?.complete),
        instant: false,
        revision: current.revision + (
          current.text !== text || event.detail?.waiting || event.detail?.complete || event.detail?.durationMs == null ? 1 : 0
        ),
        entranceRevision: current.entranceRevision + (event.detail?.enter === false ? 0 : 1),
      }));
    };
    window.addEventListener(EVENT_NAME, receive);
    return () => window.removeEventListener(EVENT_NAME, receive);
  }, [bubbleKey]);

  useEffect(() => {
    const skip = event => {
      if (!matchesBubble(event.detail, bubbleKey)) return;
      setMessage(current => ({ ...current, complete: true, instant: true }));
    };
    window.addEventListener(SKIP_EVENT_NAME, skip);
    return () => window.removeEventListener(SKIP_EVENT_NAME, skip);
  }, [bubbleKey]);

  useLayoutEffect(() => {
    updateBubbleSize(shell, characters);
  }, [characters, shell]);

  useLayoutEffect(() => {
    return restartBubbleEntrance(shell, reduced);
  }, [message.entranceRevision, reduced, shell]);

  // Completed bubbles should settle immediately. Keeping the entrance animation
  // running after TTS has finished can paint transformed glyphs beyond the
  // compact 2D bubble's clipped line box, which shows up as tiny dark marks.
  return <EntranceText text={message.text} instant={message.instant || message.complete} />;
}

export function mountSpeechBubble(target) {
  if (!(target instanceof Element) || mountedTargets.has(target)) return false;
  const shell = target.closest('[data-bubble-shell]') || target.parentElement;
  const bubbleKey = target.dataset.bubbleKey || shell?.dataset.bubbleKey || target.id;
  const initialText = String(shell?.dataset.text || target.dataset.text || target.textContent || DEFAULT_TEXT);
  mountedTargets.add(target);
  target.dataset.bubbleMounted = 'true';
  target.textContent = '';
  createRoot(target).render(<BubbleLetters initialText={initialText} bubbleKey={bubbleKey} target={target} />);
  document.documentElement.dataset.calligraphReady = 'true';
  return true;
}

export function mountSpeechBubbles(root = document) {
  if (root instanceof Element && root.matches('[data-calligraph-bubble]')) mountSpeechBubble(root);
  root.querySelectorAll?.('[data-calligraph-bubble]').forEach(mountSpeechBubble);
}

mountSpeechBubbles();

const bubbleObserver = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node instanceof Element) mountSpeechBubbles(node);
    }
  }
});
bubbleObserver.observe(document.documentElement, { childList: true, subtree: true });

window.MengMengSpeechBubble = Object.freeze({
  mount: mountSpeechBubble,
  mountAll: mountSpeechBubbles,
  setText: setSpeechBubbleText,
  skip: skipSpeechBubble,
});
