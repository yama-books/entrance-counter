import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, summary, currentStaff, mergeEvents, csv, dayOf } from '../src/model.js';
const event = (id, kind = 'entry', at = '2026-10-30T00:29:00Z', extra = {}) => ({ id, kind, at, staff: 'テスト担当', ...extra });
test('independent counts, staff snapshots, cancellation and JST bins', () => {
  const events = [event('s', 'staff'), ...Array.from({ length: 10 }, (_, i) => event('e' + i)), ...Array.from({ length: 3 }, (_, i) => event('a' + i, 'akarenga', '2026-10-30T00:30:00Z')), event('s2', 'staff', undefined, { staff: 'テスト交代' }), event('next', 'entry', '2026-10-30T01:00:00Z', { staff: 'テスト交代' })];
  validate(events);
  assert.deepEqual(summary(events, '2026-10-30', 30).totals, { entry: 11, akarenga: 3 });
  events.push(event('c', 'cancel', undefined, { target: 'e0' }));
  const result = summary(validate(events), '2026-10-30', 30);
  assert.equal(result.totals.entry, 10);
  assert.equal(result.bins[18].entry, 9);
  assert.equal(result.bins[19].akarenga, 3);
  assert.equal(summary(events, '2026-10-30', 60).bins[9].akarenga, 3);
  assert.equal(result.staff[1].entry, 1);
  assert.equal(currentStaff(events), 'テスト交代');
  assert.equal(events[1].staff, 'テスト担当');
  assert.equal(events.length, 17);
});
test('JST midnight and empty day', () => {
  assert.equal(dayOf('2026-10-29T15:00:00Z'), '2026-10-30');
  assert.equal(summary([event('a', 'entry', '2026-10-29T14:59:59Z')], '2026-10-30').totals.entry, 0);
});
test('reject corrupt and double cancellation; retain original history', () => {
  const source = [event('e'), event('c', 'cancel', undefined, { target: 'e' })];
  assert.throws(() => validate([...source, event('c2', 'cancel', undefined, { target: 'e' })]));
  assert.throws(() => validate([event('x', 'cancel', undefined, { target: 'missing' })]));
  for (const bad of [event('x', 'invalid'), event('x', 'entry', 'bad'), event('x', 'memo', undefined, { text: '' })]) assert.throws(() => validate([bad]));
  assert.equal(source.length, 2);
});
test('JSON roundtrip and restore are additive and idempotent', () => {
  const events = [event('e'), event('m', 'memo', undefined, { text: '架空の確認メモ' })];
  const backup = JSON.parse(JSON.stringify(events));
  assert.deepEqual(mergeEvents(events, backup), events);
  assert.deepEqual(mergeEvents([event('new')], backup), [event('new'), ...events]);
  assert.throws(() => mergeEvents(events, [event('e', 'akarenga')]));
});
test('CSV quotes, newlines and spreadsheet formula protection', () => {
  const output = csv([['=1+1', 'a"b', 'a\nb', '@test', '-2']]);
  assert.ok(output.startsWith('\uFEFF"\'=1+1"'));
  assert.ok(output.includes('"a""b"'));
  assert.ok(output.includes('"a\nb"'));
});
test('restoring older staff changes does not switch current staff', () => {
  assert.equal(currentStaff([event('new', 'staff', '2026-10-30T02:00:00Z', { staff: 'テスト新担当' }), event('old', 'staff')]), 'テスト新担当');
});
test('5/15/30/60-minute boundaries share the same totals and cancellation rules', () => {
  const events = [0, 4, 5, 14, 15, 29, 30, 59].map((m, i) => event('b' + i, i % 2 ? 'akarenga' : 'entry', `2026-10-30T00:${String(m).padStart(2, '0')}:00Z`));
  events.push(event('void', 'cancel', undefined, { target: 'b0' }));
  for (const minutes of [5, 15, 30, 60]) {
    const result = summary(validate(events), '2026-10-30', minutes);
    assert.equal(result.bins.length, 1440 / minutes);
    assert.deepEqual(result.totals, { entry: 3, akarenga: 4 });
    assert.equal(result.bins.reduce((n, b) => n + b.entry + b.akarenga, 0), 7);
  }
  const five = summary(events, '2026-10-30', 5);
  assert.equal(five.bins.find(b => b.time === '09:00').akarenga, 1);
  assert.equal(five.bins.find(b => b.time === '09:05').entry, 1);
  assert.equal(summary(events, '2026-10-30', 15).bins.find(b => b.time === '09:15').entry, 1);
  assert.throws(() => summary(events, '2026-10-30', 10));
});
