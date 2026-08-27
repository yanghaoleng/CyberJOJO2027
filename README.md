# JOJO-Cam

一个让孩子和叫叫一起拍照、录像、做表情的浏览器相机 Demo。

在线体验：[https://mikeywa.site/jocam/](https://mikeywa.site/jocam/)

## 当前功能

- Rive 叫叫动画与摄像头画面实时合成
- MediaPipe 本地人像分割，可切换「人在前 / 鸡在前」
- 点击快门拍照、长按录像，并保留按下瞬间的 Rive 表情
- 手机横竖屏自适应，桌面端提供扫码入口
- 两种阅读天数字幕，可生成 1–520 的随机天数
- Fish Audio 预生成的普通话男童引导语；运行时不会把任何第三方 API Key 发送给浏览器
- 所有相机帧都在当前设备内合成，不上传原始画面

## 本地开发

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

默认开发地址为 `http://localhost:5173/`。

## 构建

```bash
npm run build
```

产物输出到 `dist/`。如果静态资源需要部署到独立域名，可以设置：

```bash
JOCAM_ASSET_BASE=https://example.com/jocam/ npm run build
```

## 隐私与密钥

- 不要把 Fish Audio、火山引擎或其他服务的 API Key 提交到仓库。
- 本地密钥文件使用 `.env.*` 命名，已由 `.gitignore` 排除。
- 需要第三方模型时，应由服务端代理调用，浏览器只连接自己的后端。

## 许可证

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE.md)。允许个人学习、研究、修改和非商业分发；任何商业使用均需另行取得书面授权。

这是一份带有「不可商用」限制的源码可用许可证，因此不属于 OSI 定义的开源许可证。

Required Notice: Copyright © 2026 yanghaoleng.
