import { describe, it, expect } from 'vitest';
import { seed } from '../seed';
import { agendaFor } from './generate';

describe('agendaFor', () => {
	const db = seed(new Date(2026, 8, 15));
	const find = (id: string) => db.meetings.find((m) => m.id === id)!;

	it('宿題があり目的に価格が入る会議は 5 項目', () => {
		expect(agendaFor(db, find('m-abc'))).toEqual([
			'前回宿題の確認',
			'導入スケジュールのすり合わせ',
			'価格条件',
			'契約タイミング',
			'次回アクション'
		]);
	});

	it('宿題が無く目的に価格も入らない会議は 3 項目', () => {
		// m-abc-demo は Brief を持たず、目的は「製品デモで適用範囲の当たりを付ける」
		expect(agendaFor(db, find('m-abc-demo'))).toEqual([
			'導入スケジュールのすり合わせ',
			'契約タイミング',
			'次回アクション'
		]);
	});

	it('目的に価格が入れば価格条件が入る', () => {
		expect(agendaFor(db, find('m-abc-quote'))).toContain('価格条件');
	});
});
