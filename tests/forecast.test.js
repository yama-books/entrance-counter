import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visitorForecast, validatePredictions, mergePredictions, previousPredictions } from '../src/forecast.js';
const at = time => `2026-10-31T${time}:00+09:00`;
const entry = (id, kind = 'entry', extra = {}) => ({ id, kind, at: at('10:00'), staff: '架空担当', ...extra });
const prediction = (id, extra = {}) => ({ id, staff: '架空担当', count: 120, date: '2026-10-31', at: at('10:00'), ...extra });
test('JST営業時間の人数見込み、取消・赤煉瓦・別日の除外、終了後の実績', () => {
  const events = [entry('a'), entry('b'), entry('c'), entry('x', 'akarenga'), entry('old', 'entry', { at: '2026-10-30T10:00:00+09:00' }), entry('cancel', 'cancel', { target: 'b' })];
  const forecast = visitorForecast(events, new Date(at('10:00')));
  assert.equal(forecast.actual, 2); assert.equal(forecast.estimate, 15);
  assert.equal(visitorForecast(events, new Date(at('08:59'))).estimate, null);
  assert.equal(visitorForecast(events, new Date(at('09:00'))).status, 'starting');
  assert.equal(visitorForecast([], new Date(at('10:00'))).status, 'no-records');
  assert.equal(visitorForecast(events, new Date(at('16:30'))).estimate, 2);
  assert.equal(visitorForecast(events, new Date(at('23:00'))).status, 'ended');
  assert.equal(visitorForecast(events, new Date('2026-11-01T00:00:00+09:00')).actual, 0);
});
test('予測は名前・人数・対象日・時刻を保持し、保存IDより前の履歴だけを返す', () => {
  const a = prediction('a'), b = prediction('b', { staff: '別の架空担当', count: 0 });
  const records = mergePredictions([a], [b]);
  assert.deepEqual(previousPredictions(records, null), []);
  assert.deepEqual(previousPredictions(records, 'missing'), []);
  assert.deepEqual(previousPredictions(records, 'b'), [a]);
  assert.deepEqual(mergePredictions(records, [b]), records);
  assert.throws(() => mergePredictions(records, [prediction('b', { count: 1 })]));
  assert.deepEqual(mergePredictions(records, []), records);
});
test('予測の小数・不正値・名前・日時を拒否し、JSON往復は保持する', () => {
  for (const count of [-1, .1, NaN, Infinity, 100000000, '12']) assert.throws(() => validatePredictions([prediction('a', { count })]));
  for (const staff of ['', ' ', 'a\nb', 'x'.repeat(81)]) assert.throws(() => validatePredictions([prediction('a', { staff })]));
  for (const extra of [{ date: '2026-10-30' }, { at: 'bad' }, { at: '2026-10-31T10:00:00' }]) assert.throws(() => validatePredictions([prediction('a', extra)]));
  assert.throws(() => validatePredictions([prediction('a'), prediction('a')]));
  assert.deepEqual(validatePredictions(JSON.parse(JSON.stringify([prediction('a')]))), [prediction('a')]);
});
