import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb } from './store.svelte';
import { addPerson, linkIdentity, undo } from './actions';
import { personOfIdentity } from './derived';

beforeEach(() => {
	(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
	resetDb();
});

describe('ChannelIdentity の関連付け', () => {
	it('未登録の差出人は関連付けまでパネルに出ない', () => {
		expect(personOfIdentity(db, 'id-sunrise')).toBeUndefined();
		const p = addPerson(
			{
				name: '鈴木 一郎',
				kana: 'すずき いちろう',
				company: '株式会社サンライズ',
				title: '採用担当',
				email: 'suzuki@sunrise.co.jp',
				phone: '03-5555-0101',
				lowConfidence: ['phone']
			},
			'people'
		);
		expect(personOfIdentity(db, 'id-sunrise')).toBeUndefined();
		linkIdentity('id-sunrise', p.id);
		expect(personOfIdentity(db, 'id-sunrise')?.id).toBe(p.id);
		expect(db.threads.filter((t) => t.identityId === 'id-sunrise').every((t) => t.personId === p.id)).toBe(true);
		undo(db.logs[0].id);
		expect(personOfIdentity(db, 'id-sunrise')).toBeUndefined();
	});
});
