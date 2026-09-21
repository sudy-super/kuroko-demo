import { describe, it, expect } from 'vitest';
import { seed } from '../seed';
import { handleMention } from './line';

const db = seed(new Date(2026, 8, 15));

describe('LINE', () => {
	it('@KUROKO なしは処理しない', () => {
		expect(handleMention(db, '明日の資料どうします?', 'member')).toBeNull();
	});
	it('ToDo 登録', () => {
		const r = handleMention(db, '@KUROKO 明日 17 時までに資料確認、ToDo 入れて', 'owner')!;
		expect(r.task).toEqual({ title: '資料確認', due: '2026-09-16', time: '17:00' });
	});
	it('Member の空き時間は詳細なし', () => {
		const r = handleMention(db, '@KUROKO 社長の水曜は空いてる?', 'member')!;
		expect(r.reply).toMatch(/^水曜は .+ が空いています。\(予定の詳細は共有できません\)$/);
	});
	it('Member はメールを見られない', () => {
		expect(handleMention(db, '@KUROKO 田中さんのメール見せて', 'member')!.reply).toBe(
			'メールの内容はオーナーのみが参照できます。'
		);
	});
});
