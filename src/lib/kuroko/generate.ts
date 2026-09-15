import type { Db, TimeSlot, MessageThread } from '../types';
import { bizDay, key, fmtMDW, parse, minutes, toHm } from '../dates';
import { personOf } from '../derived';

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
