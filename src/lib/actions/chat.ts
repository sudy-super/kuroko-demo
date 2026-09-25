import { DOC_KINDS, type ChatMessage, type Document } from '../types';
import { db } from '../store.svelte';
import { toast, request, type ContextChip } from '../ui.svelte';
import { nowIso, parse, fmtMDW, hm } from '../dates';
import { firstFreeStart, suggestionOf } from '../derived';
import { uid, suggestion } from '../kuroko/generate';
import { ASK_PERSON, reply, route } from '../kuroko/route';
import { handleMention } from '../kuroko/line';
import { goto } from '$app/navigation';
import { integrations } from '../integrations';
import { addTask, acceptTaskSuggestions } from './tasks';
import { createEvent } from './meetings';

/* 履歴は切らない。件数で切ると、後から押せるはずの提案カードが黙って消える
   (chat.md「過去の発言のカードの操作は後から押せるべき」)。長さへの一次資料の処方は
   段階的開示であって件数の上限ではない */
function pushChat(m: Omit<ChatMessage, 'id' | 'at'>) {
	db.chat.push({ id: uid('c'), at: nowIso(), ...m });
}

/**
 * 依頼を 1 往復進める。KUROKO の返答は 800ms 後に積む (仕様 9.2 の「生成中」表示に合わせる)。
 * 直前の発言が聞き返しなら、その次は聞き返さずに用件の選び直しへ倒す (仕様 9.1「1 往復まで」)
 */
export async function chatSend(text: string, ctx?: ContextChip) {
	const q = text.trim();
	if (!q) return;
	// 直前が人物の聞き返しだったときだけ「もう聞いた」とみなす。用件の選び直し (7 種のチップ)を
	// 混ぜると、そこから人物なしで頼まれた 1 回目を聞き返せなくなる
	const asked = db.chat[db.chat.length - 1]?.text === ASK_PERSON;
	// 聞き返しの選択肢は人物しか運べないので、聞き返す前の依頼 (日時はそこにある)を route へ渡す
	const prev = asked ? db.chat[db.chat.length - 2]?.text : undefined;
	pushChat({ role: 'user', text: q });
	await new Promise((r) => setTimeout(r, 800));
	const { suggestion, ...msg } = reply(db, route(db, q, ctx, prev), asked);
	if (suggestion) db.suggestions.push(suggestion);
	pushChat({ role: 'kuroko', ...msg });
}

/**
 * LINE / Slack の 1 往復。発言を積み、800ms 後に KUROKO の返答を同じ入れ物へ積む
 * (chatSend と同じ待ち)。`@KUROKO` で始まらない発言には返さない (handleMention が null)。
 * member (従業員) の「予定を入れて」は書き込まず、社長のチャットへ候補として回す
 */
export async function lineSay(text: string, role: 'owner' | 'member') {
	const q = text.trim();
	if (!q) return;
	const channel = db.demo.lineTab;
	const who = role === 'owner' ? db.user.name.split(' ')[0] : '山田';
	(channel === 'line' ? db.line : db.slack).push({ id: uid('ln'), who, text: q, at: hm(), role });
	const r = handleMention(db, q, role);
	if (!r) return;
	await new Promise((res) => setTimeout(res, 800));
	if (r.task) addTask({ title: r.task.title, due: r.task.due, time: r.task.time }, channel);
	if (r.suggestion) {
		// 埋まっている時間は避ける (derived.ts の firstFreeStart)。/chat の予定の候補と同じ扱い
		const { date, start, end } = firstFreeStart(db, r.suggestion.date, 60, r.suggestion.at);
		const s = suggestion('line', 'event', `${who}さんから「${q}」の依頼がありました`, {
			type: 'event',
			title: r.suggestion.title,
			date,
			start,
			end,
			personIds: []
		});
		db.suggestions.push(s);
		// 社長のチャット (/chat) へ回す。押すまで予定にならないのは chatAct の create-event 任せ
		pushChat({
			role: 'kuroko',
			card: {
				icon: 'ic-cal',
				title: '予定の候補',
				lines: [r.suggestion.title, `${fmtMDW(parse(date))} ${start}〜${end}`],
				reason: s.reason,
				actions: [
					{ label: 'この内容で作成', act: 'create-event', arg: s.id },
					{ label: '日時を変更する', act: 'change-date', arg: s.id }
				]
			}
		});
	}
	integrations.chat.post(channel, r.reply, r.card);
}

/** カードのボタン。既存の処理へ振り分けるだけで、ここでは何も組み立てない */
export function chatAct(act: string, arg: string) {
	const s = suggestionOf(db, arg);
	switch (act) {
		case 'create-event': {
			// 済んだ候補からは二度と作らない。表示側 (ChatCard) も同じ status で操作を引っ込める
			if (s?.payload.type !== 'event' || s.status !== 'pending')
				throw new Error(`予定の候補がありません: ${arg}`);
			const { type, personIds, ...rest } = s.payload;
			createEvent({ ...rest, personIds, withMeeting: true }, 'chat');
			s.status = 'accepted';
			toast('予定を登録しました');
			return;
		}
		case 'change-date':
			if (s?.payload.type !== 'event') throw new Error(`予定の候補がありません: ${arg}`);
			// 日時だけ変えたいので、埋めた値を持ったまま予定の追加画面を開く
			return request('/calendar', { kind: 'new-event', date: s.payload.date, start: s.payload.start });
		case 'add-task':
			if (acceptTaskSuggestions([arg]).length === 0) throw new Error(`ToDo の候補がありません: ${arg}`);
			toast('ToDo を登録しました');
			return;
		case 'open-person':
			return goto(`/people/${arg}`);
		case 'open-thread':
			return goto(`/inbox?t=${arg}`);
		case 'open-meeting':
			return goto(`/meetings/${arg}`);
		case 'gen-doc':
			if (!DOC_KINDS.includes(arg as Document['kind'])) throw new Error(`知らない資料の種別です: ${arg}`);
			return request('/documents', { kind: 'gen-doc', docKind: arg as Document['kind'] });
		default:
			throw new Error(`知らない操作です: ${act}`);
	}
}
