import { describe, it, expect } from 'vitest';
import { seed, SEED } from './seed';
import { search, recent, GROUPS } from './search';

const BASE = new Date(2026, 8, 15); // 火曜。シードの相対日付がこの日を基準になる

describe('search', () => {
	it('「田中」で 7 つの群に分かれて出る', () => {
		const d = seed(BASE);
		const hits = search(d, '田中');
		// 群は GROUPS の順に固まって並ぶ
		const groups = [...new Set(hits.map((h) => h.group))];
		expect(groups).toEqual(GROUPS);
		expect(hits.find((h) => h.group === '人物')).toMatchObject({
			label: '田中 太郎',
			href: `/people/${SEED.tanaka}`,
			source: '社内データ'
		});
		// 本人を通じて会社・案件・メール・予定・資料・ToDo まで当たる
		expect(hits.find((h) => h.group === '会社')?.label).toBe('ABC 株式会社');
		expect(hits.find((h) => h.group === 'メール')?.source).toBe('Gmail');
		expect(hits.find((h) => h.group === '予定')?.source).toBe('Google カレンダー');
		expect(hits.find((h) => h.group === '資料')?.source).toBe('ドキュメント');
	});

	it('群ごと最大 4 件', () => {
		const d = seed(BASE);
		// 「ABC」は ABC 社関連のメール・予定・資料が 4 件を超える
		for (const g of GROUPS) {
			expect(search(d, 'ABC').filter((h) => h.group === g).length).toBeLessThanOrEqual(4);
		}
	});

	it('部分一致で、大文字と小文字を区別しない', () => {
		const d = seed(BASE);
		expect(search(d, 'abc').some((h) => h.label === 'ABC 株式会社')).toBe(true);
		expect(search(d, 'たなか').some((h) => h.label === '田中 太郎')).toBe(true);
	});

	it('空欄と該当なしは 0 件', () => {
		const d = seed(BASE);
		expect(search(d, '')).toEqual([]);
		expect(search(d, '   ')).toEqual([]);
		expect(search(d, 'ここには無い文字列')).toEqual([]);
	});
});

describe('recent', () => {
	it('道を画面の名前に変える。詳細は実体の名前を出す', () => {
		const d = seed(BASE);
		d.demo.recent = ['/today', `/people/${SEED.tanaka}`, `/companies/${SEED.abcCo}`, '/settings'];
		expect(recent(d)).toEqual([
			{ href: '/today', label: 'Today' },
			{ href: `/people/${SEED.tanaka}`, label: '田中 太郎' },
			{ href: `/companies/${SEED.abcCo}`, label: 'ABC 株式会社' },
			{ href: '/settings', label: '設定' }
		]);
	});

	it('名前が引けない道は落とす', () => {
		const d = seed(BASE);
		d.demo.recent = ['/people/p-none', '/nowhere', '/today'];
		expect(recent(d).map((r) => r.href)).toEqual(['/today']);
	});
});
