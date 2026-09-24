import type { Connection, Automation } from '../types';
import { db, resetDb } from '../store.svelte';
import { nowIso } from '../dates';
import { todayCount } from '../derived';
import { resetLayout } from '../todayLayout.svelte';
import { timers } from './core';

export function setAutomation(level: Automation) {
	db.settings.automation = level;
}
export function toggleConnection(id: 'gmail' | 'gcal' | 'slack' | 'line') {
	const c = db.settings.connections.find((x) => x.id === id)!;
	c.connected = !c.connected;
	c.lastSync = c.connected ? nowIso() : undefined;
}
// 1 つずつ繋ぐ。toggleConnection は反転なので、繋ぐ向きにしか動かさない
export function connect(id: Connection['id']) {
	const c = db.settings.connections.find((x) => x.id === id)!;
	if (!c.connected) toggleConnection(id);
}
export function resetDemo() {
	for (const t of timers.values()) clearTimeout(t);
	timers.clear();
	resetDb();
	// Today のカードの配置はデモのデータとは別の鍵に置いているので、ここで一緒に消す (docs/research/card-drag.md)
	resetLayout();
}
// 接続直後は案内を出さない。案内は上部バーの「デモの操作」のメニューか ⌘K から始める
export function markStarted() {
	db.demo.started = true;
}
export function startGuide() {
	// 完了画面からの始め直し。Welcome へ戻らないので、seed() が未接続に戻した接続を元の状態に戻す
	// (全部繋ぐと、スキップして未接続で使っていた人の画面に連携アイコンの列が生える)
	if (todayCount(db) === 0) {
		const before = new Map(db.settings.connections.map((c) => [c.id, c.connected]));
		resetDemo();
		for (const c of db.settings.connections) if (before.get(c.id)) connect(c.id);
	}
	db.demo.started = true;
	db.demo.guide.on = true;
}
export function stopGuide() {
	db.demo.guide.on = false;
}
export function startScenario(n: number) {
	db.demo.scenario = n;
}
export function noteRecent(href: string) {
	db.demo.recent = [href, ...db.demo.recent.filter((h) => h !== href)].slice(0, 5);
}
