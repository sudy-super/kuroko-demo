import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, resetDb } from './store.svelte';
import {
	addApproval,
	approve,
	undoApproval,
	reject,
	restoreStaleSending,
	SEND_DELAY_MS,
	setAutomation,
	addTask,
	toggleTask,
	undo,
	createEvent
} from './actions';
import { todayCount } from './derived';

beforeEach(() => {
	(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
	resetDb();
	vi.useFakeTimers();
});

const ext = () =>
	addApproval({
		title: 't',
		risk: 'external_send',
		kind: 'mail',
		to: 'a <a@b.jp>',
		body: 'x',
		effectLine: 'e',
		payload: { type: 'line', text: 'x' },
		origin: 'inbox'
	});

describe('approval', () => {
	it('external_send は承認後 5 秒で executed、取り消せる', () => {
		const a = ext();
		approve(a.id);
		expect(a.status).toBe('sending');
		undoApproval(a.id);
		expect(a.status).toBe('pending');
		approve(a.id);
		vi.advanceTimersByTime(SEND_DELAY_MS);
		expect(a.status).toBe('executed');
		expect(db.logs[0].approved).toBe(true);
	});
	it('risk x 自動化レベルの 9 通り', () => {
		const cases: [string, string, string][] = [
			['external_send', 'draft', 'pending'],
			['external_send', 'internal_auto', 'pending'],
			['external_send', 'trusted', 'pending'],
			['internal', 'draft', 'pending'],
			['internal', 'internal_auto', 'executed'],
			['internal', 'trusted', 'executed'],
			['internal_low', 'draft', 'pending'],
			['internal_low', 'internal_auto', 'executed'],
			['internal_low', 'trusted', 'executed']
		];
		for (const [risk, level, expected] of cases) {
			setAutomation(level as any);
			const a = addApproval({
				title: 't',
				risk: risk as any,
				kind: 'share',
				to: 'x',
				body: '',
				effectLine: '',
				payload: { type: 'share', personId: 'p-tanaka', what: 'w' },
				origin: 'meeting'
			});
			expect(a.status, `${risk}/${level}`).toBe(expected);
		}
	});
	it('却下は 1 手で rejected', () => {
		const a = ext();
		reject(a.id);
		expect(a.status).toBe('rejected');
	});
	it('送信待ちを却下すると 5 秒後も送信されない', () => {
		const a = ext();
		const n = db.line.length;
		approve(a.id);
		reject(a.id);
		expect(a.status).toBe('rejected');
		vi.advanceTimersByTime(SEND_DELAY_MS);
		expect(a.status).toBe('rejected');
		expect(db.line.length).toBe(n);
	});
	it('実行済みの承認は却下できない', () => {
		const a = ext();
		approve(a.id);
		vi.advanceTimersByTime(SEND_DELAY_MS);
		reject(a.id);
		expect(a.status).toBe('executed');
	});
	it('起動時に古い sending は pending に戻る', () => {
		const a = ext();
		a.status = 'sending';
		a.sendingAt = new Date(Date.now() - 11000).toISOString();
		restoreStaleSending();
		expect(a.status).toBe('pending');
	});
	it('却下を二度呼んでもログは 1 件', () => {
		const a = ext();
		reject(a.id);
		const n = db.logs.length;
		reject(a.id);
		expect(db.logs.length).toBe(n);
	});
	it('ToDo の登録を元に戻すと登録件数も戻る', () => {
		const n = db.demo.stats.tasksAdded;
		addTask({ title: 'x' }, 'chat');
		expect(db.demo.stats.tasksAdded).toBe(n + 1);
		undo(db.logs[0].id);
		expect(db.demo.stats.tasksAdded).toBe(n);
	});
	it('予定の登録を元に戻すと会議も消える', () => {
		const e = createEvent(
			{
				date: db.seededOn,
				start: '15:00',
				end: '16:00',
				title: '打ち合わせ',
				personIds: ['p-tanaka'],
				withMeeting: true
			},
			'calendar'
		);
		expect(db.meetings.find((m) => m.eventId === e.id)).toBeTruthy();
		undo(db.logs[0].id);
		expect(db.events.find((x) => x.id === e.id)).toBeUndefined();
		expect(db.meetings.find((m) => m.eventId === e.id)).toBeUndefined();
	});
	// ブラウザでは $state proxy への書き込みが元のオブジェクトに戻らないため、
	// action は db に入れた要素そのものを返す必要がある。node では同一性でしか検査できない
	it('action の返り値は db の中の要素と同一', () => {
		expect(ext()).toBe(db.approvals[0]);
		expect(addTask({ title: 'y' }, 'chat')).toBe(db.tasks[0]);
		const e = createEvent({ date: db.seededOn, start: '9:00', end: '9:30', title: 'z', personIds: [] }, 'calendar');
		expect(e).toBe(db.events[db.events.length - 1]);
	});
	it('ToDo の登録と完了は元に戻せる', () => {
		const n = todayCount(db);
		const t = addTask({ title: 'x', due: db.seededOn }, 'chat');
		expect(todayCount(db)).toBe(n + 1);
		undo(db.logs[0].id);
		expect(db.tasks.find((x) => x.id === t.id)).toBeUndefined();
		toggleTask('t-cards');
		expect(todayCount(db)).toBe(n - 1);
		undo(db.logs[0].id);
		expect(todayCount(db)).toBe(n);
	});
});
