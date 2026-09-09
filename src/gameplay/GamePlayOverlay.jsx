import { useCallback, useEffect, useRef, useState } from "react";
import FoodModel from "../assets-gallery/FoodModel.jsx";
import { requestGameplay } from "./gameplay-api.js";
import { FOOD_LABELS, advanceFrameStability, clamp, createRoundGuard, frameSignature, getMouthTarget, isNearMouth, rawPointFromStage, stageBoxFromRaw } from "./gameplay-state.js";
import "./gameplay.css";

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const usableFrame = (frame) => frame?.image?.startsWith("data:image/jpeg;base64,") && frame.width > 0 && frame.height > 0;

function foodOrigin(stage, panel) {
  const halfWidth = 60, halfHeight = 64, gap = 12;
  const minX = halfWidth + gap, minY = halfHeight + gap;
  const maxX = Math.max(minX, stage.width - halfWidth - gap);
  const maxY = Math.max(minY, stage.height - halfHeight - gap);
  const preferred = { x: maxX, y: clamp(stage.height * 0.48, minY, maxY) };
  if (!panel) return preferred;
  const clear = (point) => point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
    && (point.x + halfWidth + gap <= panel.x || point.x - halfWidth - gap >= panel.x + panel.width
      || point.y + halfHeight + gap <= panel.y || point.y - halfHeight - gap >= panel.y + panel.height);
  return [preferred,
    { x: maxX, y: panel.y + panel.height + halfHeight + gap },
    { x: panel.x - halfWidth - gap, y: preferred.y },
    { x: panel.x + panel.width + halfWidth + gap, y: preferred.y },
  ].find(clear) || { x: maxX, y: maxY };
}

/** Mount inside the camera viewfinder. All coordinates use this element's CSS pixels. */
export default function GamePlayOverlay({ mode, onClose, captureFrame, onReaction, onActivity, onTarget, character = "jiaojiao", characterRect, frameKey = "camera", transcript = "" }) {
  const elementRef = useRef(null);
  const panelRef = useRef(null);
  const callbacks = useRef({ captureFrame, onReaction, onActivity, onTarget, onClose });
  callbacks.current = { captureFrame, onReaction, onActivity, onTarget, onClose };
  const guard = useRef(createRoundGuard());
  const requestRef = useRef(null);
  const timerRef = useRef(null);
  const dragRef = useRef(null);
  const stabilityRef = useRef(null);
  const retryAtRef = useRef(0);
  const roundRef = useRef(makeId());
  const mountedRef = useRef(false);
  const [stage, setStage] = useState({ width: 1, height: 1 });
  const [panelBounds, setPanelBounds] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [foodId, setFoodId] = useState(null);
  const [foodSource, setFoodSource] = useState("");
  const [foodPosition, setFoodPosition] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [nearMouth, setNearMouth] = useState(false);
  const [target, setTarget] = useState(null);
  const [selection, setSelection] = useState(null);
  const [steady, setSteady] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const busy = ["recognizing", "creating", "verifying"].includes(phase);
  const mouth = getMouthTarget(characterRect, stage);
  const origin = foodOrigin(stage, mode === "feed" ? panelBounds : null);
  const foodPoint = foodPosition || origin;
  const selectedPoint = selection || { x: stage.width / 2, y: stage.height / 2 };

  const stopTransient = useCallback(() => {
    guard.current.cancel();
    requestRef.current?.abort(); requestRef.current = null;
    clearTimeout(timerRef.current); timerRef.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    try { drag?.element?.releasePointerCapture?.(drag.pointerId); } catch { /* A cancelled pointer may already be released. */ }
    callbacks.current.onTarget?.(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    callbacks.current.onActivity?.(true);
    const element = elementRef.current;
    const previousFocus = document.activeElement;
    element.querySelector(".gameplay-close")?.focus({ preventScroll: true });
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      stopTransient();
      callbacks.current.onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    const measure = () => {
      setStage({ width: element.clientWidth, height: element.clientHeight });
      const bounds = element.getBoundingClientRect(); const panel = panelRef.current?.getBoundingClientRect();
      if (panel) setPanelBounds({ x: panel.left - bounds.left, y: panel.top - bounds.top, width: panel.width, height: panel.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (panelRef.current) observer.observe(panelRef.current);
    return () => {
      mountedRef.current = false; observer.disconnect(); stopTransient(); callbacks.current.onActivity?.(false);
      window.removeEventListener("keydown", onKeyDown);
      queueMicrotask(() => {
        const returnTo = previousFocus?.isConnected ? previousFocus : document.querySelector(".play-entry");
        returnTo?.focus?.({ preventScroll: true });
      });
    };
  }, [stopTransient]);

  useEffect(() => {
    stopTransient(); roundRef.current = makeId(); retryAtRef.current = 0;
    setPhase("idle"); setError(""); setMessage(""); setTarget(null); setConfirmed(null);
    setFoodId(null); setFoodPosition(null); setFoodSource(""); setNearMouth(false);
    setSelection(null); setSteady(false); setManualOpen(false); setRetrySeconds(0); stabilityRef.current = null;
  }, [mode, frameKey, stopTransient]);

  useEffect(() => {
    if (!retrySeconds) return undefined;
    const timer = setInterval(() => setRetrySeconds(Math.max(0, Math.ceil((retryAtRef.current - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [retrySeconds]);

  useEffect(() => {
    if (mode !== "find" || phase !== "searching") return undefined;
    let cancelled = false, sampling = false;
    stabilityRef.current = null; setSteady(false);
    const sample = async () => {
      if (sampling || cancelled || !mountedRef.current) return;
      sampling = true;
      try {
        const frame = await callbacks.current.captureFrame?.();
        if (cancelled || !mountedRef.current) return;
        if (!usableFrame(frame)) throw new Error("Camera not ready");
        const signature = await frameSignature(frame);
        if (!cancelled && mountedRef.current) {
          stabilityRef.current = advanceFrameStability(stabilityRef.current, signature, performance.now());
          setSteady(stabilityRef.current.steady);
        }
      } catch { if (!cancelled && mountedRef.current) setSteady(false); }
      finally { sampling = false; }
    };
    void sample();
    const timer = setInterval(sample, 600);
    return () => { cancelled = true; clearInterval(timer); };
  }, [mode, phase, frameKey]);

  const failRequest = (failure, fallbackPhase) => {
    const wait = failure.retryAfterMs || 0;
    retryAtRef.current = Date.now() + wait;
    setRetrySeconds(Math.ceil(wait / 1000));
    setError(failure.name === "AbortError" ? "这次看得有点久，再试一下吧" : failure.message || "暂时没连上，再试一下吧");
    setPhase(fallbackPhase);
  };

  const observe = async (source) => {
    if (!mountedRef.current || busy || requestRef.current || Date.now() < retryAtRef.current) return;
    stopTransient();
    const token = guard.current.next();
    const controller = new AbortController(); requestRef.current = controller;
    const isCurrent = () => mountedRef.current && guard.current.isCurrent(token) && !controller.signal.aborted;
    const roundId = source === "quest" ? makeId() : roundRef.current;
    if (source === "quest") { roundRef.current = roundId; setTarget(null); setConfirmed(null); setSelection(null); }
    setError(""); setMessage(""); setPhase(source === "food" ? "recognizing" : source === "quest" ? "creating" : "verifying");
    try {
      const frame = await callbacks.current.captureFrame?.();
      if (!isCurrent()) return;
      if (!usableFrame(frame)) throw new Error("相机还没准备好，等画面出现再试试");
      if (source === "verify") {
        const signature = await frameSignature(frame);
        if (!isCurrent()) return;
        const checked = advanceFrameStability(stabilityRef.current, signature, performance.now());
        if (!checked.steady) { setMessage("镜头刚刚动了，稳住再找一次"); setPhase("searching"); return; }
      }
      const frameId = makeId();
      const point = source === "verify" ? rawPointFromStage(selectedPoint, frame, stage) : undefined;
      const result = await requestGameplay({ source, image: frame.image, roundId, frameId, character, ...(source === "verify" ? { target, point } : {}) }, { signal: controller.signal });
      if (!isCurrent()) return;
      if (source === "food") {
        if (result.evaluable && FOOD_LABELS[result.foodId]) {
          setFoodId(result.foodId); setFoodSource("camera"); setFoodPosition(null); setPhase("ready");
          setMessage(`看见${FOOD_LABELS[result.foodId]}啦！拖给叫叫尝尝`);
          callbacks.current.onReaction?.({ action: "curious", text: result.text || `是${FOOD_LABELS[result.foodId]}呀！` });
        } else { setPhase(foodId ? "ready" : "idle"); setMessage("还没看见苹果、蛋糕或面条，换个角度试试"); }
      } else if (source === "quest") {
        if (result.evaluable && result.target) {
          setTarget(result.target); setPhase("searching"); setMessage("把东西放进圆圈，或者点一下它");
          callbacks.current.onReaction?.({ action: "curious", text: result.target.prompt });
        } else { setPhase("idle"); setMessage("这里还不太清楚，换个角度再出一道题吧"); }
      } else if (result.evaluable && result.matched && result.bbox && stageBoxFromRaw(result.bbox, frame, stage)) {
        setConfirmed({ frame, bbox: result.bbox }); setPhase("success"); setMessage("找到了！这是你选中的范围");
        callbacks.current.onReaction?.({ action: "praise", text: "你发现啦，观察得真仔细！" });
      } else { setPhase("searching"); setMessage(result.text || "还没找到，再观察一下吧"); }
    } catch (failure) {
      if (isCurrent()) failRequest(failure, source === "verify" ? "searching" : foodId && source === "food" ? "ready" : "idle");
    } finally { if (requestRef.current === controller) requestRef.current = null; }
  };

  const pickFood = (id) => {
    stopTransient(); setFoodId(id); setFoodSource("manual"); setFoodPosition(null); setPhase("ready");
    setError(""); setMessage(`你选了${FOOD_LABELS[id]}，拖给叫叫吧`); setNearMouth(false); setManualOpen(false);
  };

  const pointerPoint = (event) => {
    const rect = elementRef.current.getBoundingClientRect();
    return { x: clamp(event.clientX - rect.left, 24, rect.width - 24), y: clamp(event.clientY - rect.top, 24, rect.height - 24) };
  };

  const dragStart = (event) => {
    if (phase !== "ready" || !foodId || !mouth || character !== "jiaojiao" || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPoint(event);
    dragRef.current = { pointerId: event.pointerId, element: event.currentTarget, point };
    setPhase("dragging"); setFoodPosition(point); setNearMouth(isNearMouth(point, mouth, 15));
    callbacks.current.onTarget?.({ ...point, mouthOpen: isNearMouth(point, mouth, 15), chewing: false });
  };

  const dragMove = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = pointerPoint(event); dragRef.current.point = point;
    const close = isNearMouth(point, mouth, 15);
    setFoodPosition(point); setNearMouth(close);
    callbacks.current.onTarget?.({ ...point, mouthOpen: close, chewing: false });
  };

  const eatFoodAtMouth = () => {
    if (!mouth || !mountedRef.current) return;
    setFoodPosition({ x: mouth.x, y: mouth.y }); setPhase("eating"); setMessage("啊呜，接住啦！");
    callbacks.current.onTarget?.({ x: mouth.x, y: mouth.y, mouthOpen: false, chewing: true });
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      callbacks.current.onTarget?.(null);
      callbacks.current.onReaction?.({ action: "happy", text: "谢谢你的分享！" });
      setFoodPosition(null); setPhase("ready"); setMessage("再喂一口，或者换一种食物");
    }, 1_650);
  };

  const keyboardFeed = (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (event.repeat || phase !== "ready" || !foodId || !mouth || character !== "jiaojiao") return;
    setFoodPosition({ x: mouth.x, y: mouth.y }); setPhase("dragging"); setNearMouth(true);
    setMessage("把这一口递给叫叫");
    callbacks.current.onTarget?.({ x: mouth.x, y: mouth.y, mouthOpen: true, chewing: false });
    timerRef.current = setTimeout(() => { setNearMouth(false); eatFoodAtMouth(); }, 320);
  };

  const selectWithKeyboard = (event) => {
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); setSelection(null); return; }
    const delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key];
    if (!delta) return;
    event.preventDefault();
    setSelection({ x: clamp(selectedPoint.x + delta[0], 24, stage.width - 24), y: clamp(selectedPoint.y + delta[1], 24, stage.height - 24) });
    setMessage("选好后，点“找到了”让叫叫看看");
  };

  const releaseDrag = (event, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!cancelled) drag.point = pointerPoint(event);
    try { drag.element.releasePointerCapture(event.pointerId); } catch { /* Pointer cancellation already releases capture. */ }
    setNearMouth(false);
    if (cancelled || !isNearMouth(drag.point, mouth)) {
      setPhase("returning"); setFoodPosition(null); callbacks.current.onTarget?.(null);
      timerRef.current = setTimeout(() => { if (mountedRef.current) setPhase("ready"); }, 320);
      return;
    }
    eatFoodAtMouth();
  };

  const close = () => { stopTransient(); callbacks.current.onClose?.(); };
  const displayBox = confirmed ? stageBoxFromRaw(confirmed.bbox, confirmed.frame, stage) : null;

  return (
    <div ref={elementRef} className={`gameplay-overlay gameplay-${mode}`} role="region" aria-label={mode === "feed" ? "分你一口互动" : "叫叫找一找互动"} data-gameplay-mode={mode} data-gameplay-phase={phase} data-gameplay-food-source={foodSource || "none"}>
      {confirmed && <div className="gameplay-confirmed" aria-label="本次确认的画面">
        <img src={confirmed.frame.image} alt="找到了的这一刻" style={{ transform: confirmed.frame.mirrored ? "scaleX(-1)" : undefined }} />
        {displayBox && <div className="gameplay-target-box" style={{ left: displayBox.x, top: displayBox.y, width: displayBox.width, height: displayBox.height }}><span>找到了 · 范围高亮</span></div>}
      </div>}
      {mode === "find" && phase === "searching" && <button type="button" className="gameplay-select-surface" aria-label="点选要给叫叫看的物品，方向键移动圆圈，回车回到中心" onKeyDown={selectWithKeyboard} onPointerDown={(event) => { setSelection(pointerPoint(event)); setError(""); }} />}
      {mode === "find" && ["searching", "verifying"].includes(phase) && <div className={`gameplay-reticle ${steady ? "is-steady" : ""}`} style={{ left: selectedPoint.x, top: selectedPoint.y }} aria-hidden="true"><i /><i /><i /><i /></div>}
      <header className="gameplay-topbar">
        <div><span className="gameplay-eyebrow">和叫叫一起玩</span><strong>{mode === "feed" ? "分你一口" : "叫叫找一找"}</strong></div>
        <button type="button" className="gameplay-close" aria-label="结束当前玩法" onClick={close}>×</button>
      </header>
      {mode === "feed" && foodId && <button type="button" className={`gameplay-food is-${phase}`} aria-label={`拖动${FOOD_LABELS[foodId]}喂叫叫，也可以按回车喂一口`} onKeyDown={keyboardFeed}
        style={{ left: foodPoint.x, top: foodPoint.y }} disabled={!['ready', 'dragging'].includes(phase) || !mouth || character !== "jiaojiao"}
        onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={(event) => releaseDrag(event)}
        onPointerCancel={(event) => releaseDrag(event, true)} onLostPointerCapture={(event) => releaseDrag(event, true)} onContextMenu={(event) => event.preventDefault()}>
        <FoodModel foodId={foodId} className="gameplay-food-model" interactive={false} autoRotate={phase === "ready"} transparent />
        <span>{FOOD_LABELS[foodId]}</span>
      </button>}
      {mode === "feed" && phase === "dragging" && mouth && <div className={`gameplay-mouth-guide ${nearMouth ? "is-near" : ""}`} style={{ left: mouth.x, top: mouth.y, width: mouth.radius * 2, height: mouth.radius * 2 }} aria-hidden="true" />}
      <section ref={panelRef} className="gameplay-panel" aria-label={mode === "feed" ? "喂食操作" : "找一找操作"}>
        {mode === "feed" ? <>
          <h2>{phase === "eating" ? "啊呜，接住啦！" : foodId ? "拖到嘴边，再松开" : "让叫叫看看你的食物"}</h2>
          <p>{character !== "jiaojiao" ? "先换叫叫来尝一口吧" : foodId && !mouth ? "叫叫还没站好，等它出现再喂一口" : message || "把苹果、蛋糕或面条放到镜头前"}</p>
          {foodSource === "manual" && <span className="gameplay-source-tag">自己选的食物</span>}
          <div className="gameplay-actions">
            <button type="button" className="gameplay-primary" disabled={busy || retrySeconds > 0 || ['dragging', 'eating'].includes(phase)} onClick={() => observe("food")}>{phase === "recognizing" ? "正在看食物…" : retrySeconds ? `${retrySeconds} 秒后再看` : foodId ? "再认一次" : "看看是什么"}</button>
            <button type="button" className="gameplay-secondary" disabled={['dragging', 'eating'].includes(phase)} onClick={() => setManualOpen(!manualOpen)} aria-expanded={manualOpen}>自己选一个</button>
          </div>
          {manualOpen && <div className="gameplay-food-picker" aria-label="手动选择食物">{Object.entries(FOOD_LABELS).map(([id, label]) => <button key={id} type="button" onClick={() => pickFood(id)}>{label}</button>)}</div>}
        </> : <>
          <h2>{target?.prompt || "发现身边的小惊喜"}</h2>
          <p>{phase === "creating" ? "叫叫正在观察周围…" : phase === "verifying" ? "正在看你选的这个东西…" : message || "先让叫叫看看周围，再一起找一找"}</p>
          {phase === "searching" && <span className={`gameplay-stability ${steady ? "is-ready" : ""}`}>{steady ? "镜头稳啦，可以确认" : "稳住镜头一小会儿"}</span>}
          <div className="gameplay-actions">
            {phase === "searching" || phase === "verifying" ? <button type="button" className="gameplay-primary" disabled={!steady || busy || retrySeconds > 0} onClick={() => observe("verify")}>{phase === "verifying" ? "确认中…" : retrySeconds ? `${retrySeconds} 秒后再试` : "找到了，看看这个"}</button>
              : <button type="button" className="gameplay-primary" disabled={busy || retrySeconds > 0} onClick={() => observe("quest")}>{phase === "creating" ? "正在出题…" : retrySeconds ? `${retrySeconds} 秒后再试` : phase === "success" ? "再找一个" : "看看周围，出一道题"}</button>}
            {target && phase !== "success" && <button type="button" className="gameplay-secondary" disabled={busy || retrySeconds > 0} onClick={() => observe("quest")}>换一道</button>}
          </div>
        </>}
        {error && <p className="gameplay-error" role="alert">{error}</p>}
      </section>
      <span className="gameplay-announcement" aria-live="polite">{message}</span>
    </div>
  );
}
