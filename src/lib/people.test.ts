import { describe, it, expect } from 'vitest';
import { seed } from './seed';
import { identitiesOf, personHistory, personStats } from './people';
import { updatePersonMemo } from './actions';
import { replaceDb, db } from './store.svelte';

const BASE = new Date(2026, 8, 15); // 火曜。シードの相対日付がこの日を基準になる

describe('identitiesOf', () => {
	it('その人物に紐づく連絡先だけを返す', () => {
		const d = seed(BASE);
		expect(identitiesOf(d, 'p-tanaka').map((i) => i.id)).toEqual(['id-tanaka-mail', 'id-tanaka-line']);
		// personId のない連絡先 (未登録の差出人) は誰のものにもならない
		expect(identitiesOf(d, 'p-sato').map((i) => i.kind)).toEqual(['email', 'slack_id']);
		expect(identitiesOf(d, 'p-none')).toEqual([]);
	});
});

describe('personHistory', () => {
	it('スレッドと会議を新しい順に並べる', () => {
		const d = seed(BASE);
		const h = personHistory(d, 'p-tanaka');
		expect(h.map((x) => x.title)).toEqual(['次回お打ち合わせについて', '先ほどの件、了解しました']);
		expect(h.map((x) => x.kind)).toEqual(['mail', 'line']);
		expect(h.map((x) => x.label)).toEqual(['メール', 'LINE']);
		expect(h[0].href).toBe('/inbox?t=th-tanaka-next');
		expect(h[0].at > h[1].at).toBe(true);
	});

	it('Slack のスレッドは slack になる', () => {
		const d = seed(BASE);
		expect(personHistory(d, 'p-yamada').map((x) => x.kind)).toEqual(['slack']);
	});

	it('これから先の会議は「最近のやりとり」に混ぜない', () => {
		const d = seed(BASE);
		// m-abc の予定 (ev-abc-meeting) は翌営業日なので出さない
		expect(personHistory(d, 'p-tanaka').some((x) => x.kind === 'meeting')).toBe(false);
	});

	it('過去の会議は会議として出し、時刻は 0 埋めして比べる', () => {
		const d = seed(BASE);
		d.events.push({
			id: 'ev-past',
			date: '2026-09-14',
			start: '9:00',
			end: '10:00',
			title: 'ABC 株式会社 初回商談',
			personIds: ['p-tanaka'],
			source: 'gcal',
			meetingId: 'm-past'
		});
		d.meetings.push({
			id: 'm-past',
			eventId: 'ev-past',
			title: 'ABC 株式会社 初回商談',
			personIds: ['p-tanaka'],
			purpose: '',
			briefRead: false,
			agenda: [],
			agendaShared: false,
			transcriptIds: []
		});
		const h = personHistory(d, 'p-tanaka');
		const m = h.find((x) => x.kind === 'meeting')!;
		expect(m.at).toBe('2026-09-14T09:00');
		expect(m.href).toBe('/meetings/m-past');
		// 9/14 19:40 の LINE より後ろに来る (文字列のままだと '9:00' > '19:40' になってしまう)
		expect(h.map((x) => x.title)).toEqual([
			'次回お打ち合わせについて',
			'先ほどの件、了解しました',
			'ABC 株式会社 初回商談'
		]);
	});
});

describe('personStats', () => {
	it('メールの通数、会議の件数、最終商談を返す', () => {
		const d = seed(BASE);
		// th-tanaka-next の 2 通。LINE のスレッドは数えない
		expect(personStats(d, 'p-tanaka')).toEqual({ mails: 2, meetings: 1, lastMeeting: undefined });
		expect(personStats(d, 'p-sato')).toEqual({ mails: 2, meetings: 0, lastMeeting: undefined });
	});

	it('最終商談は基準日までで最も新しい会議の日付', () => {
		const d = seed(BASE);
		d.events.push({
			id: 'ev-past',
			date: '2026-09-01',
			start: '15:00',
			end: '16:00',
			title: '見積提示',
			personIds: ['p-tanaka'],
			source: 'gcal',
			meetingId: 'm-past'
		});
		d.meetings.push({
			id: 'm-past',
			eventId: 'ev-past',
			title: '見積提示',
			personIds: ['p-tanaka'],
			purpose: '',
			briefRead: false,
			agenda: [],
			agendaShared: false,
			transcriptIds: []
		});
		expect(personStats(d, 'p-tanaka')).toEqual({ mails: 2, meetings: 2, lastMeeting: '2026-09-01' });
	});
});

describe('updatePersonMemo', () => {
	it('メモを書き換えて作業履歴に残す', () => {
		replaceDb(seed(BASE));
		const before = db.logs.length;
		const p = updatePersonMemo('p-tanaka', '価格は決裁者と直接詰める。');
		expect(p?.memo).toBe('価格は決裁者と直接詰める。');
		expect(db.people.find((x) => x.id === 'p-tanaka')!.memo).toBe('価格は決裁者と直接詰める。');
		expect(db.logs.length).toBe(before + 1);
		expect(db.logs[0]).toMatchObject({ actor: 'user', origin: 'people', kind: 'other' });
		expect(db.logs[0].text).toContain('田中 太郎');
	});

	it('中身が変わらないときは履歴を増やさない', () => {
		replaceDb(seed(BASE));
		const memo = db.people.find((x) => x.id === 'p-tanaka')!.memo;
		const before = db.logs.length;
		updatePersonMemo('p-tanaka', memo);
		expect(db.logs.length).toBe(before);
	});
});
