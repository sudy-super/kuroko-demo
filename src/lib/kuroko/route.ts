import type { ChatMessage, Db, Suggestion } from '../types';
import type { ContextChip } from '../ui.svelte';
import { key, bizDay, nextWeekday, parse, nowIso, fmtMDW } from '../dates';
import { companyOf, nextMeeting, personOf, projectOf } from '../derived';
import { slotsFor, uid } from './generate';

/** 仕様 9.1 のキーワード表による振り分け。LLM は使わない */
export type Intent = {
	kind: 'event' | 'task' | 'person' | 'mail' | 'brief' | 'schedule' | 'document' | 'unknown';
	personId?: string;
	when?: string;
	docKind?: '提案書' | '見積書' | '報告書';
	raw: string;
};

const PEOPLE: [string, string][] = [
	['田中', 'p-tanaka'],
	['佐藤', 'p-sato'],
	['山田', 'p-yamada']
];

/** 人物が要る用件。埋まらないときだけ聞き返す (仕様 9.1「1 往復まで」) */
const NEEDS_PERSON: Intent['kind'][] = ['event', 'person', 'mail', 'schedule'];

export function route(db: Db, text: string, ctx?: ContextChip): Intent {
	const t = text.trim();
	const personId = PEOPLE.find(([name]) => t.includes(name))?.[1] ?? ctx?.personId;
	// 「明日」はデモの基準日から数える。シードが seededOn を today として組まれているため
	const base = parse(db.seededOn);
	const when = /明日/.test(t)
		? key(bizDay(1, base))
		: /今週/.test(t)
			? key(bizDay(2, base))
			: /来週/.test(t)
				? key(bizDay(5, base))
				: /金曜/.test(t)
					? key(nextWeekday(5, base))
					: undefined;
	const docKind = /提案書/.test(t)
		? '提案書'
		: /見積/.test(t)
			? '見積書'
			: /報告書/.test(t)
				? '報告書'
				: undefined;
	let kind: Intent['kind'] = 'unknown';
	if (/日程調整|候補(を)?送/.test(t)) kind = 'schedule';
	else if (docKind && /作|生成/.test(t)) kind = 'document';
	else if (/会議準備|ブリーフ|準備/.test(t)) kind = 'brief';
	else if (/todo|覚えて|リマインド|までに/i.test(t)) kind = 'task';
	else if (/メール|返信/.test(t)) kind = 'mail';
	else if (
		/打ち合わせ|打合せ|予定|会議|ミーティング|商談/.test(t) &&
		/入れ|作|追加|設定|セット|したい|お願い/.test(t)
	)
		kind = 'event';
	else if (/やり取り|この人|過去|について|プロフィール/.test(t) || (personId && !when))
		kind = 'person';
	return { kind, personId, when, docKind, raw: t };
}

/** 振り分け先が分からないときに出す 7 種。押すとその文言をそのまま送り直す */
export const GUIDE_CHIPS = [
	'打ち合わせを入れて',
	'ToDo を覚えて',
	'過去のやり取りを見せて',
	'メールに返信',
	'会議準備',
	'日程調整して',
	'提案書を作って'
];

type Reply = Pick<ChatMessage, 'text' | 'card' | 'chips'> & { suggestion?: Suggestion };

const sug = (kind: Suggestion['kind'], reason: string, payload: Suggestion['payload']): Suggestion => ({
	id: uid('sg'),
	source: 'chat',
	kind,
	status: 'pending',
	reason,
	payload,
	createdAt: nowIso()
});

const nameOf = (db: Db, personId: string) => personOf(db, personId)?.name.split(' ')[0] ?? '';

/** 人物の指定が要る用件で相手が分からないとき、その用件のまま送り直せる文言にする */
const personChips = (raw: string) => PEOPLE.map(([name]) => `${name}さん ${raw}`);

/**
 * 意図から KUROKO の返答を組み立てる。event と task は候補 (Suggestion) までで、
 * 保存はカードのボタン (chatAct) を押したときに初めて行う (仕様 5.4)
 */
export function reply(db: Db, i: Intent, asked = false): Reply {
	const person = personOf(db, i.personId);
	if (!person && NEEDS_PERSON.includes(i.kind)) {
		// 聞き返しは 1 往復まで。一度聞いても埋まらなければ用件の選び直しに戻す (仕様 9.1)
		if (asked) return { text: 'うまく聞き取れませんでした。次のどれをお手伝いしましょうか?', chips: GUIDE_CHIPS };
		return { text: 'どなたについてでしょうか?', chips: personChips(i.raw) };
	}
	const base = parse(db.seededOn);

	if (i.kind === 'event') {
		const date = i.when ?? key(bizDay(1, base));
		const title = `${nameOf(db, person!.id)}様との打ち合わせ`;
		const s = sug('event', `「${i.raw}」を打ち合わせの依頼と受け取りました`, {
			type: 'event',
			title,
			date,
			start: '10:00',
			end: '11:00',
			personIds: [person!.id],
			projectId: person!.projectIds[0],
			online: 'meet'
		});
		return {
			card: {
				icon: 'ic-cal',
				title: '予定の候補',
				lines: [title, `${fmtMDW(parse(date))} 10:00〜11:00`, 'Meet'],
				reason: s.reason,
				actions: [
					{ label: 'この内容で作成', act: 'create-event', arg: s.id },
					{ label: '日時を変更する', act: 'change-date', arg: s.id }
				]
			},
			suggestion: s
		};
	}

	if (i.kind === 'task') {
		// 「覚えて」「リマインド」のような頼み方の部分は ToDo の題名から落とす
		const title = i.raw.replace(/[、,]?\s*(覚えて|リマインドして|リマインド|todo)[。.!！]?$/i, '').trim();
		const s = sug('task', `「${i.raw}」を ToDo の依頼と受け取りました`, {
			type: 'task',
			title,
			due: i.when,
			personId: i.personId
		});
		return {
			card: {
				icon: 'ic-todo',
				title: 'ToDo の候補',
				lines: [title, i.when ? `期限 ${fmtMDW(parse(i.when))}` : '期限なし'],
				reason: s.reason,
				actions: [{ label: '登録', act: 'add-task', arg: s.id }]
			},
			suggestion: s
		};
	}

	if (i.kind === 'person') {
		const company = companyOf(db, person!.companyId);
		const project = projectOf(db, person!.projectIds[0]);
		const mail = db.identities.find((x) => x.personId === person!.id && x.kind === 'email');
		return {
			card: {
				icon: 'ic-people',
				title: person!.name,
				lines: [
					[company?.name, person!.title].filter(Boolean).join(' '),
					mail?.value ?? '',
					project ? `${project.name} (${project.status} / ${project.amount})` : ''
				].filter(Boolean),
				reason: '登録済みの人物から引きました',
				actions: [{ label: 'プロフィールを開く', act: 'open-person', arg: person!.id }]
			}
		};
	}

	if (i.kind === 'mail') {
		const th = db.threads.find((t) => t.personId === person!.id && t.inQueue && !t.done);
		if (!th) return { text: `${nameOf(db, person!.id)}様からの未対応の連絡はありません。` };
		return {
			card: {
				icon: 'ic-mail',
				title: th.subject,
				lines: [th.sender, th.needsReply ? '返信が必要です' : '未対応'],
				reason: '要対応として選んだ連絡から引きました',
				actions: [{ label: 'メールを開いて返信案を作る', act: 'open-thread', arg: th.id }]
			}
		};
	}

	if (i.kind === 'brief') {
		const next = nextMeeting(db);
		if (!next) return { text: '準備が必要な会議はありません。' };
		return {
			card: {
				icon: 'ic-bell',
				title: next.meeting.title,
				lines: [
					`${fmtMDW(parse(next.event.date))} ${next.event.start}〜${next.event.end}`,
					next.meeting.purpose
				],
				reason: '直近の会議の Brief が用意できています',
				actions: [{ label: 'Brief を開く', act: 'open-meeting', arg: next.meeting.id }]
			}
		};
	}

	if (i.kind === 'schedule') {
		const th = db.threads.find((t) => t.personId === person!.id && t.inQueue && !t.done);
		// 日程候補は返信の本文に差し込む形でしか送れない (insertSlots が threadId を要る)
		if (!th) return { text: `${nameOf(db, person!.id)}様宛の返信できる連絡がありません。` };
		const slots = slotsFor(db, person!.id).filter((s) => s.selected);
		return {
			card: {
				icon: 'ic-clock',
				title: `${nameOf(db, person!.id)}様への日程候補`,
				lines: slots.map((s) => `${fmtMDW(parse(s.date))} ${s.start}〜${s.end}`),
				reason: '空いている時間から 3 件選びました',
				// 候補を本文に差し込むのは返信欄の「日程候補を入れる」の仕事 (ReplyBox.svelte)。
				// ここで insertSlots しても ReplyBox が開くときに下書きを落とすので、開くまでにする
				actions: [{ label: 'メールを開いて候補を入れる', act: 'open-thread', arg: th.id }]
			}
		};
	}

	if (i.kind === 'document') {
		const kind = i.docKind!;
		const project = projectOf(db, person?.projectIds[0]) ?? db.projects[0];
		return {
			card: {
				icon: 'ic-doc',
				title: `${kind}の作成`,
				lines: [project ? `${project.name} (${project.status})` : '案件の指定なし', `種別 ${kind}`],
				reason: `「${i.raw}」を${kind}の作成依頼と受け取りました`,
				actions: [{ label: '下書きを作る', act: 'gen-doc', arg: kind }]
			}
		};
	}

	return { text: '次のどれをお手伝いしましょうか?', chips: GUIDE_CHIPS };
}

/* 待っている間に出す文。HIG の Generative AI は「Processing… ではなく Finding substitutions
   for ingredients のように何をしているかを書け」と例示する (chat.md 資料 1)。
   意図が分からないときだけ、何を探しているか言えないので曖昧なままにする */
const WORKING: Record<Intent['kind'], string> = {
	event: '空いている時間を探しています',
	task: 'ToDo の内容をまとめています',
	person: '過去のやり取りを探しています',
	mail: 'メールの返信案を作っています',
	brief: '会議の資料を集めています',
	schedule: '日程の候補を選んでいます',
	document: '書類の下書きを作っています',
	unknown: 'ご依頼の内容を読み取っています'
};
export const workingText = (i: Intent) => WORKING[i.kind];
