import { describe, it, expect } from 'vitest';
import { seed } from './seed';
import { key, bizDay } from './dates';

describe('seed', () => {
	it('要件どおりの件数', () => {
		const db = seed(new Date(2026, 8, 15));
		expect(db.threads.filter((t) => t.inQueue).length).toBe(8);
		expect(db.threads.length).toBe(8 + 39 + 2); // キュー 8 + 件名のみ 39 + サンライズ過去 2 (面談日程はキューにもある)
		expect(db.approvals.filter((a) => a.status === 'pending').length).toBe(2);
		expect(db.tasks.filter((t) => t.due === '2026-09-15' && t.status !== 'done').length).toBe(3);
		expect(db.meetings[0].eventId).toBe('ev-abc-meeting');
		expect(db.events.find((e) => e.id === 'ev-abc-meeting')!.date).toBe(
			key(bizDay(1, new Date(2026, 8, 15)))
		);
	});
	it('未登録の差出人は personId を持たない', () => {
		const db = seed(new Date(2026, 8, 15));
		const sunrise = db.identities.find((i) => i.value === 'suzuki@sunrise.co.jp')!;
		expect(sunrise.personId).toBeUndefined();
	});
});
