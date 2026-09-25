import type { Approval, Origin, SchedulingRequest, CalendarEvent } from '../types';
import { db } from '../store.svelte';
import { parse, fmtMDW } from '../dates';
import { addressOf, personOf, companyOf, identityOf, threadOf } from '../derived';
import { slotsFor, slotsText, uid } from '../kuroko/generate';
import { integrations } from '../integrations';
import { log, uncount, pushed, closeThread } from './core';
import { askToSend } from './approvals';
import { meetingFor } from './meetings';

const draftOf = (threadId: string) => db.scheduling.find((s) => s.threadId === threadId && s.status === 'draft');

// 日程の確定で作った予定と会議を捨てる (選び直し・日時の変更・キャンセル)
function dropBooking(s: SchedulingRequest) {
	db.events = db.events.filter((e) => e.id !== s.eventId);
	db.meetings = db.meetings.filter((m) => m.id !== s.meetingId);
}

export function insertSlots(threadId: string): SchedulingRequest {
	const th = threadOf(db, threadId)!;
	// 人物が分からないまま日程調整を作らない (人物なしだと confirmSlot() が落ちる)
	if (!th.personId) throw new Error(`insertSlots: ${threadId} に personId がありません`);
	const existing = draftOf(threadId);
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
	const out = pushed(db.scheduling, s);
	log('日程候補 3 件を提案しました', 'draft', { origin: 'inbox' });
	return out;
}

// insertSlots() の逆。候補の載った本文を送らないと決まった時に呼ぶ。sendReply() は本文を見ず
// threadId の draft を拾うだけなので、本文と下書きを合わせる責任はこちら側にある
export function dropSlotsDraft(threadId: string) {
	const draft = draftOf(threadId);
	if (!draft) return;
	// 承認待ち・送信待ちの返信が指している下書きは、その本文に候補が載っているので残す
	// (executeApproval() が token を発行する先 — payload.schedulingId)
	const id = draft.id;
	const held = db.approvals.some(
		(a) =>
			(a.status === 'pending' || a.status === 'sending') &&
			a.payload.type === 'reply' &&
			a.payload.schedulingId === id
	);
	if (held) return;
	db.scheduling.splice(db.scheduling.indexOf(draft), 1);
}

export function sendReply(threadId: string, body: string, origin: Origin = 'inbox'): Approval {
	const th = threadOf(db, threadId)!;
	const p = personOf(db, th.personId);
	const idn = identityOf(db, th.identityId)!;
	const draft = draftOf(threadId);
	const addr = addressOf(idn);
	const to = p ? `${p.name} ${addr}` : addr;
	// 送る先はスレッドの出所そのもの。記号もここから引く (ApprovalIcon の MARK)
	const kind = th.source === 'line' ? 'line' : th.source === 'slack' ? 'slack' : 'mail';
	return askToSend({
		title: `${p?.name.split(' ')[0] ?? '相手'}様への返信`,
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
	closeThread(th);
	log(`「${th.subject}」を対応済みにしました`, 'other', { actor: 'user', origin: 'inbox' });
}

export function confirmSlot(token: string, slotId: string) {
	const s = db.scheduling.find((x) => x.token === token && (x.status === 'sent' || x.status === 'confirmed'));
	if (!s) return null;
	const slot = s.slots.find((x) => x.id === slotId);
	if (!slot) return null;
	// 確定済みの枠を選び直した場合は、前の予定と会議を捨ててから作り直す
	const redo = s.status === 'confirmed';
	if (redo) dropBooking(s);
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
	const m = meetingFor(event);
	event.meetingId = m.id;
	const out = { event: pushed(db.events, event), meeting: pushed(db.meetings, m) };
	s.status = 'confirmed';
	s.chosenSlotId = slotId;
	s.eventId = event.id;
	s.meetingId = m.id;
	// 相手が確定した予定は「元に戻す」の対象にしない。戻すのは /schedule の「日時を変更する」「キャンセルする」
	log(`${fmtMDW(parse(slot.date))} ${slot.start} に ${p.name}様との打ち合わせを確定しました`, 'hold', {
		origin: 'schedule',
		approved: true,
		count: redo ? undefined : 'confirmed'
	});
	return out;
}

export function changeSlot(token: string) {
	const s = db.scheduling.find((x) => x.token === token);
	if (!s || s.status !== 'confirmed') return;
	dropBooking(s);
	s.status = 'sent';
	s.chosenSlotId = s.eventId = s.meetingId = undefined;
	uncount('confirmed');
}

export function cancelScheduling(token: string) {
	const s = db.scheduling.find((x) => x.token === token);
	if (!s || (s.status !== 'sent' && s.status !== 'confirmed')) return;
	dropBooking(s);
	s.status = 'cancelled';
	log(`${personOf(db, s.personId)?.name}様との打ち合わせがキャンセルされました`, 'other', { origin: 'schedule' });
}
