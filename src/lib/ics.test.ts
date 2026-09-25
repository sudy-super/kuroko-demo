import { describe, it, expect } from 'vitest';
import { icsFor } from './ics';
import type { CalendarEvent } from './types';

const event: CalendarEvent = {
	id: 'ev-1',
	date: '2026-09-25',
	start: '14:00',
	end: '15:00',
	title: 'x',
	url: 'meet.google.com/abc-defg-hij',
	personIds: [],
	source: 'kuroko'
};

describe('icsFor', () => {
	it('DTSTART/DTEND を Asia/Tokyo の壁時計時刻に変換する', () => {
		const ics = icsFor(event, '田中様との打ち合わせ');
		expect(ics).toContain('DTSTART;TZID=Asia/Tokyo:20260925T140000');
		expect(ics).toContain('DTEND;TZID=Asia/Tokyo:20260925T150000');
		expect(ics).toContain('SUMMARY:田中様との打ち合わせ');
	});
	it('改行は CRLF', () => {
		const ics = icsFor(event, 't');
		expect(ics).toContain('\r\n');
		expect(ics.split('\r\n').join('\n')).not.toContain('\n\n'); // LF 単体の連続がない = 全行 CRLF
		for (const line of ics.trimEnd().split('\r\n')) expect(line).not.toMatch(/\n/);
	});
});
