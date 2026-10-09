# DOMI 暗色沉浸章节

- 直接复用 JMA a14dae2 的 words.css、voice-input-control.js/css、text-motion.css、Calligraph 源组件、word-music.js、字体与音乐资源；仅适配本地模块导入、ASR 传输与赛博叫叫十关内容。
- 画布铺满 100dvh。父页面仅悬浮退出按钮，去除占空间的标题栏。暗色星空、彩色地貌、小树、蘑菇、发光石头、风车；景物位于主角周围。
- 题干、听读、进度点、六条实际测量的音量条、持续收音与暂停、逐步识别字幕、单词菜单、继续/完成、背景音乐。成功可点击继续或等待五秒。
- 390×844 浏览器检查画布铺满、十关点词通关、记录保存、没有 JMA 域名请求；没有页面脚本错误。
- ASR 测试替身验证 interim/final、识别时音量条保持显示、暂停收音、自主 banana 与引导 apple 分组以及提前退出；测试替身不代表真实手机识别验收。
- 212 项单元测试通过；生产发布后另核对服务、页面和关键资源哈希。

运行浏览器检查需提供 playwright-core（可通过 PLAYWRIGHT_MODULE 指定模块路径）：
`node scripts/qa/domi-world.mjs` / `node scripts/qa/domi-voice.mjs`，先启动 4173 端口的构建预览。
