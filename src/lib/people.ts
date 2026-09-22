import type { Db, Source } from './types';

export type HistoryKind = 'mail' | 'line' | 'slack' | 'meeting';
export type HistoryItem = {
	at: string;
	kind: HistoryKind;
	label: string;
	title: string;
	href: string;
};

export const HISTORY_LABEL: Record<HistoryKind, string> = {
	mail: 'メール',
	line: 'LINE',
	slack: 'Slack',
	meeting: '会議'
};

// 「最近のやりとり」の種類を示す記号。ORIGIN_ICON (types.ts) と同じ絵を使う
export const HISTORY_ICON: Record<HistoryKind, string> = {
	mail: 'b-gmail',
	line: 'b-line',
	slack: 'b-slack',
	meeting: 'ic-bell'
};

// 予定の開始時刻は '9:00' のように 1 桁時もある。文字列のまま比べると 19:40 より後ろに来るので 0 埋めする
const stamp = (dateKey: string, start: string) => `${dateKey}T${start.padStart(5, '0')}`;

const SOURCE_KIND: Partial<Record<Source, HistoryKind>> = {
	gmail: 'mail',
	line: 'line',
	slack: 'slack'
};

export const identitiesOf = (db: Db, personId: string) =>
	db.identities.filter((i) => i.personId === personId);

/** 人物のスレッドと会議を新しい順に並べる。これから先の予定は「最近のやりとり」に混ぜない */
export function personHistory(db: Db, personId: string): HistoryItem[] {
	const limit = `${db.seededOn}T23:59`;
	const out: HistoryItem[] = [];
	for (const t of db.threads) {
		const kind = t.personId === personId ? SOURCE_KIND[t.source] : undefined;
		if (!kind) continue;
		out.push({
			at: t.lastAt,
			kind,
			label: HISTORY_LABEL[kind],
			title: t.subject,
			href: `/inbox?t=${t.id}`
		});
	}
	for (const m of db.meetings) {
		if (!m.personIds.includes(personId)) continue;
		const e = db.events.find((x) => x.id === m.eventId);
		if (!e) continue;
		out.push({
			at: stamp(e.date, e.start),
			kind: 'meeting',
			label: HISTORY_LABEL.meeting,
			title: m.title,
			href: `/meetings/${m.id}`
		});
	}
	return out.filter((x) => x.at <= limit).sort((a, b) => b.at.localeCompare(a.at));
}

/** メールは通数 (スレッドではなく Message の数)。会議は personHistory と同じく基準日までの分だけ数える */
export function personStats(db: Db, personId: string) {
	const mailThreads = new Set(
		db.threads.filter((t) => t.personId === personId && t.source === 'gmail').map((t) => t.id)
	);
	const past = db.meetings
		.filter((m) => m.personIds.includes(personId))
		.map((m) => db.events.find((e) => e.id === m.eventId)?.date)
		.filter((d): d is string => !!d && d <= db.seededOn)
		.sort();
	return {
		mails: db.messages.filter((m) => mailThreads.has(m.threadId)).length,
		meetings: past.length,
		lastMeeting: past[past.length - 1]
	};
}
