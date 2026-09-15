import type {
	Approval,
	Connection,
	ActivityLog,
	LogKind,
	Origin,
	Task,
	UndoPayload,
	SchedulingRequest,
	CalendarEvent,
	Meeting,
	Automation,
	Suggestion
} from './types';
import { db, save, resetDb } from './store.svelte';
import { toast } from './ui.svelte';
import { nowIso, parse, fmtMDW, minutes, toHm } from './dates';
import { personOf } from './derived';
import { slotsFor, slotsText, uid } from './kuroko/generate';
import { integrations } from './integrations';

export const SEND_DELAY_MS = 5000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function log(
	text: string,
	kind: LogKind,
	o: { actor?: 'user' | 'KUROKO'; origin?: Origin; approved?: boolean; undo?: UndoPayload } = {}
): ActivityLog {
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
	db.logs.unshift(l);
	// $state proxy への書き込みは元のオブジェクトに反映されないので、db 側の要素を返す
	return db.logs[0];
}

// 社外への送信だけは自動化レベルによらず必ず承認を求める
const autoExecutes = (risk: Approval['risk'], level: Automation) => risk !== 'external_send' && level !== 'draft';

export function addApproval(input: Omit<Approval, 'id' | 'status' | 'createdAt'>): Approval {
	db.approvals.unshift({ ...input, id: uid('ap'), status: 'pending', createdAt: nowIso() });
	const a = db.approvals[0];
	if (autoExecutes(a.risk, db.settings.automation)) {
		executeApproval(a.id, true);
	}
	save();
	return a;
}

export function approve(id: string, origin: Origin = 'approval') {
	const a = db.approvals.find((x) => x.id === id);
	if (!a || a.status !== 'pending') return;
	if (a.risk === 'external_send') {
		a.status = 'sending';
		a.sendingAt = nowIso();
		a.origin = origin;
		timers.set(
			id,
			setTimeout(() => executeApproval(id), SEND_DELAY_MS)
		);
		toast('5 秒後に送信します', {
			seconds: 5,
			undo: () => undoApproval(id),
			done: '送信しました (デモのため実送信していません)'
		});
	} else {
		executeApproval(id);
		// 押された時点ではなく、今できたログを取り消す。取り消せない種類には取り消しを出さない
		const l = db.logs[0];
		toast('実行しました', l?.undo ? { undo: () => undo(l.id) } : {});
	}
	save();
}

export function undoApproval(id: string) {
	const a = db.approvals.find((x) => x.id === id);
	if (!a || a.status !== 'sending') return;
	clearTimeout(timers.get(id));
	timers.delete(id);
	a.status = 'pending';
	a.sendingAt = undefined;
	save();
}

export function reject(id: string, origin: Origin = 'approval') {
	const a = db.approvals.find((x) => x.id === id);
	if (!a || (a.status !== 'pending' && a.status !== 'sending')) return;
	// 送信待ちを却下したら、待っている送信も止める
	clearTimeout(timers.get(id));
	timers.delete(id);
	a.status = 'rejected';
	a.sendingAt = undefined;
	log(`${a.title}を却下しました`, 'other', { actor: 'user', origin });
	save();
}

// 送信待ちのままタブが閉じられた分は、起動時に承認待ちへ戻す
export function restoreStaleSending() {
	for (const a of db.approvals)
		if (a.status === 'sending' && a.sendingAt && Date.now() - Date.parse(a.sendingAt) > 10000) {
			a.status = 'pending';
			a.sendingAt = undefined;
		}
	save();
}

export function executeApproval(id: string, auto = false) {
	const a = db.approvals.find((x) => x.id === id);
	// 却下済みと実行済みは動かさない。待機中のタイマーが後から発火しても素通りさせる
	if (!a || (a.status !== 'pending' && a.status !== 'sending')) return;
	a.status = 'executed';
	a.executedAt = nowIso();
	timers.delete(id);
	const p = a.payload;
	const ext = a.risk === 'external_send';
	if (p.type === 'reply') {
		const th = db.threads.find((t) => t.id === p.threadId)!;
		integrations.mail.sendMessage(th, p.body);
		th.needsReply = false;
		th.done = true;
		const s = p.schedulingId && db.scheduling.find((x) => x.id === p.schedulingId);
		if (s) {
			s.status = 'sent';
			s.token = uid('tok');
			s.threadId = th.id;
		}
		db.demo.stats.replied++;
		log(`${a.to.split(' <')[0]}へメールを送信しました`, 'send', { actor: 'user', origin: a.origin, approved: true });
	} else if (p.type === 'share') {
		log(`${a.title}を実行しました`, 'send', { actor: 'user', origin: a.origin, approved: true });
	} else if (p.type === 'agenda') {
		const m = db.meetings.find((x) => x.id === p.meetingId)!;
		m.agendaShared = true;
		log('アジェンダを参加者に共有しました', 'send', {
			actor: 'user',
			origin: a.origin,
			approved: true,
			undo: { kind: 'agenda_share', meetingId: m.id }
		});
	} else if (p.type === 'document') {
		log(`${a.title}を送信しました`, 'send', { actor: 'user', origin: a.origin, approved: true });
	} else if (p.type === 'followup') {
		log('フォローメールを送信しました', 'send', { actor: 'user', origin: a.origin, approved: true });
	} else if (p.type === 'line') {
		integrations.chat.post('line', p.text);
		log('LINE に返信しました', 'send', { actor: 'user', origin: a.origin, approved: true });
	}
	if (auto) {
		db.logs[0].approved = false;
		db.logs[0].text += ' (自動化レベルにより承認を省略)';
	}
	if (ext && !auto) db.demo.stats.approved++;
	save();
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
	db.tasks.unshift({ id: uid('t'), priority: 'normal', status: 'todo', origin, createdAt: nowIso(), ...input });
	const t = db.tasks[0];
	db.demo.stats.tasksAdded++;
	log(`ToDo「${t.title}」を登録しました`, 'register', {
		actor: origin === 'chat' || origin === 'line' || origin === 'meeting' ? 'KUROKO' : 'user',
		origin,
		undo: { kind: 'task_add', taskId: t.id }
	});
	save();
	return t;
}

export function toggleTask(id: string, origin: Origin = 'tasks') {
	const t = db.tasks.find((x) => x.id === id);
	if (!t) return;
	t.status = t.status === 'done' ? 'todo' : 'done';
	if (t.status === 'done') {
		db.demo.stats.tasksDone++;
		log(`ToDo「${t.title}」を完了にしました`, 'other', {
			actor: 'user',
			origin,
			undo: { kind: 'task_done', taskId: t.id }
		});
	}
	save();
}

// 候補の出所をそのまま登録経路にする (ToDo の行に出る)
const SUGGESTION_ORIGIN: Record<Suggestion['source'], Origin> = {
	chat: 'chat',
	transcript: 'meeting',
	ocr: 'people',
	email: 'inbox',
	line: 'line'
};

/** ToDo 候補を登録する。KUROKO が勝手に登録することはない (仕様 5.4) ので、必ずここを通す */
export function acceptTaskSuggestions(ids: string[]): Task[] {
	const out: Task[] = [];
	for (const id of ids) {
		const s = db.suggestions.find((x) => x.id === id);
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

export function undo(logId: string) {
	const l = db.logs.find((x) => x.id === logId);
	if (!l || !l.undo || l.undone) return;
	const u = l.undo;
	if (u.kind === 'task_add') {
		db.tasks = db.tasks.filter((t) => t.id !== u.taskId);
		db.demo.stats.tasksAdded = Math.max(0, db.demo.stats.tasksAdded - 1);
	}
	if (u.kind === 'task_done') {
		const t = db.tasks.find((x) => x.id === u.taskId);
		if (t) t.status = 'todo';
		db.demo.stats.tasksDone = Math.max(0, db.demo.stats.tasksDone - 1);
	}
	if (u.kind === 'event_add') {
		db.events = db.events.filter((e) => e.id !== u.eventId);
		// createEvent(withMeeting) が一緒に作った会議を残さない
		db.meetings = db.meetings.filter((m) => m.eventId !== u.eventId);
	}
	if (u.kind === 'agenda_share') {
		const m = db.meetings.find((x) => x.id === u.meetingId);
		if (m) m.agendaShared = false;
	}
	if (u.kind === 'link_identity') {
		const i = db.identities.find((x) => x.id === u.identityId);
		if (i) {
			i.personId = undefined;
			for (const t of db.threads) if (t.identityId === i.id) t.personId = undefined;
		}
	}
	l.undone = true;
	save();
}

export function insertSlots(threadId: string): SchedulingRequest {
	const th = db.threads.find((t) => t.id === threadId)!;
	const existing = db.scheduling.find((s) => s.threadId === threadId && s.status === 'draft');
	if (existing) return existing;
	const slots = slotsFor(db, th.personId ?? '');
	const s: SchedulingRequest = {
		id: uid('sr'),
		token: '',
		personId: th.personId ?? '',
		duration: 60,
		range: { from: slots[0].date, to: slots[3].date },
		online: 'meet',
		slots,
		status: 'draft',
		threadId,
		text: slotsText(slots, personOf(db, th.personId)?.name.split(' ')[0] ?? '')
	};
	db.scheduling.push(s);
	log('日程候補 3 件を提案しました', 'draft', { origin: 'inbox' });
	save();
	return db.scheduling[db.scheduling.length - 1];
}

export function sendReply(threadId: string, body: string, origin: Origin = 'inbox'): Approval {
	const th = db.threads.find((t) => t.id === threadId)!;
	const p = personOf(db, th.personId);
	const idn = db.identities.find((i) => i.id === th.identityId)!;
	const draft = db.scheduling.find((s) => s.threadId === threadId && s.status === 'draft');
	const to = p ? `${p.name} <${idn.value}>` : idn.value;
	return addApproval({
		title: `${p?.name.split(' ')[0] ?? '相手'}様への返信`,
		risk: 'external_send',
		kind: 'mail',
		to,
		subject: `Re: ${th.subject}`,
		body,
		effectLine: `承認すると、${p?.name.replace(' ', '') ?? ''}様 (${idn.value}) にこのメールが送信されます${draft ? '。相手が候補を選ぶと、その日時で予定が確定します' : ''}`,
		payload: { type: 'reply', threadId, body, schedulingId: draft?.id },
		origin
	});
}

export function markDone(threadId: string) {
	const th = db.threads.find((t) => t.id === threadId);
	if (th) {
		th.done = true;
		th.needsReply = false;
		save();
	}
}

export function confirmSlot(token: string, slotId: string) {
	const s = db.scheduling.find((x) => x.token === token && (x.status === 'sent' || x.status === 'confirmed'));
	if (!s) return null;
	const slot = s.slots.find((x) => x.id === slotId);
	if (!slot) return null;
	// 確定済みの枠を選び直した場合は、前の予定と会議を捨ててから作り直す
	const redo = s.status === 'confirmed';
	if (redo) {
		db.events = db.events.filter((e) => e.id !== s.eventId);
		db.meetings = db.meetings.filter((m) => m.id !== s.meetingId);
	}
	const p = personOf(db, s.personId)!;
	const event: CalendarEvent = {
		id: uid('ev'),
		date: slot.date,
		start: slot.start,
		end: slot.end,
		title: `${db.companies.find((c) => c.id === p.companyId)?.name ?? ''} 打ち合わせ`,
		place: 'オンライン',
		online: 'meet',
		url: integrations.conference.createMeetingUrl('meet'),
		personIds: [p.id],
		companyId: p.companyId,
		projectId: p.projectIds[0],
		source: 'kuroko',
		purpose: '次回の打ち合わせ'
	};
	const meeting: Meeting = {
		id: uid('m'),
		eventId: event.id,
		title: event.title,
		personIds: [p.id],
		companyId: p.companyId,
		projectId: p.projectIds[0],
		purpose: event.purpose!,
		briefRead: false,
		agenda: [],
		agendaShared: false,
		transcriptIds: [],
		brief: integrations.document.brief(db, p.id, p.projectIds[0])
	};
	meeting.brief!.note = '通常は前日夜に届きます (デモのため即時生成)';
	event.meetingId = meeting.id;
	db.events.push(event);
	db.meetings.push(meeting);
	s.status = 'confirmed';
	s.chosenSlotId = slotId;
	s.eventId = event.id;
	s.meetingId = meeting.id;
	if (!redo) db.demo.stats.confirmed++;
	// 相手が確定した予定は「元に戻す」の対象にしない。戻すのは /schedule の「日時を変更する」「キャンセルする」
	log(`${fmtMDW(parse(slot.date))} ${slot.start} に ${p.name} 様との打ち合わせを確定しました`, 'hold', {
		origin: 'schedule',
		approved: true
	});
	save();
	return { event: db.events[db.events.length - 1], meeting: db.meetings[db.meetings.length - 1] };
}

export function changeSlot(token: string) {
	const s = db.scheduling.find((x) => x.token === token);
	if (!s || s.status !== 'confirmed') return;
	db.events = db.events.filter((e) => e.id !== s.eventId);
	db.meetings = db.meetings.filter((m) => m.id !== s.meetingId);
	s.status = 'sent';
	s.chosenSlotId = s.eventId = s.meetingId = undefined;
	db.demo.stats.confirmed = Math.max(0, db.demo.stats.confirmed - 1);
	save();
}

export function cancelScheduling(token: string) {
	const s = db.scheduling.find((x) => x.token === token);
	if (!s || (s.status !== 'sent' && s.status !== 'confirmed')) return;
	db.events = db.events.filter((e) => e.id !== s.eventId);
	db.meetings = db.meetings.filter((m) => m.id !== s.meetingId);
	s.status = 'cancelled';
	log(`${personOf(db, s.personId)?.name} 様との打ち合わせがキャンセルされました`, 'other', { origin: 'schedule' });
	save();
}

export function createEvent(
	input: Omit<CalendarEvent, 'id' | 'source'> & { withMeeting?: boolean },
	origin: Origin = 'calendar'
): CalendarEvent {
	const { withMeeting, ...rest } = input;
	const e: CalendarEvent = { ...rest, id: uid('ev'), source: 'kuroko' };
	if (e.online) e.url = integrations.conference.createMeetingUrl(e.online);
	const ev = integrations.calendar.createEvent(db, e);
	if (withMeeting) {
		const m: Meeting = {
			id: uid('m'),
			eventId: e.id,
			title: e.title,
			personIds: e.personIds,
			companyId: e.companyId,
			projectId: e.projectId,
			purpose: e.purpose ?? '',
			briefRead: false,
			agenda: [],
			agendaShared: false,
			transcriptIds: [],
			brief: integrations.document.brief(db, e.personIds[0], e.projectId)
		};
		m.brief!.note = '通常は前日夜に届きます (デモのため即時生成)';
		ev.meetingId = m.id;
		db.meetings.push(m);
	}
	log(`予定「${ev.title}」を登録しました`, 'hold', {
		actor: 'user',
		origin,
		undo: { kind: 'event_add', eventId: ev.id }
	});
	save();
	return ev;
}

export function deleteEvent(id: string, origin: Origin = 'calendar') {
	const e = db.events.find((x) => x.id === id);
	if (!e) return;
	integrations.calendar.deleteEvent(db, id);
	// 予定と一緒に作った会議も残さない
	db.meetings = db.meetings.filter((m) => m.eventId !== id);
	log(`予定「${e.title}」を削除しました`, 'other', { actor: 'user', origin });
	save();
}

// 時刻は '9:00' のように 1 桁時もあるので、文字列ではなく分に直して足す
export function addBuffer(eventId: string, min: number) {
	const e = db.events.find((x) => x.id === eventId);
	if (!e) return;
	e.bufferBefore = min;
	e.start = toHm(minutes(e.start) + min);
	e.end = toHm(minutes(e.end) + min);
	save();
}

export function setAutomation(level: Automation) {
	db.settings.automation = level;
	save();
}
export function toggleConnection(id: 'gmail' | 'gcal' | 'slack' | 'line') {
	const c = db.settings.connections.find((x) => x.id === id)!;
	c.connected = !c.connected;
	c.lastSync = c.connected ? nowIso() : undefined;
	save();
}
// 一覧から 1 つずつ繋ぐ。toggleConnection は反転なので、600ms の待ちの間に
// connectAll が走ると繋いだはずの 1 件が外れる。繋ぐ向きにしか動かさない
export function connect(id: Connection['id']) {
	const c = db.settings.connections.find((x) => x.id === id)!;
	if (!c.connected) toggleConnection(id);
}
export function connectAll() {
	for (const c of db.settings.connections) {
		c.connected = true;
		c.lastSync = nowIso();
	}
	save();
}
export function resetDemo() {
	for (const t of timers.values()) clearTimeout(t);
	timers.clear();
	resetDb();
}
// 接続直後は案内を出さない。案内は Today の「デモを開始する」から始める
export function markStarted() {
	db.demo.started = true;
	save();
}
export function startGuide() {
	db.demo.started = true;
	db.demo.guide.on = true;
	save();
}
export function stopGuide() {
	db.demo.guide.on = false;
	save();
}
export function startScenario(n: number) {
	db.demo.scenario = n;
	save();
}
export function noteRecent(href: string) {
	db.demo.recent = [href, ...db.demo.recent.filter((h) => h !== href)].slice(0, 5);
	save();
}
