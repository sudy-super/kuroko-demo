import { describe, it, expect } from 'vitest';
import { seed } from '../seed';
import { route, reply } from './route';

const db = seed(new Date(2026, 8, 15));

describe('route', () => {
	it.each([
		['田中さんと打ち合わせ入れて', 'event', 'p-tanaka'],
		['金曜までに ABC 社へ見積提出、覚えて', 'task', undefined],
		['田中さんとの過去のやり取り', 'person', 'p-tanaka'],
		['佐藤さんのメールに返信', 'mail', 'p-sato'],
		['明日の会議準備', 'brief', undefined],
		['田中さんに候補送って', 'schedule', 'p-tanaka'],
		['ABC 社向けの提案書を作って', 'document', undefined],
		['こんにちは', 'unknown', undefined]
	])('%s → %s', (text, kind, personId) => {
		const r = route(db, text);
		expect(r.kind).toBe(kind);
		expect(r.personId).toBe(personId);
	});

	it('文脈チップの人物を使う', () => {
		expect(route(db, '返信案を作って', { label: '', personId: 'p-sato' }).personId).toBe('p-sato');
	});

	it('提案書の種別', () => {
		expect(route(db, '見積作って').docKind).toBe('見積書');
	});

	/* 時刻の読み取り (dates.ts の hourOf)。言われた時刻を候補の開始に使うため、
	   言われなければ undefined のまま firstFreeStart の空き枠に任せる */
	it.each([
		['田中さんと明日 11 時に打ち合わせを入れて', '11:00'],
		['田中さんと明日 11:30 に打ち合わせを入れて', '11:30'],
		['田中さんと明日 14 時半に打ち合わせを入れて', '14:30'],
		['田中さんと明日打ち合わせを入れて', undefined],
		// 業務時間 (9:00-18:00) の外は読み取らない
		['田中さんと明日 21 時に打ち合わせを入れて', undefined]
	])('%s → %s', (text, at) => {
		expect(route(db, text).at).toBe(at);
	});

	it('時刻を言うとその時刻から候補を出す', () => {
		const c = reply(db, route(db, '田中さんと明日 11 時に打ち合わせを入れて')).card!;
		expect(c.lines[1]).toContain('11:00〜12:00');
	});

	it('時刻を言わなければ空き枠から出す', () => {
		const c = reply(db, route(db, '田中さんと明日打ち合わせを入れて')).card!;
		expect(c.lines[1]).toContain('9:00〜10:00');
	});
});
