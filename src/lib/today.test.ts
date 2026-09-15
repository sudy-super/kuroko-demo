import { describe, it, expect } from 'vitest';
import { seed } from './seed';
import { todayCount, todayItems, freeSlots, guideSection } from './derived';
import { addDays } from './dates';

describe('todayItems', () => {
	it('どの曜日を今日にしても 7 件', () => {
		for (let i = 0; i < 7; i++) expect(todayCount(seed(addDays(i, new Date(2026, 8, 14))))).toBe(7);
	});
	it('内訳', () => {
		const items = todayItems(seed(new Date(2026, 8, 15)));
		expect(items.map((i) => [i.kind, i.n])).toEqual([
			['approval', 2],
			['reply', 1],
			['brief', 1],
			['tasks', 3]
		]);
	});
	it('sending の承認は数えない', () => {
		const db = seed(new Date(2026, 8, 15));
		db.approvals[0].status = 'sending';
		expect(todayCount(db)).toBe(6);
	});
	it('次の会議より後の会議の未読 Brief は数えない', () => {
		const db = seed(new Date(2026, 8, 15));
		db.events.push({
			...db.events.find((e) => e.id === 'ev-abc-meeting')!,
			id: 'ev-later',
			date: '2026-09-30',
			meetingId: 'm-later'
		});
		db.meetings.push({ ...db.meetings[0], id: 'm-later', eventId: 'ev-later', briefRead: false });
		expect(todayCount(db)).toBe(7);
	});
	it('freeSlots は予定を引く', () => {
		const db = seed(new Date(2026, 8, 15));
		expect(freeSlots(db, '2026-09-15')).toEqual([
			{ start: '9:00', end: '10:00' },
			{ start: '11:00', end: '13:00' },
			{ start: '14:00', end: '17:30' }
		]);
	});
	it('guideSection は初期 1', () => {
		expect(guideSection(seed(new Date(2026, 8, 15)))).toBe(1);
	});
});
