import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const base = process.env.QA_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: "reduce" });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket('**/voice', ws => ws.onMessage(data => {
      if (typeof data !== 'string') return;
      const message = JSON.parse(data);
      if (message.type === 'start') ws.send(JSON.stringify({ type: 'ready', transport: 'seeduplex' }));
      if (message.type === 'ping') ws.send(JSON.stringify({ type: 'pong', id: message.id }));
    }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '开始和叫叫聊聊', exact: true }).click({ timeout: 120000 });
    await page.getByRole('button', { name: /打开作品列表/ }).click({ timeout: 120000 });
    assert.equal(await page.locator('.health-demo-card').count(), 0);
    await page.getByRole('button', { name: '模拟数据', exact: true }).click();
    const card = page.locator('.health-demo-card');
    await card.waitFor();
    await page.screenshot({ path: `/tmp/jojo-health-initial-${width}.png` });
    assert.ok(await page.locator('.media-timeline-day').first().locator('.health-demo-card').count());
    assert.equal(await card.locator('.health-demo-metrics>div').count(), 4);
    assert.match(await card.textContent(), /早餐记录尚未确认/);
    // A failed audio resource must not claim playback succeeded.
    await page.route('**/health-morning-reminder.mp3', route => route.abort());
    await card.getByRole('button', { name: '体验语音 + Push 提醒', exact: true }).click();
    await card.getByRole('status').filter({ hasText: '语音暂时无法播放' }).waitFor();
    await page.locator('.health-demo-push').waitFor();
    assert.match(await page.locator('.health-demo-push').textContent(), /未真实发送/);
    await page.getByRole('button', { name: '关闭健康提醒预览' }).click();
    await page.unroute('**/health-morning-reminder.mp3');
    // Reload the failed media element and replay the deployed, actual voice asset.
    await card.locator('audio').evaluate(audio => audio.load());
    await card.getByRole('button', { name: /重新体验语音/ }).click();
    await page.waitForFunction(() => {
      const audio = document.querySelector('.health-demo-card audio');
      return audio && !audio.paused && audio.currentTime > .15 && audio.duration > 1;
    });
    assert.match(await card.locator('.health-demo-channels').textContent(), /正在播放/);
    await page.screenshot({ path: `/tmp/jojo-health-push-${width}.png` });
    await card.getByRole('button', { name: '停止语音', exact: true }).click();
    await page.getByRole('button', { name: '关闭健康提醒预览' }).click();
    await card.screenshot({ path: `/tmp/jojo-health-card-${width}.png` });
    const bounds = await card.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('demo-health-morning-activity')), false);
    await page.getByRole('button', { name: '本地数据', exact: true }).click();
    assert.equal(await card.count(), 0); assert.equal(await page.locator('.health-demo-push').count(), 0);
    await page.route('**/*.mp4', route => route.abort());
    await page.goto(base + '/intro/index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#health-monitoring').scrollIntoViewIfNeeded();
    assert.match(await page.locator('#health-monitoring').textContent(), /智能手表/);
    assert.match(await page.locator('#health-monitoring').textContent(), /尚未上线/);
    assert.ok(await page.locator('#health-monitoring').evaluate(el => el.nextElementSibling.id === 'future-exploration'));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#health-monitoring').screenshot({ path: `/tmp/jojo-health-site-${width}.png` });
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS ${width}px: newest health demo, local isolation, audio failure/retry + actual playback, Push preview, official section and no overflow`);
  }
} finally { await browser.close(); }
