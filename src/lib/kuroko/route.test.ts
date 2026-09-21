import { describe, it, expect } from 'vitest';
import { seed } from '../seed';
import { route } from './route';

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
});
