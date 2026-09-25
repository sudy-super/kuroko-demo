// TODO(real): Google Calendar API に差し替える。双方向同期の競合解決 (どちらの更新を採るか)が要件
import type { CalendarProvider } from '../types';
import type { CalendarEvent, Db } from '../../types';

export const calendar: CalendarProvider = {
	createEvent(d: Db, e: CalendarEvent): CalendarEvent {
		d.events.push(e);
		// $state proxy への書き込みは元のオブジェクトに反映されないので、db 側の要素を返す
		return d.events[d.events.length - 1];
	},
	deleteEvent(d: Db, id: string) {
		d.events = d.events.filter((e) => e.id !== id);
	}
};
