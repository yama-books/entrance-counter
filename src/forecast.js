import { active, dayOf } from './model.js';
import { eventDays, closedDay } from './event-days.js';

export function visitorForecast(events, now = new Date(), results = []) {
  const date = dayOf(now), open = new Date(`${date}T09:00:00+09:00`), close = new Date(`${date}T16:30:00+09:00`);
  const entries = active(events).filter(e => e.kind === 'entry' && dayOf(e.at) === date);
  const finalized = closedDay(results, date), rateTime = finalized ? new Date(finalized.at) : now;
  const actual = entries.length, elapsed = Math.max(0, Math.min(450, (rateTime - open) / 60000));
  const status = !eventDays.includes(date) ? 'outside' : finalized || now >= close ? 'ended' : now < open ? 'before-opening' : elapsed < 1 ? 'starting' : !actual ? 'no-records' : 'running';
  const estimate = status === 'ended' ? actual : status === 'running' ? Math.round(actual / elapsed * 450) : null;
  const first = active(events).filter(e => e.kind === 'entry' && dayOf(e.at) === eventDays[0]);
  const previousKnown = events.some(e => e.kind === 'entry' && dayOf(e.at) === eventDays[0]) || Boolean(closedDay(results, eventDays[0]));
  const combined = estimate === null ? null : date === eventDays[0] ? elapsed >= 1 ? estimate + Math.round(actual / elapsed * 450) : null : date === eventDays[1] && previousKnown ? first.length + estimate : null;
  return { date, actual, elapsed, status, estimate, combined, previousKnown };
}

export function validatePredictions(records) {
  if (!Array.isArray(records) || records.length > 50000) throw Error('予測の記録形式または件数が不正です');
  const ids = new Set();
  for (const p of records) {
    if (!p || typeof p.id !== 'string' || !p.id || p.id.length > 100 || ids.has(p.id)) throw Error('予測の記録IDが不正です');
    if (typeof p.staff !== 'string' || !p.staff.trim() || p.staff.length > 80 || /[\u0000-\u001f]/.test(p.staff)) throw Error('担当者名を1〜80文字で入力してください');
    if (!Number.isSafeInteger(p.count) || p.count < 0 || p.count > 99999999) throw Error('予測人数は0〜99,999,999の整数で入力してください');
    if (typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || typeof p.at !== 'string' || !p.at.includes('T') || !/(Z|[+-]\d\d:\d\d)$/.test(p.at) || !Number.isFinite(Date.parse(p.at)) || dayOf(p.at) !== p.date) throw Error('予測の日時が不正です');
    ids.add(p.id);
  }
  return records;
}

export function mergePredictions(existing, incoming) {
  validatePredictions(existing); validatePredictions(incoming);
  const records = new Map(existing.map(p => [p.id, p]));
  for (const p of incoming) {
    const before = records.get(p.id);
    if (before && ['id', 'staff', 'count', 'date', 'at'].some(key => before[key] !== p[key])) throw Error('保存済みの予測を書き換えることはできません');
    if (!before) records.set(p.id, p);
  }
  return validatePredictions([...records.values()]);
}

export function previousPredictions(records, savedId) {
  const index = records.findIndex(p => p.id === savedId);
  return index < 0 ? [] : records.slice(0, index).reverse();
}
