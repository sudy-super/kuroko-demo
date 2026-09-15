// TODO(real): Google Calendar API に差し替える。双方向同期の競合解決 (どちらの更新を採るか)が要件
import type { CalendarProvider } from '../types';
import type { CalendarEvent, Db } from '../../types';
import { freeSlots } from '../../derived';
import { eventsIn } from '../../calendar';
import { minutes, parse } from '../../dates';

export const calendar: CalendarProvider = {
	listEvents: (d: Db, from: string, to: string) => eventsIn(d, parse(from), parse(to)),
	createEvent(d: Db, e: CalendarEvent): CalendarEvent {
		d.events.push(e);
		// $state proxy への書き込みは元のオブジェクトに反映されないので、db 側の要素を返す
		return d.events[d.events.length - 1];
	},
	// 予定の書き換えは画面から呼ぶ経路がまだ無い。黙って代替せず、使われたら落とす
	updateEvent() {
		throw new Error('not implemented: 予定の書き換えに接続するまで使わない');
	},
	deleteEvent(d: Db, id: string) {
		d.events = d.events.filter((e) => e.id !== id);
	},
	// 時刻は '9:00' のように 1 桁時もあるので、文字列ではなく分に直して比べる
	findFreeSlots: (d: Db, date: string, duration: number) =>
		freeSlots(d, date).filter((s) => minutes(s.end) - minutes(s.start) >= duration)
};
