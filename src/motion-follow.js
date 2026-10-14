const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const wrapAngle = (n) => Math.atan2(Math.sin(n), Math.cos(n));
const visible = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && (p.visibility ?? 1) >= .55 && (p.presence ?? 1) >= .55;

// Retarget directions, not absolute camera coordinates: distance from the camera
// must not change the character's limb lengths. Front camera behaves like a mirror.
export function mapMotionPose(landmarks, { mirrored = true, aspect = 1 } = {}) {
  if (!Array.isArray(landmarks) || !visible(landmarks[11]) || !visible(landmarks[12])) return null;
  const point = (index) => {
    const p = landmarks[index];
    return visible(p) ? { x: (mirrored ? 1 - p.x : p.x) * aspect, y: p.y } : null;
  };
  const direction = (a, b) => {
    const from = point(a), to = point(b);
    return from && to && Math.hypot(to.x - from.x, to.y - from.y) > .015 ? Math.atan2(to.y - from.y, to.x - from.x) : null;
  };
  const left = mirrored ? [12, 14, 16, 24, 26, 28] : [11, 13, 15, 23, 25, 27];
  const right = mirrored ? [11, 13, 15, 23, 25, 27] : [12, 14, 16, 24, 26, 28];
  const a = point(7) || point(2), b = point(8) || point(5);
  const earLeft = a && b ? (a.x < b.x ? a : b) : null;
  const earRight = a && b ? (a.x < b.x ? b : a) : null;
  const roll = earLeft ? clamp(Math.atan2(earRight.y - earLeft.y, earRight.x - earLeft.x), -.5, .5) : 0;
  const nose = point(0), l = point(11), r = point(12);
  const shoulderWidth = Math.max(Math.hypot(l.x - r.x, l.y - r.y), .08);
  const hips = point(23) && point(24) ? { x: (point(23).x + point(24).x) / 2, y: (point(23).y + point(24).y) / 2 } : null;
  const shoulders = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
  const angles = {
    head: -Math.PI / 2 + roll,
    body: hips ? -Math.PI / 2 + clamp(wrapAngle(Math.atan2(shoulders.y - hips.y, shoulders.x - hips.x) + Math.PI / 2), -.4, .4) : null,
    upperL: direction(left[0], left[1]), lowerL: direction(left[1], left[2]),
    upperR: direction(right[0], right[1]), lowerR: direction(right[1], right[2]),
    thighL: direction(left[3], left[4]), shinL: direction(left[4], left[5]),
    thighR: direction(right[3], right[4]), shinR: direction(right[4], right[5]),
  };
  return { angles, gaze: nose ? clamp((nose.x - shoulders.x) / shoulderWidth * 2, -1, 1) : 0,
    headY: nose ? clamp((nose.y - shoulders.y) / shoulderWidth + .45, -.65, .65) : 0, landmarks };
}

// Names verified against the shipped Rive file. Some bones share their name
// with a group; artboard.node() returns that group, so always resolve bone() first.
const BINDINGS = {
  body: ['IP_CJ_body'], head: ['IP_CJ_head'],
  upperL: ['IP_CJ_upperarm_L'], lowerL: ['IP_CJ_forearm_L'],
  upperR: ['IP_CJ_arm_R'], lowerR: ['IP_CJ_forearm_R'],
  thighL: ['IP_CJ_thigh_L'], shinL: ['IP_CJ_lowerleg_L'],
  thighR: ['IP_CJ_thigh_R'], shinR: ['IP_CJ_lowerleg_R'],
};

export function createMotionRig(instance) {
  const artboard = instance?.artboard;
  const bindings = Object.entries(BINDINGS).flatMap(([key, names]) => {
    let bone;
    for (const name of names) { try { bone = artboard?.bone?.(name); } catch { /* absent in this export */ } if (bone) break; }
    if (!bone) return [];
    const world = bone.worldTransform();
    return [{ key, bone, rotation: bone.rotation, restWorld: Math.atan2(world.xy, world.xx), smooth: null }];
  });
  let target = null, receivedAt = 0, lastAt = 0, original = null, wrapper = null, disposed = false;
  const headNodes = ['IP_CJ_head_X', 'IP_CJ_head_Y'].map(name => { try { return artboard?.node?.(name); } catch { return null; } });
  const headRest = headNodes.map(node => node ? { x: node.x, y: node.y } : null);
  let gaze = 0, headY = 0;
  const parent = instance.runtime?.Mat2D ? new instance.runtime.Mat2D() : null;
  const reset = () => {
    target = null; lastAt = 0;
    try {
      for (const b of bindings) { b.bone.rotation = b.rotation; b.smooth = null; }
      headNodes.forEach((node,i) => { if(node && headRest[i]) { node.x = headRest[i].x; node.y = headRest[i].y; } });
    } catch { /* Rive can already be disposed during owner cleanup. */ }
    gaze = 0; headY = 0;
    try { artboard?.advance(0); } catch { /* owner is replacing the artboard */ }
    instance._needsRedraw = true;
  };
  const update = (pose, timestamp = performance.now()) => { if (!disposed) { target = pose; receivedAt = timestamp; } };
  const afterAdvance = (timestamp = performance.now()) => {
    if (disposed || !target || instance.artboard !== artboard) return;
    const missing = timestamp - receivedAt > 450;
    const blend = 1 - Math.exp(-Math.min(80, Math.max(1, lastAt ? timestamp - lastAt : 16)) / (missing ? 140 : 65));
    lastAt = timestamp;
    gaze += ((missing ? 0 : target.gaze || 0) - gaze) * blend;
    headY += ((missing ? 0 : target.headY || 0) - headY) * blend;
    if(headNodes[0]) headNodes[0].x = headRest[0].x + gaze * 26;
    if(headNodes[1]) headNodes[1].y = headRest[1].y + headY * 22;
    for (const b of bindings) {
      const wanted = !missing && Number.isFinite(target.angles[b.key]) ? target.angles[b.key] : b.restWorld;
      b.smooth = b.smooth === null ? b.restWorld : b.smooth;
      b.smooth += wrapAngle(wanted - b.smooth) * blend;
      // Invert the parent transform so a tilted torso doesn't distort the arms.
      if (parent) {
        b.bone.parentWorldTransform(parent);
        const det = parent.xx * parent.yy - parent.xy * parent.yx;
        if (Math.abs(det) < 1e-6) continue;
        const dx = Math.cos(b.smooth), dy = Math.sin(b.smooth);
        b.bone.rotation = Math.atan2((parent.xx * dy - parent.xy * dx) / det, (parent.yy * dx - parent.yx * dy) / det);
      } else {
        const world = b.bone.worldTransform();
        b.bone.rotation += wrapAngle(b.smooth - Math.atan2(world.xy, world.xx));
      }
      artboard.advance(0);
    }
    instance._needsRedraw = true;
    instance.scheduleRendering?.();
  };
  const install = () => {
    if (wrapper || disposed || typeof instance.advanceAndReportChanges !== 'function') return false;
    original = instance.advanceAndReportChanges;
    wrapper = function (...args) { const result = original.apply(this, args); afterAdvance(); return result; };
    instance.advanceAndReportChanges = wrapper;
    return true;
  };
  const dispose = () => {
    if (disposed) return;
    reset();
    if (instance.advanceAndReportChanges === wrapper) instance.advanceAndReportChanges = original;
    try { parent?.delete(); } catch { /* owner cleanup */ } disposed = true;
  };
  return { update, afterAdvance, reset, install, dispose, capabilities: bindings.map(b => b.key) };
}
