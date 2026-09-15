/* カレンダーの純粋関数。画面 (週 / 月) と保存前の警告が同じ規則を使えるよう、ここだけに置く。
   時刻は '9:00' のように 1 桁時もあるので、文字列ではなく minutes() で分に直して比べる */
import type { CalendarEvent, Db } from './types';
import { minutes, addDays } from './dates';

/** 予定の時間帯だけを見るための最小の形。保存前の入力にも既存の予定にも使う */
export type Slot = { date: string; start: string; end: string; place?: string };

/** 終了と開始が同じ時刻なら重ならない (13:00〜14:00 と 14:00〜15:00 は別の予定) */
export const overlaps = (a: Slot, b: Slot) =>
	a.date === b.date && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);

/** ダブルブッキングの警告に出す、入力と時間が重なる既存の予定 */
export const conflicts = (db: Db, i: Slot) => db.events.filter((e) => overlaps(e, i));

/** 移動時間の警告。直前の予定と場所が異なり、終了から開始までが 30 分以下なら出す */
export function travelWarning(db: Db, i: Slot): { prev: CalendarEvent; gapMin: number } | null {
	if (!i.place) return null;
	const prev = db.events
		.filter(
			(e) =>
				e.date === i.date &&
				minutes(e.end) <= minutes(i.start) &&
				e.place &&
				e.place !== 'オンライン'
		)
		.sort((a, b) => minutes(b.end) - minutes(a.end))[0];
	if (!prev || prev.place === i.place) return null;
	const gapMin = minutes(i.start) - minutes(prev.end);
	return gapMin <= 30 ? { prev, gapMin } : null;
}

/** 週表示の重なり。等幅に割らず、先に始まった予定の上へ 1 段ずつ右にずらして重ねる */
export function layoutColumns(events: CalendarEvent[]): { event: CalendarEvent; offset: number }[] {
	const sorted = [...events].sort((a, b) => minutes(a.start) - minutes(b.start));
	const out: { event: CalendarEvent; offset: number }[] = [];
	for (const e of sorted) out.push({ event: e, offset: out.filter((x) => overlaps(x.event, e)).length });
	return out;
}

/** その日を含む月曜始まりの 7 日 */
export function weekOf(d: Date): Date[] {
	const mon = addDays(-((d.getDay() + 6) % 7), d);
	return Array.from({ length: 7 }, (_, i) => addDays(i, mon));
}

/** 月表示の格子。週の数で高さが変わらないよう、常に 6 週 42 日を返す */
export function monthGrid(d: Date): Date[] {
	const first = weekOf(new Date(d.getFullYear(), d.getMonth(), 1))[0];
	return Array.from({ length: 42 }, (_, i) => addDays(i, first));
}

export const eventsOn = (db: Db, dateKey: string) =>
	db.events.filter((e) => e.date === dateKey).sort((a, b) => minutes(a.start) - minutes(b.start));

/* 'YYYY-MM-DD' は辞書順が日付順と一致するので、Date に直さず文字列のまま比べる */
export const eventsIn = (db: Db, from: string, to: string) =>
	db.events.filter((e) => e.date >= from && e.date <= to);
