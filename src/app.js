import { labels, dayOf, timeOf, active, currentStaff, summary, csv, validate } from './model.js';
import { openStore, read, write } from './storage.js';
const $ = selector => document.querySelector(selector);
let db, events = [], chartKind = 'entry', historyLimit = 100, queue = Promise.resolve(), pending = 0;
let selectedDay = dayOf(new Date()), today = selectedDay;
const status = (text, error = false) => { $('#status').textContent = text; $('#status').classList.toggle('error', error); };
const node = (tag, text, className) => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };
const stamp = at => `${dayOf(at)} ${timeOf(at)}`;
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('entrance-counter') : null;
function render() {
  today = dayOf(new Date());
  $('#date').textContent = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'full' }).format(new Date());
  $('#staff-name').textContent = currentStaff(events);
  const interval = Number($('#interval').value), data = summary(events, today, interval);
  for (const kind of ['entry', 'akarenga']) {
    $(`#${kind}-total`).textContent = data.totals[kind].toLocaleString('ja-JP');
    $(`[data-undo="${kind}"]`).disabled = !active(events).some(e => e.kind === kind && dayOf(e.at) === today);
  }
  const max = Math.max(1, ...data.bins.map(b => b[chartKind]));
  $('#chart-description').textContent = `最大 ${max} / ${interval}分`;
  $('#chart').replaceChildren(...data.bins.map(b => {
    const el = node('div', '', 'bar'); el.style.height = `${b[chartKind] / max * 100}%`; el.title = `${b.time} ${labels[chartKind]} ${b[chartKind]}`; return el;
  }));
  $('#chart').setAttribute('aria-label', `${today} ${labels[chartKind]}、${interval}分ごと。` + data.bins.filter(b => b[chartKind]).map(b => `${b.time} ${b[chartKind]}`).join('、'));
  renderHistory($('#recent'), events.filter(e => dayOf(e.at) === today).slice(-5).reverse(), false);
  if ($('#history-dialog').open) renderHistory($('#all-history'), events.slice(-historyLimit).reverse(), true);
  $('#more-history').hidden = events.length <= historyLimit;
  const details = (target, kind, text) => {
    const list = events.filter(e => e.kind === kind).slice().reverse();
    $(target).replaceChildren(...(list.length ? list.map(e => { const el = node('div', '', 'detail'); el.append(node('small', `${stamp(e.at)}　${e.staff}`), node('div', text(e))); return el; }) : [node('p', 'まだ記録がありません。', 'empty')]));
  };
  details('#memos', 'memo', e => e.text); details('#staff-history', 'staff', e => e.staff);
  renderSummary();
}
function table(target, headers, rows) {
  const el = document.createElement('table'), head = document.createElement('tr');
  headers.forEach(h => head.append(node('th', h))); el.append(head);
  rows.forEach(values => { const row = document.createElement('tr'); values.forEach(v => row.append(node('td', v))); el.append(row); });
  $(target).replaceChildren(el);
}
function renderSummary() {
  const data = summary(events, selectedDay, Number($('#interval').value));
  table('#summary-table', ['時刻', '入場', '赤煉瓦'], [...data.bins.map(b => [b.time, b.entry, b.akarenga]), ['合計', data.totals.entry, data.totals.akarenga]]);
  table('#staff-table', ['担当', '入場', '赤煉瓦'], data.staff.map(s => [s.name, s.entry, s.akarenga]));
}
function renderHistory(target, list, actions) {
  const cancelled = new Set(events.filter(e => e.kind === 'cancel').map(e => e.target));
  target.replaceChildren(...(list.length ? list.map(e => {
    const row = node('div', '', `record${actions ? ' with-action' : ''}${cancelled.has(e.id) ? ' cancelled' : ''}`);
    const clock = node('span', timeOf(e.at).slice(0, 5)); clock.title = stamp(e.at);
    row.append(clock, node('span', labels[e.kind], 'badge ' + e.kind), node('span', ['entry', 'akarenga'].includes(e.kind) ? '+1' : e.kind === 'cancel' ? '−1' : '—'), node('span', e.staff));
    if (actions && ['entry', 'akarenga'].includes(e.kind) && !cancelled.has(e.id)) { const button = node('button', '取消'); button.addEventListener('click', () => cancelEvent(e)); row.append(button); }
    return row;
  }) : [node('p', 'まだ記録がありません。', 'empty')]));
}
function enqueue(operation, message) {
  pending++; status(`保存中… ${pending}件`);
  const job = queue.then(async () => { events = await write(db, operation); render(); channel?.postMessage('updated'); return events; });
  queue = job.catch(() => {});
  job.then(() => { pending--; status(pending ? `保存中… ${pending}件` : message); }, error => { pending--; status(`保存失敗：${error.message}。入力を確認して再試行してください。`, true); });
  return job;
}
function record(kind, extra = {}) { return { id: crypto.randomUUID(), at: new Date().toISOString(), kind, ...extra }; }
function confirmAction(text) {
  return new Promise(resolve => {
    $('#confirm-text').textContent = text;
    const dialog = $('#confirm-dialog'); let result = false;
    $('#confirm-yes').onclick = () => { result = true; dialog.close(); };
    $('#confirm-no').onclick = () => dialog.close();
    dialog.addEventListener('close', () => resolve(result), { once: true }); dialog.showModal();
  });
}
async function cancelEvent(event) {
  if (await confirmAction(`${stamp(event.at)} の「${labels[event.kind]}」1件を取り消しますか？`)) enqueue(record('cancel', { target: event.id }), '取消を保存しました').catch(() => {});
}
document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  button.classList.remove('spark'); void button.offsetWidth; button.classList.add('spark');
  enqueue(record(button.dataset.kind), `${labels[button.dataset.kind]} +1 を保存しました`).catch(() => {});
}));
document.querySelectorAll('[data-undo]').forEach(button => button.addEventListener('click', () => {
  const event = active(events).findLast(e => e.kind === button.dataset.undo && dayOf(e.at) === today); if (event) cancelEvent(event);
}));
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => { const dialog = document.getElementById(button.dataset.open); dialog.showModal(); render(); }));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('[data-chart]').forEach(button => button.addEventListener('click', () => {
  chartKind = button.dataset.chart;
  document.querySelectorAll('[data-chart]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }); render();
}));
$('#interval').addEventListener('change', render);
$('#summary-day').value = selectedDay;
$('#summary-day').addEventListener('change', () => { if ($('#summary-day').value) selectedDay = $('#summary-day').value; renderSummary(); });
$('#more-history').addEventListener('click', () => { historyLimit += 100; render(); });
function saveForm(selector, kind, input, key, message) {
  $(selector).addEventListener('submit', async event => {
    event.preventDefault(); const text = $(input).value.trim(); if (!text) return;
    const button = event.target.querySelector('button'); button.disabled = true;
    try { await enqueue(record(kind, { [key]: text }), message); $(input).value = ''; if (kind === 'staff') $('#staff-dialog').close(); }
    catch { /* Keep input on failed save. */ } finally { button.disabled = false; }
  });
}
saveForm('#staff-form', 'staff', '#staff-input', 'name', '担当変更を保存しました');
saveForm('#memo-form', 'memo', '#memo-input', 'text', '引継ぎを保存しました');
function download(text, extension, suffix) {
  const blob = new Blob([text], { type: extension === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `entrance-counter-${today}-${suffix}.${extension}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function freshExport(fn) {
  try { await queue; events = await read(db); fn(); } catch (e) { status(`書出し失敗：${e.message}`, true); }
}
$('#export-json').addEventListener('click', () => freshExport(() => download(JSON.stringify({ app: 'entrance-counter', version: 1, events }, null, 2), 'json', 'backup')));
$('#export-csv').addEventListener('click', () => freshExport(() => download(csv([['ID', '日時(JST)', '種別', '増減', '担当', '取消対象ID', 'メモ'], ...events.map(e => [e.id, stamp(e.at), labels[e.kind], ['entry', 'akarenga'].includes(e.kind) ? 1 : e.kind === 'cancel' ? -1 : '', e.staff, e.target, e.text])]), 'csv', 'events')));
$('#export-summary').addEventListener('click', () => freshExport(() => download(csv([['日付(JST)', '時刻', '入場', '赤煉瓦'], ...summary(events, selectedDay, Number($('#interval').value)).bins.map(b => [selectedDay, b.time, b.entry, b.akarenga])]), 'csv', 'summary')));
$('#restore').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 30 * 1024 * 1024) throw Error('ファイルは30MBまでです');
    const backup = JSON.parse(await file.text());
    if (backup.app !== 'entrance-counter' || backup.version !== 1) throw Error('対応するバックアップではありません');
    validate(backup.events);
    if (await confirmAction(`${backup.events.length}件のバックアップを追加復元しますか？ 同一IDの記録は重複しません。`)) await enqueue({ type: 'restore', events: backup.events }, '復元を保存しました');
  } catch (e) { status(`復元失敗：${e.message}`, true); }
  event.target.value = '';
});
async function refresh() { if (!db || pending) return; try { events = await read(db); render(); } catch (e) { status(`読込失敗：${e.message}`, true); } }
if (channel) channel.onmessage = refresh;
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (dayOf(new Date()) !== today) { selectedDay = dayOf(new Date()); $('#summary-day').value = selectedDay; } render(); }, 30000);
try {
  db = await openStore(); events = await read(db); render();
  document.querySelectorAll('[data-kind]').forEach(button => button.disabled = false);
  status('端末内に保存します');
} catch (e) { status(`保存領域を開けません：${e.message}。再読込してください。`, true); }
