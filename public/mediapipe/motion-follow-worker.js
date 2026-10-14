let model;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts(data.bundle);
      const vision = await Vision.FilesetResolver.forVisionTasks(data.wasm);
      model = await Vision.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: data.model, delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5,
        outputSegmentationMasks: false,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
  } else if (data.type === 'frame') {
    try {
      const result = model.detectForVideo(data.image, data.timestamp);
      self.postMessage({ type: 'pose', landmarks: result.landmarks[0] || null, timestamp: data.timestamp });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
    finally { data.image.close(); }
  }
};
