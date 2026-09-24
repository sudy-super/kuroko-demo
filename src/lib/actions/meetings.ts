import type { Approval, Origin } from '../types';
import { db } from '../store.svelte';
import { nowIso } from '../dates';
import { personOf, meetingOf, mailTargetOf } from '../derived';
import { agendaFor, uid, minutesFor, suggestion } from '../kuroko/generate';
import { log, must, pushed } from './core';
import { addApproval } from './approvals';

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
	return addApproval({
		title: `${personOf(db, m!.personIds[0])?.name.split(' ')[0] ?? '相手'}様へのフォローメール`,
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
