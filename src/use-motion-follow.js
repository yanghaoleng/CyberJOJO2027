import { useEffect, useRef, useState } from 'react';
import { createMotionRig, mapMotionPose } from './motion-follow.js';

export function useMotionFollow({ enabled, videoRef, riveRef, mirrored }) {
  const [status, setStatus] = useState('loading');
  const landmarksRef = useRef(null);
  const capabilitiesRef = useRef([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true, ready = false, busy = false, frame = 0, lastSample = 0, lastVideo = -1, lastSeen = 0, currentStatus = 'loading';
    const set = value => { if (alive && value !== currentStatus) { currentStatus = value; setStatus(value); } };
    setStatus('loading');
    const rig = createMotionRig(riveRef.current);
    capabilitiesRef.current = rig.capabilities; rig.install();
    // MediaPipe's pinned runtime loads its WASM factory with importScripts.
    const worker = new Worker(`${import.meta.env.BASE_URL}mediapipe/motion-follow-worker.js`);
    const deadline = window.setTimeout(() => { if (!ready) { worker.terminate(); set('error'); } }, 20_000);
    worker.onmessage = ({ data }) => {
      if (!alive) return;
      if (data.type === 'ready') { ready = true; clearTimeout(deadline); set('waiting'); }
      else if (data.type === 'pose') {
        busy = false;
        const video = videoRef.current;
        const pose = mapMotionPose(data.landmarks, { mirrored, aspect: video.videoWidth / video.videoHeight });
        landmarksRef.current = pose?.landmarks || null;
        if (pose) { rig.update(pose, performance.now()); lastSeen = performance.now(); set('tracking'); }
        else if (performance.now() - lastSeen > 450) set('waiting');
      } else if (data.type === 'error') { console.warn('Motion following unavailable', data.message); busy = false; ready = false; worker.terminate(); set('error'); }
    };
    worker.onerror = error => { console.warn('Motion worker failed', error.message); ready = false; set('error'); };
    worker.postMessage({ type: 'init', wasm: new URL(`${import.meta.env.BASE_URL}mediapipe/wasm`, location.origin).href,
      bundle: new URL(`${import.meta.env.BASE_URL}mediapipe/vision_bundle.js`, location.origin).href,
      model: new URL(`${import.meta.env.BASE_URL}mediapipe/pose_landmarker_lite.task`, location.origin).href });
    const sample = async (timestamp) => {
      frame = requestAnimationFrame(sample);
      // Idle animation is paused during following; drive redraws even when
      // Rive has no playing timeline to wake its own render loop.
      rig.afterAdvance(timestamp);
      if (busy && timestamp - lastSample > 4000) { ready = false; busy = false; landmarksRef.current = null; worker.terminate(); set('error'); }
      const video = videoRef.current;
      if (!ready || busy || document.hidden || !video || video.readyState < 2 || !video.videoWidth || video.currentTime === lastVideo || timestamp - lastSample < 66) return;
      busy = true; lastSample = timestamp; lastVideo = video.currentTime;
      let image;
      try {
        const scale = Math.min(1, 512 / Math.max(video.videoWidth, video.videoHeight));
        image = await createImageBitmap(video, { resizeWidth: Math.round(video.videoWidth * scale), resizeHeight: Math.round(video.videoHeight * scale) });
        if (!alive) { image.close(); return; }
        worker.postMessage({ type: 'frame', image, timestamp }, [image]);
      } catch { image?.close(); busy = false; }
    };
    frame = requestAnimationFrame(sample);
    return () => { alive = false; cancelAnimationFrame(frame); clearTimeout(deadline); worker.terminate(); rig.dispose(); landmarksRef.current = null; capabilitiesRef.current = []; };
  }, [enabled, videoRef, riveRef, mirrored]);
  return { status, landmarksRef, capabilitiesRef };
}
