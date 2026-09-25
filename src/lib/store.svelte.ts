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

const serialize = () => JSON.stringify($state.snapshot(db));
// 最後に localStorage と揃えた中身。同じ中身は書き戻さない (書き戻すと、キーの並びの違いだけで
// 2 つのタブが storage イベントを投げ合い続ける)
let synced = '';

export function save() {
	if (!hasStorage()) return;
	localStorage.setItem(STORAGE_KEY, (synced = serialize()));
}

// ブラウザでは db の変化を 1 か所で見て保存する。1 回の操作での書き込みは $effect が 1 回にまとめる
if (hasStorage()) {
	synced = serialize();
	$effect.root(() => {
		$effect(() => {
			const s = serialize();
			if (s !== synced) localStorage.setItem(STORAGE_KEY, (synced = s));
		});
	});
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
	// storage イベントは受信側の localStorage が更新された後に発火するので、
	// 自前で解析せず loadFromStorage の検証を通す
	const h = (e: StorageEvent) => {
		if (e.key !== STORAGE_KEY) return;
		const next = loadFromStorage();
		if (!next) return;
		replaceDb(next);
		synced = serialize();
	};
	window.addEventListener('storage', h);
	return () => window.removeEventListener('storage', h);
}
