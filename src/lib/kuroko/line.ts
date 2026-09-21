import type { Db, LineMessage } from '../types';
import { bizDay, key, nextWeekday, parse, fmtMD } from '../dates';
import { freeSlots, personOf } from '../derived';

export interface MentionResult {
	reply: string;
	card?: LineMessage['card'];
	task?: { title: string; due: string; time?: string };
	suggestion?: { title: string; date: string };
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const MENTION = /^@KUROKO\s*/;
/** 「水曜」「水曜日」から曜日番号を取る。無ければ翌営業日の曜日に倒す */
function dayOf(db: Db, text: string): { date: Date; label: string } {
	const base = parse(db.seededOn);
	const m = text.match(/([日月火水木金土])曜/);
	const date = m ? nextWeekday(WD.indexOf(m[1]), base) : bizDay(1, base);
	return { date, label: WD[date.getDay()] };
}

const slotsText = (db: Db, date: Date) =>
	freeSlots(db, key(date))
		.map((s) => `${s.start}-${s.end}`)
		.join('、');

/**
 * LINE / Slack の @KUROKO への言及を 1 件だけ解釈する。`@KUROKO` で始まらなければ
 * 何もしない (画面上部のバナーの文言どおり)。
 * role は見せてよい範囲を決める。member (従業員) には予定の中身・メール本文・書き込みを渡さない
 */
export function handleMention(db: Db, text: string, role: 'owner' | 'member'): MentionResult | null {
	if (!MENTION.test(text)) return null;
	const body = text.replace(MENTION, '');
	const owner = role === 'owner';

	if (/予定.*(入れ|作)/.test(body)) {
		const { date, label } = dayOf(db, body);
		const title = body.match(/「(.+?)」/)?.[1] ?? '打ち合わせ';
		const suggestion = { title, date: key(date) };
		return owner
			? { reply: `${label}曜の予定の候補を作りました。KUROKO のチャットで確認してください。`, suggestion }
			: { reply: '予定の登録はオーナーに依頼します。', suggestion };
	}

	if (/todo|入れて|覚えて/i.test(body)) {
		// 「までに」の後ろから「、」まで。無ければ命令の語を落とした残り
		const title =
			body.match(/までに(.+?)[、。]/)?.[1] ??
			body.replace(/.*までに/, '').replace(/[、。]?\s*(ToDo|todo)?\s*(入れて|覚えて).*$/i, '').trim();
		const { date } = dayOf(db, body);
		const hour = body.match(/(\d+)\s*時/)?.[1];
		const task = { title, due: key(date), ...(hour ? { time: `${Number(hour)}:00` } : {}) };
		const who = owner ? db.user.name : (personOf(db, 'p-yamada')?.name ?? '');
		return {
			reply: 'ToDo を登録しました。',
			task,
			card: {
				title,
				lines: [`期限 ${/明日/.test(body) ? '明日' : fmtMD(date)}${hour ? ` ${task.time}` : ''}`, `登録者 ${who}`],
				actions: [{ label: 'Tasks で見る', act: 'open', arg: '/tasks' }]
			}
		};
	}

	if (/空いてる|空き/.test(body)) {
		const { date, label } = dayOf(db, body);
		const free = slotsText(db, date);
		if (!owner) return { reply: `${label}曜は ${free} が空いています。(予定の詳細は共有できません)` };
		const busy = db.events
			.filter((e) => e.date === key(date))
			.map((e) => `${e.start}-${e.end} ${e.title}`)
			.join('、');
		return {
			reply: `${label}曜 (${fmtMD(date)}) は ${free} が空いています。${busy ? `埋まっているのは ${busy} です。` : ''}`
		};
	}

	if (/メール|見せて/.test(body)) {
		if (!owner) return { reply: 'メールの内容はオーナーのみが参照できます。' };
		const th =
			db.threads.find((t) => t.inQueue && db.people.some((p) => t.personId === p.id && body.includes(p.name.split(' ')[0]))) ??
			db.threads.find((t) => t.inQueue)!;
		const last = [...db.messages].reverse().find((m) => m.threadId === th.id && m.from === 'them');
		return {
			reply: `${personOf(db, th.personId)?.name.split(' ')[0] ?? '相手'}様の最新のメールは「${th.subject}」です。${last?.body.split('\n').filter(Boolean)[1] ?? ''}`,
			card: {
				title: th.subject,
				lines: [th.sender],
				actions: [{ label: 'Inbox で見る', act: 'open', arg: `/inbox?t=${th.id}` }]
			}
		};
	}

	return { reply: 'この内容は引き受けられません。予定、空き時間、ToDo の登録をお試しください。' };
}
