import type { Db, MessageThread, Reason, TodayItem, Meeting, CalendarEvent } from './types';
import { REASON_ORDER } from './types';
import { key, parse, addDays, minutes, toHm, hm } from './dates';

export const personOf = (db: Db, id?: string) => db.people.find((p) => p.id === id);
export const companyOf = (db: Db, id?: string) => db.companies.find((c) => c.id === id);
export const projectOf = (db: Db, id?: string) => db.projects.find((p) => p.id === id);
export const identityOf = (db: Db, id: string) => db.identities.find((i) => i.id === id);
export const personOfIdentity = (db: Db, identityId: string) =>
	personOf(db, identityOf(db, identityId)?.personId);
export const severestReason = (t: MessageThread): Reason | undefined =>
	REASON_ORDER.find((r) => t.reasons.includes(r));

export const queue = (db: Db) =>
	db.threads.filter((t) => t.inQueue && !t.done).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
export const replyNeeded = (db: Db) => queue(db).filter((t) => t.needsReply);
export const pendingApprovals = (db: Db) => db.approvals.filter((a) => a.status === 'pending');

const T = (db: Db) => db.seededOn; // 「今日」の基準。実時刻ではなくシードの基準日を使う

export const todayTasks = (db: Db) => db.tasks.filter((t) => t.due === T(db) && t.status !== 'done');
export const overdueTasks = (db: Db) =>
	db.tasks.filter((t) => t.due && t.due < T(db) && t.status !== 'done');
export const weekTasks = (db: Db) => {
	const k = T(db);
	const w = key(addDays(6, parse(k)));
	return db.tasks.filter((t) => t.due && t.due >= k && t.due <= w && t.status !== 'done');
};
export const todayEvents = (db: Db) =>
	db.events.filter((e) => e.date === T(db)).sort((a, b) => a.start.localeCompare(b.start));
// nextEvent だけは実時刻と比べる (今まさに次の予定を出すため)
export const nextEvent = (db: Db) => {
	const now = minutes(hm());
	return todayEvents(db).find((e) => minutes(e.end) > now);
};

export function nextMeeting(db: Db): { meeting: Meeting; event: CalendarEvent } | undefined {
	const k = T(db);
	const ev = db.events
		.filter((e) => e.meetingId && e.date >= k)
		.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
	const meeting = ev && db.meetings.find((m) => m.id === ev.meetingId);
	return meeting ? { meeting, event: ev } : undefined;
}

export function todayItems(db: Db): TodayItem[] {
	const items: TodayItem[] = [];
	const ap = pendingApprovals(db);
	if (ap.length)
		items.push({
			kind: 'approval',
			n: ap.length,
			label: `承認待ち ${ap.length} 件`,
			detail: ap.map((a) => a.title).join(' / '),
			href: '#approvals'
		});
	const rp = replyNeeded(db);
	if (rp.length)
		items.push({
			kind: 'reply',
			n: rp.length,
			label: `返信が必要な連絡 ${rp.length} 件`,
			detail: rp.map((t) => t.subject).join(' / '),
			href: `/inbox?t=${rp[0].id}`
		});
	const nm = nextMeeting(db);
	if (nm && nm.meeting.brief && !nm.meeting.briefRead)
		items.push({
			kind: 'brief',
			n: 1,
			label: '次の会議の準備',
			detail: `${nm.meeting.title} の Brief が届いています`,
			href: `/meetings/${nm.meeting.id}`
		});
	const tt = todayTasks(db);
	if (tt.length)
		items.push({
			kind: 'tasks',
			n: tt.length,
			label: `今日の ToDo ${tt.length} 件`,
			detail: tt.map((t) => t.title).join(' / '),
			href: '/tasks'
		});
	const sc = db.scheduling.filter((s) => s.status === 'sent');
	if (sc.length)
		items.push({
			kind: 'sched',
			n: sc.length,
			label: `日程調整の返信待ち ${sc.length} 件`,
			detail: sc.map((s) => personOf(db, s.personId)?.name ?? '').join(' / '),
			href: '/calendar'
		});
	return items;
}

export const todayCount = (db: Db) => todayItems(db).reduce((n, i) => n + i.n, 0);

export function freeSlots(db: Db, dateKey: string, from = '9:00', to = '18:00') {
	const busy = db.events
		.filter((e) => e.date === dateKey)
		.map((e) => [minutes(e.start), minutes(e.end)] as const)
		.sort((a, b) => a[0] - b[0]);
	const out: { start: string; end: string }[] = [];
	let cur = minutes(from);
	for (const [s, e] of busy) {
		if (s > cur) out.push({ start: toHm(cur), end: toHm(Math.min(s, minutes(to))) });
		cur = Math.max(cur, e);
	}
	if (cur < minutes(to)) out.push({ start: toHm(cur), end: toHm(minutes(to)) });
	return out.filter((x) => minutes(x.end) > minutes(x.start));
}

// 保存された進行状況ではなく、今の状態だけから案内の段階を決める
export function guideSection(db: Db): 0 | 1 | 2 | 3 | 4 | 5 {
	if (pendingApprovals(db).length > 0 && !db.scheduling.length) return 1;
	const s = db.scheduling[0];
	if (!s || s.status === 'draft') return 2;
	if (s.status === 'sent') return 3;
	if (db.tasks.filter((t) => t.origin === 'meeting').length < 2) return 4;
	return todayCount(db) === 0 ? 0 : 5;
}

export function todaySummary(db: Db) {
	const k = T(db);
	const L = db.logs.filter((l) => l.at.startsWith(k) && !l.undone);
	const c = (kind: string) => L.filter((l) => l.kind === kind).length;
	return { drafts: c('draft'), holds: c('hold'), sends: c('send'), registers: c('register') };
}
