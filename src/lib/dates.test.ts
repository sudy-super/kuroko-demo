import { describe, it, expect } from 'vitest';
import { bizDay, nextWeekday, fmtMDW, key, addDays, rel } from './dates';

const sat = new Date(2026, 8, 12); // 2026-09-12 (土)
const fri = new Date(2026, 8, 11);

describe('dates', () => {
  it('bizDay は土日を飛ばす', () => {
    expect(key(bizDay(1, fri))).toBe('2026-09-14'); // 月
    expect(key(bizDay(1, sat))).toBe('2026-09-14');
    expect(key(bizDay(5, fri))).toBe('2026-09-18');
    expect(key(bizDay(6, fri))).toBe('2026-09-21');
  });
  it('nextWeekday は from より後の直近', () => {
    const wed = new Date(2026, 8, 9);
    expect(key(nextWeekday(3, wed))).toBe('2026-09-16');
    expect(key(nextWeekday(3, fri))).toBe('2026-09-16');
  });
  it('表示形式', () => {
    expect(fmtMDW(new Date(2026, 8, 9))).toBe('9/9 (水)');
    expect(rel(addDays(1, fri), fri)).toBe('明日');
    expect(rel(fri, fri)).toBe('今日');
  });
});
