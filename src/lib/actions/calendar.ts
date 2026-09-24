import type { Origin, UndoPayload, CalendarEvent } from '../types';
import { db, save } from '../store.svelte';
import { minutes, toHm } from '../dates';
import { eventOf } from '../derived';
import { uid } from '../kuroko/generate';
import { integrations } from '../integrations';
import { log, meetingFor } from './core';

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
