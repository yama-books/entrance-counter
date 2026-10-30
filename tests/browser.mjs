import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html')));
    if (!path.startsWith(root + sep)) throw Error('path');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 1194, height: 834 }, acceptDownloads: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  await page.locator('#staff-top').click(); await page.locator('#staff-input').fill('テスト担当A'); await page.locator('#staff-form button').click();
  await page.waitForFunction(() => !document.querySelector('#staff-dialog').open);
  await page.locator('[data-kind="entry"]').evaluate(el => { for (let i = 0; i < 10; i++) el.click(); });
  await page.locator('[data-kind="akarenga"]').evaluate(el => { for (let i = 0; i < 3; i++) el.click(); });
  await page.waitForFunction(() => document.querySelector('#entry-total').textContent === '10' && document.querySelector('#akarenga-total').textContent === '3');
  console.log('PASS 10 rapid entries / 3 independent akarenga');
  await page.reload(); await page.waitForFunction(() => document.querySelector('#entry-total').textContent === '10');
  await page.locator('#staff-top').click(); await page.locator('#staff-input').fill('テスト担当B'); await page.locator('#staff-form button').click();
  await page.waitForFunction(() => !document.querySelector('#staff-dialog').open);
  await page.locator('[data-open="memo-dialog"]').click(); await page.locator('#memo-input').fill('架空メモ <script> test'); await page.locator('#memo-form button').click();
  await page.waitForFunction(() => document.querySelector('#memos').textContent.includes('架空メモ'));
  await page.locator('#memo-dialog [data-close]').click();
  assert.ok((await page.locator('#recent .memo-record').textContent()).includes('架空メモ <script> test'));
  assert.ok((await page.locator('#latest-handoff-text').textContent()).includes('架空メモ <script> test'));
  assert.equal(await page.locator('#latest-handoff-text script').count(), 0);
  await page.locator('[data-undo="entry"]').click(); await page.locator('#confirm-yes').click();
  await page.waitForFunction(() => document.querySelector('#entry-total').textContent === '9');
  const page2 = await context.newPage(); await page2.goto(url); await page2.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  await Promise.all([page.locator('[data-kind="entry"]').evaluate(el => { for (let i = 0; i < 5; i++) el.click(); }), page2.locator('[data-kind="entry"]').evaluate(el => { for (let i = 0; i < 5; i++) el.click(); })]);
  await page.waitForFunction(() => document.querySelector('#entry-total').textContent === '19');
  await page2.close(); await page.reload(); await page.waitForFunction(() => document.querySelector('#entry-total').textContent === '19');
  assert.equal(await page.locator('#staff-name').textContent(), 'テスト担当B');
  console.log('PASS reload, staff snapshot, safe memo, cancellation, concurrent tabs');
  assert.ok((await page.locator('#latest-handoff-text').textContent()).includes('架空メモ'));
  await page.locator('[data-open="history-dialog"]').click();
  assert.ok((await page.locator('#all-history .memo-record').textContent()).includes('架空メモ <script> test'));
  await page.locator('#history-dialog [data-close]').click();
  for (const minutes of [5, 15, 30, 60]) {
    await page.locator('#interval').selectOption(String(minutes));
    assert.equal(await page.locator('#chart .bar').count(), 1440 / minutes);
    await page.locator('[data-open="summary-dialog"]').click();
    assert.equal(await page.locator('#summary-table tr').count(), 1440 / minutes + 2);
    await page.locator('#summary-dialog [data-close]').click();
  }
  await page.locator('#interval').selectOption('5');
  console.log('PASS highlighted handoff body in recent/full history and pinned latest; all four aggregation intervals');
  await page.locator('[data-open="data-dialog"]').click();
  const downloaded = page.waitForEvent('download'); await page.locator('#export-json').click(); const download = await downloaded;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(backup.events.length, 27);
  assert.equal(backup.events.filter(e => e.kind === 'entry' && e.staff === 'テスト担当A').length, 10);
  await page.locator('#restore').setInputFiles({ name: 'test-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.locator('#confirm-yes').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('復元を保存'));
  assert.equal(await page.locator('#entry-total').textContent(), '19');
  await page.locator('#restore').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"wrong"}') });
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('復元失敗'));
  const csvDownload = page.waitForEvent('download'); await page.locator('#export-csv').click();
  assert.ok((await readFile(await (await csvDownload).path(), 'utf8')).includes('日時(JST)'));
  await page.locator('#data-dialog [data-close]').click();
  await page.locator('[data-open="memo-dialog"]').click(); assert.ok((await page.locator('#memos').textContent()).includes('架空メモ <script> test')); await page.locator('#memo-dialog [data-close]').click();
  console.log('PASS JSON/CSV download, idempotent restore, corrupt restore rejection, memo persistence');
  const fresh = await browser.newContext({ acceptDownloads: true });
  const restored = await fresh.newPage(); await restored.goto(url); await restored.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  await restored.locator('[data-open="data-dialog"]').click();
  await restored.locator('#restore').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await restored.locator('#confirm-yes').click(); await restored.waitForFunction(() => document.querySelector('#entry-total').textContent === '19');
  await fresh.close();
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { IDBObjectStore.prototype.put = put; throw new DOMException('Test quota failure', 'QuotaExceededError'); };
  });
  await page.locator('[data-kind="entry"]').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('保存失敗'));
  assert.equal(await page.locator('#entry-total').textContent(), '19');
  await page.locator('[data-open="memo-dialog"]').click(); await page.locator('#memo-input').fill('架空の再試行メモ');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { IDBObjectStore.prototype.put = put; throw new DOMException('Test failure', 'QuotaExceededError'); };
  });
  await page.locator('#memo-form button').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('保存失敗'));
  assert.equal(await page.locator('#memo-input').inputValue(), '架空の再試行メモ');
  await page.locator('#memo-form button').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('引継ぎを保存'));
  await page.locator('#memo-dialog [data-close]').click();
  console.log('PASS empty-browser restore; failed save preserves totals and memo input; retry succeeds');
  const storage = await page.evaluate(async () => {
    const { openStore, write, read } = await import('/src/storage.js');
    const db = await openStore(); const e = { id: 'idempotence-test', kind: 'entry', at: new Date().toISOString() };
    await write(db, e); await write(db, e);
    const before = await read(db);
    let rejected = false;
    try { await write(db, { id: 'bad-cancel', kind: 'cancel', at: e.at, target: 'missing' }); } catch { rejected = true; }
    const after = await read(db); db.close();
    let closed = false; try { await write(db, { ...e, id: 'closed' }); } catch { closed = true; }
    return { once: before.filter(x => x.id === e.id).length, rejected, unchanged: JSON.stringify(before) === JSON.stringify(after), closed };
  });
  assert.deepEqual(storage, { once: 1, rejected: true, unchanged: true, closed: true });
  console.log('PASS IndexedDB idempotence, invalid transaction rollback, closed DB rejection');
  // A contact must save before release; the following synthetic click must not add again.
  const touchContext = await browser.newContext({ hasTouch: true, viewport: { width: 1194, height: 834 } });
  const touch = await touchContext.newPage(); await touch.goto(url); await touch.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  await touch.evaluate(() => {
    window.numberMotions = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) { if (this.id === 'entry-total') window.numberMotions.push(frames); return animate.call(this, frames, options); };
  });
  const hit = await touch.locator('[data-kind="entry"]').boundingBox();
  await touch.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2); await touch.mouse.down();
  await touch.waitForFunction(() => document.querySelector('#entry-total').textContent === '1');
  assert.ok(await touch.evaluate(() => window.numberMotions.some(frames => frames[0].transform === 'translateY(.32em)' && frames[1].transform === 'translateY(0)')));
  await touch.mouse.up(); await touch.waitForTimeout(150);
  assert.equal(await touch.locator('#entry-total').textContent(), '1');
  await touch.locator('[data-kind="entry"]').focus(); await touch.keyboard.press('Enter');
  await touch.waitForFunction(() => document.querySelector('#entry-total').textContent === '2');
  await touch.keyboard.press('Space'); await touch.waitForFunction(() => document.querySelector('#entry-total').textContent === '3');
  await touch.locator('[data-kind="entry"]').tap(); await touch.waitForFunction(() => document.querySelector('#entry-total').textContent === '4');
  await touch.waitForTimeout(150); assert.equal(await touch.locator('#entry-total').textContent(), '4');
  await touch.emulateMedia({ reducedMotion: 'reduce' }); const motions = await touch.evaluate(() => window.numberMotions.length);
  await touch.locator('[data-kind="entry"]').tap(); await touch.waitForFunction(() => document.querySelector('#entry-total').textContent === '5');
  assert.equal(await touch.evaluate(() => window.numberMotions.length), motions);
  await touch.reload(); await touch.waitForFunction(() => document.querySelector('#entry-total').textContent === '5');
  await touchContext.close();
  console.log('PASS contact-time save, exactly once after release/touch/keyboard, upward number motion, reduced-motion suppression');
  const shiftImage = await readFile('assets/cutouts/ART-01_yaezakura.png');
  await page.locator('[data-open="shift-dialog"]').click();
  await page.locator('#shift-file').setInputFiles({ name: 'test-shift.png', mimeType: 'image/png', buffer: shiftImage });
  await page.waitForFunction(() => /^(test-shift.png|保存失敗)/.test(document.querySelector('#shift-status').textContent));
  assert.ok((await page.locator('#shift-status').textContent()).startsWith('test-shift.png'), await page.locator('#shift-status').textContent());
  await page.waitForFunction(() => document.querySelector('#shift-preview').naturalWidth > 0);
  await page.reload(); await page.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  await page.locator('[data-open="shift-dialog"]').click();
  await page.waitForFunction(() => document.querySelector('#shift-status').textContent.startsWith('test-shift.png'));
  const originalPreview = await page.locator('#shift-preview').getAttribute('src');
  await page.locator('#shift-file').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await page.waitForFunction(() => document.querySelector('#shift-status').textContent.startsWith('保存失敗'));
  assert.equal(await page.locator('#shift-preview').getAttribute('src'), originalPreview);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { IDBObjectStore.prototype.put = put; throw new DOMException('Test failure', 'QuotaExceededError'); };
  });
  await page.locator('#shift-file').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: shiftImage });
  await page.waitForFunction(() => document.querySelector('#shift-status').textContent.includes('Test failure'));
  assert.equal(await page.locator('#shift-preview').getAttribute('src'), originalPreview);
  await page.locator('#shift-file').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: shiftImage });
  await page.waitForFunction(() => document.querySelector('#shift-status').textContent.startsWith('replacement.png'));
  const saved = await page.evaluate(async () => {
    const { openStore, read, readShift } = await import('/src/storage.js'); const db = await openStore();
    const image = await readShift(db), events = await read(db); db.close(); return { name: image.name, count: events.length, bytes: image.blob.size };
  });
  assert.equal(saved.name, 'replacement.png'); assert.equal(saved.count, 29); assert.equal(saved.bytes, shiftImage.length);
  await page.locator('#shift-dialog [data-close]').click();
  console.log('PASS local shift image upload/reload/replacement, invalid image and failed save preserve image, event log unchanged');
  // Count button sinks on contact and rises after release.
  const countButton = page.locator('[data-kind="entry"]'), box = await countButton.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  assert.ok(await countButton.evaluate(el => el.classList.contains('pressed') && getComputedStyle(el).transform !== 'none'));
  await page.mouse.up(); await page.waitForFunction(() => !document.querySelector('[data-kind="entry"]').classList.contains('pressed'));
  // Staff call: settings validation, mocked Apps Script delivery, failure keeps the request text.
  const callUrl = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec', calls = [];
  let callReply = { ok: true };
  await page.route('https://script.google.com/**', async route => {
    calls.push({ method: route.request().method(), type: route.request().headers()['content-type'], body: JSON.parse(route.request().postData()) });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(callReply) });
  });
  await page.locator('#call-top').click();
  assert.equal(await page.locator('#call-dialog h2').textContent(), '要件を入力');
  assert.ok(await page.locator('#call-settings').evaluate(el => el.open));
  await page.locator('#call-input').fill('受付に来てください');
  await page.locator('#call-form button').click();
  await page.waitForFunction(() => document.querySelector('#call-status').textContent.includes('先に送信設定'));
  await page.locator('#call-url').fill('https://example.com/exec'); await page.locator('#call-key').fill('test-pass');
  await page.locator('#call-settings-form button').click();
  await page.waitForFunction(() => document.querySelector('#call-status').textContent.includes('形式で入力'));
  await page.locator('#call-url').fill(callUrl); await page.locator('#call-settings-form button').click();
  await page.waitForFunction(() => document.querySelector('#call-status').textContent.includes('保存しました'));
  await page.locator('#call-form button').click();
  await page.waitForFunction(() => document.querySelector('#call-status').textContent.startsWith('送信しました'));
  assert.equal(calls.length, 1); assert.equal(calls[0].method, 'POST'); assert.match(calls[0].type, /^text\/plain/);
  assert.equal(calls[0].body.key, 'test-pass'); assert.equal(calls[0].body.text, '受付に来てください'); assert.equal(calls[0].body.staff, 'テスト担当B');
  assert.equal(await page.locator('#call-input').inputValue(), '');
  callReply = { ok: false, error: '合言葉が違います' };
  await page.locator('#call-input').fill('二回目'); await page.locator('#call-form button').click();
  await page.waitForFunction(() => document.querySelector('#call-status').textContent.includes('合言葉が違います'));
  assert.equal(await page.locator('#call-input').inputValue(), '二回目');
  await page.locator('#call-dialog [data-close]').click(); await page.unroute('https://script.google.com/**');
  console.log('PASS count button sinks on contact; staff call settings, mocked delivery, failure keeps request');
  // Theme picker: five palettes, choice persists on the device.
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'ivory-brick');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(255, 249, 237)');
  assert.equal(await page.locator('[data-kind="akarenga"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(184, 94, 78)');
  assert.ok((await page.locator('.entry > img').evaluate(el => getComputedStyle(el).filter)).includes('grayscale(1)'));
  assert.ok((await page.locator('.cat').evaluate(el => getComputedStyle(el).filter)).includes('saturate(0.25)'));
  assert.ok((await page.locator('.akarenga > img').evaluate(el => getComputedStyle(el).filter)).includes('hue-rotate(16deg)'));
  await page.locator('[data-open="theme-dialog"]').click();
  assert.equal(await page.locator('.theme-option').count(), 5);
  const entryFace = () => page.locator('[data-kind="entry"]').evaluate(el => getComputedStyle(el).backgroundColor);
  const before = await entryFace();
  await page.locator('.theme-option[data-theme="nordic-lake"]').click();
  assert.equal(await page.locator('.theme-option[aria-pressed="true"]').getAttribute('data-theme'), 'nordic-lake');
  assert.equal(await page.locator('.entry > img').evaluate(el => getComputedStyle(el).filter), 'none');
  assert.notEqual(await entryFace(), before);
  await page.reload(); await page.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'nordic-lake');
  for (const value of ['unknown', 'raspberry-lemon']) {
    await page.evaluate(value => localStorage.setItem('entrance-counter-theme', value), value); await page.reload();
    await page.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'ivory-brick');
  }
  console.log('PASS approved ivory/brick palette, matching people/cat/brick artwork, five choices, persistence and legacy fallback');
  await page.locator('#interval').selectOption('5');
  for (const [width, height] of [[1194,834],[1024,768],[768,1024],[390,844]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width >= 1024) {
      assert.ok((await page.locator('[data-kind="entry"]').boundingBox()).y + (await page.locator('[data-kind="entry"]').boundingBox()).height < height);
      const menu = await page.locator('[data-open="shift-dialog"]').boundingBox(); assert.ok(menu.y + menu.height < height);
      const call = await page.locator('#call-top').boundingBox(); assert.ok(call.x + call.width <= width && call.y >= 0);
    }
  }
  await page.setViewportSize({ width:1194,height:834 });
  await page.screenshot({ path: process.env.SCREENSHOT_PATH || 'test-results/ipad-landscape.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.count').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.deepEqual(errors, []);
  console.log('PASS responsive layout, reduced motion, no page errors');
  const scheduleContext = await browser.newContext({ viewport: { width: 1194, height: 834 } });
  const schedulePage = await scheduleContext.newPage();
  await schedulePage.clock.setFixedTime(new Date('2026-10-31T11:10:00+09:00'));
  await schedulePage.goto(url); await schedulePage.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  await schedulePage.locator('#call-top').click();
  assert.equal(await schedulePage.locator('#call-schedule-day').textContent(), '10/31（土）');
  assert.deepEqual(await schedulePage.locator('#call-schedule-list .call-time').allTextContents(), ['11:00～11:30', '11:30～12:00', '13:55～15:15']);
  assert.ok((await schedulePage.locator('#call-schedule-list li.current').textContent()).includes('手話同好会公演（音楽室A）'));
  await schedulePage.screenshot({ path: 'test-results/call-schedule.png' });
  await schedulePage.clock.setFixedTime(new Date('2026-10-30T12:00:00+09:00'));
  await schedulePage.locator('#call-dialog [data-close]').click(); await schedulePage.locator('#call-top').click();
  assert.ok(await schedulePage.locator('#call-schedule').isHidden());
  await scheduleContext.close();
  console.log('PASS staff call schedule by JST date with current slot');
} finally { await browser.close(); server.close(); }
