import { labels, dayOf, timeOf, active, currentStaff, summary, csv, validate } from './model.js';
import { openStore, read, write, readShift, writeShift } from './storage.js';
import { scheduleFor } from './schedule.js';
import { themes, themeKey, savedTheme, applyTheme } from './themes.js';
const $ = selector => document.querySelector(selector);
let db, events = [], chartKind = 'entry', historyLimit = 100, queue = Promise.resolve(), pending = 0;
let selectedDay = dayOf(new Date()), today = selectedDay;
let chartMinute = null, chartDay = today, chartBins = [];
let chartStart = 0, chartEnd = 1440;
const status = (text, error = false) => { $('#status').textContent = text; $('#status').classList.toggle('error', error); };
const node = (tag, text, className) => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };
const stamp = at => `${dayOf(at)} ${timeOf(at)}`;
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('entrance-counter') : null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let renderFrame = 0, shiftUrl = null;
const countMotions = new Set();
function scheduleRender(kind) {
  if (['entry', 'akarenga'].includes(kind)) countMotions.add(kind);
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0; render(); countMotions.clear();
  });
}
function updateNumber(kind, total) {
  const el = $(`#${kind}-total`), before = Number(el.dataset.total || 0);
  el.textContent = total.toLocaleString('ja-JP'); el.dataset.total = total;
  el.classList.toggle('compact', total >= 1000);
  el.classList.toggle('extra-compact', total >= 10000);
  if (total <= before || !countMotions.has(kind) || reducedMotion.matches) return;
  el.getAnimations().forEach(animation => animation.cancel());
  el.animate([{ transform: 'translateY(6px)', opacity: .6 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 160, easing: 'ease-out' });
}
function render() {
  today = dayOf(new Date());
  $('#date').textContent = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'full' }).format(new Date());
  $('#staff-name').textContent = currentStaff(events);
  const interval = Number($('#interval').value), data = summary(events, today, interval);
  for (const kind of ['entry', 'akarenga']) {
    updateNumber(kind, data.totals[kind]);
    $(`[data-undo="${kind}"]`).disabled = !active(events).some(e => e.kind === kind && dayOf(e.at) === today);
  }
  const daytime = $('#chart-range').value === 'daytime';
  chartStart = daytime ? 540 : 0; chartEnd = daytime ? 990 : 1440;
  const viewEvents = daytime ? events.filter(e => {
    if (!['entry', 'akarenga'].includes(e.kind)) return true;
    const [hour, minute] = timeOf(e.at).split(':').map(Number);
    return hour * 60 + minute >= chartStart && hour * 60 + minute < chartEnd;
  }) : events;
  chartBins = summary(viewEvents, today, interval).bins.map((bin, i) => ({ ...bin, start: i * interval, end: Math.min((i + 1) * interval, chartEnd) })).filter(bin => bin.start >= chartStart && bin.start < chartEnd);
  const max = Math.max(4, Math.ceil(Math.max(0, ...chartBins.map(b => b[chartKind])) * 1.2 / 4) * 4);
  $('#chart-description').textContent = `${interval === 60 ? '1時間' : `${interval}分`}ごとの${chartKind === 'entry' ? '人数' : '件数'}`;
  $('#chart-axis').replaceChildren(...[4, 3, 2, 1, 0].map(step => node('span', max * step / 4)));
  $('#chart').classList.toggle('fine-interval', interval <= 15);
  $('#chart').dataset.series = chartKind;
  $('#chart').style.gridTemplateColumns = chartBins.map(bin => `${bin.end - bin.start}fr`).join(' ');
  $('#chart').classList.toggle('show-values', interval >= 15);
  const labelWidth = Math.max(12, String(Math.max(...chartBins.map(b => b[chartKind]))).length * 6 + 2);
  $('.chart-surface').style.minWidth = interval >= 15 ? `${28 + (chartEnd - chartStart) / Math.min(...chartBins.map(b => b.end - b.start)) * labelWidth}px` : '0';
  $('#chart').style.touchAction = interval >= 15 ? 'auto' : 'pan-y';
  $('#chart').replaceChildren(...chartBins.map(b => {
    const el = node('div', '', 'bar'); el.style.height = `${b[chartKind] / max * 100}%`; el.title = `${b.time} ${labels[chartKind]} ${b[chartKind]}`;
    if (interval >= 15 && b[chartKind] > 0) el.append(node('span', b[chartKind], 'bar-value'));
    return el;
  }));
  $('.chart-labels').replaceChildren(...(daytime ? [[540, '9:00'], [660, '11:00'], [780, '13:00'], [900, '15:00'], [990, '16:30']] : [[0, '0時'], [360, '6時'], [720, '12時'], [1080, '18時'], [1440, '24時']]).map(([minute, text]) => {
    const tick = node('span', text); tick.style.left = `${(minute - chartStart) / (chartEnd - chartStart) * 100}%`; return tick;
  }));
  if (chartDay !== today) { chartMinute = null; chartDay = today; }
  if (chartMinute === null || chartMinute < chartStart || chartMinute >= chartEnd) {
    const latest = chartBins.findLast(b => b[chartKind] > 0);
    const clock = timeOf(new Date()).split(':').map(Number);
    chartMinute = latest ? latest.start : Math.max(chartStart, Math.min(chartEnd - 1, clock[0] * 60 + clock[1]));
  }
  $('#chart').setAttribute('aria-label', `${today} ${labels[chartKind]}、${interval}分ごとの時間帯を選択`);
  showChartSelection();
  renderHistory($('#recent'), events.filter(e => dayOf(e.at) === today).slice(-5).reverse(), false);
  if ($('#history-dialog').open) renderHistory($('#all-history'), events.slice(-historyLimit).reverse(), true);
  $('#more-history').hidden = events.length <= historyLimit;
  // Keep the latest handoff visible even after more count events arrive.
  const latestMemo = events.findLast(e => e.kind === 'memo');
  $('#latest-handoff').hidden = !latestMemo;
  if (latestMemo) {
    $('#latest-handoff-meta').textContent = `${stamp(latestMemo.at)}　${latestMemo.staff}`;
    $('#latest-handoff-text').textContent = latestMemo.text;
  }
  const details = (target, kind, text) => {
    const list = events.filter(e => e.kind === kind).slice().reverse();
    $(target).replaceChildren(...(list.length ? list.map(e => { const el = node('div', '', 'detail'); el.append(node('small', `${stamp(e.at)}　${e.staff}`), node('div', text(e))); return el; }) : [node('p', 'まだ記録がありません。', 'empty')]));
  };
  if ($('#memo-dialog').open) details('#memos', 'memo', e => e.text);
  if ($('#staff-dialog').open) details('#staff-history', 'staff', e => e.staff);
  if ($('#summary-dialog').open) renderSummary();
}
function showChartSelection() {
  if (!chartBins.length) return;
  const index = chartBins.findIndex(bin => chartMinute >= bin.start && chartMinute < bin.end);
  const bin = chartBins[index], end = bin.end;
  const endTime = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  const range = `${bin.time}〜${endTime}`, value = `${labels[chartKind]} ${bin[chartKind]}${chartKind === 'entry' ? '人' : '冊'}`;
  $('#chart-time').textContent = range;
  $('#chart-value').textContent = value;
  const chart = $('#chart');
  chart.querySelectorAll('.bar').forEach((bar, i) => bar.classList.toggle('selected', i === index));
  chart.style.setProperty('--selection', `${((bin.start + bin.end) / 2 - chartStart) / (chartEnd - chartStart) * 100}%`);
  chart.setAttribute('aria-valuemax', chartBins.length - 1);
  chart.setAttribute('aria-valuenow', index);
  chart.setAttribute('aria-valuetext', `${range} ${value}`);
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
    const row = node('div', '', `record${actions ? ' with-action' : ''}${cancelled.has(e.id) ? ' cancelled' : ''}${e.kind === 'memo' ? ' memo-record' : ''}`);
    const clock = node('span', timeOf(e.at).slice(0, 5)); clock.title = stamp(e.at);
    row.append(clock, node('span', labels[e.kind], 'badge ' + e.kind), node('span', ['entry', 'akarenga'].includes(e.kind) ? '+1' : e.kind === 'cancel' ? '−1' : '—'), node('span', e.staff));
    if (e.kind === 'memo') row.append(node('p', e.text, 'memo-content'));
    if (actions && ['entry', 'akarenga'].includes(e.kind) && !cancelled.has(e.id)) { const button = node('button', '取消'); button.addEventListener('click', () => cancelEvent(e)); row.append(button); }
    return row;
  }) : [node('p', 'まだ記録がありません。', 'empty')]));
}
function enqueue(operation, message) {
  pending++; status(`保存中… ${pending}件`);
  const job = queue.then(async () => { events = await write(db, operation); scheduleRender(operation.kind); channel?.postMessage('updated'); return events; });
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
document.querySelectorAll('[data-kind]').forEach(button => {
  const count = () => {
    if (button.disabled) return;
    enqueue(record(button.dataset.kind), `${labels[button.dataset.kind]} +1 を保存しました`).catch(() => {});
  };
  // Sink on contact and stay down briefly so even a quick tap is visible.
  let pressedAt = 0, releaseTimer = 0;
  const press = () => { clearTimeout(releaseTimer); pressedAt = performance.now(); button.classList.add('pressed'); };
  const release = () => { releaseTimer = setTimeout(() => button.classList.remove('pressed'), Math.max(0, 90 - (performance.now() - pressedAt))); };
  // Count on contact; ignore the matching compatibility click to avoid double recording.
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); press(); count();
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(type, release);
  button.addEventListener('click', event => { if (event.detail === 0 && !event.pointerType) { press(); release(); count(); } });
});
document.querySelectorAll('[data-undo]').forEach(button => button.addEventListener('click', () => {
  const event = active(events).findLast(e => e.kind === button.dataset.undo && dayOf(e.at) === today); if (event) cancelEvent(event);
}));
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
  const dialog = document.getElementById(button.dataset.open); dialog.showModal(); render();
  if (dialog.id === 'call-dialog') showCallSchedule();
  if (dialog.id === 'settings-dialog') showCallSettings();
  if (dialog.id === 'theme-dialog') showThemes();
  if (dialog.id === 'shift-dialog') showShift().catch(e => { $('#shift-status').textContent = `読込失敗：${e.message}`; });
}));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('[data-chart]').forEach(button => button.addEventListener('click', () => {
  chartKind = button.dataset.chart;
  document.querySelectorAll('[data-chart]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }); render();
}));
$('#interval').addEventListener('change', render);
$('#chart-range').addEventListener('change', () => { render(); $('.chart-scroll').scrollLeft = 0; });
const chart = $('#chart');
function selectChartAt(clientX, clientY) {
  if (!chartBins.length) return;
  const index = [...chart.querySelectorAll('.bar')].findIndex((bar, i) => {
    if (!chartBins[i][chartKind]) return false;
    const box = bar.getBoundingClientRect(), label = bar.querySelector('.bar-value');
    return clientX >= box.left && clientX <= box.right && clientY >= (label ? label.getBoundingClientRect().top : box.top) && clientY <= box.bottom;
  });
  if (index < 0) return;
  chartMinute = chartBins[index].start;
  showChartSelection();
}
let chartPointer = null;
chart.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary) return;
  chartPointer = event.pointerId; chart.setPointerCapture(event.pointerId);
  selectChartAt(event.clientX, event.clientY);
});
chart.addEventListener('pointermove', event => { if (event.pointerId === chartPointer) selectChartAt(event.clientX, event.clientY); });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) chart.addEventListener(type, () => { chartPointer = null; });
chart.addEventListener('keydown', event => {
  const index = Number(chart.getAttribute('aria-valuenow'));
  const next = { ArrowLeft: index - 1, ArrowDown: index - 1, ArrowRight: index + 1, ArrowUp: index + 1, Home: 0, End: chartBins.length - 1 }[event.key];
  if (next === undefined || !chartBins.length) return;
  event.preventDefault(); chartMinute = chartBins[Math.max(0, Math.min(chartBins.length - 1, next))].start; showChartSelection();
});
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
async function showShift() {
  const image = await readShift(db);
  if (shiftUrl) URL.revokeObjectURL(shiftUrl);
  shiftUrl = image ? URL.createObjectURL(image.blob) : null;
  $('#shift-preview').hidden = !image;
  $('#shift-open').hidden = !image;
  if (image) {
    $('#shift-preview').src = shiftUrl; $('#shift-open').href = shiftUrl;
    $('#shift-status').textContent = `${image.name}　保存：${stamp(image.at)}`;
  } else $('#shift-status').textContent = 'シフト表の画像を選んで保存してください。';
}
$('#shift-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  event.target.disabled = true;
  let candidateUrl;
  try {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) throw Error('PNG・JPEG・WebP・GIFの10MB以下の画像を選んでください');
    candidateUrl = URL.createObjectURL(file);
    const image = new Image(); image.src = candidateUrl; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40000000) throw Error('画像は4,000万画素以下にしてください');
    await writeShift(db, { blob: file, name: file.name, at: new Date().toISOString() });
    await showShift(); channel?.postMessage('shift-updated'); status('シフト表を端末内に保存しました');
  } catch (e) { $('#shift-status').textContent = `保存失敗：${e?.message || '不明なエラー'}。保存済みの画像は保持しています。`; }
  finally { if (candidateUrl) URL.revokeObjectURL(candidateUrl); event.target.disabled = false; event.target.value = ''; }
});
// Staff call: the device holds the Apps Script URL and passcode; the recipient lives only in the script.
const callSettingsKey = 'entrance-counter-call';
// Public deployment endpoint: the passcode is NEVER included in published files.
const callEndpointUrl = 'https://script.google.com/macros/s/AKfycbzJqPHStaj08vfVucJ0hl7a1Nlw7lDIIcq1i5DSj0uRDySu4pS2J1-FpUfqR-fNMnJ9/exec';
function callSettings() {
  // Older versions stored {url,key}; ignore any saved URL in favor of the approved endpoint.
  for (const storageKey of [callSettingsKey, 'book-flea-register-call']) {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (value && typeof value.key === 'string' && value.key.trim() && value.key.length <= 200) {
        return { url: callEndpointUrl, key: value.key };
      }
    } catch { /* Try the next local setting. */ }
  }
  return null;
}
applyTheme(savedTheme());
function showThemes() {
  const current = document.documentElement.dataset.theme;
  $('#theme-options').replaceChildren(...themes.map(theme => {
    const button = node('button', '', 'theme-option'); button.type = 'button'; button.dataset.theme = theme.id;
    button.setAttribute('aria-pressed', String(theme.id === current));
    const swatches = node('span', '', 'theme-swatches'); swatches.setAttribute('aria-hidden', 'true');
    theme.colors.forEach(color => { const chip = document.createElement('i'); chip.style.background = color; swatches.append(chip); });
    const label = node('span', [theme.no, theme.name].filter(Boolean).join(' ')); label.append(node('small', theme.note));
    button.append(swatches, label, node('span', '選択中', 'theme-check'));
    button.addEventListener('click', () => {
      applyTheme(theme.id);
      try { localStorage.setItem(themeKey, theme.id); } catch { /* Theme still applies for this visit. */ }
      showThemes();
    });
    return button;
  }));
}
function showCallSchedule() {
  const schedule = scheduleFor(new Date());
  $('#call-schedule').hidden = !schedule;
  if (!schedule) return;
  $('#call-schedule-day').textContent = schedule.label;
  $('#call-schedule-list').replaceChildren(...schedule.items.map(item => {
    const row = node('li', '', item.current ? 'current' : '');
    row.append(node('span', `${item.from}～${item.to}`, 'call-time'));
    const text = node('span', '', 'call-plan'); item.lines.forEach(line => text.append(node('span', line)));
    row.append(text);
    if (item.current) row.append(node('span', 'いま', 'call-now'));
    return row;
  }));
}
function showCallSettings() {
  const settings = callSettings();
  $('#call-key').value = '';
  $('#call-settings-status').textContent = settings ? '合言葉は設定済みです。変更する場合は新しい合言葉を入力してください。' : '合言葉がまだ設定されていません。';
}
$('#call-settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const key = $('#call-key').value;
  if (!key.trim() || key.length > 200) {
    $('#call-settings-status').textContent = '合言葉を1〜200文字で入力してください。'; return;
  }
  try { localStorage.setItem(callSettingsKey, JSON.stringify({ key })); }
  catch { $('#call-settings-status').textContent = '合言葉を保存できませんでした。'; return; }
  $('#call-key').value = '';
  $('#call-settings-status').textContent = 'この端末に合言葉を保存しました。';
});
$('#call-form').addEventListener('submit', async event => {
  event.preventDefault();
  const text = $('#call-input').value.trim(), staff = $('#call-staff').value.trim(), settings = callSettings(), button = event.target.querySelector('button');
  if (!text || !staff || staff.length > 80) { $('#call-status').textContent = '担当者名と要件を入力してください。'; return; }
  if (!settings) { $('#call-status').textContent = '合言葉が未設定です。画面下の「設定」→「メール通知」で保存してください。要件は残っています。'; return; }
  button.disabled = true; $('#call-status').textContent = '送信中…';
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 20000);
  try {
    // text/plain keeps this a simple request, which Apps Script accepts without a CORS preflight.
    const response = await fetch(settings.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: settings.key, text, staff, source:'library', at: new Date().toISOString() }), signal: abort.signal });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw Error(result.error || `応答 ${response.status}`);
    $('#call-input').value = ''; $('#call-staff').value = ''; $('#call-status').textContent = `送信しました（${timeOf(new Date().toISOString()).slice(0, 5)}）。`; status('山本へ連絡を送信しました');
  } catch (e) {
    $('#call-status').textContent = `送信失敗：${e.name === 'AbortError' ? '時間切れ' : e.message || '通信できませんでした'}。要件は残っています。`;
  } finally { clearTimeout(timer); button.disabled = false; }
});
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
if (channel) channel.onmessage = event => {
  if (event.data === 'shift-updated') { if ($('#shift-dialog').open) showShift().catch(e => { $('#shift-status').textContent = `読込失敗：${e.message}`; }); }
  else refresh();
};
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (dayOf(new Date()) !== today) { selectedDay = dayOf(new Date()); $('#summary-day').value = selectedDay; } render(); }, 30000);
try {
  db = await openStore(); events = await read(db); render();
  document.querySelectorAll('[data-kind]').forEach(button => button.disabled = false);
  status('端末内に保存します');
} catch (e) { status(`保存領域を開けません：${e.message}。再読込してください。`, true); }
