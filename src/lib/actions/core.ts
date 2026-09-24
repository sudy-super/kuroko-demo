import type { ActivityLog, LogKind, Origin, UndoPayload, Demo } from '../types';
import { db } from '../store.svelte';
import { nowIso } from '../dates';
import { identityOf, meetingOf, taskOf } from '../derived';
import { uid } from '../kuroko/generate';

/* 作業履歴 (log) とその取り消し、各操作が共有する小さな道具 */

// 送信待ち (approve) のタイマー。却下・取り消し・デモのやり直しで止める
export const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** 見つからないのは呼び出し側が出すべきでない操作を出したということなので、黙らず落とす */
export function must<T>(x: T | null | undefined, msg: string): T {
	if (!x) throw new Error(msg);
	return x;
}

// $state proxy への書き込みは元のオブジェクトに反映されないので、積んだ後の db 側の要素を返す
export const pushed = <T>(list: T[], x: NoInfer<T>): T => list[list.push(x) - 1];
export const unshifted = <T>(list: T[], x: NoInfer<T>): T => (list.unshift(x), list[0]);

export function stopTimer(id: string) {
	clearTimeout(timers.get(id));
	timers.delete(id);
}

export function closeThread(th: { needsReply: boolean; done: boolean }) {
	th.needsReply = false;
	th.done = true;
}

type Stat = keyof Demo['stats'];

/** 作業履歴を 1 件積む。count を渡すと完了画面の実績も 1 つ数える (取り消しでは uncount で戻す) */
export function log(
	text: string,
	kind: LogKind,
	o: { actor?: 'user' | 'KUROKO'; origin?: Origin; approved?: boolean; undo?: UndoPayload; count?: Stat } = {}
): ActivityLog {
	if (o.count) db.demo.stats[o.count]++;
	const l: ActivityLog = {
		id: uid('log'),
		at: nowIso(),
		actor: o.actor ?? 'KUROKO',
		kind,
		text,
		origin: o.origin ?? 'today',
		approved: o.approved ?? false,
		undo: o.undo
	};
	return unshifted(db.logs, l);
}

export const uncount = (k: Stat) => (db.demo.stats[k] = Math.max(0, db.demo.stats[k] - 1));

export function undo(logId: string) {
	const l = db.logs.find((x) => x.id === logId);
	if (!l || !l.undo || l.undone) return;
	const u = l.undo;
	if (u.kind === 'task_add') {
		db.tasks = db.tasks.filter((t) => t.id !== u.taskId);
		uncount('tasksAdded');
	}
	if (u.kind === 'task_done') {
		const t = taskOf(db, u.taskId);
		if (t) t.status = 'todo';
		uncount('tasksDone');
	}
	if (u.kind === 'event_add') {
		db.events = db.events.filter((e) => e.id !== u.eventId);
		// createEvent(withMeeting) が一緒に作った会議を残さない
		db.meetings = db.meetings.filter((m) => m.eventId !== u.eventId);
	}
	if (u.kind === 'event_delete') {
		db.events.push(u.event);
		db.meetings.push(...u.meetings);
	}
	if (u.kind === 'agenda_share') {
		const m = meetingOf(db, u.meetingId);
		if (m) m.agendaShared = false;
	}
	if (u.kind === 'link_identity') {
		const i = identityOf(db, u.identityId);
		if (i) {
			i.personId = undefined;
			for (const t of db.threads) if (t.identityId === i.id) t.personId = undefined;
		}
	}
	l.undone = true;
}
