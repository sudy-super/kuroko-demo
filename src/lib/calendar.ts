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

/* 週表示の目盛り。styles/calendar.css の .week-hour / .week-col の高さと同じ値で、片方だけ動かすと
   格子と予定の位置がずれる。WEEK_HOUR_PX が 48 (components 3.12 の既定) ではない理由は
   WeekView.svelte の PX の注記を見よ */
export const WEEK_HOUR_PX = 88;
/** 予定の描画の高さの下限 (WCAG 2.5.8 / Apple HIG の当たり判定 44px) */
export const WEEK_MIN_EVENT_PX = 44;
/** 上の下限を分に直した長さ。layoutColumns の minDurationMin に渡す。
    先に 60 を掛けてから割るのは、WEEK_MIN_EVENT_PX / (WEEK_HOUR_PX / 60) だと浮動小数点の
    丸めで 30.000000000000004 になり、ちょうど 30 分の予定どうしまで重なり判定に
    引っかかるため */
export const WEEK_MIN_DURATION_MIN = (WEEK_MIN_EVENT_PX * 60) / WEEK_HOUR_PX;

/** 週表示の重なり (calendar-block.md「重なり」)。時間が途切れない予定の塊ごとに列を割り、
    その塊の幅を列数で均等に分ける。col は 0 から数えた列、cols は塊全体の列数。
    minDurationMin は描画上の最小の長さ (分、WEEK_MIN_DURATION_MIN)。予定の高さに下限が
    あるため、実時間が短くても描画はそこまで伸びる。実時間の終了で重なりを判定すると、
    伸びた分だけ次の予定と描画が重なり、文字も当たり判定も潰れる。
    既定値 0 (実時間どおり) は既存の呼び出し・テストと同じ結果 */
export type Placed = { event: CalendarEvent; col: number; cols: number };
export function layoutColumns(events: CalendarEvent[], minDurationMin = 0): Placed[] {
	const sorted = [...events].sort((a, b) => minutes(a.start) - minutes(b.start));
	const end = (e: CalendarEvent) => Math.max(minutes(e.end), minutes(e.start) + minDurationMin);
	const overlapsRendered = (a: CalendarEvent, b: CalendarEvent) =>
		minutes(a.start) < end(b) && minutes(b.start) < end(a);
	const out: Placed[] = [];
	let group: Placed[] = [];
	let groupEnd = -1;
	const close = () => {
		const cols = Math.max(...group.map((x) => x.col)) + 1;
		for (const x of group) x.cols = cols;
		group = [];
		groupEnd = -1;
	};
	for (const e of sorted) {
		if (group.length && minutes(e.start) >= groupEnd) close();
		// 同じ塊の中でも、描画上すでに終わった予定の列は空いているので使い直す
		const used = new Set(group.filter((x) => overlapsRendered(x.event, e)).map((x) => x.col));
		let col = 0;
		while (used.has(col)) col++;
		const placed: Placed = { event: e, col, cols: 1 };
		group.push(placed);
		out.push(placed);
		groupEnd = Math.max(groupEnd, end(e));
	}
	if (group.length) close();
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
