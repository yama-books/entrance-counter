export const kinds = ['entry', 'akarenga', 'staff', 'memo', 'cancel'];
export const labels = { entry: '入場', akarenga: '赤煉瓦', staff: '担当変更', memo: '引継ぎ', cancel: '取消' };
const dayFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export const dayOf = at => dayFormatter.format(new Date(at));
export const timeOf = at => timeFormatter.format(new Date(at));
export function validate(events) {
  if (!Array.isArray(events) || events.length > 200000) throw Error('記録形式または件数が不正です');
  const seen = new Map(), cancelled = new Set();
  for (const e of events) {
    if (!e || typeof e.id !== 'string' || !e.id || e.id.length > 100 || seen.has(e.id) || !kinds.includes(e.kind) || typeof e.at !== 'string' || !Number.isFinite(Date.parse(e.at)) || !e.at.includes('T') || !/(Z|[+-]\d\d:\d\d)$/.test(e.at) || typeof e.staff !== 'string' || e.staff.length > 80) throw Error('記録が不正です');
    if (e.kind === 'memo' && (typeof e.text !== 'string' || !e.text.trim() || e.text.length > 2000)) throw Error('メモが不正です');
    if (e.kind === 'staff' && !e.staff.trim()) throw Error('担当者が未入力です');
    if (e.kind === 'cancel') {
      const target = seen.get(e.target);
      if (!target || !['entry', 'akarenga'].includes(target.kind) || cancelled.has(e.target)) throw Error('取消対象が不正です');
      cancelled.add(e.target);
    }
    seen.set(e.id, e);
  }
  return events;
}
export function active(events) {
  const cancelled = new Set(events.filter(e => e.kind === 'cancel').map(e => e.target));
  return events.filter(e => ['entry', 'akarenga'].includes(e.kind) && !cancelled.has(e.id));
}
export function summary(events, day, minutes = 60) {
  if (![5, 15, 30, 60].includes(minutes)) throw Error('集計単位が不正です');
  const bins = Array.from({ length: 1440 / minutes }, (_, i) => ({ time: `${String(Math.floor(i * minutes / 60)).padStart(2, '0')}:${String(i * minutes % 60).padStart(2, '0')}`, entry: 0, akarenga: 0 }));
  const totals = { entry: 0, akarenga: 0 }, staff = new Map();
  for (const e of active(events).filter(e => dayOf(e.at) === day)) {
    totals[e.kind]++;
    const [h, m] = timeOf(e.at).split(':').map(Number);
    bins[Math.floor((h * 60 + m) / minutes)][e.kind]++;
    if (!staff.has(e.staff)) staff.set(e.staff, { entry: 0, akarenga: 0 });
    staff.get(e.staff)[e.kind]++;
  }
  return { totals, bins, staff: [...staff].map(([name, counts]) => ({ name, ...counts })) };
}
export const currentStaff = events => events.filter(e => e.kind === 'staff').reduce((latest, e) => !latest || Date.parse(e.at) >= Date.parse(latest.at) ? e : latest, null)?.staff || '未設定';
export function mergeEvents(existing, incoming) {
  validate(incoming);
  const map = new Map(existing.map(e => [e.id, e]));
  for (const e of incoming) {
    if (map.has(e.id) && JSON.stringify(map.get(e.id)) !== JSON.stringify(e)) throw Error('同じIDの異なる記録があります');
    map.set(e.id, e);
  }
  return validate([...map.values()]);
}
export function csv(rows) {
  return '\uFEFF' + rows.map(row => row.map(v => {
    let s = String(v ?? '');
    if (/^[\s]*[=+@\-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
