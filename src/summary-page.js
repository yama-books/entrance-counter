import { openStore, readBackup } from './storage.js';
import { eventSummary } from './event-days.js';
import { savedTheme, applyTheme } from './themes.js';
const $ = selector => document.querySelector(selector);
applyTheme(savedTheme());
let db, generation = 0;
const number = value => value.toLocaleString('ja-JP');
function node(tag, text) { const el = document.createElement(tag); el.textContent = text; return el; }
function fitLabels() {
  document.querySelectorAll('.bin-value').forEach(label => { label.hidden = label.textContent.length * 7 + 2 > label.parentElement.getBoundingClientRect().width; });
}
function draw(kind, bins) {
  const max = Math.max(4, Math.ceil(Math.max(...bins.map(bin => bin[kind])) * 1.35 / 4) * 4);
  $(`#${kind}-axis`).replaceChildren(...[4,3,2,1,0].map(step => node('span', number(max * step / 4))));
  const chart = $(`#${kind}-bars`);
  chart.replaceChildren(...bins.map(bin => {
    const bar = node('div', ''); bar.className = 'bar'; bar.style.height = `${bin[kind] / max * 100}%`; bar.title = `${bin.time} ${number(bin[kind])}${kind === 'entry' ? '人' : '冊'}`;
    if (bin[kind]) { const label = node('span', number(bin[kind])); label.className = 'bin-value'; bar.append(label); }
    return bar;
  }));
  chart.setAttribute('aria-label', `${kind === 'entry' ? '入場者数' : '赤煉瓦'}、2日間合算・30分ごと。` + bins.map(bin => `${bin.time} ${bin[kind]}`).join('、'));
}
async function refresh() {
  if (!db) return;
  const current = ++generation;
  try {
    const backup = await readBackup(db); if (current !== generation) return;
    const report = eventSummary(backup.events, backup.dayResults);
    $('#report-status').textContent = !report.recorded ? 'このブラウザに記録がありません。記録した端末から開いてください。' : report.complete ? '全日程終了・両日確定済み' : '途中集計（未確定の日があります）';
    for (const kind of ['entry','akarenga']) { $(`#report-${kind}-value`).textContent = report.recorded ? number(report.totals[kind]) : '—'; draw(kind, report.bins); }
    $('#report-days').replaceChildren(...report.days.map((day, index) => {
      const row = document.createElement('tr');
      for (const value of [`${index + 1}日目　${day.date.slice(5).replace('-','/')}`, report.recorded ? `${number(day.totals.entry)}人` : '—', report.recorded ? `${number(day.totals.akarenga)}冊` : '—', day.closed ? '確定済み' : '未確定']) row.append(node('td', value));
      return row;
    }));
    $('#report-outside').textContent = `グラフは9:00〜16:30。時間外の記録：入場 ${number(report.outside.entry)}人／赤煉瓦 ${number(report.outside.akarenga)}冊。`;
    $('#report-updated').textContent = `表示：${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'short',timeStyle:'short'}).format(new Date())}`;
    $('#print-summary').disabled = false; document.documentElement.dataset.ready = 'true'; fitLabels();
  } catch (e) { $('#report-status').textContent = `読込失敗：${e.message}。受付画面から開き直してください。`; $('#print-summary').disabled = true; }
}
$('#print-summary').addEventListener('click', () => window.print());
window.addEventListener('resize', fitLabels);
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('entrance-counter') : null;
if (channel) channel.onmessage = refresh;
try { db = await openStore(); await refresh(); } catch (e) { $('#report-status').textContent = `保存領域を開けません：${e.message}`; }
