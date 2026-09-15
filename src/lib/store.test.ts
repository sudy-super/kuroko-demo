import { describe, it, expect, beforeEach } from 'vitest';
import { db, save, resetDb, loadFromStorage, STORAGE_KEY } from './store.svelte';

const mem: Record<string, string> = {};
beforeEach(() => {
	for (const k in mem) delete mem[k];
	(globalThis as any).localStorage = {
		getItem: (k: string) => mem[k] ?? null,
		setItem: (k: string, v: string) => {
			mem[k] = v;
		},
		removeItem: (k: string) => {
			delete mem[k];
		}
	};
});

describe('store', () => {
	it('save して load すると同じ件数', () => {
		resetDb();
		db.tasks.push({
			id: 'x',
			title: 'テスト',
			priority: 'normal',
			status: 'todo',
			origin: 'tasks',
			createdAt: ''
		});
		save();
		expect(loadFromStorage()!.tasks.find((t) => t.id === 'x')).toBeTruthy();
	});
	it('seededOn が今日でなければ null', () => {
		resetDb();
		db.seededOn = '2000-01-01';
		save();
		expect(loadFromStorage()).toBeNull();
	});
});
