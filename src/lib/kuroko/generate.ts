import type { Db, TimeSlot, MessageThread, Minutes, Meeting } from '../types';
import { bizDay, key, fmtMDW, parse, minutes, toHm } from '../dates';
import { personOf, meetingMailTargetFor } from '../derived';
import { SAMPLE_TRANSCRIPT, SAMPLE_MINUTES } from './samples';

let seq = 0;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${(++seq).toString(36)}`;

// 候補は「今日」= db.seededOn を基準にした営業日で作る。実時刻は使わない
export function slotsFor(db: Db, _personId: string, duration = 60): TimeSlot[] {
	const spec: [number, string, boolean][] = [
		[2, '13:00', true],
		[3, '15:00', true],
		[4, '11:00', true],
		[5, '16:00', false]
	];
	return spec.map(([n, start, selected]) => {
		const date = key(bizDay(n, parse(db.seededOn)));
		const s = minutes(start);
		const end = toHm(s + duration);
		// 直前 60 分以内に終わる予定のうち、いちばん近いもの
		const before = db.events
			.filter((e) => e.date === date && minutes(e.end) <= s && s - minutes(e.end) <= 60)
			.sort((a, b) => minutes(b.end) - minutes(a.end))[0];
		const note = before ? `前に${before.title}あり` : undefined;
		const warn = before && before.place && before.place !== 'オンライン' ? '移動が続きます' : undefined;
		return { id: uid('slot'), date, start, end, selected, note, warn };
	});
}

export function slotsText(slots: TimeSlot[], personName: string): string {
	const lines = slots.filter((s) => s.selected).map((s) => `・${fmtMDW(parse(s.date))} ${s.start}〜${s.end}`);
	return `${personName}様\n\nご連絡ありがとうございます。\n以下の日程でご都合はいかがでしょうか。\n${lines.join('\n')}\n\nご都合の良い日時をお選びいただけますと幸いです。\nよろしくお願いいたします。`;
}

export function replyDraft(
	db: Db,
	thread: MessageThread,
	tone: 'short' | 'polite' | 'casual' | 'decline' | 'slots'
): { body: string; reason: string } {
	const name = personOf(db, thread.personId)?.name.split(' ')[0] ?? 'ご担当者';
	const map = {
		short: {
			body: `${name}様\n\nご連絡ありがとうございます。承知しました。\n改めてご連絡いたします。`,
			reason: '短い返答を求められたため、要点だけにしました'
		},
		polite: {
			body: `${name}様\n\nいつもお世話になっております。株式会社 KUROKO の佐々木です。\nご連絡いただきありがとうございます。\n内容を確認のうえ、改めてご連絡いたします。\n\n引き続きよろしくお願いいたします。`,
			reason: '社外の決裁者宛のため、丁寧な文体にしました'
		},
		casual: {
			body: `${name}さん\n\nご連絡ありがとうございます。\n確認して折り返します。`,
			reason: 'やり取りが多い相手のため、簡潔な文体にしました'
		},
		decline: {
			body: `${name}様\n\nご連絡ありがとうございます。\n誠に恐縮ですが、今回は見送らせていただきたく存じます。\nまたの機会にご相談できれば幸いです。`,
			reason: 'お断りの返答として、理由を述べずに丁重に締めました'
		},
		slots: {
			body: slotsText(slotsFor(db, thread.personId ?? ''), name),
			reason: '来週の打ち合わせ希望への返答として、空いている枠を 3 つ含めました'
		}
	} as const;
	return map[tone];
}

// 文字起こしから ToDo を拾う手がかり。仕様 5.20 (会議後)
const TODO_HINTS = ['する', 'まで', 'お送り', '送付', '提出', '調整'];
const DECISION_HINTS = ['合意', '決定', 'で進め'];

export function minutesFor(
	db: Db,
	meetingId: string,
	text: string
): { minutes: Minutes; todos: { title: string; due: string; reason: string }[] } {
	// メールを持たない相手 (社内の人物) にはフォローメール案を作らない。議事録自体は作る
	const to = meetingMailTargetFor(db, meetingId)?.to;
	const from = parse(db.seededOn);
	if (text.trim() === SAMPLE_TRANSCRIPT.trim()) {
		return {
			minutes: {
				summary: SAMPLE_MINUTES.summary,
				decisions: SAMPLE_MINUTES.decisions,
				...(to ? { followUpMail: { to, ...SAMPLE_MINUTES.followUp } } : {})
			},
			todos: SAMPLE_MINUTES.todos.map((t) => ({
				title: t.title,
				due: key(bizDay(t.dueBiz, from)),
				reason: t.reason
			}))
		};
	}
	const lines = text
		.split('。')
		.map((s) => s.trim())
		.filter(Boolean);
	const todos = lines
		.filter((s) => TODO_HINTS.some((h) => s.includes(h)))
		.slice(0, 3)
		.map((s, i) => ({ title: s, due: key(bizDay(i + 2, from)), reason: `文字起こしの「${s}」から抽出` }));
	return {
		minutes: {
			summary: lines.slice(0, 3).join('。') + (lines.length ? '。' : ''),
			decisions: lines.filter((s) => DECISION_HINTS.some((h) => s.includes(h))).slice(0, 3),
			...(to
				? {
						followUpMail: {
							to,
							subject: '本日の打ち合わせのお礼',
							body: `本日はお時間をいただきありがとうございました。\n打ち合わせの内容は議事録にまとめております。\nお気づきの点がありましたらお知らせください。\n\n引き続きよろしくお願いいたします。\n\n株式会社 KUROKO 佐々木 健`
						}
					}
				: {})
		},
		todos
	};
}

/** 会議のアジェンダの下書き。宿題と価格の 2 項目は、その会議に材料があるときだけ並べる
    (材料の出所は Meeting.brief.homework と Meeting.purpose) */
export function agendaFor(_db: Db, meeting: Meeting): string[] {
	const items: string[] = [];
	if (meeting.brief?.homework.length) items.push('前回宿題の確認');
	items.push('導入スケジュールのすり合わせ');
	if (meeting.purpose.includes('価格')) items.push('価格条件');
	items.push('契約タイミング');
	items.push('次回アクション');
	return items;
}
