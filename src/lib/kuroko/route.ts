import type { ChatMessage, Db, Suggestion } from '../types';
import type { ContextChip } from '../ui.svelte';
import { key, bizDay, parse, fmtMDW, whenOf, hourOf } from '../dates';
import { companyOf, firstFreeStart, nextMeeting, personOf, projectOf } from '../derived';
import { slotsFor, suggestion } from './generate';
import { SEED } from '../seed';

/** 仕様 9.1 のキーワード表による振り分け。LLM は使わない */
export type Intent = {
	kind: 'event' | 'task' | 'person' | 'mail' | 'brief' | 'schedule' | 'document' | 'unknown';
	personId?: string;
	when?: string;
	/** 「11 時」のように時刻まで言われたとき。言われなければ空き枠に任せる (firstFreeStart) */
	at?: string;
	docKind?: '提案書' | '見積書' | '報告書';
	raw: string;
};

const PEOPLE: [string, string][] = [
	['田中', SEED.tanaka],
	['佐藤', SEED.sato],
	['山田', SEED.yamada]
];

/**
 * 人物が要る用件。埋まらないときだけ聞き返す。
 * 往復の上限を定めた一次資料は無い (chat.md 観点 4.4 — NN/g の 425 会話は平均 3.6 往復で、
 * 長さと有用性に相関なし)。1 往復に限っているのはデモの都合であって規定ではない
 */
const NEEDS_PERSON: Intent['kind'][] = ['event', 'person', 'mail', 'schedule'];

/**
 * prev は聞き返しの直前の依頼 (actions.ts の chatSend が渡す)。
 * 聞き返しの選択肢は短い言い直しなので日時を持たない (下の REASK)。元の依頼から引き継ぐ
 */
export function route(db: Db, text: string, ctx?: ContextChip, prev?: string): Intent {
	const t = text.trim();
	const personId = PEOPLE.find(([name]) => t.includes(name))?.[1] ?? ctx?.personId;
	// 「明日」はデモの基準日から数える。シードが seededOn を today として組まれているため
	const base = parse(db.seededOn);
	const w = whenOf(t, base) ?? (prev ? whenOf(prev, base) : undefined);
	const when = w && key(w);
	const at = hourOf(t) ?? (prev ? hourOf(prev) : undefined);
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
	return { kind, personId, when, at, docKind, raw: t };
}

/**
 * 振り分け先が分からないときに出す 7 種。押すとその文言をそのまま送り直す。
 * 扱える用件を最初に並べる (chat.md 観点 4.5 — 「何でもどうぞ」と言わない)。
 * どれも 20 文字以内 (chat.md 観点 2.7、M3 Chips の規定)
 */
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

const nameOf = (db: Db, personId: string) => personOf(db, personId)?.name.split(' ')[0] ?? '';

/* 聞き返しのチップは元の依頼文をそのまま抱えると 20 文字を超える (chat.md 観点 2.7)。
   用件ごとの短い言い直しに畳む。押すとこの文が送り直されるので、意図も人物も復元できる */
const REASK: Record<string, string> = {
	event: 'と打ち合わせを入れて',
	person: 'とのやり取り',
	mail: 'のメールに返信',
	schedule: 'に候補送って'
};

/** 人物を聞き返す文。chatSend がこの文で「もう聞いた」を見分ける (1 往復に限るため) */
export const ASK_PERSON = 'どなたについてでしょうか?';

/** 人物の指定が要る用件で相手が分からないときの選択肢。必ず 3 つの集合で出す (chat.md 観点 2.6) */
const personChips = (kind: Intent['kind']) => PEOPLE.map(([name]) => `${name}さん${REASK[kind]}`);

/**
 * 考えている間に出す文。「処理中…」のような曖昧な語を使わず、何をしているかを書く
 * (chat.md 観点 3.1、HIG Generative AI の "instead of 'Processing…'…")
 */
export function thinking(db: Db, text: string, ctx?: ContextChip): string {
	const i = route(db, text, ctx);
	const name = i.personId ? nameOf(db, i.personId) : '';
	switch (i.kind) {
		case 'event':
			return name ? `${name}様との予定を組み立てています` : '予定の候補を組み立てています';
		case 'task':
			return 'ToDo の候補を組み立てています';
		case 'person':
			return name ? `${name}様のこれまでのやり取りを探しています` : '登録済みの人物を探しています';
		case 'mail':
			return name ? `${name}様からの連絡を探しています` : '要対応の連絡を探しています';
		case 'brief':
			return '直近の会議の Brief を探しています';
		case 'schedule':
			return name ? `${name}様との日程の空きを調べています` : '日程の空きを調べています';
		case 'document':
			return `${i.docKind}の下書きの材料を集めています`;
		default:
			return 'ご依頼を読み取っています';
	}
}

/**
 * 意図から KUROKO の返答を組み立てる。event と task は候補 (Suggestion) までで、
 * 保存はカードのボタン (chatAct) を押したときに初めて行う (仕様 5.4)
 */
export function reply(db: Db, i: Intent, asked = false): Reply {
	const person = personOf(db, i.personId);
	if (!person && NEEDS_PERSON.includes(i.kind)) {
		// 聞き返しは 1 往復まで。一度聞いても埋まらなければ用件の選び直しに戻す (仕様 9.1)
		// できないことは 1 文目で言い切る (chat.md 観点 4.1)。長い説明を先に置かない
		if (asked) return { text: 'どなたか分かりませんでした。次のどれをお手伝いしましょうか?', chips: GUIDE_CHIPS };
		return { text: ASK_PERSON, chips: personChips(i.kind) };
	}
	const base = parse(db.seededOn);

	if (i.kind === 'event') {
		// 埋まっている時間は避ける (derived.ts の firstFreeStart)。日程調整の候補と同じ扱い
		const { date, start, end } = firstFreeStart(db, i.when ?? key(bizDay(1, base)), 60, i.at);
		const title = `${nameOf(db, person!.id)}様との打ち合わせ`;
		const s = suggestion('chat', 'event', `「${i.raw}」を打ち合わせの依頼と受け取りました`, {
			type: 'event',
			title,
			date,
			start,
			end,
			personIds: [person!.id],
			projectId: person!.projectIds[0],
			online: 'meet'
		});
		return {
			card: {
				icon: 'ic-cal',
				title: '予定の候補',
				lines: [title, `${fmtMDW(parse(date))} ${start}〜${end}`, 'Meet'],
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
		const s = suggestion('chat', 'task', `「${i.raw}」を ToDo の依頼と受け取りました`, {
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
