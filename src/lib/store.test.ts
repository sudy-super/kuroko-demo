import { describe, it, expect, beforeEach } from 'vitest';
import { db, save, resetDb, loadFromStorage, installStorageSync, STORAGE_KEY } from './store.svelte';
import { DB_VERSION } from './seed';
import type { Db } from './types';

// node には window が無いので、イベントを配るだけの最小の代用を置く
const win = new EventTarget();
(globalThis as any).window = win;
const fireStorage = () => win.dispatchEvent(Object.assign(new Event('storage'), { key: STORAGE_KEY }));

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
	it('save した内容が load で戻る', () => {
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
	it('別タブが書いた内容を storage イベントで取り込む', () => {
		resetDb();
		const stop = installStorageSync();
		const next = JSON.parse(mem[STORAGE_KEY]) as Db;
		next.tasks.push({
			id: 'y',
			title: '別タブ',
			priority: 'normal',
			status: 'todo',
			origin: 'tasks',
			createdAt: ''
		});
		mem[STORAGE_KEY] = JSON.stringify(next);
		fireStorage();
		stop();
		expect(db.tasks.find((t) => t.id === 'y')).toBeTruthy();
	});
	it('版が違う内容は storage イベントで取り込まない', () => {
		resetDb();
		const stop = installStorageSync();
		const before = db.tasks.length;
		const next = JSON.parse(mem[STORAGE_KEY]) as Db;
		mem[STORAGE_KEY] = JSON.stringify({ ...next, version: DB_VERSION + 1, tasks: [] });
		fireStorage();
		stop();
		expect(db.tasks.length).toBe(before);
	});
});
