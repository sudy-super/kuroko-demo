import { describe, it, expect, beforeEach } from 'vitest';
import { seed } from '../seed';
import { minutesFor } from './generate';
import { SAMPLE_TRANSCRIPT } from './samples';
import { db as store, resetDb } from '../store.svelte';
import { addTranscript, acceptTaskSuggestions, rejectSuggestions, sendFollowUp } from '../actions';
import { todayCount, weekTasks } from '../derived';

describe('minutesFor', () => {
	const db = seed(new Date(2026, 8, 15));
	it('サンプルは固定の議事録', () => {
		const r = minutesFor(db, 'm-abc', SAMPLE_TRANSCRIPT);
		expect(r.minutes.decisions.length).toBe(3);
		expect(r.todos.length).toBe(3);
		expect(r.todos[0].reason).toContain('文字起こし');
	});
	it('任意の文からも候補を最大 3 件', () => {
		const r = minutesFor(db, 'm-abc', '来週までに資料を送付する。価格は据え置きで合意。次回は再来週に調整する。以上。');
		expect(r.todos.length).toBe(2);
		expect(r.minutes.decisions[0]).toContain('合意');
	});
});

describe('addTranscript / acceptTaskSuggestions / sendFollowUp', () => {
	beforeEach(() => {
		(globalThis as unknown as { localStorage: Storage }).localStorage = {
			getItem: () => null,
			setItem() {},
			removeItem() {}
		} as unknown as Storage;
		resetDb();
	});

	it('文字起こしから議事録と候補 3 件を作る', () => {
		addTranscript('m-abc', SAMPLE_TRANSCRIPT);
		const m = store.meetings.find((x) => x.id === 'm-abc')!;
		expect(m.minutes?.decisions.length).toBe(3);
		expect(m.transcriptIds.length).toBe(1);
		expect(store.suggestions.filter((s) => s.source === 'transcript' && s.status === 'pending').length).toBe(3);
		expect(store.logs[0].text).toContain('ToDo 候補 3 件');
	});

	it('採用した候補が ToDo と Today に出る', () => {
		addTranscript('m-abc', SAMPLE_TRANSCRIPT);
		const pending = store.suggestions.filter((s) => s.source === 'transcript' && s.status === 'pending');
		const before = weekTasks(store).length;
		const tasks = acceptTaskSuggestions(pending.slice(0, 2).map((s) => s.id));
		expect(tasks.length).toBe(2);
		expect(tasks.every((t) => store.tasks.some((x) => x.id === t.id) && t.origin === 'meeting')).toBe(true);
		// 候補の期限は 2〜4 営業日先なので Today の「今週の ToDo」に出る
		expect(weekTasks(store).length).toBe(before + 2);
		expect(store.suggestions.filter((s) => s.source === 'transcript' && s.status === 'pending').length).toBe(1);
	});

	it('残りを破棄すると候補が消える', () => {
		addTranscript('m-abc', SAMPLE_TRANSCRIPT);
		const pending = store.suggestions.filter((s) => s.source === 'transcript' && s.status === 'pending');
		rejectSuggestions([pending[0].id]);
		expect(store.suggestions.find((s) => s.id === pending[0].id)!.status).toBe('rejected');
	});

	it('フォローメールは外部送信の承認待ちになる', () => {
		addTranscript('m-abc', SAMPLE_TRANSCRIPT);
		const before = todayCount(store);
		const a = sendFollowUp('m-abc');
		expect(a.status).toBe('pending');
		expect(a.risk).toBe('external_send');
		expect(a.payload).toMatchObject({ type: 'followup', meetingId: 'm-abc' });
		expect(a.body).toBe(store.meetings.find((x) => x.id === 'm-abc')!.minutes!.followUpMail.body);
		// Today の承認待ちのタイルに乗る
		expect(todayCount(store)).toBe(before + 1);
	});

	it('議事録がない会議のフォローメールは失敗する', () => {
		expect(() => sendFollowUp('m-abc')).toThrow();
	});
});
