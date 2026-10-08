# 绿豆链接卡片与玩法报告验证

- 正式入口：`https://cyberjojo.mikeywa.site/` → 明确说“我想要开口造世界”或“跟读练习” → 绿豆卡片 → 页面内 `https://jma.mikeywa.site/words`。
- 208 项 Node 测试通过，含触发优先级、否定表达、跨来源/错窗口/错会话拒绝、有界报告检查；JMA 的两项账本测试及共享游戏运行时检查通过。
- 浏览器集成检查使用真实 React 页面、JMA 3D 页面与语音消息处理，模拟相机与识别服务。已验证两条触发语、自动切绿豆、嵌入、退出、部分记录、六轮完成、返回、刷新持久化、相册查看与逐条删除；没有页面脚本错误。
- 验证父页面音轨进入时 disabled、返回时 enabled。站点策略仅向 JMA 委派麦克风，并仅允许赛博叫叫嵌入 `/words`。
- 手机尺寸及移动浏览器身份模拟已检查相册排版。自动化不等于真实手机、微信或实际 ASR 的验收；成绩是目标词识别完成记录，不是发音评分。
- 可复测：先 `npm run build`，用 `PLAYWRIGHT_MODULE` 指向可用 playwright-core 模块，`JMA_QA_ROOT` 指向配套源码目录，运行 `node scripts/verify-word-activity.mjs`。`QA_DEVICE=desktop` 验证桌面布局。测试通过本地构建覆盖两个正式域名的 HTTP 内容，语音服务用明确 fixtures，不写入真实服务。
- 报告最多保留本机最近 200 次，可删除；照片的 30 项策略不影响报告，无账号/跨设备同步。
