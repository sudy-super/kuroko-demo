import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, resetDb } from './store.svelte';
import { insertSlots, dropSlotsDraft, sendReply, approve, confirmSlot, cancelScheduling, SEND_DELAY_MS } from './actions';
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
	// review-task-15.md C1 — 人物未登録のスレッドで日程調整を使うと、相手の画面が
	// confirmSlot() で TypeError を起こしていた。fail-close で作らせない
	it('人物未登録のスレッドでは insertSlots が throw する', () => {
		expect(db.threads.find((t) => t.id === 'th-sunrise-interview')?.personId).toBeUndefined();
		expect(() => insertSlots('th-sunrise-interview')).toThrow();
	});
	it('personId が空の scheduling は confirmSlot が null を返す (二重の防御)', () => {
		const s = insertSlots('th-tanaka-next');
		s.personId = '';
		s.status = 'sent';
		s.token = 'tok';
		expect(confirmSlot('tok', s.slots[0].id)).toBeNull();
	});
	// review-task-15.md C2 — 破棄や他トーンへの乗り換えでは insertSlots を呼ばないので、
	// sendReply が拾う draft が残らない
	it('insertSlots を呼ばなければ sendReply の schedulingId は付かない', () => {
		const ap = sendReply('th-tanaka-next', '日程の話は取り下げます。', 'inbox');
		expect(ap.payload.type).toBe('reply');
		expect((ap.payload as { schedulingId?: string }).schedulingId).toBeUndefined();
		expect(ap.effectLine).not.toContain('相手が候補を選ぶと');
	});
	// slots を採用したあと別トーンを採用すると本文から候補が消えるので、下書きも道連れにする
	it('dropSlotsDraft のあとは sendReply の schedulingId が付かない', () => {
		insertSlots('th-tanaka-next');
		dropSlotsDraft('th-tanaka-next');
		expect(db.scheduling.filter((s) => s.threadId === 'th-tanaka-next').length).toBe(0);
		const ap = sendReply('th-tanaka-next', '承知しました。改めてご連絡いたします。', 'inbox');
		expect((ap.payload as { schedulingId?: string }).schedulingId).toBeUndefined();
		expect(ap.effectLine).not.toContain('相手が候補を選ぶと');
		approve(ap.id);
		vi.advanceTimersByTime(SEND_DELAY_MS);
		expect(db.scheduling.some((s) => s.token)).toBe(false);
	});
	// 承認待ちの返信が指している下書きは、その本文に候補が載っているので消さない
	it('承認待ちの返信が指す下書きは dropSlotsDraft でも残る', () => {
		const s = insertSlots('th-tanaka-next');
		const ap = sendReply('th-tanaka-next', 'body ' + s.text, 'inbox');
		dropSlotsDraft('th-tanaka-next');
		expect(db.scheduling).toContain(s);
		approve(ap.id);
		vi.advanceTimersByTime(SEND_DELAY_MS);
		expect(s.status).toBe('sent');
		expect(s.token).toBeTruthy();
	});
});
