import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [], channels = [];
let answerHeartbeat = true, pingCount = 0;
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  const Native = window.AudioContext; window.qaAudioContexts = [];
  window.AudioContext = class extends Native { constructor(...args) { super(...args); window.qaAudioContexts.push(this); } };
});
await page.routeWebSocket('**/voice', channel => {
  channels.push(channel);
  channel.onMessage(data => {
    if (typeof data !== 'string') return;
    const message = JSON.parse(data);
    if (message.type === 'start') channel.send(JSON.stringify({ type: 'ready', transport: 'seeduplex' }));
    if (message.type === 'ping') { pingCount++; if (answerHeartbeat) channel.send(JSON.stringify({ type: 'pong', id: message.id })); }
  });
});
try {
  await page.goto(process.env.QA_URL || 'http://127.0.0.1:4173/words');
  await page.getByRole('button', { name: '开始和叫叫聊聊', exact: true }).click();
  await page.waitForSelector('.word-bubble-play', { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('.camera-stage').dataset.character === 'lvdou');
  await page.getByRole('button', { name: '结束单词泡泡' }).click();
  channels.at(-1).send(JSON.stringify({ type: 'speech_text', character: 'lvdou', text: 'Hello little explo', final: false }));
  await page.waitForFunction(() => document.querySelector('.character-caption-bubble')?.textContent === 'Hello little');
  channels.at(-1).send(JSON.stringify({ type: 'speech_text', character: 'lvdou', text: 'Hello little explorer, can you find a red apple?', final: true }));
  await page.waitForFunction(() => document.querySelector('.character-caption-bubble')?.textContent.includes('explorer'));
  for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport); await page.waitForTimeout(400);
    const caption = await page.locator('.character-caption-bubble').evaluate(element => ({
      lines: element.querySelectorAll('.character-caption-copy').length,
      left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
      words: [...element.querySelectorAll('.character-caption-word')].map(word => word.textContent.trim()),
      fits: [...element.querySelectorAll('.character-caption-copy')].every(line => line.scrollWidth <= line.clientWidth + 1),
    }));
    assert.ok(caption.lines <= 2); assert.ok(caption.left >= 0 && caption.right <= viewport.width); assert.equal(caption.fits, true);
    assert.ok(caption.words.every(word => 'Hello little explorer, can you find a red apple?'.split(' ').includes(word.replace('…',''))));
    await page.screenshot({ path: `/tmp/cyberjojo-caption-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(11000);
  assert.ok(pingCount > 0); assert.equal(await page.locator('.voice-health-hint').count(), 0, 'quiet connection stays healthy');
  channels.at(-1).close({ code: 1011, reason: 'fixture lost upstream' });
  await page.waitForFunction(() => document.querySelector('.camera-stage').dataset.voiceState === 'listening', { timeout: 10000 });
  assert.ok(channels.length >= 2); assert.equal(await page.locator('.word-bubble-play').count(), 0);
  assert.equal(await page.locator('.camera-stage').getAttribute('data-character'), 'lvdou');
  await page.evaluate(async () => { for (const context of qaAudioContexts) if (context.state === 'running') await context.suspend(); });
  await page.waitForTimeout(4500);
  assert.ok(await page.evaluate(() => qaAudioContexts.some(context => context.state === 'running')));
  answerHeartbeat = false;
  const count = channels.length;
  await page.waitForFunction(() => document.querySelector('.voice-health-hint')?.textContent.includes('重新连接'), { timeout: 26000 });
  answerHeartbeat = true;
  await page.waitForFunction(() => document.querySelector('.camera-stage').dataset.voiceState === 'listening', { timeout: 12000 });
  assert.ok(channels.length > count, 'OPEN but unresponsive connection is replaced');
  await page.getByRole('button', { name: '展开相机设置菜单' }).click();
  await page.getByRole('menuitem', { name: '语音连接记录' }).click();
  const report = page.getByRole('dialog', { name: '语音连接记录' });
  await report.waitFor(); assert.ok((await report.textContent()).includes('连接成功')); assert.ok((await report.textContent()).includes('语音连接慢了'));
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '下载记录' }).click();
  const download = await downloadPromise; assert.ok(download.suggestedFilename().endsWith('.json'));
  const { readFile } = await import('node:fs/promises'); const log = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.ok(log.events.some(event => event.code === 'connection_timeout')); assert.ok(log.events.every(event => !('text' in event) && !('audio' in event)));
  await page.screenshot({ path: '/tmp/cyberjojo-voice-record.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: whole-word captions at 320/390/844, streaming updates, quiet heartbeat, close/reconnect, suspended capture recovery, stalled OPEN socket, diagnostic download');
} catch (error) {
  await page.screenshot({ path: '/tmp/cyberjojo-stability-failure.png' });
  console.log(await page.locator('.character-caption-bubble').evaluateAll(elements => elements.map(element => ({ text: element.textContent, html: element.innerHTML, rect: element.getBoundingClientRect().toJSON() }))));
  console.log('page errors', errors);
  throw error;
} finally { await browser.close(); }
