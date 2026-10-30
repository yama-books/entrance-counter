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
  await page.locator('[data-undo="entry"]').click(); await page.locator('#confirm-yes').click();
  await page.waitForFunction(() => document.querySelector('#entry-total').textContent === '9');
  const page2 = await context.newPage(); await page2.goto(url); await page2.waitForFunction(() => !document.querySelector('[data-kind]').disabled);
  await Promise.all([page.locator('[data-kind="entry"]').evaluate(el => { for (let i = 0; i < 5; i++) el.click(); }), page2.locator('[data-kind="entry"]').evaluate(el => { for (let i = 0; i < 5; i++) el.click(); })]);
  await page.waitForFunction(() => document.querySelector('#entry-total').textContent === '19');
  await page2.close(); await page.reload(); await page.waitForFunction(() => document.querySelector('#entry-total').textContent === '19');
  assert.equal(await page.locator('#staff-name').textContent(), 'テスト担当B');
  console.log('PASS reload, staff snapshot, safe memo, cancellation, concurrent tabs');
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
  for (const [width, height] of [[1194,834],[1024,768],[768,1024],[390,844]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width >= 1024) assert.ok((await page.locator('[data-kind="entry"]').boundingBox()).y + (await page.locator('[data-kind="entry"]').boundingBox()).height < height);
  }
  await page.setViewportSize({ width:1194,height:834 });
  await page.screenshot({ path: process.env.SCREENSHOT_PATH || 'test-results/ipad-landscape.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.count').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.deepEqual(errors, []);
  console.log('PASS responsive layout, reduced motion, no page errors');
} finally { await browser.close(); server.close(); }
