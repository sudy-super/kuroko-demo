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
	Suggestion,
	Person,
	ChatMessage,
	Document,
	CardFields,
	Project
} from './types';
import { db, save, resetDb } from './store.svelte';
import { toast, dismissToast, type ContextChip } from './ui.svelte';
import { nowIso, parse, fmtMDW, minutes, toHm, hm } from './dates';
import {
	addressOf,
	personOf,
	companyOf,
	identityOf,
	meetingOf,
	eventOf,
	threadOf,
	documentOf,
	projectOf,
	doneLogOf,
	firstFreeStart,
	todayCount,
	mailTargetOf,
	personMailTargetOf,
	orderTasks
} from './derived';
import { agendaFor, slotsFor, slotsText, uid, minutesFor } from './kuroko/generate';
import { ASK_PERSON, reply, route } from './kuroko/route';
import { handleMention } from './kuroko/line';
import { goto } from '$app/navigation';
import { integrations } from './integrations';
import { resetLayout } from './todayLayout.svelte';

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
		// Gmail の送信取り消しと同じく、「送信しました」を先に出して 5 秒だけ取り消せる。
		// key: id で、別の送信の取り消しがこのトーストを閉じないようにする
		toast('送信しました (デモのため実送信していません)', {
			seconds: SEND_DELAY_MS / 1000,
			undo: () => undoApproval(id),
			key: id
		});
	} else {
		executeApproval(id);
		// 押された時点ではなく、今できたログを取り消す。取り消せない種類には取り消しを出さない
		const l = db.logs[0];
		toast('実行しました', l?.undo ? { undo: () => undo(l.id) } : {});
	}
	save();
}

/**
 * LINE / Slack のカードからの承認。社外への送信を伴うので、承認できるのはオーナーだけ
 * (仕様 5.13 と handleMention の role の切り分けと同じ考え方)。member には呼ばせない
 */
export function lineApprove(id: string, role: 'owner' | 'member', channel: 'line' | 'slack') {
	if (role !== 'owner') return false;
	approve(id, channel);
	return true;
}

export function undoApproval(id: string) {
	const a = db.approvals.find((x) => x.id === id);
	if (!a || a.status !== 'sending') return;
	clearTimeout(timers.get(id));
	timers.delete(id);
	a.status = 'pending';
	a.sendingAt = undefined;
	save();
	// この承認の送信のトーストだけを閉じる。別の送信が表示中なら閉じない
	dismissToast(id);
}

export function editApproval(id: string, body: string) {
	const a = db.approvals.find((x) => x.id === id);
	if (!a || a.status !== 'pending') return;
	a.body = body;
	// reply 以外の payload は本文を持たないので、種類ごとに更新先を分ける
	if (a.payload.type === 'reply') a.payload.body = body;
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
	toast('却下しました');
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
		const th = threadOf(db, p.threadId)!;
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
		// 送った先はスレッドの出所そのもの。sendReply が決めた kind と文言を食い違わせない
		const via = a.kind === 'mail' ? 'メール' : a.kind === 'line' ? 'LINE' : 'Slack';
		log(`${a.to.split(' <')[0].split(' (')[0]}へ${via}を送信しました`, 'send', { actor: 'user', origin: a.origin, approved: true });
	} else if (p.type === 'share') {
		log(`${a.title}を実行しました`, 'send', { actor: 'user', origin: a.origin, approved: true });
	} else if (p.type === 'agenda') {
		const m = meetingOf(db, p.meetingId)!;
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
		// 相手のスレッドがあれば reply と同じように閉じる。無い会議 (threadId は省略可能) では何もしない
		const th = threadOf(db, p.threadId);
		if (th) {
			th.needsReply = false;
			th.done = true;
		}
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
	const t = db.tasks.find((x) => x.id === id);
	if (!t) return;
	t.priority = t.priority === 'high' ? 'normal' : 'high';
	save();
}

export function toggleTask(id: string, origin: Origin = 'tasks') {
	const t = db.tasks.find((x) => x.id === id);
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
	save();
}

export function insertSlots(threadId: string): SchedulingRequest {
	const th = threadOf(db, threadId)!;
	// 人物が分からないまま日程調整を作らない (人物なしだと confirmSlot() が落ちる)
	if (!th.personId) throw new Error(`insertSlots: ${threadId} に personId がありません`);
	const existing = db.scheduling.find((s) => s.threadId === threadId && s.status === 'draft');
	if (existing) return existing;
	const slots = slotsFor(db, th.personId);
	const s: SchedulingRequest = {
		id: uid('sr'),
		token: '',
		personId: th.personId,
		duration: 60,
		range: { from: slots[0].date, to: slots[3].date },
		online: 'meet',
		slots,
		status: 'draft',
		threadId,
		text: slotsText(slots, personOf(db, th.personId)!.name.split(' ')[0])
	};
	db.scheduling.push(s);
	log('日程候補 3 件を提案しました', 'draft', { origin: 'inbox' });
	save();
	return db.scheduling[db.scheduling.length - 1];
}

// insertSlots() の逆。候補の載った本文を送らないと決まった時に呼ぶ。sendReply() は本文を見ず
// threadId の draft を拾うだけなので、本文と下書きを合わせる責任はこちら側にある
export function dropSlotsDraft(threadId: string) {
	const i = db.scheduling.findIndex((s) => s.threadId === threadId && s.status === 'draft');
	if (i < 0) return;
	// 承認待ち・送信待ちの返信が指している下書きは、その本文に候補が載っているので残す
	// (executeApproval() が token を発行する先 — payload.schedulingId)
	const id = db.scheduling[i].id;
	const held = db.approvals.some(
		(a) =>
			(a.status === 'pending' || a.status === 'sending') &&
			a.payload.type === 'reply' &&
			a.payload.schedulingId === id
	);
	if (held) return;
	db.scheduling.splice(i, 1);
	save();
}

export function sendReply(threadId: string, body: string, origin: Origin = 'inbox'): Approval {
	const th = threadOf(db, threadId)!;
	const p = personOf(db, th.personId);
	const idn = identityOf(db, th.identityId)!;
	const draft = db.scheduling.find((s) => s.threadId === threadId && s.status === 'draft');
	const addr = addressOf(idn);
	const to = p ? `${p.name} ${addr}` : addr;
	// 送る先はスレッドの出所そのもの。記号も効果文もここから引く (ApprovalIcon の MARK)
	const kind = th.source === 'line' ? 'line' : th.source === 'slack' ? 'slack' : 'mail';
	const what = kind === 'mail' ? 'このメール' : `この ${idn.label} の返信`;
	return addApproval({
		title: `${p?.name.split(' ')[0] ?? '相手'}様への返信`,
		risk: 'external_send',
		kind,
		to,
		subject: `Re: ${th.subject}`,
		body,
		payload: { type: 'reply', threadId, body, schedulingId: draft?.id },
		origin
	});
}

export function markDone(threadId: string) {
	const th = threadOf(db, threadId);
	if (!th) return;
	th.done = true;
	th.needsReply = false;
	log(`「${th.subject}」を対応済みにしました`, 'other', { actor: 'user', origin: 'inbox' });
	save();
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
	// 古い下書きの personId が '' のままならここで弾く
	const p = personOf(db, s.personId);
	if (!p) return null;
	const event: CalendarEvent = {
		id: uid('ev'),
		date: slot.date,
		start: slot.start,
		end: slot.end,
		title: `${companyOf(db, p.companyId)?.name ?? ''} 打ち合わせ`,
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
	log(`${fmtMDW(parse(slot.date))} ${slot.start} に ${p.name}様との打ち合わせを確定しました`, 'hold', {
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
	log(`${personOf(db, s.personId)?.name}様との打ち合わせがキャンセルされました`, 'other', { origin: 'schedule' });
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
	const e = eventOf(db, id);
	if (!e) return;
	// 取り消しで戻せるよう、消す前の中身を控える。配列から外すだけで中身は書き換わらないので、
	// 控えた参照をそのまま押し戻せばよい
	const undoPayload: UndoPayload = {
		kind: 'event_delete',
		event: e,
		meetings: db.meetings.filter((m) => m.eventId === id)
	};
	integrations.calendar.deleteEvent(db, id);
	// 予定と一緒に作った会議も残さない
	db.meetings = db.meetings.filter((m) => m.eventId !== id);
	const l = log(`予定「${e.title}」を削除しました`, 'other', { actor: 'user', origin, undo: undoPayload });
	save();
	// 呼び出し側が取り消しを組み立てるので、積んだログを返す (db.logs[0] を読ませない)
	return l;
}

// 時刻は '9:00' のように 1 桁時もあるので、文字列ではなく分に直して足す
export function addBuffer(eventId: string, min: number) {
	const e = eventOf(db, eventId);
	if (!e) return;
	e.bufferBefore = min;
	e.start = toHm(minutes(e.start) + min);
	e.end = toHm(minutes(e.end) + min);
	save();
}

/** People のメモ。中身が変わったときだけ作業履歴に残す */
export function updatePersonMemo(personId: string, memo: string): Person | undefined {
	const p = personOf(db, personId);
	if (!p || p.memo === memo) return p;
	p.memo = memo;
	log(`${p.name}様のメモを更新しました`, 'other', { actor: 'user', origin: 'people' });
	save();
	return p;
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
// 1 つずつ繋ぐ。toggleConnection は反転なので、繋ぐ向きにしか動かさない
export function connect(id: Connection['id']) {
	const c = db.settings.connections.find((x) => x.id === id)!;
	if (!c.connected) toggleConnection(id);
}
export function resetDemo() {
	for (const t of timers.values()) clearTimeout(t);
	timers.clear();
	resetDb();
	// Today のカードの配置はデモのデータとは別の鍵に置いているので、ここで一緒に消す (docs/research/card-drag.md)
	resetLayout();
}
// 接続直後は案内を出さない。案内は上部バーの「デモの操作」のメニューか ⌘K から始める
export function markStarted() {
	db.demo.started = true;
	save();
}
export function startGuide() {
	// 完了画面からの始め直し。Welcome へ戻らないので、seed() が未接続に戻した接続を元の状態に戻す
	// (全部繋ぐと、スキップして未接続で使っていた人の画面に連携アイコンの列が生える)
	if (todayCount(db) === 0) {
		const before = new Map(db.settings.connections.map((c) => [c.id, c.connected]));
		resetDemo();
		for (const c of db.settings.connections) {
			if (before.get(c.id)) connect(c.id);
		}
	}
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

/** 文字起こしを足し、議事録と ToDo 候補を作る。候補は登録せず、必ず人の承認を通す (仕様 5.4) */
export function addTranscript(meetingId: string, text: string) {
	const m = meetingOf(db, meetingId);
	if (!m) throw new Error(`会議が見つかりません: ${meetingId}`);
	const { minutes: mi, todos } = minutesFor(db, meetingId, text);
	db.transcripts.push({ id: uid('tr'), meetingId, text, addedAt: nowIso() });
	m.transcriptIds.push(db.transcripts[db.transcripts.length - 1].id);
	m.minutes = mi;
	for (const t of todos) {
		db.suggestions.unshift({
			id: uid('sg'),
			source: 'transcript',
			kind: 'task',
			status: 'pending',
			reason: t.reason,
			payload: {
				type: 'task',
				title: t.title,
				due: t.due,
				meetingId,
				personId: m.personIds[0],
				projectId: m.projectId
			},
			createdAt: nowIso()
		});
	}
	log(`議事録と ToDo 候補 ${todos.length} 件を作成しました`, 'draft', { origin: 'meeting' });
	save();
	return m.minutes;
}

export function sendFollowUp(meetingId: string): Approval {
	const m = meetingOf(db, meetingId);
	if (!m?.minutes) throw new Error(`議事録がありません: ${meetingId}`);
	const mail = m.minutes.followUpMail;
	if (!mail) throw new Error(`フォローメール案がありません: ${meetingId}`);
	// 相手が既に話しているスレッドがあればそこに返す。無ければ新規のメールとして送る
	const threadId = db.threads.find((t) => t.personId === m.personIds[0])?.id;
	return addApproval({
		title: `${personOf(db, m.personIds[0])?.name.split(' ')[0] ?? '相手'}様へのフォローメール`,
		risk: 'external_send',
		kind: 'mail',
		to: mail.to,
		subject: mail.subject,
		body: mail.body,
		payload: { type: 'followup', meetingId, threadId },
		origin: 'meeting'
	});
}

/** フォローメール案の本文をその場で直す (MinutesView の「編集」)。承認に回す前の案だけが対象 */
export function editFollowUp(meetingId: string, body: string) {
	const mail = meetingOf(db, meetingId)?.minutes?.followUpMail;
	if (!mail) throw new Error(`フォローメール案がありません: ${meetingId}`);
	mail.body = body;
	save();
}

/** Brief を開いた時点で既読にする。Today の「次の会議の準備」はこの印で消える (derived.ts todayItems) */
export function markBriefRead(meetingId: string) {
	const m = meetingOf(db, meetingId);
	if (!m) throw new Error(`会議がありません: ${meetingId}`);
	if (m.briefRead) return;
	m.briefRead = true;
	save();
}

export function generateAgenda(meetingId: string) {
	const m = meetingOf(db, meetingId);
	if (!m) throw new Error(`会議がありません: ${meetingId}`);
	m.agenda = agendaFor(db, m);
	log('アジェンダを作成しました', 'draft', { origin: 'meeting' });
	save();
}

export function updateAgenda(meetingId: string, items: string[]) {
	const m = meetingOf(db, meetingId);
	if (!m) throw new Error(`会議がありません: ${meetingId}`);
	m.agenda = items;
	save();
}

export function shareAgenda(meetingId: string, origin: Origin = 'meeting'): Approval {
	const m = meetingOf(db, meetingId);
	if (!m) throw new Error(`会議がありません: ${meetingId}`);
	const { person: p, to } = mailTargetOf(db, meetingId);
	return addApproval({
		title: `${p.name.split(' ')[0]}様へのアジェンダ共有`,
		risk: 'external_send',
		kind: 'mail',
		to,
		body: m.agenda.join('\n'),
		payload: { type: 'agenda', meetingId },
		origin
	});
}

/* 履歴は切らない。件数で切ると、後から押せるはずの提案カードが黙って消える
   (chat.md「過去の発言のカードの操作は後から押せるべき」)。長さへの一次資料の処方は
   段階的開示であって件数の上限ではない */
function pushChat(m: Omit<ChatMessage, 'id' | 'at'>) {
	db.chat.push({ id: uid('c'), at: nowIso(), ...m });
	save();
}

/**
 * 依頼を 1 往復進める。KUROKO の返答は 800ms 後に積む (仕様 9.2 の「生成中」表示に合わせる)。
 * 直前の発言が聞き返しなら、その次は聞き返さずに用件の選び直しへ倒す (仕様 9.1「1 往復まで」)
 */
export async function chatSend(text: string, ctx?: ContextChip) {
	const q = text.trim();
	if (!q) return;
	// 直前が人物の聞き返しだったときだけ「もう聞いた」とみなす。用件の選び直し (7 種のチップ)を
	// 混ぜると、そこから人物なしで頼まれた 1 回目を聞き返せなくなる
	const asked = db.chat[db.chat.length - 1]?.text === ASK_PERSON;
	// 聞き返しの選択肢は人物しか運べないので、聞き返す前の依頼 (日時はそこにある)を route へ渡す
	const prev = asked ? db.chat[db.chat.length - 2]?.text : undefined;
	pushChat({ role: 'user', text: q });
	await new Promise((r) => setTimeout(r, 800));
	const { suggestion, ...msg } = reply(db, route(db, q, ctx, prev), asked);
	if (suggestion) db.suggestions.push(suggestion);
	pushChat({ role: 'kuroko', ...msg });
}

/**
 * LINE / Slack の 1 往復。発言を積み、800ms 後に KUROKO の返答を同じ入れ物へ積む
 * (chatSend と同じ待ち)。`@KUROKO` で始まらない発言には返さない (handleMention が null)。
 * member (従業員) の「予定を入れて」は書き込まず、社長のチャットへ候補として回す
 */
export async function lineSay(text: string, role: 'owner' | 'member') {
	const q = text.trim();
	if (!q) return;
	const channel = db.demo.lineTab;
	const who = role === 'owner' ? db.user.name.split(' ')[0] : '山田';
	(channel === 'line' ? db.line : db.slack).push({ id: uid('ln'), who, text: q, at: hm(), role });
	save();
	const r = handleMention(db, q, role);
	if (!r) return;
	await new Promise((res) => setTimeout(res, 800));
	if (r.task) addTask({ title: r.task.title, due: r.task.due, time: r.task.time }, channel);
	if (r.suggestion) {
		// 埋まっている時間は避ける (derived.ts の firstFreeStart)。/chat の予定の候補と同じ扱い
		const { date, start, end } = firstFreeStart(db, r.suggestion.date, 60, r.suggestion.at);
		const s: Suggestion = {
			id: uid('sg'),
			source: 'line',
			kind: 'event',
			status: 'pending',
			reason: `${who}さんから「${q}」の依頼がありました`,
			payload: {
				type: 'event',
				title: r.suggestion.title,
				date,
				start,
				end,
				personIds: []
			},
			createdAt: nowIso()
		};
		db.suggestions.push(s);
		// 社長のチャット (/chat) へ回す。押すまで予定にならないのは chatAct の create-event 任せ
		pushChat({
			role: 'kuroko',
			card: {
				icon: 'ic-cal',
				title: '予定の候補',
				lines: [r.suggestion.title, `${fmtMDW(parse(date))} ${start}〜${end}`],
				reason: s.reason,
				actions: [
					{ label: 'この内容で作成', act: 'create-event', arg: s.id },
					{ label: '日時を変更する', act: 'change-date', arg: s.id }
				]
			}
		});
	}
	integrations.chat.post(channel, r.reply, r.card);
	save();
}

/** カードのボタン。既存の処理へ振り分けるだけで、ここでは何も組み立てない */
export function chatAct(act: string, arg: string) {
	const s = db.suggestions.find((x) => x.id === arg);
	switch (act) {
		case 'create-event': {
			// 済んだ候補からは二度と作らない。表示側 (ChatCard) も同じ status で操作を引っ込める
			if (s?.payload.type !== 'event' || s.status !== 'pending')
				throw new Error(`予定の候補がありません: ${arg}`);
			const { type, personIds, ...rest } = s.payload;
			createEvent({ ...rest, personIds, withMeeting: true }, 'chat');
			s.status = 'accepted';
			save();
			toast('予定を登録しました');
			return;
		}
		case 'change-date':
			if (s?.payload.type !== 'event') throw new Error(`予定の候補がありません: ${arg}`);
			// 日時だけ変えたいので、埋めた値を持ったまま予定の追加画面を開く
			return goto(`/calendar?new=1&date=${s.payload.date}&start=${s.payload.start}`);
		case 'add-task':
			if (acceptTaskSuggestions([arg]).length === 0) throw new Error(`ToDo の候補がありません: ${arg}`);
			toast('ToDo を登録しました');
			return;
		case 'open-person':
			return goto(`/people/${arg}`);
		case 'open-thread':
			return goto(`/inbox?t=${arg}`);
		case 'open-meeting':
			return goto(`/meetings/${arg}`);
		case 'gen-doc':
			return goto(`/documents?kind=${encodeURIComponent(arg)}`);
		default:
			throw new Error(`知らない操作です: ${act}`);
	}
}

/** 資料を 1 件作って db に積む。1200ms の待ちは呼び出し側 (/documents) が見せる */
export function generateDocument(
	kind: Document['kind'],
	projectId: string | undefined,
	origin: Origin
): Document {
	const project = projectOf(db, projectId);
	const d = integrations.document.generate(kind, {
		companyName: companyOf(db, project?.companyId)?.name,
		theme: project?.name,
		projectId: project?.id,
		personId: project?.personIds[0]
	});
	db.documents.unshift(d);
	// 案件の資料一覧 (/projects/[id]) と Brief の関連資料から辿れるようにする
	if (project) project.documentIds.unshift(d.id);
	log(`${d.title}を作成しました`, 'draft', { origin });
	save();
	return db.documents[0];
}

export function sendDocument(docId: string, personId: string, origin: Origin = 'documents'): Approval {
	const d = documentOf(db, docId);
	if (!d) throw new Error(`資料がありません: ${docId}`);
	const { person, to } = personMailTargetOf(db, personId);
	return addApproval({
		title: `${person.name.split(' ')[0]}様への${d.kind}の送付`,
		risk: 'external_send',
		kind: 'mail',
		to,
		subject: d.title,
		body: `添付: ${d.title}.pdf`,
		payload: { type: 'document', documentId: d.id, personId },
		origin
	});
}

/** 名刺の読み取り結果から人物を登録する。会社は名前で引き、無ければ作る。
    メールアドレスの ChannelIdentity が既にあれば personId を付けない (関連付けは
    利用者が linkIdentity で選ぶ。過去のスレッドが黙って別人に結び付くのを避ける) */
export function addPerson(fields: CardFields, origin: Origin): Person {
	let company = db.companies.find((c) => c.name === fields.company);
	if (!company && fields.company) {
		db.companies.push({
			id: uid('c'),
			name: fields.company,
			domain: fields.email.split('@')[1] ?? '',
			industry: '',
			size: ''
		});
		company = db.companies[db.companies.length - 1];
	}
	db.people.push({
		id: uid('p'),
		name: fields.name,
		kana: fields.kana,
		companyId: company?.id,
		title: fields.title,
		phone: fields.phone || undefined,
		memo: '',
		tags: [],
		projectIds: []
	});
	const p = db.people[db.people.length - 1];
	if (!db.identities.some((i) => i.kind === 'email' && i.value === fields.email))
		db.identities.push({ id: uid('id'), personId: p.id, kind: 'email', value: fields.email, label: 'Gmail' });
	log(`人物「${p.name}」を登録しました`, 'register', { actor: 'user', origin });
	save();
	return p;
}

/** ChannelIdentity と、そこから来た全スレッドを人物に結び付ける */
export function linkIdentity(identityId: string, personId: string) {
	const i = identityOf(db, identityId);
	if (!i) throw new Error(`ChannelIdentity がありません: ${identityId}`);
	i.personId = personId;
	const company = personOf(db, personId)?.companyId;
	for (const t of db.threads)
		if (t.identityId === identityId) {
			t.personId = personId;
			t.companyId ??= company;
		}
	log(`${db.threads.filter((t) => t.identityId === identityId).length} 件のメールを人物に関連付けました`, 'register', {
		actor: 'user',
		origin: 'people',
		undo: { kind: 'link_identity', identityId }
	});
	save();
}

/** 人物の会社の案件を作り、人物に紐付ける。商談はこれから始まるので状態は「商談前」 */
export function createProjectFor(personId: string, name: string): Project {
	const p = personOf(db, personId);
	if (!p?.companyId) throw new Error(`会社が引けません: ${personId}`);
	db.projects.push({
		id: uid('pj'),
		name,
		companyId: p.companyId,
		status: '商談前',
		amount: '未定',
		personIds: [personId],
		documentIds: []
	});
	const pj = db.projects[db.projects.length - 1];
	p.projectIds.push(pj.id);
	log(`案件「${pj.name}」を作成しました`, 'register', { actor: 'user', origin: 'people' });
	save();
	return pj;
}
