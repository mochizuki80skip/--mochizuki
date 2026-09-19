// _slots.js / _store.js の純粋ロジックを Redis 抜きで検証する
import { normalizeSchedule, rangesForDate, hhmmToMin } from '../api/_store.js';
import { buildAvailability, enumerateDates, dowOfYmd, slotsInRanges, fitsInOneRange, toDashedYmd } from '../api/_slots.js';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.log(`✗ ${name}\n   got:  ${g}\n   want: ${w}`); }
};

// --- 日付ユーティリティ ---
eq('toDashedYmd(compact)', toDashedYmd('20260919'), '2026-09-19');
eq('toDashedYmd(dashed)', toDashedYmd('2026-09-19'), '2026-09-19');
eq('toDashedYmd(bad)', toDashedYmd('xx'), null);
eq('dow 2026-09-19 = 土(6)', dowOfYmd('2026-09-19'), 6);
eq('dow 2026-09-20 = 日(0)', dowOfYmd('2026-09-20'), 0);
eq('enumerate 7days', enumerateDates('2026-09-19','2026-09-25').length, 7);
eq('enumerate 月跨ぎ', enumerateDates('2026-09-29','2026-10-02'), ['2026-09-29','2026-09-30','2026-10-01','2026-10-02']);

// --- 枠の生成 ---
eq('slots 10:00-12:00 /30', slotsInRanges([{start:'10:00',end:'12:00'}], 30), ['10:00','10:30','11:00','11:30']);
eq('休憩で分割', slotsInRanges([{start:'10:00',end:'11:00'},{start:'15:00',end:'16:00'}], 30), ['10:00','10:30','15:00','15:30']);
eq('60分が休憩をまたぐ→不可', fitsInOneRange([{start:'10:00',end:'13:00'},{start:'15:00',end:'19:00'}], hhmmToMin('12:30'), 60), false);
eq('60分が収まる→可', fitsInOneRange([{start:'10:00',end:'13:00'}], hhmmToMin('12:00'), 60), true);

// --- スケジュール正規化 ---
const s = normalizeSchedule({
  slotMin: 30,
  clinics: {
    '192': {
      capacity: 1,
      week: { 1: [{start:'15:00',end:'19:00'},{start:'10:00',end:'13:00'}] }, // 順不同
      exceptions: { '2026-09-23': { closed: true } },
    },
  },
});
eq('帯が開始順に並ぶ', s.clinics['192'].week[1], [{start:'10:00',end:'13:00'},{start:'15:00',end:'19:00'}]);
eq('重なる帯は結合', normalizeSchedule({clinics:{'192':{week:{1:[{start:'10:00',end:'13:00'},{start:'12:00',end:'15:00'}]}}}}).clinics['192'].week[1], [{start:'10:00',end:'15:00'}]);
eq('不正な帯は捨てる', normalizeSchedule({clinics:{'192':{week:{1:[{start:'19:00',end:'10:00'},{start:'ab',end:'cd'}]}}}}).clinics['192'].week[1], []);
eq('臨時休診は枠なし', rangesForDate(s, '192', '2026-09-23', 3), []);
eq('193は既定値で埋まる', s.clinics['193'].week[1], [{start:'10:00',end:'19:00'}]);

// --- 空き枠の組み立て（未来日で検証）---
const future = new Date(Date.now() + 40 * 86400000);
const fy = future.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
const fdow = dowOfYmd(fy);
const sched = normalizeSchedule({
  slotMin: 30,
  clinics: { '192': { capacity: 1, week: { [fdow]: [{start:'10:00',end:'12:00'}] } } },
});

// 30分コース・全部空き → 4枠
let r = buildAvailability({ schedule: sched, clinic:'192', ymds:[fy], bookedMap:{}, duration:30 });
eq('30分/空き4枠', r.available.map(a=>a.iso.slice(11,16)), ['10:00','10:30','11:00','11:30']);
eq('時間軸は4枠', r.axisAvailable.length, 4);

// 60分コース → 最後の 11:30 は 12:30 まで必要なので不可
r = buildAvailability({ schedule: sched, clinic:'192', ymds:[fy], bookedMap:{}, duration:60 });
eq('60分/3枠', r.available.map(a=>a.iso.slice(11,16)), ['10:00','10:30','11:00']);

// 10:30 が埋まると、30分は10:30が消え、60分は10:00と10:30が消える
r = buildAvailability({ schedule: sched, clinic:'192', ymds:[fy], bookedMap:{[fy]:{'10:30':1}}, duration:30 });
eq('30分/10:30埋まり', r.available.map(a=>a.iso.slice(11,16)), ['10:00','11:00','11:30']);
r = buildAvailability({ schedule: sched, clinic:'192', ymds:[fy], bookedMap:{[fy]:{'10:30':1}}, duration:60 });
eq('60分/10:30埋まり', r.available.map(a=>a.iso.slice(11,16)), ['11:00']);
eq('埋まっても時間軸は不変', r.axisAvailable.length, 4);

// capacity 2 なら1件入っていてもまだ空き
const sched2 = normalizeSchedule({ slotMin:30, clinics:{'192':{capacity:2, week:{[fdow]:[{start:'10:00',end:'12:00'}]}}} });
r = buildAvailability({ schedule: sched2, clinic:'192', ymds:[fy], bookedMap:{[fy]:{'10:30':1}}, duration:30 });
eq('capacity2/1件では埋まらない', r.available.length, 4);
r = buildAvailability({ schedule: sched2, clinic:'192', ymds:[fy], bookedMap:{[fy]:{'10:30':2}}, duration:30 });
eq('capacity2/2件で埋まる', r.available.map(a=>a.iso.slice(11,16)), ['10:00','11:00','11:30']);

// 過去の枠は出ない
const past = new Date(Date.now() - 2 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
const pdow = dowOfYmd(past);
const schedP = normalizeSchedule({ slotMin:30, clinics:{'192':{capacity:1, week:{[pdow]:[{start:'10:00',end:'12:00'}]}}} });
r = buildAvailability({ schedule: schedP, clinic:'192', ymds:[past], bookedMap:{}, duration:30 });
eq('過去日は空き0', r.available.length, 0);
eq('過去日も時間軸には出る', r.axisAvailable.length, 4);

console.log(`\n${fail === 0 ? '✅' : '❌'} pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
