import type { Origin, Task, Suggestion } from '../types';
import { db, save } from '../store.svelte';
import { nowIso } from '../dates';
import { doneLogOf, orderTasks, taskOf, suggestionOf } from '../derived';
import { uid } from '../kuroko/generate';
import { log, undo, unshifted } from './core';

/** 一覧の先頭の行から足すとき (tasks/+page.svelte)。自分で並べた順になっているなら一番上に置く
    (期限順のときは期限の位置に入る)。Google ToDo リストの「タスクを追加」と同じ */
export function addTaskOnTop(title: string, due: string | undefined): Task {
	const t = addTask({ title, due }, 'tasks');
	if (db.taskOrder) {
		db.taskOrder = [t.id, ...db.taskOrder];
		save();
	}
	return t;
}

export function addTask(
	input: {
		title: string;
		due?: string;
		time?: string;
		priority?: Task['priority'];
		personId?: string;
		companyId?: string;
		projectId?: string;
		meetingId?: string;
		memo?: string;
	},
	origin: Origin
): Task {
	const t = unshifted(db.tasks, { id: uid('t'), priority: 'normal', status: 'todo', origin, createdAt: nowIso(), ...input });
	db.demo.stats.tasksAdded++;
	log(`ToDo「${t.title}」を登録しました`, 'register', {
		actor: origin === 'chat' || origin === 'line' || origin === 'meeting' ? 'KUROKO' : 'user',
		origin,
		undo: { kind: 'task_add', taskId: t.id }
	});
	save();
	return t;
}

/** 見えている一覧 (ids、上から順) の中で、id を to 番目へ動かす。動かした時点で並び順は
    「自分で並べた順」になる (Apple のリマインダーと同じ。task-reorder.md)。
    絞り込みで見えていない ToDo の位置は変えない: 見えている分の枠の並びだけを差し替える */
export function moveTask(visible: string[], id: string, to: number) {
	const from = visible.indexOf(id);
	if (from < 0 || to < 0 || to >= visible.length || from === to) return;
	const next = [...visible];
	next.splice(to, 0, ...next.splice(from, 1));
	const base = orderTasks(db, db.tasks).map((t) => t.id);
	const seen = new Set(visible);
	let k = 0;
	db.taskOrder = base.map((x) => (seen.has(x) ? next[k++] : x));
	save();
}

/** 自分で並べた順を捨てて期限順に戻す */
export function sortTasksByDue() {
	db.taskOrder = undefined;
	save();
}

/** 星 (Google ToDo リストと同じ)。付けると優先度を高、外すと既定の中にする */
export function toggleStar(id: string) {
	const t = taskOf(db, id);
	if (!t) return;
	t.priority = t.priority === 'high' ? 'normal' : 'high';
	save();
}

export function toggleTask(id: string, origin: Origin = 'tasks') {
	const t = taskOf(db, id);
	if (!t) return;
	if (t.status === 'done') {
		// 完了を外すのは「完了にしました」の取り消しと同じこと。ログと実績の戻しを undo に任せる
		const l = doneLogOf(db, t.id);
		if (l) return undo(l.id);
		// 初期データの完了済みなど、この画面で完了にしたのではないものは実績を減らさない
		t.status = 'todo';
		save();
		return;
	}
	t.status = 'done';
	db.demo.stats.tasksDone++;
	log(`ToDo「${t.title}」を完了にしました`, 'other', {
		actor: 'user',
		origin,
		undo: { kind: 'task_done', taskId: t.id }
	});
	save();
}

// 候補の出所をそのまま登録経路にする (ToDo の行に出る)
const SUGGESTION_ORIGIN: Record<Suggestion['source'], Origin> = {
	chat: 'chat',
	transcript: 'meeting',
	email: 'inbox',
	line: 'line'
};

/** ToDo 候補を登録する。KUROKO が勝手に登録することはない (仕様 5.4) ので、必ずここを通す */
export function acceptTaskSuggestions(ids: string[]): Task[] {
	const out: Task[] = [];
	for (const id of ids) {
		const s = suggestionOf(db, id);
		if (!s || s.status !== 'pending' || s.payload.type !== 'task') continue;
		const { type, ...input } = s.payload;
		out.push(addTask(input, SUGGESTION_ORIGIN[s.source]));
		s.status = 'accepted';
	}
	save();
	return out;
}

export function rejectSuggestions(ids: string[]) {
	for (const s of db.suggestions) if (ids.includes(s.id) && s.status === 'pending') s.status = 'rejected';
	save();
}
