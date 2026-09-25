import { describe, it, expect } from 'vitest';
import { seed, SEED } from '../seed';
import { route, reply } from './route';

const db = seed(new Date(2026, 8, 15));

describe('route', () => {
	it.each([
		['田中さんと打ち合わせ入れて', 'event', SEED.tanaka],
		['金曜までに ABC 社へ見積提出、覚えて', 'task', undefined],
		['田中さんとの過去のやり取り', 'person', SEED.tanaka],
		['佐藤さんのメールに返信', 'mail', SEED.sato],
		['明日の会議準備', 'brief', undefined],
		['田中さんに候補送って', 'schedule', SEED.tanaka],
		['ABC 社向けの提案書を作って', 'document', undefined],
		['こんにちは', 'unknown', undefined]
	])('%s → %s', (text, kind, personId) => {
		const r = route(db, text);
		expect(r.kind).toBe(kind);
		expect(r.personId).toBe(personId);
	});

	it('文脈チップの人物を使う', () => {
		expect(route(db, '返信案を作って', { label: '', personId: SEED.sato }).personId).toBe(SEED.sato);
	});

	it('提案書の種別', () => {
		expect(route(db, '見積作って').docKind).toBe('見積書');
	});

	/* 時刻の読み取り (dates.ts の hourOf)。言われた時刻を候補の開始に使うため、
	   言われなければ undefined のまま firstFreeStart の空き枠に任せる */
	it.each([
		['田中さんと明日 11 時に打ち合わせを入れて', '11:00'],
		['田中さんと明日 11:30 に打ち合わせを入れて', '11:30'],
		['田中さんと明日 14 時半に打ち合わせを入れて', '14:30'],
		['田中さんと明日打ち合わせを入れて', undefined],
		// 業務時間 (9:00-18:00) の外は読み取らない
		['田中さんと明日 21 時に打ち合わせを入れて', undefined]
	])('%s → %s', (text, at) => {
		expect(route(db, text).at).toBe(at);
	});

	it('時刻を言うとその時刻から候補を出す', () => {
		const c = reply(db, route(db, '田中さんと明日 11 時に打ち合わせを入れて')).card!;
		expect(c.lines[1]).toContain('11:00〜12:00');
	});

	it('時刻を言わなければ空き枠から出す', () => {
		const c = reply(db, route(db, '田中さんと明日打ち合わせを入れて')).card!;
		expect(c.lines[1]).toContain('9:00〜10:00');
	});

	/* 聞き返しの選択肢は人物しか運べない (REASK)。日時は聞き返す前の依頼から引き継ぐ。
	   第 4 引数は actions.ts の chatSend が直前の発言を渡すもの */
	it('聞き返しの選択肢に時刻を引き継ぐ', () => {
		const i = route(db, '田中さんと打ち合わせを入れて', undefined, '明日 11 時に打ち合わせを入れて');
		expect(i.at).toBe('11:00');
		expect(reply(db, i).card!.lines[1]).toContain('11:00〜12:00');
	});

	it('聞き返しの選択肢に日付を引き継ぐ', () => {
		const i = route(db, '田中さんと打ち合わせを入れて', undefined, '来週 打ち合わせを入れて');
		expect(i.when).toBe(route(db, '来週 打ち合わせを入れて').when);
		// 基準日 2026-09-15 の「来週」は bizDay(5) = 9/22。「明日」の 9/16 ではない
		expect(reply(db, i).card!.lines[1]).toContain('9/22');
	});

	it('言い直しで日時を言えばそちらを使う', () => {
		const i = route(db, '田中さんと明日 15 時に打ち合わせを入れて', undefined, '来週 11 時に打ち合わせ');
		expect(i.at).toBe('15:00');
		expect(i.when).toBe(route(db, '明日').when);
	});
});
