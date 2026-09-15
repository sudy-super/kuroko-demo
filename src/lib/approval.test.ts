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
	undo
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
	it('起動時に古い sending は pending に戻る', () => {
		const a = ext();
		a.status = 'sending';
		a.sendingAt = new Date(Date.now() - 11000).toISOString();
		restoreStaleSending();
		expect(a.status).toBe('pending');
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
