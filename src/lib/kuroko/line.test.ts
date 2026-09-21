import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { seed } from '../seed';
import { handleMention, visibleActions } from './line';
import { route } from './route';
import { db as store, resetDb } from '../store.svelte';
import { lineApprove } from '../actions';

const db = seed(new Date(2026, 8, 15));

describe('LINE', () => {
	it('@KUROKO なしは処理しない', () => {
		expect(handleMention(db, '明日の資料どうします?', 'member')).toBeNull();
	});
	it('ToDo 登録', () => {
		const r = handleMention(db, '@KUROKO 明日 17 時までに資料確認、ToDo 入れて', 'owner')!;
		expect(r.task).toEqual({ title: '資料確認', due: '2026-09-16', time: '17:00' });
	});
	// 時期の読み取りは /chat (kuroko/route.ts) と同じ dates.ts の whenOf に寄せてある。
	// 2026-09-15 (火) の「来週」は 5 営業日先の 9/22 で、翌日 (9/16) ではない
	it('来週は 5 営業日先', () => {
		const r = handleMention(db, '@KUROKO 来週までに請求書を送る、ToDo に入れて', 'owner')!;
		expect(r.task).toEqual({ title: '請求書を送る', due: '2026-09-22' });
		expect(route(db, '来週までに請求書を送る、覚えて').when).toBe(r.task!.due);
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

describe('lineApprove', () => {
	beforeEach(() => {
		(globalThis as unknown as { localStorage: Storage }).localStorage = {
			getItem: () => null,
			setItem() {},
			removeItem() {}
		} as unknown as Storage;
		resetDb();
		// approve は 5 秒後の送信のタイマーを張るので、実時間で放置しない (approval.test.ts と同じ)
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	// 社外送信は社長の判断。member の画面には操作を出さないが、通り道自体も塞ぐ
	it('Member は社外送信を承認できない', () => {
		const a = store.approvals.find((x) => x.status === 'pending' && x.risk === 'external_send')!;
		expect(lineApprove(a.id, 'member', 'line')).toBe(false);
		expect(store.approvals.find((x) => x.id === a.id)!.status).toBe('pending');
	});

	it('Owner は承認できる', () => {
		const a = store.approvals.find((x) => x.status === 'pending' && x.risk === 'external_send')!;
		expect(lineApprove(a.id, 'owner', 'line')).toBe(true);
		expect(store.approvals.find((x) => x.id === a.id)!.status).toBe('sending');
	});
});

describe('visibleActions', () => {
	const card = {
		title: '田中様への返信',
		lines: [],
		actions: [
			{ label: '内容を見る', act: 'preview', arg: 'ap-1' },
			{ label: '承認して送信', act: 'approve', arg: 'ap-1' },
			{ label: 'Inbox で見る', act: 'open', arg: '/inbox' }
		]
	};
	// 本文の参照も社外送信も社長の判断 (handleMention が member の「メール見せて」を断るのと同じ)
	it('Member には本文を見る操作も承認も出さない', () => {
		expect(visibleActions(card, 'member').map((a) => a.act)).toEqual(['open']);
	});
	it('Owner には全部出す', () => {
		expect(visibleActions(card, 'owner')).toHaveLength(3);
	});
});
