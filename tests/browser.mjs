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
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' })[extname(path)] || 'application/octet-stream');
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
  await page.locator('#chart-range').selectOption('all');
  for (const minutes of [5, 15, 30, 60]) {
    await page.locator('#interval').selectOption(String(minutes));
    assert.equal(await page.locator('#chart .bar').count(), 1440 / minutes);
    await page.locator('[data-open="summary-dialog"]').click();
    assert.equal(await page.locator('#summary-table tr').count(), 1440 / minutes + 2);
    await page.locator('#summary-dialog [data-close]').click();
  }
  await page.locator('#interval').selectOption('5');
  console.log('PASS highlighted handoff body in recent/full history and pinned latest; all four aggregation intervals');
  // Fixed readout: keyboard can inspect zero bins; pointer ignores empty regions.
  const chartBefore = await page.locator('#entry-total').textContent();
  await page.locator('#interval').selectOption('15');
  assert.ok((await page.locator('#chart-description').textContent()).includes('15分ごと'));
  await page.locator('#chart').focus();
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#chart-time').textContent(), '00:00〜00:15');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#chart-time').textContent(), '00:15〜00:30');
  await page.locator('#interval').selectOption('30');
  assert.equal(await page.locator('#chart-time').textContent(), '00:00〜00:30');
  await page.locator('#interval').selectOption('15');
  assert.equal(await page.locator('#chart-time').textContent(), '00:15〜00:30');
  await page.locator('[data-chart="akarenga"]').click();
  assert.ok((await page.locator('#chart-value').textContent()).startsWith('赤煉瓦 '));
  const plot = await page.locator('#chart').boundingBox();
  const beforeBlankDrag = await page.locator('#chart-time').textContent();
  await page.mouse.move(plot.x + 2, plot.y + 10); await page.mouse.down();
  await page.mouse.move(plot.x + plot.width - 2, plot.y + 10, { steps: 8 }); await page.mouse.up();
  assert.equal(await page.locator('#chart-time').textContent(), beforeBlankDrag);
  await page.locator('#chart').focus(); await page.keyboard.press('End');
  assert.equal(await page.locator('#chart-time').textContent(), '23:45〜24:00');
  assert.equal(await page.locator('.bar.selected').count(), 1);
  assert.ok((await page.locator('#chart').getAttribute('aria-valuetext')).includes('23:45〜24:00 赤煉瓦'));
  await page.locator('#chart').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#chart-time').textContent(), '23:45〜24:00');
  await page.locator('[data-chart="entry"]').click();
  assert.equal(await page.locator('#entry-total').textContent(), chartBefore);
  const bins = await page.locator('.bar').count();
  const highest = await page.locator('.bar').evaluateAll(bars => bars.reduce((best, bar, i) => parseFloat(bar.style.height) > parseFloat(bars[best].style.height) ? i : best, 0));
  await page.locator('#chart').focus(); await page.keyboard.press('Home');
  for (let i = 0; i < highest; i++) await page.keyboard.press('ArrowRight');
  const chosen = await page.locator('.bar.selected').getAttribute('title');
  assert.ok(chosen.includes((await page.locator('#chart-value').textContent()).replace(/人$/, '')));
  assert.equal(bins, 96);
  console.log('PASS chart fixed range/value readout, interval time preservation, category switch, drag/end bounds, keyboard and no counting side effects');
  const focusedContext = await browser.newContext({ viewport: { width: 1194, height: 834 } });
  const focused = await focusedContext.newPage(); await focused.clock.setFixedTime(new Date('2026-10-31T21:00:00+09:00')); await focused.goto(url);
  await focused.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  await focused.evaluate(async () => {
    const store = await import('/src/storage.js'), db = await store.openStore();
    const events = []; let id = 0;
    for (const [time, count, kind] of [['09:00',2,'entry'],['09:15',12,'entry'],['16:29',3,'entry'],['16:30',7,'entry'],['21:00',4,'entry'],['16:29',2,'akarenga'],['16:30',5,'akarenga']]) {
      for (let i = 0; i < count; i++) events.push({ id: `chart-fixture-${id++}`, at: `2026-10-31T${time}:00+09:00`, kind, staff: '架空担当' });
    }
    await store.write(db, { type: 'restore', events }); db.close();
  });
  await focused.reload(); await focused.waitForFunction(() => document.querySelector('#entry-total').textContent === '28');
  assert.equal(await focused.locator('#chart-range').inputValue(), 'daytime');
  await focused.locator('#interval').selectOption('15');
  assert.equal(await focused.locator('.bar').count(), 30);
  assert.deepEqual(await focused.locator('.bar-value').allTextContents(), ['2','12','3']);
  await focused.locator('.bar-value').nth(1).click();
  assert.equal(await focused.locator('#chart-time').textContent(), '09:15〜09:30');
  assert.equal(await focused.locator('#chart-value').textContent(), '入場 12人');
  const labelA = await focused.locator('.bar-value').nth(0).boundingBox(), labelB = await focused.locator('.bar-value').nth(1).boundingBox();
  assert.ok(labelA.x + labelA.width < labelB.x, 'adjacent values do not overlap');
  for (const interval of ['30', '60']) {
    await focused.locator('#interval').selectOption(interval); await focused.locator('#chart').focus(); await focused.keyboard.press('End');
    assert.equal(await focused.locator('#chart-time').textContent(), '16:00〜16:30');
    assert.equal(await focused.locator('#chart-value').textContent(), '入場 3人');
  }
  await focused.locator('[data-chart="akarenga"]').click();
  assert.equal(await focused.locator('#chart-value').textContent(), '赤煉瓦 2冊');
  await focused.locator('#chart-range').selectOption('all');
  assert.equal(await focused.locator('#chart-time').textContent(), '16:00〜17:00');
  assert.equal(await focused.locator('#chart-value').textContent(), '赤煉瓦 7冊');
  assert.equal(await focused.locator('#entry-total').textContent(), '28');
  assert.equal(await focused.locator('#akarenga-total').textContent(), '7');
  await focusedContext.close();
  console.log('PASS daytime 30 quarter-hour bars, direct nonzero labels without overlap, 16:30 cutoff including partial hour, full-day restoration and unchanged daily totals');
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
  const touch = await touchContext.newPage(); await touch.clock.setFixedTime(new Date('2026-10-31T21:00:00+09:00')); await touch.goto(url); await touch.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  await touch.evaluate(() => {
    window.numberMotions = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) { if (this.id === 'entry-total') window.numberMotions.push(frames); return animate.call(this, frames, options); };
  });
  const hit = await touch.locator('[data-kind="entry"]').boundingBox();
  await touch.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2); await touch.mouse.down();
  await touch.waitForFunction(() => document.querySelector('#entry-total').textContent === '1');
  assert.ok(await touch.evaluate(() => window.numberMotions.some(frames => frames[0].transform === 'translateY(6px)' && frames[1].transform === 'translateY(0)')));
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
  await touch.locator('#interval').selectOption('15');
  assert.equal(await touch.locator('.bar').count(), 30);
  assert.equal(await touch.locator('.bar-value').count(), 0, 'night records are outside daytime chart');
  const touchSelection = await touch.locator('#chart-time').textContent();
  await touch.locator('#chart').tap({ position: { x: 2, y: 10 } });
  assert.equal(await touch.locator('#chart-time').textContent(), touchSelection);
  assert.equal(await touch.locator('#entry-total').textContent(), '5');
  await touch.locator('#chart-range').selectOption('all');
  await touch.locator('.bar-value').tap();
  assert.equal(await touch.locator('#chart-time').textContent(), '21:00〜21:15');
  assert.equal(await touch.locator('#chart-value').textContent(), '入場 5人');
  assert.equal(await touch.locator('#chart').evaluate(el => getComputedStyle(el).touchAction), 'auto');
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
  assert.ok(await countButton.evaluate(el => el.classList.contains('pressed') && getComputedStyle(el).transform === 'matrix(1, 0, 0, 1, 0, 2)'));
  await page.mouse.up(); await page.waitForFunction(() => !document.querySelector('[data-kind="entry"]').classList.contains('pressed'));
  // Staff call: explicit staff name, settings-only passcode, and fixed GAS endpoint.
  const calls=[];let callReply={ok:true};
  await page.route('https://script.google.com/**',async route=>{
    calls.push({url:route.request().url(),method:route.request().method(),type:route.request().headers()['content-type'],body:JSON.parse(route.request().postData())});
    await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(callReply)});
  });
  await page.locator('#call-top').click();
  assert.equal(await page.locator('#call-staff').inputValue(), 'テスト担当B');
  assert.equal(await page.locator('#call-staff').getAttribute('readonly'), null);
  await page.locator('#call-staff').fill('');
  assert.equal(await page.locator('#call-dialog #call-key').count(),0);
  assert.equal(await page.locator('#call-url').count(),0);
  await page.locator('#call-input').fill('受付に来てください');
  await page.locator('#call-form button').click();
  assert.equal(calls.length,0); // required staff name blocks submit.
  await page.locator('#call-staff').fill('図書館担当');
  await page.locator('#call-form button').click();
  await page.waitForFunction(()=>document.querySelector('#call-status').textContent.includes('「設定」'));
  assert.equal(await page.locator('#call-input').inputValue(),'受付に来てください');
  await page.locator('#call-dialog [data-close]').click();
  await page.locator('[data-open="settings-dialog"]').click();
  await page.locator('#call-key').fill('test-pass');
  await page.locator('#call-settings-form button').click();
  await page.waitForFunction(()=>document.querySelector('#call-settings-status').textContent.includes('保存しました'));
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('entrance-counter-call'))),{key:'test-pass'});
  await page.locator('#settings-dialog [data-close]').click();
  await page.locator('#call-top').click();
  assert.equal(await page.locator('#call-staff').inputValue(), 'テスト担当B');
  await page.locator('#call-staff').fill('図書館担当');
  await page.locator('#call-form button').click();
  await page.waitForFunction(()=>document.querySelector('#call-status').textContent.startsWith('送信しました'));
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://script.google.com/macros/s/AKfycbzJqPHStaj08vfVucJ0hl7a1Nlw7lDIIcq1i5DSj0uRDySu4pS2J1-FpUfqR-fNMnJ9/exec');
  assert.equal(calls[0].method,'POST');assert.match(calls[0].type,/^text\/plain/);
  assert.equal(calls[0].body.key,'test-pass');
  assert.equal(calls[0].body.staff,'図書館担当');
  assert.equal(calls[0].body.text,'受付に来てください');
  assert.equal(calls[0].body.source,'library');
  assert.equal(await page.locator('#call-input').inputValue(),'');
  assert.equal(await page.locator('#call-staff').inputValue(),'');
  // Older local settings may carry a different URL; it must be ignored.
  await page.evaluate(()=>localStorage.setItem('entrance-counter-call',JSON.stringify({url:'https://script.google.com/macros/s/OLD_DEPLOYMENT/exec',key:'legacy-pass'})));
  callReply={ok:false,error:'合言葉が違います'};
  await page.locator('#call-staff').fill('受付二号');
  await page.locator('#call-input').fill('二回目');
  await page.locator('#call-form button').click();
  await page.waitForFunction(()=>document.querySelector('#call-status').textContent.includes('合言葉が違います'));
  assert.equal(calls[1].url,calls[0].url);
  assert.equal(calls[1].body.key,'legacy-pass');
  assert.equal(calls[1].body.staff,'受付二号');
  assert.equal(await page.locator('#call-staff').inputValue(),'受付二号');
  assert.equal(await page.locator('#call-input').inputValue(),'二回目');
  await page.locator('#call-dialog [data-close]').click();
  await page.unroute('https://script.google.com/**');
  console.log('PASS fixed GAS URL, explicit staff name, Settings-only password and failure retention');
  const forecastContext = await browser.newContext({ viewport: { width: 1194, height: 834 }, acceptDownloads: true });
  const fp = await forecastContext.newPage(); await fp.clock.setFixedTime(new Date('2026-10-31T10:00:00+09:00')); await fp.goto(url);
  await fp.waitForFunction(() => !document.querySelector('#forecast-top').disabled);
  await fp.locator('#forecast-top').click(); await fp.waitForFunction(() => !document.querySelector('#prediction-open').disabled);
  await fp.locator('#prediction-open').click(); assert.equal(await fp.locator('#prediction-staff').inputValue(), '');
  await fp.locator('#forecast-dialog [data-close]').click();
  await fp.locator('#staff-top').click(); await fp.locator('#staff-input').fill('架空予測A'); await fp.locator('#staff-form button').click();
  await fp.waitForFunction(() => !document.querySelector('#staff-dialog').open);
  for (let i = 0; i < 2; i++) await fp.locator('[data-kind="entry"]').click();
  await fp.waitForFunction(() => document.querySelector('#entry-total').textContent === '2');
  await fp.locator('#forecast-top').click(); await fp.waitForFunction(() => !document.querySelector('#prediction-open').disabled);
  assert.equal(await fp.locator('#forecast-estimate').textContent(), '15人');
  assert.equal(await fp.locator('#prediction-list tr').count(), 0);
  await fp.locator('#prediction-open').click(); assert.equal(await fp.locator('#prediction-staff').inputValue(), '架空予測A');
  await fp.locator('#prediction-count').fill('123'); await fp.locator('#prediction-submit').click();
  await fp.waitForFunction(() => document.querySelector('#prediction-status').textContent.includes('保存しました'));
  assert.ok((await fp.locator('#prediction-status').textContent()).includes('架空予測A'));
  await fp.locator('#forecast-dialog [data-close]').click();
  await fp.locator('#staff-top').click(); await fp.locator('#staff-input').fill('架空予測B'); await fp.locator('#staff-form button').click();
  await fp.waitForFunction(() => !document.querySelector('#staff-dialog').open);
  await fp.locator('#forecast-top').click(); await fp.waitForFunction(() => !document.querySelector('#prediction-open').disabled);
  assert.equal(await fp.locator('#prediction-list tr').count(), 0);
  await fp.locator('#prediction-open').click(); assert.equal(await fp.locator('#prediction-staff').inputValue(), '架空予測B');
  await fp.locator('#prediction-count').fill('234');
  await fp.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { IDBObjectStore.prototype.put = put; throw new DOMException('Test prediction failure', 'QuotaExceededError'); };
  });
  await fp.locator('#prediction-submit').click(); await fp.waitForFunction(() => document.querySelector('#prediction-status').textContent.includes('保存失敗'));
  assert.equal(await fp.locator('#prediction-count').inputValue(), '234');
  assert.equal(await fp.locator('#prediction-staff').inputValue(), '架空予測B');
  assert.equal(await fp.locator('#prediction-list tr').count(), 0);
  await fp.locator('#prediction-submit').click(); await fp.waitForFunction(() => document.querySelector('#prediction-status').textContent.includes('保存しました'));
  assert.ok((await fp.locator('#prediction-list').textContent()).includes('架空予測A'));
  assert.ok(!(await fp.locator('#prediction-list').textContent()).includes('架空予測B'));
  assert.ok((await fp.locator('#prediction-list').textContent()).includes('123人'));
  for (const [width, height] of [[1024,768],[768,1024],[390,844]]) {
    await fp.setViewportSize({ width, height }); assert.ok(await fp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await fp.locator('#forecast-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
  }
  await fp.locator('#forecast-dialog [data-close]').click(); await fp.reload();
  await fp.waitForFunction(() => !document.querySelector('#forecast-top').disabled);
  await fp.locator('#forecast-top').click(); await fp.waitForFunction(() => !document.querySelector('#prediction-open').disabled);
  assert.equal(await fp.locator('#prediction-list tr').count(), 0);
  await fp.locator('#forecast-dialog [data-close]').click();
  await fp.locator('[data-open="data-dialog"]').click();
  const forecastDownload = fp.waitForEvent('download'); await fp.locator('#export-json').click();
  const forecastBackup = JSON.parse(await readFile(await (await forecastDownload).path(), 'utf8'));
  assert.equal(forecastBackup.predictions.length, 2); assert.deepEqual(forecastBackup.predictions.map(p => p.staff), ['架空予測A','架空予測B']);
  const forecastCSV = fp.waitForEvent('download'); await fp.locator('#export-predictions').click();
  assert.ok((await readFile(await (await forecastCSV).path(), 'utf8')).includes('架空予測A'));
  await fp.locator('#data-dialog [data-close]').click();
  const predictionStorage = await fp.evaluate(async () => {
    const s = await import('/src/storage.js'), db = await s.openStore(), before = await s.readPredictions(db), eventsBefore = await s.read(db);
    await s.savePrediction(db, before[1]);
    let conflict = false, midnight = false;
    try { await s.write(db, { type: 'restore', events: [...eventsBefore, { id:'should-rollback', kind:'entry', at:new Date().toISOString(), staff:'架空担当' }], predictions: [{ ...before[0], count: 1 }] }); } catch { conflict = true; }
    try { await s.savePrediction(db, { ...before[0], id:'wrong-date', date:'2026-10-30', at:'2026-10-30T10:00:00+09:00' }); } catch { midnight = true; }
    await s.write(db, { type:'restore', events:eventsBefore });
    const result = { once:(await s.readPredictions(db)).length === 2, conflict, midnight, unchanged:JSON.stringify(eventsBefore) === JSON.stringify(await s.read(db)), retained:JSON.stringify(before) === JSON.stringify(await s.readPredictions(db)) }; db.close(); return result;
  });
  assert.deepEqual(predictionStorage, { once:true, conflict:true, midnight:true, unchanged:true, retained:true });
  const predictionFresh = await browser.newContext({ viewport: { width: 390, height: 844 } }), restoredForecast = await predictionFresh.newPage();
  await restoredForecast.clock.setFixedTime(new Date('2026-10-31T10:00:00+09:00')); await restoredForecast.goto(url);
  await restoredForecast.waitForFunction(() => !document.querySelector('#forecast-top').disabled);
  await restoredForecast.locator('[data-open="data-dialog"]').click();
  await restoredForecast.locator('#restore').setInputFiles({ name:'forecast-backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(forecastBackup)) });
  await restoredForecast.locator('#confirm-yes').click(); await restoredForecast.waitForFunction(() => document.querySelector('#status').textContent.includes('復元を保存'));
  assert.equal(await restoredForecast.evaluate(async () => { const s=await import('/src/storage.js'),db=await s.openStore();const n=(await s.readPredictions(db)).length;db.close();return n; }), 2);
  await predictionFresh.close(); await forecastContext.close();
  console.log('PASS visitor forecast pace, staff prefill, saved-only prior predictions, save failure/retry, reload privacy, JSON/CSV and fresh restore, atomic conflict rollback, idempotence, old backup retention, midnight rejection and responsive dialog');
  const closingContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, acceptDownloads: true });
  const cp = await closingContext.newPage(); await cp.clock.setFixedTime(new Date('2026-10-31T16:30:00+09:00')); await cp.goto(url + '/src/model.js');
  await cp.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('entrance-counter-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('state'); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction('state','readwrite'); tx.objectStore('state').put([
      {id:'old-staff',kind:'staff',at:'2026-10-31T09:00:00+09:00',staff:'移行テスト担当'},
      {id:'old-entry',kind:'entry',at:'2026-10-31T10:00:00+09:00',staff:'移行テスト担当'},
      {id:'old-brick',kind:'akarenga',at:'2026-10-31T10:00:00+09:00',staff:'移行テスト担当'}
    ],'events'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }));
  await cp.goto(url); await cp.waitForFunction(() => !document.querySelector('#forecast-top').disabled);
  assert.equal(await cp.locator('#entry-total').textContent(), '1');
  assert.ok(await cp.evaluate(() => new Promise(resolve => { const r=indexedDB.open('entrance-counter-v1',1);r.onerror=()=>resolve(r.error.name==='VersionError');r.onsuccess=()=>{r.result.close();resolve(false);}; })));
  const closeDayUI = async (date) => { await cp.locator(`[data-finalize="${date}"]`).click(); await cp.locator('#confirm-yes').click(); await cp.waitForFunction(() => !document.querySelector('#day-results-dialog [data-close]').disabled); };
  await cp.locator('[data-open="day-results-dialog"]').click();
  assert.equal(await cp.locator('[data-finalize="2026-11-01"]').isDisabled(), true);
  await cp.evaluate(() => { const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){IDBObjectStore.prototype.put=put;throw new DOMException('Test close failure','QuotaExceededError');}; });
  await closeDayUI('2026-10-31'); assert.ok((await cp.locator('#day-results-status').textContent()).includes('保存失敗'));
  assert.equal(await cp.locator('[data-kind="entry"]').isDisabled(), false);
  await closeDayUI('2026-10-31');
  assert.equal(await cp.locator('[data-kind="entry"]').isDisabled(), true);
  assert.equal(await cp.locator('[data-undo="entry"]').isDisabled(), true);
  const locked = await cp.evaluate(async () => {
    const s=await import('/src/storage.js'),db=await s.openStore(),before=await s.read(db);let add=false,cancel=false,restore=false;
    try{await s.write(db,{id:'blocked-add',kind:'entry',at:new Date().toISOString()});}catch{add=true;}
    try{await s.write(db,{id:'blocked-cancel',kind:'cancel',at:new Date().toISOString(),target:'old-entry'});}catch{cancel=true;}
    try{await s.write(db,{type:'restore',events:[...before,{id:'blocked-restore',kind:'entry',at:new Date().toISOString(),staff:'架空担当'}]});}catch{restore=true;}
    const unchanged=JSON.stringify(before)===JSON.stringify(await s.read(db));db.close();return {add,cancel,restore,unchanged};
  });
  assert.deepEqual(locked,{add:true,cancel:true,restore:true,unchanged:true});
  await closeDayUI('2026-10-31'); assert.equal(await cp.locator('[data-kind="entry"]').isDisabled(),false);
  await cp.locator('#day-results-dialog [data-close]').click(); await cp.locator('[data-kind="entry"]').click();
  await cp.waitForFunction(() => document.querySelector('#entry-total').textContent==='2');
  await cp.locator('[data-open="day-results-dialog"]').click(); await closeDayUI('2026-10-31'); await cp.locator('#day-results-dialog [data-close]').click();
  await cp.clock.setFixedTime(new Date('2026-11-01T10:00:00+09:00')); await cp.reload(); await cp.waitForFunction(() => !document.querySelector('#forecast-top').disabled);
  assert.equal(await cp.locator('#entry-total').textContent(),'0');
  assert.ok((await cp.locator('#entry-event-total').textContent()).includes('2人'));
  await cp.locator('#previous-day-button').click(); assert.ok((await cp.locator('#previous-day-summary').textContent()).includes('入場 2人'));
  assert.ok((await cp.locator('#previous-day-records').textContent()).includes('移行テスト担当')); await cp.locator('#previous-day-dialog [data-close]').click();
  for(let i=0;i<3;i++) await cp.locator('[data-kind="entry"]').click(); for(let i=0;i<2;i++) await cp.locator('[data-kind="akarenga"]').click();
  await cp.waitForFunction(() => document.querySelector('#entry-total').textContent==='3'&&document.querySelector('#akarenga-total').textContent==='2');
  assert.ok((await cp.locator('#entry-event-total').textContent()).includes('5人'));
  assert.ok((await cp.locator('#akarenga-event-total').textContent()).includes('3冊'));
  await cp.locator('#forecast-top').click(); await cp.waitForFunction(() => !document.querySelector('#prediction-open').disabled);
  assert.equal(await cp.locator('#forecast-estimate').textContent(),'23人'); assert.equal(await cp.locator('#forecast-combined').textContent(),'25人'); await cp.locator('#forecast-dialog [data-close]').click();
  await cp.locator('#interval').selectOption('30'); await cp.locator('[data-chart="combined"]').click();
  assert.equal(await cp.locator('.bar-group').count(),15); assert.equal(await cp.locator('#chart .bar').count(),30);
  await cp.locator('#chart').focus(); await cp.keyboard.press('Home'); await cp.keyboard.press('ArrowRight'); await cp.keyboard.press('ArrowRight');
  assert.equal(await cp.locator('#chart-value').textContent(),'入場 4人／赤煉瓦 3冊');
  const pairColors=await cp.locator('.bar-group').first().locator('.bar').evaluateAll(bars=>bars.map(b=>getComputedStyle(b).backgroundColor)); assert.notEqual(pairColors[0],pairColors[1]);
  for(const [width,height] of [[1194,834],[1024,768],[390,844]]){await cp.setViewportSize({width,height});assert.ok(await cp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await cp.setViewportSize({width:1024,height:768});
  await cp.screenshot({ path:'test-results/two-day-counter.png', fullPage:true });
  await cp.locator('[data-chart="entry"]').click();
  await cp.locator('[data-open="day-results-dialog"]').click(); await closeDayUI('2026-11-01');
  assert.ok((await cp.locator('#event-final-summary').textContent()).includes('入場 5人／赤煉瓦 3冊'));
  await closeDayUI('2026-11-01');
  const raced=await cp.evaluate(async()=>{
    const s=await import('/src/storage.js'),m=await import('/src/event-days.js'),db=await s.openStore(),before=await s.read(db);
    const r=await Promise.allSettled([s.write(db,{id:'race-entry',kind:'entry',at:new Date().toISOString()}),s.saveDayResult(db,{id:'stale-close',kind:'close',date:'2026-11-01',expectedIds:m.dayRecordIds(before,'2026-11-01')})]);db.close();return r.map(x=>x.status);
  }); assert.deepEqual(raced,['fulfilled','rejected']);
  await cp.reload(); await cp.waitForFunction(() => !document.querySelector('#forecast-top').disabled);
  assert.equal(await cp.locator('#entry-total').textContent(),'4'); assert.equal(await cp.locator('[data-kind="entry"]').isDisabled(),false);
  await cp.locator('[data-open="day-results-dialog"]').click(); await closeDayUI('2026-11-01');
  assert.ok((await cp.locator('#event-final-summary').textContent()).includes('入場 6人／赤煉瓦 3冊')); await cp.locator('#day-results-dialog [data-close]').click();
  await cp.locator('[data-open="data-dialog"]').click();const closedDownload=cp.waitForEvent('download');await cp.locator('#export-json').click();
  const closedBackup=JSON.parse(await readFile(await (await closedDownload).path(),'utf8'));assert.equal(closedBackup.dayResults.length,6);
  const restoredClosingContext=await browser.newContext(),rc=await restoredClosingContext.newPage();await rc.clock.setFixedTime(new Date('2026-11-01T11:00:00+09:00'));await rc.goto(url);await rc.waitForFunction(()=>!document.querySelector('#forecast-top').disabled);
  await rc.locator('[data-open="data-dialog"]').click();await rc.locator('#restore').setInputFiles({name:'closed-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(closedBackup))});await rc.locator('#confirm-yes').click();
  await rc.waitForFunction(()=>document.querySelector('#status').textContent.includes('復元を保存'));assert.equal(await rc.locator('[data-kind="entry"]').isDisabled(),true);
  assert.ok(await rc.evaluate(async()=>{const s=await import('/src/storage.js'),db=await s.openStore(),before=await s.readDayResults(db),events=await s.read(db);await s.write(db,{type:'restore',events});const same=JSON.stringify(before)===JSON.stringify(await s.readDayResults(db));db.close();return same;}));
  await restoredClosingContext.close();await closingContext.close();
  console.log('PASS v1 to v2 data retention/old-version rejection, close failure/retry, backend add/cancel/restore locks, unlock/reclose history, prior day display, second-day cumulative counters and forecast, paired-color 2-day chart, count-vs-close race, atomic snapshot backup and closed-state restore');
  // Theme picker: five palettes, choice persists on the device.
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'ivory-brick');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(250, 250, 246)');
  assert.equal(await page.locator('[data-kind="akarenga"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(183, 121, 112)');
  assert.ok((await page.locator('.entry > img').getAttribute('src')).includes('UI-03_visitors-minimal.png'));
  assert.equal(await page.locator('.entry > img').evaluate(el => getComputedStyle(el).filter), 'none');
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
  const digitFont = await page.evaluate(async () => {
    const faces = await document.fonts.load('700 120px "Reception Digits"', '0123456789,+');
    return faces.length === 1 && faces[0].status === 'loaded';
  });
  assert.ok(digitFont, 'Local pixel digit font must decode successfully');
  assert.ok((await page.locator('[data-open="staff-dialog"] img').getAttribute('src')).includes('UI-06_staff-minimal.png'));
  assert.ok((await page.locator('[data-open="memo-dialog"] img').getAttribute('src')).includes('UI-07_memo-minimal.png'));
  for (const selector of ['body', '.counter', '.counter.akarenga', '.count', '.bar']) {
    assert.equal(await page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundImage), 'none');
  }
  assert.equal(await page.locator('.counter').first().evaluate(el => getComputedStyle(el).borderTopWidth), '1px');
  assert.ok(await page.locator('.counter').first().evaluate(el => parseFloat(getComputedStyle(el).borderRadius) <= 2));
  await page.locator('[data-chart="akarenga"]').click();
  assert.equal(await page.locator('.bar:not(.selected)').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(183, 121, 112)');
  await page.locator('[data-chart="entry"]').click();
  assert.equal(await page.locator('.bar:not(.selected)').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(120, 150, 138)');
  assert.equal(await page.locator('#chart-axis span').count(), 5);
  assert.equal(await page.locator('#chart-axis span').last().textContent(), '0');
  assert.equal(await page.locator('.count-tick').count(), 0);
  console.log('PASS minimal UI: three new PNG pictograms, decoded pixel digits, thin square frames, flat surfaces, single-color chart/axis and 2px press');
  await page.locator('#interval').selectOption('5');
  for (const [width, height] of [[1440,900],[1194,834],[1024,768],[768,1024],[390,844]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const buttons = await page.locator('.count').evaluateAll(elements => elements.map(el => {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      return { width: rect.width, height: rect.height, y: rect.y, fontSize: style.fontSize };
    }));
    for (const dimension of ['width', 'height', 'y']) {
      assert.ok(Math.abs(buttons[0][dimension] - buttons[1][dimension]) < .05, `equal plus button ${dimension} at ${width}px`);
    }
    assert.equal(buttons[0].fontSize, buttons[1].fontSize, `equal plus font at ${width}px`);
    if (width >= 1024) {
      const panel = await page.locator('.chart-panel').boundingBox(), ticks = await page.locator('.chart-labels').boundingBox();
      assert.ok(ticks.y + ticks.height <= panel.y + panel.height, 'chart labels stay inside panel');
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
  console.log('PASS equal plus button width/height/position/font at 1440/1194/1024/768/390px; responsive layout, reduced motion, no page errors');
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
