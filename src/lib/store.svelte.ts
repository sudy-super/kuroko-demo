import type { Db } from './types';
import { seed, DB_VERSION } from './seed';
import { key, today } from './dates';

export const STORAGE_KEY = 'kuroko-demo';
const hasStorage = () => typeof localStorage !== 'undefined';

export function loadFromStorage(): Db | null {
	if (!hasStorage()) return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Db;
		// 日付の相対関係が崩れるため、版が違うか前日以前のシードなら捨てる
		if (parsed.version !== DB_VERSION || parsed.seededOn !== key(today())) return null;
		return parsed;
	} catch {
		return null;
	}
}

export const db: Db = $state(loadFromStorage() ?? seed());

export function save() {
	if (!hasStorage()) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify($state.snapshot(db)));
}

// db の束縛は差し替えられないため、キーごとに中身を移す
export function replaceDb(next: Db) {
	for (const k of Object.keys(next) as (keyof Db)[]) (db as any)[k] = next[k];
}

export function resetDb() {
	replaceDb(seed());
	save();
}

export function installStorageSync(): () => void {
	const h = (e: StorageEvent) => {
		if (e.key === STORAGE_KEY && e.newValue) replaceDb(JSON.parse(e.newValue));
	};
	window.addEventListener('storage', h);
	return () => window.removeEventListener('storage', h);
}
