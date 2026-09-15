import { describe, it, expect } from 'vitest';
import { seed } from './seed';
import { key } from './dates';
import type { CalendarEvent } from './types';
import { travelWarning, conflicts, overlaps, layoutColumns, weekOf, monthGrid, eventsOn } from './calendar';

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
	it('重ならない予定はすべて左端', () => {
		const out = layoutColumns([ev('a', '9:00', '10:00'), ev('b', '10:00', '11:00')]);
		expect(out.map((x) => x.offset)).toEqual([0, 0]);
	});
	it('重なるたびに 1 段ずつ右へずらす', () => {
		const out = layoutColumns([
			ev('c', '9:00', '12:00'),
			ev('a', '9:00', '10:00'),
			ev('b', '9:30', '10:30')
		]);
		// 開始の早い順に並べ直してから段を決める
		expect(out.map((x) => [x.event.id, x.offset])).toEqual([
			['c', 0],
			['a', 1],
			['b', 2]
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
