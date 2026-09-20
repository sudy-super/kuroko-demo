import type { CalendarEvent } from './types';

/** 改行は CRLF (RFC 5545)。DTSTART/DTEND は日本時間の壁時計時刻に TZID を付ける
 *  (UTC への変換はしない。デモのシード日時はローカル時刻として作られているため) */
export function icsFor(event: CalendarEvent, title: string): string {
	const stamp = (date: string, time: string) => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`;
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//KUROKO AI//demo//JA',
		'BEGIN:VEVENT',
		`UID:${event.id}@kuroko.demo`,
		`DTSTART;TZID=Asia/Tokyo:${stamp(event.date, event.start)}`,
		`DTEND;TZID=Asia/Tokyo:${stamp(event.date, event.end)}`,
		`SUMMARY:${title}`,
		...(event.place || event.url ? [`LOCATION:${event.url ?? event.place}`] : []),
		...(event.url ? [`DESCRIPTION:${event.url}`] : []),
		'END:VEVENT',
		'END:VCALENDAR'
	];
	return lines.join('\r\n') + '\r\n';
}
