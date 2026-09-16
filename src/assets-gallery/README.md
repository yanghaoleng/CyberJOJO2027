# 资源陈列室

`AssetsGallery.jsx` 为 `/assets` 页面。资源地址始终使用 Vite 的 `BASE_URL`，支持根域名和子路径部署；页面样式单独加载，字体和 Rive WASM 均来自同源本地资源。

## 生成资源

- `node scripts/generate-food-models.mjs`：重新生成苹果、草莓奶油蛋糕、面条、果汁饮料、彩色糖果五个独立 GLB 和模型元信息。真实几何、PBR 材质，不依赖外部贴图；按材质合批并索引去重。模型以米为单位，尺寸参考真实食物，预览器自动居中缩放。
- `node scripts/generate-asset-manifest.mjs`：遍历 `public/`，生成 `public/asset-catalog.json`，并从应用中真正使用的 Phosphor JSX 导入生成 `used-icons.js`。该页面自己的工具图标不计入应用图标清单。
- 添加、替换或删除资源后，重新生成资源清单。生成器包含文件大小、SHA256、图片尺寸和模型实际三角面信息；不将资源目录里自己的总清单重复计算为资源。

## 喂食复用

```jsx
<FoodModel
  foodId="apple" // apple | cake | noodles | drink | candy
  className="gameplay-food-model"
  interactive={false}
  autoRotate={true}
  transparent
/>
```

容器必须给出高度。`interactive={false}` 不接收指针事件，外层可正常进行触摸拖拽，`autoRotate` 随 props 改变。资源页启用 `interactive`，支持鼠标拖动、触摸旋转、缩放、复位、旋转开关和键盘操作。

模型在进入可见范围后才加载，离开时释放 renderer、控制器、几何、材质、环境贴图及 WebGL context。异步导入和 GLB 请求在卸载后不会创建新 renderer，隐藏标签页暂停实际渲染；尊重系统减少动画设置。

Rive 必须点击载入才请求文件；只有可见卡片保留运行实例，切分类或离开页面会清理。动画选项读取原文件中的真实 `animationNames` / `stateMachineNames`，优先用 `TalkingEmotion_Normal` 预览，原文件变化通过 SHA256 参数避免复用旧 URL 缓存。

绿豆文件来自 https://rive.mikeywa.site/4KM，原名为 `ai叫叫学伴_源文件_绿豆_（黑).riv`。页面展示原始 Rive 画板构图，并提供原文件下载。

叫叫文件使用 2026-09-16 群内更新并在测试环境使用的主角色导出，6,751,167 字节，SHA-256 为 `ccfc2d8e7f36baf1c0b3bec3a1ed4595d3503e699598f67ab804f8fc053b16ff`。主相机的闭嘴采样和缺失回应适配见 `src/character-interaction.js`、`src/character-animations.js`；资源页直接下载原文件字节。心形气球、花园导出随附保存，当前背景反馈仍采用相机合成效果。

## 参考与验证

- Three.js [GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html)、[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)、[OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)。
- Rive [运行时参数和清理 API](https://rive.app/docs/runtimes/web/rive-parameters)。
- 原版资源页曾检查 1440px、390px、320px 布局，3D 可见性加载与分类卸载、搜索空状态和同源资源地址。旧版 ZHc 的历史检查见 `docs/rive-ZHc-validation-2026-09-11.md`；当前动画数量以文件运行时枚举为准。
