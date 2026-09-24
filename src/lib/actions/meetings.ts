import type { Origin, UndoPayload, CalendarEvent, Approval, Meeting } from '../types';
import { db } from '../store.svelte';
import { minutes, toHm, nowIso } from '../dates';
import { eventOf, personOf, meetingOf, mailTargetOf } from '../derived';
import { uid, agendaFor, minutesFor, suggestion } from '../kuroko/generate';
import { integrations } from '../integrations';
import { log, must, pushed } from './core';
import { askToSend } from './approvals';

/** 予定に付く会議。Brief は通常前日夜に届くものを、デモでは即時に作る */
export function meetingFor(e: CalendarEvent): Meeting {
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
	return m;
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
		const m = meetingFor(e);
		ev.meetingId = m.id;
		db.meetings.push(m);
	}
	log(`予定「${ev.title}」を登録しました`, 'hold', {
		actor: 'user',
		origin,
		undo: { kind: 'event_add', eventId: ev.id }
	});
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
}

const meetingMust = (id: string) => must(meetingOf(db, id), `会議がありません: ${id}`);

/** 文字起こしを足し、議事録と ToDo 候補を作る。候補は登録せず、必ず人の承認を通す (仕様 5.4) */
export function addTranscript(meetingId: string, text: string) {
	const m = must(meetingOf(db, meetingId), `会議が見つかりません: ${meetingId}`);
	const { minutes: mi, todos } = minutesFor(db, meetingId, text);
	m.transcriptIds.push(pushed(db.transcripts, { id: uid('tr'), meetingId, text, addedAt: nowIso() }).id);
	m.minutes = mi;
	for (const t of todos) {
		db.suggestions.unshift(
			suggestion('transcript', 'task', t.reason, {
				type: 'task',
				title: t.title,
				due: t.due,
				meetingId,
				personId: m.personIds[0],
				projectId: m.projectId
			})
		);
	}
	log(`議事録と ToDo 候補 ${todos.length} 件を作成しました`, 'draft', { origin: 'meeting' });
	return m.minutes;
}

export function sendFollowUp(meetingId: string): Approval {
	const m = meetingOf(db, meetingId);
	const mail = must(must(m?.minutes, `議事録がありません: ${meetingId}`).followUpMail, `フォローメール案がありません: ${meetingId}`);
	// 相手が既に話しているスレッドがあればそこに返す。無ければ新規のメールとして送る
	const threadId = db.threads.find((t) => t.personId === m!.personIds[0])?.id;
	return askToSend({
		title: `${personOf(db, m!.personIds[0])?.name.split(' ')[0] ?? '相手'}様へのフォローメール`,
		to: mail.to,
		subject: mail.subject,
		body: mail.body,
		payload: { type: 'followup', meetingId, threadId },
		origin: 'meeting'
	});
}

/** フォローメール案の本文をその場で直す (MinutesView の「編集」)。承認に回す前の案だけが対象 */
export function editFollowUp(meetingId: string, body: string) {
	must(meetingOf(db, meetingId)?.minutes?.followUpMail, `フォローメール案がありません: ${meetingId}`).body = body;
}

/** Brief を開いた時点で既読にする。Today の「次の会議の準備」はこの印で消える (derived.ts todayItems) */
export function markBriefRead(meetingId: string) {
	const m = meetingMust(meetingId);
	if (m.briefRead) return;
	m.briefRead = true;
}

export function generateAgenda(meetingId: string) {
	const m = meetingMust(meetingId);
	m.agenda = agendaFor(db, m);
	log('アジェンダを作成しました', 'draft', { origin: 'meeting' });
}

export function updateAgenda(meetingId: string, items: string[]) {
	const m = meetingMust(meetingId);
	m.agenda = items;
}

export function shareAgenda(meetingId: string, origin: Origin = 'meeting'): Approval {
	const m = meetingMust(meetingId);
	const { person: p, to } = mailTargetOf(db, meetingId);
	return askToSend({
		title: `${p.name.split(' ')[0]}様へのアジェンダ共有`,
		to,
		body: m.agenda.join('\n'),
		payload: { type: 'agenda', meetingId },
		origin
	});
}
