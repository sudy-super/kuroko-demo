import type { Db, LineMessage } from '../types';
import { bizDay, key, parse, fmtMD, whenOf } from '../dates';
import { freeSlots, personOf } from '../derived';

export interface MentionResult {
	reply: string;
	card?: LineMessage['card'];
	task?: { title: string; due: string; time?: string };
	suggestion?: { title: string; date: string };
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const MENTION = /^@KUROKO\s*/;
/** 時期の読み取りは /chat と同じ規則 (dates.ts の whenOf)。読み取れなければ翌営業日に倒す */
function dayOf(db: Db, text: string): { date: Date; label: string } {
	const base = parse(db.seededOn);
	const date = whenOf(text, base) ?? bizDay(1, base);
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
				actions: [{ label: 'ToDo で見る', act: 'open', arg: '/tasks' }]
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
				actions: [{ label: 'メールを開く', act: 'open', arg: `/inbox?t=${th.id}` }]
			}
		};
	}

	/* chat.md 観点 4.2 — 聞き返しの候補は文で並べず押せるものにする (NN/g: 文で出した
	   Williams Sonoma より、ボタンで出した Home Depot のほうが「先に進む道筋が明確」)。
	   /chat の unknown が 7 チップを出しているのと同じ形。押すとこの文がそのまま送り直される */
	return {
		reply: 'この内容は引き受けられません。次のどれをお手伝いしましょうか?',
		card: {
			title: '引き受けられる用件',
			lines: [],
			actions: [
				{ label: '予定を入れる', act: 'say', arg: '@KUROKO 水曜に「打ち合わせ」の予定を入れて' },
				{ label: '空き時間を聞く', act: 'say', arg: '@KUROKO 水曜は空いてる?' },
				{ label: 'ToDo に入れる', act: 'say', arg: '@KUROKO 明日までに資料確認、ToDo に入れて' }
			]
		}
	};
}

/* 社外への送信 (approve) と本文を見る操作 (preview) は社長だけ (仕様 5.13)。
   handleMention が member の「メール見せて」を断るのと、カードの操作でも揃える。
   押しても何も起きないボタンは残さない (出さないほうを選ぶ) — LineChat.svelte */
const OWNER_ONLY = ['approve', 'preview'];
export const visibleActions = (
	card: NonNullable<LineMessage['card']>,
	role: 'owner' | 'member'
) => (role === 'owner' ? card.actions : card.actions.filter((a) => !OWNER_ONLY.includes(a.act)));
