import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, resetDb } from './store.svelte';
import { insertSlots, sendReply, approve, confirmSlot, cancelScheduling, SEND_DELAY_MS } from './actions';
import { todayCount, nextMeeting } from './derived';

beforeEach(() => {
	(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
	resetDb();
	vi.useFakeTimers();
});

describe('scheduling', () => {
	it('draft → sent → confirmed、件数は 5 → 5 → 4 (承認 2 件処理後)', () => {
		for (const a of db.approvals.filter((a) => a.status === 'pending')) {
			approve(a.id);
		}
		vi.advanceTimersByTime(SEND_DELAY_MS);
		expect(todayCount(db)).toBe(5);
		const s = insertSlots('th-tanaka-next');
		expect(s.status).toBe('draft');
		expect(s.slots.filter((x) => x.selected).length).toBe(3);
		const ap = sendReply('th-tanaka-next', 'body ' + s.text, 'inbox');
		expect(todayCount(db)).toBe(6);
		approve(ap.id);
		expect(todayCount(db)).toBe(5); // 承認待ち +1 が sending になって消え、要返信 1 はまだ残る
		vi.advanceTimersByTime(SEND_DELAY_MS);
		expect(s.status).toBe('sent');
		expect(s.token).toBeTruthy();
		expect(todayCount(db)).toBe(5);
		const r = confirmSlot(s.token, s.slots[1].id)!;
		expect(s.status).toBe('confirmed');
		expect(r.event.url).toMatch(/^meet\.google\.com\//);
		expect(r.meeting.brief).toBeTruthy();
		// 「前回の論点」は議事録のある会議のうち予定の日付が新しいほう (見積提示)から取る。
		// 配列の並び順で取ると古いほう (デモ実施)の決定事項が出る
		expect(r.meeting.brief!.lastPoints).toEqual([
			'稟議の結果は次回商談までに共有',
			'導入スケジュールは別途提出'
		]);
		expect(todayCount(db)).toBe(4);
		expect(nextMeeting(db)!.meeting.id).toBe('m-abc'); // 次の会議は変わらない
		expect(db.logs[0].approved).toBe(true);
	});
	it('確定の履歴に「元に戻す」は付かない', () => {
		const s = insertSlots('th-tanaka-next');
		s.status = 'sent';
		s.token = 'tok';
		confirmSlot('tok', s.slots[0].id);
		expect(db.logs[0].undo).toBeUndefined();
	});
	it('action の返り値は db の中の要素と同一', () => {
		const s = insertSlots('th-tanaka-next');
		expect(s).toBe(db.scheduling[db.scheduling.length - 1]);
		s.status = 'sent';
		s.token = 'tok';
		const r = confirmSlot('tok', s.slots[0].id)!;
		expect(r.event).toBe(db.events[db.events.length - 1]);
		expect(r.meeting).toBe(db.meetings[db.meetings.length - 1]);
	});
	it('無効 token は null', () => {
		expect(confirmSlot('nope', 'x')).toBeNull();
	});
	it('確定済みの枠を選び直しても予定と会議は 1 件ずつ', () => {
		const s = insertSlots('th-tanaka-next');
		s.status = 'sent';
		s.token = 'tok';
		confirmSlot('tok', s.slots[0].id);
		const r = confirmSlot('tok', s.slots[1].id)!;
		expect(db.events.filter((e) => e.source === 'kuroko').length).toBe(1);
		expect(db.meetings.length).toBe(4); // シードの 3 件 (m-abc と過去の商談 2 件) と選び直した 1 件
		expect(db.demo.stats.confirmed).toBe(1);
		expect(s.eventId).toBe(r.event.id);
		expect(r.event.start).toBe(s.slots[1].start);
	});
	it('cancel で予定と会議が消える', () => {
		const s = insertSlots('th-tanaka-next');
		s.status = 'sent';
		s.token = 'tok';
		confirmSlot('tok', s.slots[0].id);
		cancelScheduling('tok');
		expect(s.status).toBe('cancelled');
		expect(db.events.find((e) => e.id === s.eventId)).toBeUndefined();
	});
});
