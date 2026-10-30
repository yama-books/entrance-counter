import { dayOf } from './model.js';
// 「山本を呼ぶ」で表示する山本の予定（JSTの日付ごと）。時刻は24時間表記。
export const callSchedule = {
  '2026-10-31': { label: '10/31（土）', items: [
    { from: '11:00', to: '11:30', lines: ['手話同好会公演（音楽室A）'] },
    { from: '11:30', to: '12:00', lines: ['書道部実演（書道教室）'] },
    { from: '13:55', to: '15:15', lines: ['警備巡回中'] },
  ] },
  '2026-11-01': { label: '11/1（日）', items: [
    { from: '10:10', to: '11:30', lines: ['警備巡回中'] },
    { from: '13:00', to: '13:30', lines: ['手話同好会公演（音楽室A）', '書道部実演'] },
  ] },
};
const timeFormatter = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
// Returns the day's schedule with the item in progress at `now` marked, or null when nothing is planned.
export function scheduleFor(now, schedule = callSchedule) {
  const day = schedule[dayOf(now)];
  if (!day) return null;
  const time = timeFormatter.format(new Date(now));
  return { label: day.label, items: day.items.map(item => ({ ...item, current: item.from <= time && time < item.to })) };
}
