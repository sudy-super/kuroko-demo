import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, resetDb } from './store.svelte';
import {
	approve,
	insertSlots,
	sendReply,
	confirmSlot,
	markBriefRead,
	generateAgenda,
	addTranscript,
	acceptTaskSuggestions,
	toggleTask,
	SEND_DELAY_MS
} from './actions';
import { todayCount, pendingApprovals, todayTasks, guideSection, todaySummary } from './derived';
import { SAMPLE_TRANSCRIPT } from './kuroko/samples';
import { SEED } from './seed';

beforeEach(() => {
	(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
	resetDb();
	vi.useFakeTimers();
});

describe('ゴールデンパス', () => {
	it('案内の 5 段階を順にたどると今日やることが 0 件になる', () => {
		expect(todayCount(db)).toBe(7);
		expect(guideSection(db)).toBe(1);

		// 1. 承認 2 件
		for (const a of pendingApprovals(db)) approve(a.id);
		vi.advanceTimersByTime(SEND_DELAY_MS);
		expect(todayCount(db)).toBe(5);
		expect(guideSection(db)).toBe(2);

		// 2. 田中様へ日程候補つきの返信 → 承認して送信
		const s = insertSlots(SEED.tanakaNextThread);
		const ap = sendReply(SEED.tanakaNextThread, s.text);
		approve(ap.id);
		vi.advanceTimersByTime(SEND_DELAY_MS);
		expect(todayCount(db)).toBe(5); // 返信 1 件が減り、日程調整の返信待ち 1 件が増える
		expect(guideSection(db)).toBe(3);

		// 3. 相手が候補を選ぶ
		confirmSlot(s.token!, s.slots[0].id);
		expect(todayCount(db)).toBe(4);
		expect(guideSection(db)).toBe(4);

		// 4. 会議の前後 — Brief、アジェンダ、文字起こし、ToDo 候補 2 件
		markBriefRead(SEED.abcMeeting);
		expect(todayCount(db)).toBe(3);
		generateAgenda(SEED.abcMeeting);
		addTranscript(SEED.abcMeeting, SAMPLE_TRANSCRIPT);
		const ids = db.suggestions
			.filter((x) => x.status === 'pending' && x.payload.type === 'task')
			.slice(0, 2)
			.map((x) => x.id);
		expect(acceptTaskSuggestions(ids)).toHaveLength(2);
		expect(guideSection(db)).toBe(5);

		// 5. 今日の ToDo を完了にする
		for (const t of todayTasks(db)) toggleTask(t.id);
		expect(todayCount(db)).toBe(0);
		expect(guideSection(db)).toBe(0);
	});

	it('完了画面の数字は上段も本文も実際のログと合う', () => {
		for (const a of pendingApprovals(db)) approve(a.id);
		vi.advanceTimersByTime(SEND_DELAY_MS);
		const s = insertSlots(SEED.tanakaNextThread);
		approve(sendReply(SEED.tanakaNextThread, s.text).id);
		vi.advanceTimersByTime(SEND_DELAY_MS);
		confirmSlot(s.token!, s.slots[0].id);
		markBriefRead(SEED.abcMeeting);
		generateAgenda(SEED.abcMeeting);
		addTranscript(SEED.abcMeeting, SAMPLE_TRANSCRIPT);
		acceptTaskSuggestions(
			db.suggestions
				.filter((x) => x.status === 'pending' && x.payload.type === 'task')
				.slice(0, 2)
				.map((x) => x.id)
		);
		for (const t of todayTasks(db)) toggleTask(t.id);

		// 上段 — 利用者が今日下した決定の数
		expect(db.demo.stats).toEqual({ approved: 3, replied: 2, confirmed: 1, tasksAdded: 2, tasksDone: 3 });
		// 本文 — 画面に出すのは下書きだけ。KUROKO 名義の送信は構造上必ず 0 件なので出さない
		expect(todaySummary(db, 'KUROKO').sends).toBe(0);
		const drafts = db.logs.filter((l) => !l.undone && l.kind === 'draft');
		expect(drafts.every((l) => l.actor === 'KUROKO')).toBe(true);
		expect(todaySummary(db, 'KUROKO').drafts).toBe(drafts.length);
	});
});
