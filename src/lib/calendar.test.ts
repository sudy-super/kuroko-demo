import { describe, it, expect } from 'vitest';
import { seed } from './seed';
import { key } from './dates';
import type { CalendarEvent } from './types';
import {
	travelWarning,
	conflicts,
	overlaps,
	layoutColumns,
	weekOf,
	monthGrid,
	eventsOn,
	WEEK_HOUR_PX,
	WEEK_MIN_EVENT_PX,
	WEEK_MIN_DURATION_MIN
} from './calendar';
import { deleteEvent, undo } from './actions';
import { linkUrl } from './derived';
import { replaceDb, db } from './store.svelte';

const BASE = new Date(2026, 8, 15); // 火曜。シードの相対日付はこの日を基準にする

describe('travelWarning', () => {
	const db = seed(BASE);
	it('渋谷 13:00〜14:00 の後に 品川 14:30 は警告', () => {
		const w = travelWarning(db, { date: '2026-09-15', start: '14:30', end: '15:30', place: '品川' });
		expect(w?.prev.id).toBe('ev-shibuya');
		expect(w?.gapMin).toBe(30);
	});
	it('同じ場所なら警告なし', () => {
		expect(
			travelWarning(db, { date: '2026-09-15', start: '14:30', end: '15:30', place: '渋谷' })
		).toBeNull();
	});
	it('間隔が 30 分を超えれば警告なし', () => {
		expect(
			travelWarning(db, { date: '2026-09-15', start: '15:00', end: '16:00', place: '品川' })
		).toBeNull();
	});
	it('場所が空なら警告なし', () => {
		expect(travelWarning(db, { date: '2026-09-15', start: '14:30', end: '15:30' })).toBeNull();
	});
});

describe('conflicts', () => {
	const db = seed(BASE);
	it('重なる予定を返す', () => {
		expect(conflicts(db, { date: '2026-09-15', start: '13:30', end: '14:30' }).map((e) => e.id)).toEqual([
			'ev-shibuya'
		]);
	});
	it('前の予定の終了と次の開始が同じなら重ならない', () => {
		expect(conflicts(db, { date: '2026-09-15', start: '14:00', end: '15:00' })).toEqual([]);
	});
	it('日付が違えば重ならない', () => {
		expect(conflicts(db, { date: '2026-09-16', start: '13:30', end: '14:30' })).toEqual([]);
	});
});

describe('overlaps', () => {
	it('1 桁時の時刻も分に直して比べる', () => {
		const a = { date: 'd', start: '9:30', end: '10:30' };
		expect(overlaps(a, { date: 'd', start: '10:00', end: '11:00' })).toBe(true);
		expect(overlaps(a, { date: 'd', start: '10:30', end: '11:00' })).toBe(false);
	});
});

describe('layoutColumns', () => {
	const ev = (id: string, start: string, end: string) =>
		({ id, date: 'd', start, end, title: id, personIds: [], source: 'gcal' }) as CalendarEvent;
	it('重ならない予定はそれぞれ幅いっぱい', () => {
		const out = layoutColumns([ev('a', '9:00', '10:00'), ev('b', '10:00', '11:00')]);
		expect(out.map((x) => [x.event.id, x.col, x.cols])).toEqual([
			['a', 0, 1],
			['b', 0, 1]
		]);
	});
	it('重なる塊は列に割り、塊の全員が同じ分割数を持つ', () => {
		const out = layoutColumns([
			ev('c', '9:00', '12:00'),
			ev('a', '9:00', '10:00'),
			ev('b', '9:30', '10:30')
		]);
		// 開始の早い順に並べ直してから列を決める
		expect(out.map((x) => [x.event.id, x.col, x.cols])).toEqual([
			['c', 0, 3],
			['a', 1, 3],
			['b', 2, 3]
		]);
	});
	it('先に終わった予定の列は後ろの予定が使い直す', () => {
		const out = layoutColumns([
			ev('a', '9:00', '10:00'),
			ev('c', '9:30', '12:00'),
			ev('b', '10:00', '11:00')
		]);
		expect(out.map((x) => [x.event.id, x.col, x.cols])).toEqual([
			['a', 0, 2],
			['c', 1, 2],
			['b', 0, 2]
		]);
	});
	it('間が空けば別の塊になり、分割数は持ち越さない', () => {
		const out = layoutColumns([
			ev('a', '9:00', '10:00'),
			ev('b', '9:00', '10:00'),
			ev('c', '11:00', '12:00')
		]);
		expect(out.map((x) => [x.event.id, x.col, x.cols])).toEqual([
			['a', 0, 2],
			['b', 1, 2],
			['c', 0, 1]
		]);
	});
	it('minDurationMin を渡すと、実時間では重ならない予定も描画上の終了で重ねる', () => {
		// 11:00〜11:15 は実時間どおりなら 11:15 に終わるが、WeekView の 44px 下限で描画は
		// 11:30 まで伸びる (WEEK_MIN_DURATION_MIN 分)。その分を渡すと直後の 11:15〜12:00 と
		// 重なったとみなされ、列が分かれる
		const out = layoutColumns(
			[ev('a', '11:00', '11:15'), ev('b', '11:15', '12:00')],
			WEEK_MIN_DURATION_MIN
		);
		expect(out.map((x) => [x.event.id, x.col, x.cols])).toEqual([
			['a', 0, 2],
			['b', 1, 2]
		]);
	});
	it('minDurationMin を渡さなければ実時間どおりで、続けて入った予定は重ならない (回帰なし)', () => {
		const out = layoutColumns([ev('a', '11:00', '11:15'), ev('b', '11:15', '12:00')]);
		expect(out.map((x) => [x.event.id, x.col, x.cols])).toEqual([
			['a', 0, 1],
			['b', 0, 1]
		]);
	});
	it('WEEK_MIN_DURATION_MIN は丸めの誤差を持たないので、ちょうど 30 分の予定どうしは列を分けない', () => {
		// WEEK_MIN_EVENT_PX / (WEEK_HOUR_PX / 60) と書くと 30.000000000000004 になり、
		// 0:00〜0:30 の終わりがわずかに 0:30 を超えて 0:30〜1:00 と重なったと誤判定される。
		// 定数側が先に 60 を掛けているのでちょうど 30 になる (この境目を確認する)
		expect(WEEK_MIN_DURATION_MIN).toBe(30);
		expect(WEEK_MIN_EVENT_PX / (WEEK_HOUR_PX / 60)).not.toBe(30);
		const out = layoutColumns(
			[ev('a', '0:00', '0:30'), ev('b', '0:30', '1:00')],
			WEEK_MIN_DURATION_MIN
		);
		expect(out.map((x) => [x.event.id, x.col, x.cols])).toEqual([
			['a', 0, 1],
			['b', 0, 1]
		]);
	});
});

describe('weekOf / monthGrid', () => {
	it('週は月曜始まりの 7 日', () => {
		const w = weekOf(new Date(2026, 8, 15)).map(key);
		expect(w[0]).toBe('2026-09-14');
		expect(w[6]).toBe('2026-09-20');
	});
	it('日曜はその週の末尾になる', () => {
		expect(key(weekOf(new Date(2026, 8, 20))[0])).toBe('2026-09-14');
	});
	it('月の格子は 6 週 42 日で、1 日を含む週から始まる', () => {
		const g = monthGrid(new Date(2026, 8, 15));
		expect(g.length).toBe(42);
		expect(key(g[0])).toBe('2026-08-31'); // 9/1 (火) を含む週の月曜
		expect(key(g[41])).toBe('2026-10-11');
	});
});

describe('eventsOn', () => {
	it('その日の予定を開始の早い順に返す', () => {
		const db = seed(BASE);
		expect(eventsOn(db, '2026-09-15').map((e) => e.id)).toEqual([
			'ev-standup',
			'ev-shibuya',
			'ev-sato-call'
		]);
	});
});

describe('deleteEvent の取り消し', () => {
	it('シードの予定を消しても、取り消しで会議ごと戻る', () => {
		replaceDb(seed(BASE));
		const target = db.events.find((e) => e.id === 'ev-shibuya')!;
		const before = db.events.length;
		const meetings = db.meetings.filter((m) => m.eventId === target.id).length;
		deleteEvent(target.id);
		expect(db.events.find((e) => e.id === 'ev-shibuya')).toBeUndefined();
		const l = db.logs[0];
		expect(l.undo).toEqual({ kind: 'event_delete', event: target, meetings: expect.any(Array) });
		undo(l.id);
		expect(db.events.length).toBe(before);
		expect(db.events.find((e) => e.id === 'ev-shibuya')!.title).toBe(target.title);
		expect(db.meetings.filter((m) => m.eventId === target.id).length).toBe(meetings);
		expect(db.logs.find((x) => x.id === l.id)!.undone).toBe(true);
	});
});

describe('linkUrl', () => {
	it('scheme が無い URL に https を補い、ある URL はそのまま', () => {
		// integrations/mock/conference.ts が作る表示用の形
		expect(linkUrl('meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
		expect(linkUrl('https://zoom.us/j/123')).toBe('https://zoom.us/j/123');
		expect(linkUrl('http://zoom.us/j/123')).toBe('http://zoom.us/j/123');
	});
});
