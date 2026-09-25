import { describe, it, expect } from 'vitest';
import { seed, SEED } from './seed';
import type { Suggestion } from './types';
import { filterTasks, openTaskCount, doneLogOf, todayTasks } from './derived';
import { addTask, toggleTask, undo, acceptTaskSuggestions, rejectSuggestions, moveTask, sortTasksByDue } from './actions';
import { replaceDb, db } from './store.svelte';

const BASE = new Date(2026, 8, 15); // 火曜。シードの相対日付がこの日を基準になる

describe('filterTasks', () => {
	it('期限超過は基準日より前の期限だけ (完了も含めて出す)', () => {
		const d = seed(BASE);
		expect(filterTasks(d, 'overdue').map((t) => t.id)).toEqual([SEED.expenseTask]);
		// 完了済みしかないので、チップの件数は 0 になる
		expect(openTaskCount(d, 'overdue')).toBe(0);
	});
	it('今日は期限が基準日のもの', () => {
		const d = seed(BASE);
		expect(filterTasks(d, 'today').map((t) => t.id)).toEqual([
			SEED.abcProposalTask,
			SEED.xyzQuoteTask,
			SEED.cardsTask
		]);
		expect(openTaskCount(d, 'today')).toBe(3);
	});
	it('今週は基準日から 6 日後まで', () => {
		const d = seed(BASE);
		expect(filterTasks(d, 'week').map((t) => t.id)).toEqual([
			SEED.abcProposalTask,
			SEED.xyzQuoteTask,
			SEED.cardsTask,
			SEED.trainingTask,
			SEED.standupDocTask
		]);
		expect(openTaskCount(d, 'week')).toBe(5);
	});
	it('すべては期限のないものも含み、完了は後ろに回る', () => {
		const d = seed(BASE);
		d.tasks.push({
			id: 't-nodue',
			title: '期限なし',
			priority: 'normal',
			status: 'todo',
			origin: 'tasks',
			createdAt: '2026-09-15T09:00:00'
		});
		const ids = filterTasks(d, 'all').map((t) => t.id);
		expect(ids).toHaveLength(7);
		expect(ids.at(-1)).toBe(SEED.expenseTask); // 完了は最後
		expect(ids.at(-2)).toBe('t-nodue'); // 期限なしは未完了の最後
		expect(openTaskCount(d, 'all')).toBe(6);
	});
	it('完了にすると同じフィルタの末尾へ下がる', () => {
		const d = seed(BASE);
		d.tasks.find((t) => t.id === SEED.abcProposalTask)!.status = 'done';
		expect(filterTasks(d, 'today').map((t) => t.id)).toEqual([
			SEED.xyzQuoteTask,
			SEED.cardsTask,
			SEED.abcProposalTask
		]);
		expect(openTaskCount(d, 'today')).toBe(2);
	});
	it('todayTasks は未完了だけを返す', () => {
		const d = seed(BASE);
		expect(todayTasks(d)).toHaveLength(3);
	});
});

describe('doneLogOf', () => {
	it('完了ログを引いて取り消せる', () => {
		replaceDb(seed(BASE));
		const t = addTask({ title: '見積を送る', due: '2026-09-15' }, 'tasks');
		toggleTask(t.id);
		const l = doneLogOf(db, t.id)!;
		expect(l.undo).toEqual({ kind: 'task_done', taskId: t.id });
		undo(l.id);
		expect(db.tasks.find((x) => x.id === t.id)!.status).toBe('todo');
		// 取り消し済みのログは二度と拾わない
		expect(doneLogOf(db, t.id)).toBeUndefined();
	});
	it('チェックを外すと、ログも本日の実績も戻る', () => {
		replaceDb(seed(BASE));
		const t = addTask({ title: '名刺を登録する' }, 'tasks');
		const before = db.demo.stats.tasksDone;
		toggleTask(t.id);
		const l = doneLogOf(db, t.id)!;
		expect(db.demo.stats.tasksDone).toBe(before + 1);
		toggleTask(t.id);
		expect(db.tasks.find((x) => x.id === t.id)!.status).toBe('todo');
		expect(db.demo.stats.tasksDone).toBe(before);
		expect(db.logs.find((x) => x.id === l.id)!.undone).toBe(true);
	});
	it('初期データの完了済みを外しても実績は減らない', () => {
		replaceDb(seed(BASE));
		const before = db.demo.stats.tasksDone;
		toggleTask(SEED.expenseTask);
		expect(db.tasks.find((x) => x.id === SEED.expenseTask)!.status).toBe('todo');
		expect(db.demo.stats.tasksDone).toBe(before);
	});
	it('同じ ToDo を何度も完了にしたら直近のログを返す', () => {
		replaceDb(seed(BASE));
		const t = addTask({ title: '資料を直す' }, 'tasks');
		toggleTask(t.id);
		const first = doneLogOf(db, t.id)!.id;
		undo(first);
		toggleTask(t.id);
		expect(doneLogOf(db, t.id)!.id).not.toBe(first);
	});
});

const sug = (id: string, title: string): Suggestion => ({
	id,
	source: 'transcript',
	kind: 'task',
	status: 'pending',
	reason: '文字起こしの「来週中に見積を」から抽出',
	payload: { type: 'task', title, due: '2026-09-18' },
	createdAt: '2026-09-15T10:00:00'
});

describe('ToDo 候補', () => {
	it('選んだ分だけ登録し、出所を登録経路にする', () => {
		replaceDb(seed(BASE));
		db.suggestions.push(sug('sg-1', '見積を作る'), sug('sg-2', '議事録を送る'));
		const made = acceptTaskSuggestions(['sg-1']);
		expect(made.map((t) => [t.title, t.origin, t.due])).toEqual([
			['見積を作る', 'meeting', '2026-09-18']
		]);
		expect(['sg-1', 'sg-2'].map((id) => db.suggestions.find((s) => s.id === id)!.status)).toEqual([
			'accepted',
			'pending'
		]);
	});
	it('同じ候補を二度登録しない', () => {
		replaceDb(seed(BASE));
		db.suggestions.push(sug('sg-1', '見積を作る'));
		acceptTaskSuggestions(['sg-1']);
		expect(acceptTaskSuggestions(['sg-1'])).toEqual([]);
		expect(db.tasks.filter((t) => t.title === '見積を作る')).toHaveLength(1);
	});
	it('破棄しても ToDo は増えない', () => {
		replaceDb(seed(BASE));
		db.suggestions.push(sug('sg-1', '見積を作る'));
		const before = db.tasks.length;
		rejectSuggestions(['sg-1']);
		expect(db.suggestions.find((s) => s.id === 'sg-1')!.status).toBe('rejected');
		expect(db.tasks).toHaveLength(before);
	});
});

describe('moveTask', () => {
	it('絞り込みで見えている分だけを並べ替え、見えていない ToDo の位置は変えない', () => {
		replaceDb(seed(BASE));
		const all = filterTasks(db, 'all').map((t) => t.id);
		const today = filterTasks(db, 'today').map((t) => t.id);
		// 今日の 3 件のうち先頭を末尾へ
		moveTask(today, today[0], 2);
		expect(filterTasks(db, 'today').map((t) => t.id)).toEqual([today[1], today[2], today[0]]);
		// 今日に入らない ToDo は、元の並びの位置のまま
		const rest = (ids: string[]) => ids.filter((id) => !today.includes(id));
		expect(rest(filterTasks(db, 'all').map((t) => t.id))).toEqual(rest(all));
		sortTasksByDue();
		expect(filterTasks(db, 'all').map((t) => t.id)).toEqual(all);
	});
});
