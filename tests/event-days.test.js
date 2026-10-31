import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closedDay, dayRecordIds, eventTotals, validateDayResults, mergeDayResults, assertFinalizedRecords } from '../src/event-days.js';
import { visitorForecast } from '../src/forecast.js';
const event = (id, kind = 'entry', extra = {}) => ({ id, kind, at:'2026-10-31T10:00:00+09:00', staff:'架空担当', ...extra });
const events = [event('a'), event('b','akarenga')];
const close = { id:'close1', kind:'close', date:'2026-10-31', at:'2026-10-31T12:00:00+09:00', staff:'架空担当', totals:{entry:1,akarenga:1}, ids:dayRecordIds(events,'2026-10-31') };
test('確定・解除は追記履歴で、確定日の追加や取消、改ざん結果を拒否する', () => {
  assertFinalizedRecords([close], events);
  assert.equal(closedDay([close], close.date), close);
  assert.throws(() => assertFinalizedRecords([close], [...events,event('c')]));
  assert.throws(() => assertFinalizedRecords([close], [...events,event('cancel','cancel',{target:'a'})]));
  const reopen = { id:'open1', kind:'reopen', date:close.date, at:close.at, staff:'架空担当' };
  validateDayResults([close,reopen]); assert.equal(closedDay([close,reopen],close.date),null);
  assertFinalizedRecords([close,reopen], [...events,event('c')]);
  assert.throws(() => validateDayResults([close,{...close,id:'duplicate-close'}]));
  assert.throws(() => validateDayResults([reopen]));
  assert.throws(() => assertFinalizedRecords([{...close,totals:{entry:9,akarenga:1}}],events));
});
test('2日分だけを合算し、古いバックアップは確定履歴を消さず競合を拒否する', () => {
  assert.deepEqual(eventTotals([...events,event('day2','entry',{at:'2026-11-01T10:00:00+09:00'}),event('outside','entry',{at:'2026-11-02T10:00:00+09:00'})]),{entry:2,akarenga:1});
  assert.deepEqual(mergeDayResults([close],[]),[close]); assert.deepEqual(mergeDayResults([close],[close]),[close]);
  assert.throws(() => mergeDayResults([close],[{...close,staff:'変更'}]));
});
test('2日間予測は初日翌日ペース・2日目前日実績・早期確定時刻・記録なしを扱う', () => {
  const first = visitorForecast(events,new Date('2026-10-31T10:00:00+09:00'));
  assert.equal(first.estimate,8); assert.equal(first.combined,16);
  const finalized = visitorForecast(events,new Date('2026-10-31T14:00:00+09:00'),[close]);
  assert.equal(finalized.estimate,1); assert.equal(finalized.combined,4);
  const secondEvents = [...events,event('c','entry',{at:'2026-11-01T10:00:00+09:00'})];
  assert.equal(visitorForecast(secondEvents,new Date('2026-11-01T10:00:00+09:00'),[close]).combined,9);
  assert.equal(visitorForecast([],new Date('2026-11-01T10:00:00+09:00')).combined,null);
  assert.equal(visitorForecast(events,new Date('2026-11-02T10:00:00+09:00')).status,'outside');
});
