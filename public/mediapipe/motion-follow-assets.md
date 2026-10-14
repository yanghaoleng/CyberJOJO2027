# 动作跟随资源

- `pose_landmarker_lite.task`：Google 官方 Pose Landmarker Lite float16 v1，来源 https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task 。
- `vision_bundle.js`：复制自项目锁定的 `@mediapipe/tasks-vision` 安装包，用于经典 Web Worker 中的 `importScripts`，与主页面使用同一版本。更新依赖后需同步此文件及 WASM。
- `motion-follow-worker.js`：项目的姿势识别工作线程，按需加载上述资源，仅返回关键点，不上传摄像头画面。
