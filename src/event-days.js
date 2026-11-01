import { active, dayOf, summary } from './model.js';
export const eventDays = ['2026-10-31', '2026-11-01'];
export const closedDay = (results, date) => { const last = results.findLast(r => r.date === date); return last?.kind === 'close' ? last : null; };
export const dayRecordIds = (events, date) => {
  const ids = new Set(events.filter(e => ['entry', 'akarenga'].includes(e.kind) && dayOf(e.at) === date).map(e => e.id));
  return events.filter(e => ids.has(e.id) || (e.kind === 'cancel' && ids.has(e.target))).map(e => e.id);
};
export function eventTotals(events) {
  const counts = active(events).filter(e => eventDays.includes(dayOf(e.at)));
  return { entry: counts.filter(e => e.kind === 'entry').length, akarenga: counts.filter(e => e.kind === 'akarenga').length };
}
export function validateDayResults(results) {
  if (!Array.isArray(results) || results.length > 5000) throw Error('終了記録の形式または件数が不正です');
  const ids = new Set(), state = new Map();
  for (const r of results) {
    if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 100 || ids.has(r.id) || !eventDays.includes(r.date) || !['close','reopen'].includes(r.kind) || typeof r.staff !== 'string' || !r.staff.trim() || r.staff.length > 80 || typeof r.at !== 'string' || !r.at.includes('T') || !/(Z|[+-]\d\d:\d\d)$/.test(r.at) || !Number.isFinite(Date.parse(r.at)) || dayOf(r.at) < r.date) throw Error('終了記録が不正です');
    const wasClosed = state.get(r.date) === 'close';
    if ((r.kind === 'close' && wasClosed) || (r.kind === 'reopen' && !wasClosed)) throw Error('確定・解除の順序が不正です');
    if (r.kind === 'close' && (!r.totals || !['entry','akarenga'].every(k => Number.isSafeInteger(r.totals[k]) && r.totals[k] >= 0) || !Array.isArray(r.ids) || r.ids.length > 200000 || r.ids.some(id => typeof id !== 'string' || !id || id.length > 100) || new Set(r.ids).size !== r.ids.length)) throw Error('確定結果が不正です');
    ids.add(r.id); state.set(r.date, r.kind);
  }
  return results;
}
export function mergeDayResults(existing, incoming) {
  validateDayResults(existing); validateDayResults(incoming);
  const records = new Map(existing.map(r => [r.id, r]));
  for (const r of incoming) {
    if (records.has(r.id) && JSON.stringify(records.get(r.id)) !== JSON.stringify(r)) throw Error('保存済みの終了記録を書き換えることはできません');
    if (!records.has(r.id)) records.set(r.id, r);
  }
  return validateDayResults([...records.values()]);
}
export function assertFinalizedRecords(results, events) {
  for (const date of eventDays) {
    const closed = closedDay(results, date); if (!closed) continue;
    const ids = dayRecordIds(events, date), totals = summary(events, date).totals;
    if (JSON.stringify(ids) !== JSON.stringify(closed.ids) || totals.entry !== closed.totals.entry || totals.akarenga !== closed.totals.akarenga) throw Error(`${date}は確定済みです。先に確定を解除してください`);
  }
}
export function finishEvent(results, events, operation, now = new Date()) {
  validateDayResults(results); assertFinalizedRecords(results, events);
  if (dayOf(now) < eventDays[1]) throw Error('全日程を終了できるのは2日目以降です');
  if (typeof operation.id !== 'string' || !operation.id || operation.id.length > 96) throw Error('終了記録IDが不正です');
  const next = [...results];
  for (const [index, date] of eventDays.entries()) {
    const ids = dayRecordIds(events, date);
    if (operation.expectedIds && JSON.stringify(operation.expectedIds[date]) !== JSON.stringify(ids)) throw Error('記録が更新されました。結果を確認してもう一度終了してください');
    if (!closedDay(results, date)) next.push({ id: `${operation.id}:${index + 1}`, kind:'close', date, at:now.toISOString(), staff:operation.staff, totals:summary(events, date).totals, ids });
  }
  validateDayResults(next); assertFinalizedRecords(next, events); return next;
}
export function eventSummary(events, results) {
  const days = eventDays.map(date => ({ date, totals:summary(events, date).totals, closed:closedDay(results, date) }));
  const byDay = eventDays.map(date => summary(events, date, 30).bins);
  const bins = byDay[0].map((bin, i) => ({ time:bin.time, entry:bin.entry + byDay[1][i].entry, akarenga:bin.akarenga + byDay[1][i].akarenga })).filter(bin => bin.time >= '09:00' && bin.time < '16:30');
  const totals = eventTotals(events), outside = Object.fromEntries(['entry','akarenga'].map(kind => [kind, totals[kind] - bins.reduce((sum, bin) => sum + bin[kind], 0)]));
  return { days, totals, bins, outside, complete:days.every(day => day.closed), recorded:events.length > 0 || results.length > 0 };
}
