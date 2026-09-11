const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clock = () => globalThis.performance?.now?.() || Date.now();

export function getChewingPose(elapsedMs) {
  // A bite has a deliberately even jaw rhythm; it does not advance the speech timeline.
  const phase = Math.max(0, elapsedMs) / 1000 * Math.PI * 2 * 3.8;
  const open = (1 - Math.cos(phase)) / 2;
  return { scaleY: 0.24 + open * 0.85, scaleX: 1.055 - open * 0.055, headBob: Math.sin(phase) * 2.2 };
}

function safeNode(artboard, name) {
  try { return artboard?.node?.(name) || null; } catch { return null; }
}

function transformSnapshot(node) {
  return node ? { x: node.x, y: node.y, scaleX: node.scaleX, scaleY: node.scaleY } : null;
}

/** Converts the actual mouth node to the source Rive canvas, before App's crop/composite.
 * The shipped jiaojiao artboard uses a centered frame origin. Its world node coordinates
 * are centered even though artboard.bounds is [0,width] x [0,height]. This offset was
 * verified against its rendered mouth in the locked 2.40.1 Canvas runtime.
 */
export function mouthAnchorOnCanvas(instance, mouthNode) {
  try {
    const artboard = instance?.artboard;
    if (!mouthNode || !artboard || !instance.canvas?.width || !instance.canvas?.height) return null;
    const bounds = artboard.bounds;
    const width = bounds.maxX - bounds.minX, height = bounds.maxY - bounds.minY;
    const world = mouthNode.worldTransform();
    const originX = artboard.frameOrigin ? width / 2 : 0;
    const originY = artboard.frameOrigin ? height / 2 : 0;
    const artX = world.tx + originX, artY = world.ty + originY;
    const scale = Math.min(instance.canvas.width / width, instance.canvas.height / height);
    // The product fixes both runtimes to Contain + BottomCenter.
    const pixelX = (instance.canvas.width - width * scale) / 2 + (artX - bounds.minX) * scale;
    const pixelY = instance.canvas.height - height * scale + (artY - bounds.minY) * scale;
    if (![pixelX, pixelY].every(Number.isFinite)) return null;
    return { x: pixelX / instance.canvas.width, y: pixelY / instance.canvas.height };
  } catch { return null; }
}

/**
 * Real controls verified on public/media/jiaojiao.riv. Call install() once after load,
 * update({ x:-1..1, y:-1..1, mouthOpen, chewing }) on target changes, dispose() before
 * switching files/cleaning the Rive instance. install() runs after regular animation
 * advancement and before drawing; manual renderers can call afterAdvance() themselves.
 */
export function createCharacterInteraction(instance) {
  const artboard = instance?.artboard;
  const eyes = safeNode(artboard, "controller_eyeball_location");
  const head = safeNode(artboard, "controller_faceq");
  const mouth = safeNode(artboard, "IP_CJ_mouth_Y");
  const mouthAnchor = safeNode(artboard, "IP_CJ_mouth1");
  const animations = [];
  const makePose = (name, time) => {
    try {
      const animation = artboard?.animationByName?.(name);
      if (!animation || !instance.runtime?.LinearAnimationInstance) return null;
      const pose = new instance.runtime.LinearAnimationInstance(animation, artboard);
      pose.time = time;
      animations.push(pose);
      return pose;
    } catch { return null; }
  };
  // Only a fixed mouth shape is sampled. No speech animation is played or advanced.
  const openPose = makePose("Talking_Normal", 0.5);
  // The ZHc export closes its mouth at Talking_Normal's first frame and omits
  // the separate close timeline. Keep using the explicit pose when available.
  const closedPose = makePose("Talking_Normal_close", 0) || makePose("Talking_Normal", 0);
  const capabilities = Object.freeze({
    eyes: Boolean(eyes), head: Boolean(head), mouth: Boolean(mouth && openPose && closedPose),
    chewing: Boolean(mouth && openPose && closedPose), anchor: Boolean(mouthAnchor),
    method: "verified-rive-control-nodes", chewingMethod: "procedural-jaw",
  });
  let target = null, baseline = null, lastTime = 0, chewStarted = 0, disposed = false;
  let eyeX = 0, eyeY = 0, headX = 0, headY = 0;
  let originalAdvance = null, patchedAdvance = null;

  const restoreNodes = () => {
    if (!baseline) return;
    for (const [node, saved] of [[eyes, baseline.eyes], [head, baseline.head], [mouth, baseline.mouth]]) {
      if (!node || !saved) continue;
      for (const [property, value] of Object.entries(saved)) if (Number.isFinite(value)) node[property] = value;
    }
  };

  const reset = () => {
    if (disposed) return;
    try {
      if (baseline) { closedPose?.apply(1); restoreNodes(); artboard?.advance(0); instance._needsRedraw = true; }
    } catch { /* The owner may already be replacing its Rive artboard. */ }
    target = null; baseline = null; lastTime = 0; chewStarted = 0;
    eyeX = 0; eyeY = 0; headX = 0; headY = 0;
  };

  const update = (value, timestamp = clock()) => {
    if (disposed) return;
    if (!value) { reset(); return; }
    if (!baseline) baseline = { eyes: transformSnapshot(eyes), head: transformSnapshot(head), mouth: transformSnapshot(mouth) };
    if (value.chewing && !target?.chewing) chewStarted = timestamp;
    target = { x: clamp(Number(value.x) || 0, -1, 1), y: clamp(Number(value.y) || 0, -1, 1), mouthOpen: Boolean(value.mouthOpen), chewing: Boolean(value.chewing) };
    instance._needsRedraw = true;
    if (patchedAdvance && !instance._explicitlyStoppedRendering) instance.scheduleRendering?.();
  };

  const afterAdvance = (timestamp = clock()) => {
    if (disposed || !target || !baseline || instance.artboard !== artboard) return;
    const elapsed = lastTime ? clamp(timestamp - lastTime, 0, 80) : 16;
    lastTime = timestamp;
    const eyeBlend = 1 - Math.exp(-elapsed / 48), headBlend = 1 - Math.exp(-elapsed / 130);
    eyeX += (target.x - eyeX) * eyeBlend; eyeY += (target.y - eyeY) * eyeBlend;
    headX += (target.x - headX) * headBlend; headY += (target.y - headY) * headBlend;
    const chewing = target.chewing ? getChewingPose(timestamp - chewStarted) : null;
    try {
      if (capabilities.mouth) {
        (target.mouthOpen || target.chewing ? openPose : closedPose).apply(1);
        mouth.scaleY = baseline.mouth.scaleY * (chewing ? chewing.scaleY : target.mouthOpen ? 1.8 : 1);
        mouth.scaleX = baseline.mouth.scaleX * (chewing ? chewing.scaleX : target.mouthOpen ? 1.04 : 1);
      }
      if (eyes) { eyes.x = baseline.eyes.x + eyeX * 110; eyes.y = baseline.eyes.y + eyeY * 80; }
      if (head) { head.x = baseline.head.x + headX * 32; head.y = baseline.head.y + headY * 22 + (chewing?.headBob || 0); }
      artboard.advance(0);
      instance._needsRedraw = true;
      if (patchedAdvance && !instance._explicitlyStoppedRendering) instance.scheduleRendering?.();
    } catch { reset(); }
  };

  const install = () => {
    if (disposed || patchedAdvance || typeof instance.advanceAndReportChanges !== "function") return false;
    originalAdvance = instance.advanceAndReportChanges;
    patchedAdvance = function (...args) {
      const result = originalAdvance.apply(this, args);
      afterAdvance(clock());
      return result;
    };
    instance.advanceAndReportChanges = patchedAdvance;
    return true;
  };

  const dispose = () => {
    if (disposed) return;
    reset();
    if (patchedAdvance && instance.advanceAndReportChanges === patchedAdvance) instance.advanceAndReportChanges = originalAdvance;
    animations.forEach((animation) => { try { animation.delete(); } catch { /* Already disposed with its owner. */ } });
    disposed = true;
  };

  return { update, afterAdvance, reset, dispose, install, capabilities, getMouthAnchor: () => disposed ? null : mouthAnchorOnCanvas(instance, mouthAnchor) };
}
