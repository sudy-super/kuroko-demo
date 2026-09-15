// TODO(real): Google Calendar API に差し替える。双方向同期の競合解決 (どちらの更新を採るか)が要件
import type { CalendarProvider } from '../types';
import type { Db } from '../../types';
import { freeSlots } from '../../derived';
import { minutes } from '../../dates';

const later = () => {
	throw new Error('not implemented: 予定の読み書きは Task 12 で実装する');
};

export const calendar: CalendarProvider = {
	listEvents: later,
	createEvent: later,
	updateEvent: later,
	deleteEvent: later,
	// 時刻は '9:00' のように 1 桁時もあるので、文字列ではなく分に直して比べる
	findFreeSlots: (d: Db, date: string, duration: number) =>
		freeSlots(d, date).filter((s) => minutes(s.end) - minutes(s.start) >= duration)
};
