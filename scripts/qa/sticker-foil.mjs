import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const base = process.env.QA_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const errors = [];
async function openCollection({ width = 390, permission, reducedMotion = 'no-preference' } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600, reducedMotion });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(value => {
    window.sensorRequests = 0;
    Object.defineProperty(window.DeviceOrientationEvent, 'requestPermission', { configurable: true, value: value ? async () => { window.sensorRequests++; return value; } : undefined });
  }, permission || null);
  await page.routeWebSocket('**/voice', ws => ws.onMessage(data => {
    if (typeof data !== 'string') return;
    const message = JSON.parse(data);
    if (message.type === 'start') ws.send(JSON.stringify({ type: 'ready', transport: 'seeduplex' }));
    if (message.type === 'ping') ws.send(JSON.stringify({ type: 'pong', id: message.id }));
  }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '开始和叫叫聊聊', exact: true }).click({ timeout: 120000 });
  await page.getByRole('button', { name: /打开作品列表/ }).click({ timeout: 120000 });
  await page.getByRole('button', { name: '模拟数据', exact: true }).click();
  await page.getByRole('button', { name: '收集', exact: true }).click();
  await page.locator('.friend-open-card').first().click();
  await page.locator('.sticker-optic-surface img').evaluate(img => img.decode());
  return page;
}
const sample = page => page.locator('.sticker-optic-surface').evaluate(el => ({ transform: getComputedStyle(el).transform, rainbow: getComputedStyle(el.querySelector('.sticker-optic-rainbow')).opacity, corners: [...el.querySelectorAll('.sticker-optic-corner')].map(corner => Number(getComputedStyle(corner).opacity)) }));
const orient = (page, beta, gamma) => page.evaluate(({ beta, gamma }) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta, gamma })), { beta, gamma });
try {
  const page = await openCollection();
  const trigger = page.locator('.sticker-optic-trigger');
  const box = await trigger.boundingBox();
  for (const [index, [x, y]] of [[18,18],[box.width-18,18],[18,box.height-18],[box.width-18,box.height-18]].entries()) {
    await trigger.tap({ position: { x, y } });
    await page.waitForTimeout(220);
    const value = await sample(page);
    assert.notEqual(value.transform, 'none');
    assert.ok(Number(value.rainbow) > .3);
    assert.equal(value.corners.indexOf(Math.max(...value.corners)), index);
  }
  await page.screenshot({ path: '/tmp/jojo-sticker-foil-mobile.png' });
  await page.waitForTimeout(1700);
  assert.ok(Number((await sample(page)).rainbow) < .02, 'click glow returns to rest');
  await orient(page, 65, 0); await orient(page, 45, 20); await page.waitForTimeout(250);
  assert.ok(Number((await sample(page)).rainbow) > .2, 'sensor drives the real detail');
  await page.getByRole('button', { name: '关闭收集', exact: true }).click();
  assert.equal(await page.locator('.sticker-optic').count(), 0);
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator('.media-library-card.is-friend').first().click();
  await page.locator('.sticker-optic').waitFor();
  await page.close();
  console.log('PASS mobile four corner taps, directional glints, spring return, orientation, both album entry points');

  for (const permission of ['granted', 'denied']) {
    const page = await openCollection({ permission });
    assert.equal(await page.evaluate(() => window.sensorRequests), 0);
    await page.getByRole('button', { name: '开启重力感应' }).click();
    assert.equal(await page.evaluate(() => window.sensorRequests), 1);
    if (permission === 'granted') {
      assert.equal(await page.getByRole('button', { name: '开启重力感应' }).count(), 0);
      await orient(page, 60, 0); await orient(page, 80, -20); await page.waitForTimeout(250);
      assert.ok(Number((await sample(page)).rainbow) > .2);
    } else {
      await page.getByRole('status').filter({ hasText: '还可以轻点或滑动贴纸查看反光' }).waitFor();
      await page.locator('.sticker-optic-trigger').tap({ position: { x: 20, y: 20 } }); await page.waitForTimeout(220);
      assert.ok(Number((await sample(page)).rainbow) > .3);
    }
    await page.close();
  }
  console.log('PASS gesture-only permission request, granted sensor, denied touch fallback');

  const desktop = await openCollection({ width: 1280 });
  const target = desktop.locator('.sticker-optic-trigger');
  const rect = await target.boundingBox();
  await desktop.mouse.move(rect.x + rect.width - 20, rect.y + 20);
  await desktop.waitForTimeout(220);
  assert.ok(Number((await sample(desktop)).rainbow) > .2);
  await desktop.screenshot({ path: '/tmp/jojo-sticker-foil-desktop.png' });
  await desktop.close();
  const reduced = await openCollection({ reducedMotion: 'reduce' });
  await reduced.locator('.sticker-optic-trigger').tap(); await reduced.waitForTimeout(220);
  assert.equal((await sample(reduced)).transform, 'none');
  assert.ok(Number((await sample(reduced)).rainbow) > .3);
  await reduced.close();
  assert.deepEqual(errors, []);
  console.log('PASS desktop pointer and reduced-motion static light feedback; no page errors');
} finally { await browser.close(); }
