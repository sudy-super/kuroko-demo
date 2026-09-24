import type { Db, TodayItem, Meeting, CalendarEvent, Task, ProjectStatus, MessageThread, ActivityLog, ChannelIdentity } from './types';
import { key, parse, addDays, bizDay, minutes, toHm, hm } from './dates';

export const personOf = (db: Db, id?: string) => db.people.find((p) => p.id === id);
export const companyOf = (db: Db, id?: string) => db.companies.find((c) => c.id === id);
export const projectOf = (db: Db, id?: string) => db.projects.find((p) => p.id === id);
export const identityOf = (db: Db, id: string) => db.identities.find((i) => i.id === id);
export const meetingOf = (db: Db, id?: string) => db.meetings.find((m) => m.id === id);
export const eventOf = (db: Db, id?: string) => db.events.find((e) => e.id === id);
export const threadOf = (db: Db, id?: string) => db.threads.find((t) => t.id === id);
export const documentOf = (db: Db, id?: string) => db.documents.find((d) => d.id === id);

/* 宛先の行と効果文に出す連絡先の表し方。メールはアドレスを省略せずに出す (仕様 5.3)。
   LINE / Slack の value は内部の ID なので、人が読める label (「LINE」「Slack」) に置き換える */
export const addressOf = (idn: ChannelIdentity) =>
	idn.kind === 'email' ? `<${idn.value}>` : `(${idn.label})`;

/** 連絡先の一覧に出す文字。宛先の括弧を外した形 — 内部の ID はどちらでも出さない */
export const contactOf = (idn: ChannelIdentity) =>
	idn.kind === 'email' ? idn.value : `${idn.label} 連携済み`;
export const personOfIdentity = (db: Db, identityId: string) =>
	personOf(db, identityOf(db, identityId)?.personId);

/** そのメールアドレスから来た、まだ人物に結び付いていないスレッド。関連付けの提案の材料 */
export const pendingThreadsFor = (db: Db, email: string) =>
	db.threads.filter(
		(t) => !t.personId && identityOf(db, t.identityId)?.value === email
	);

/* 人物とそのメールアドレス。宛先を組むのも効果文に出すのもここから引く
   (shareAgenda と generate.ts の mailToOf が同じ 3 行を持っていた)。
   メールを持たない相手 (社内の人物は slack_id / line_id しか持たない — seed.ts) では
   undefined。メールを送る操作を出してよいかの判定にも使う */
export function mailTargetFor(db: Db, personId?: string) {
	const person = personOf(db, personId);
	const identity = db.identities.find((i) => i.personId === person?.id && i.kind === 'email');
	if (!person || !identity) return undefined;
	return { person, identity, to: `${person.name} ${addressOf(identity)}` };
}

/* 送る側から呼ぶ入口。ここまで来て引けないのは、呼び出し側が出すべきでない操作を
   出していたということなので throw する (宛先不明のメールを作らせない) */
export function personMailTargetOf(db: Db, personId?: string) {
	const t = mailTargetFor(db, personId);
	if (!t) throw new Error(`宛先が引けません: ${personId}`);
	return t;
}

/** 会議の相手の宛先。相手は personIds の先頭 */
export const meetingMailTargetFor = (db: Db, meetingId: string) =>
	mailTargetFor(db, meetingOf(db, meetingId)?.personIds[0]);

export function mailTargetOf(db: Db, meetingId: string) {
	const t = meetingMailTargetFor(db, meetingId);
	if (!t) throw new Error(`宛先が引けません: ${meetingId}`);
	return t;
}

/* Task 10p 修正ラウンド 1 (Critical) — 差出人 / 会社を組み立てる。thread.sender は
   人物が未登録の場合は「部署 / 会社」まで含めた表示用の文字列そのものなのでそのまま使い、
   人物 (personId) と会社 (companyId) の両方が判明している場合だけ、それらの参照から
   組み立て直す。sender の文字列の形 (区切り文字や、会社名が含まれるかどうか) を一切見ない
   ため、シードの書式が変わっても二重表示にはならない */
export const threadSenderMeta = (db: Db, thread: MessageThread): string => {
	const person = personOf(db, thread.personId);
	const company = companyOf(db, thread.companyId);
	return person && company ? `${person.name} / ${company.name}` : thread.sender;
};

export const queue = (db: Db) =>
	db.threads.filter((t) => t.inQueue && !t.done).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
export const replyNeeded = (db: Db) => queue(db).filter((t) => t.needsReply);

/* このスレッドが完了した (対応済みにする、または承認された返信が実行された) ときに移る先。
   done を !done で先に絞ると、このスレッド自身がもう完了している呼び出し元 (返信の送信は
   5 秒後の承認実行で非同期に完了する) では自分の位置を見失うため、並び順だけ inQueue 全体
   から取り、完了済みかどうかは絞り込みの側で見る (review-task-15.md C3 / I2) */
export const nextInQueue = (db: Db, threadId: string): MessageThread | undefined => {
	const ordered = db.threads.filter((t) => t.inQueue).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
	const i = ordered.findIndex((t) => t.id === threadId);
	if (i === -1) return undefined;
	return ordered.slice(i + 1).find((t) => !t.done) ?? ordered.find((t) => !t.done && t.id !== threadId);
};
export const pendingApprovals = (db: Db) => db.approvals.filter((a) => a.status === 'pending');

/* 案件の状態は Atlassian の Lozenge (ワークフローの状態) にあたるので、一覧・人物詳細・会社・
   案件のどこでも同じ色で出す。終わった 2 つだけ色を分け、途中の状態は青 (進行中) にする。
   Task 10k — 途中の状態は .badge の既定 (中立の灰) に任せず info を明示する。既定の灰は
   分類の札 (「場所」「提案書」など) と、承認の区分のうち注意の要らない 2 つが使う色で、
   「特に言うことが無い」を意味する。案件の途中の状態はそれとは違う (app.css の .badge を見よ) */
export const projectStatusClass = (s: ProjectStatus) =>
	s === '受注' ? 'ok' : s === '失注' ? 'danger' : 'info';

/* M3 の large badge は "+" も含めて最大 4 文字 (docs/research/buttons.md 観点 B 原則 4)。
   このアプリで 4 桁に届く件数は無いが、規定どおり上限を持たせておく */
export const badgeCount = (n: number) => (n > 999 ? '999+' : String(n));

const T = (db: Db) => db.seededOn; // 「今日」の基準。実時刻ではなくシードの基準日を使う

export type TaskFilter = 'overdue' | 'today' | 'week' | 'all';

/** 期限の判定はここだけに置く。画面のフィルタと Today の件数で同じ規則を使う */
export function inTaskFilter(db: Db, t: Task, f: TaskFilter): boolean {
	if (f === 'all') return true;
	if (!t.due) return false;
	const k = T(db);
	if (f === 'overdue') return t.due < k;
	if (f === 'today') return t.due === k;
	return t.due >= k && t.due <= key(addDays(6, parse(k)));
}

const open = (t: Task) => t.status !== 'done';
export const todayTasks = (db: Db) => db.tasks.filter((t) => inTaskFilter(db, t, 'today') && open(t));

/** 期限の早い順 (期限なしは末尾)、同じ日は時刻の早い順 */
export const byDue = (a: Task, b: Task) =>
	(a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.time ?? '99:99').localeCompare(b.time ?? '99:99');

/** 自分で並べた順があればその順、無ければ期限順。並べた後に増えた ToDo (順に無いもの) は
    期限順で末尾に付ける */
export function orderTasks(db: Db, list: Task[]): Task[] {
	const order = db.taskOrder;
	if (!order) return [...list].sort(byDue);
	const at = new Map(order.map((id, i) => [id, i]));
	return [...list].sort(
		(a, b) => (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity) || byDue(a, b)
	);
}

/** 一覧用。未完了が先、その中は orderTasks の順 */
export const filterTasks = (db: Db, f: TaskFilter) =>
	orderTasks(db, db.tasks.filter((t) => inTaskFilter(db, t, f))).sort(
		(a, b) => Number(!open(a)) - Number(!open(b))
	);

/** チップの件数バッジ。残っている件数を出したいので完了は数えない */
export const openTaskCount = (db: Db, f: TaskFilter) =>
	db.tasks.filter((t) => inTaskFilter(db, t, f) && open(t)).length;

/** 完了行の「元に戻す」が使う直近のログ。logs は新しい順に積まれる */
export const doneLogOf = (db: Db, taskId: string) =>
	db.logs.find((l) => !l.undone && l.undo?.kind === 'task_done' && l.undo.taskId === taskId);

/** 登録直後のトーストが使うログ。db.logs[0] を見ると後から積むログを取り違える */
export const addLogOf = (db: Db, taskId: string) =>
	db.logs.find((l) => !l.undone && l.undo?.kind === 'task_add' && l.undo.taskId === taskId);

// 時刻は '9:00' のように 1 桁時もあるので、文字列ではなく分に直して比べる
export const todayEvents = (db: Db) =>
	db.events.filter((e) => e.date === T(db)).sort((a, b) => minutes(a.start) - minutes(b.start));

/** 会議は自前の日付を持たないので、ひも付く予定の日付で新しい順に並べる。
    会社・案件の関連会議と Brief の「前回の論点」で同じ順序を使う */
export const meetingsOf = (db: Db, match: (m: Meeting) => boolean) =>
	db.meetings
		.filter(match)
		.sort((a, b) => (eventDateOf(db, b) ?? '').localeCompare(eventDateOf(db, a) ?? ''));

export const eventDateOf = (db: Db, m: Meeting) => eventOf(db, m.eventId)?.date;

export function nextMeeting(db: Db): { meeting: Meeting; event: CalendarEvent } | undefined {
	const k = T(db);
	const ev = db.events
		.filter((e) => e.meetingId && e.date >= k)
		.sort((a, b) => a.date.localeCompare(b.date) || minutes(a.start) - minutes(b.start))[0];
	const meeting = ev && meetingOf(db, ev.meetingId);
	return meeting ? { meeting, event: ev } : undefined;
}

export function todayItems(db: Db): TodayItem[] {
	const items: TodayItem[] = [];
	const ap = pendingApprovals(db);
	if (ap.length)
		items.push({
			kind: 'approval',
			n: ap.length,
			label: `承認待ち ${ap.length} 件`,
			detail: ap.map((a) => a.title).join(' / '),
			href: '#approvals'
		});
	const rp = replyNeeded(db);
	if (rp.length)
		items.push({
			kind: 'reply',
			n: rp.length,
			label: `返信が必要な連絡 ${rp.length} 件`,
			detail: rp.map((t) => t.subject).join(' / '),
			href: `/inbox?t=${rp[0].id}`
		});
	const nm = nextMeeting(db);
	if (nm && nm.meeting.brief && !nm.meeting.briefRead)
		items.push({
			kind: 'brief',
			n: 1,
			label: '次の会議の準備',
			detail: `${nm.meeting.title}の Brief が届いています`,
			href: `/meetings/${nm.meeting.id}`
		});
	const tt = todayTasks(db);
	if (tt.length)
		items.push({
			kind: 'tasks',
			n: tt.length,
			label: `今日の ToDo ${tt.length} 件`,
			detail: tt.map((t) => t.title).join(' / '),
			href: '/tasks'
		});
	const sc = db.scheduling.filter((s) => s.status === 'sent');
	if (sc.length)
		items.push({
			kind: 'sched',
			n: sc.length,
			label: `日程調整の返信待ち ${sc.length} 件`,
			detail: sc.map((s) => personOf(db, s.personId)?.name ?? '').join(' / '),
			href: '/calendar'
		});
	return items;
}

export const todayCount = (db: Db) => todayItems(db).reduce((n, i) => n + i.n, 0);

/** 「デモを開始する」を出す条件。ヘッダーのメニューと ⌘K の 2 か所で使う。伏せるのは案内の
    最中だけ。やることが 0 件の完了画面では startGuide が初期状態に戻してから始める */
export const canStartGuide = (db: Db) => !db.demo.guide.on;

export function freeSlots(db: Db, dateKey: string, from = '9:00', to = '18:00') {
	const busy = db.events
		.filter((e) => e.date === dateKey)
		.map((e) => [minutes(e.start), minutes(e.end)] as const)
		.sort((a, b) => a[0] - b[0]);
	const out: { start: string; end: string }[] = [];
	let cur = minutes(from);
	for (const [s, e] of busy) {
		if (s > cur) out.push({ start: toHm(cur), end: toHm(Math.min(s, minutes(to))) });
		cur = Math.max(cur, e);
	}
	if (cur < minutes(to)) out.push({ start: toHm(cur), end: toHm(minutes(to)) });
	return out.filter((x) => minutes(x.end) > minutes(x.start));
}

/* 候補に出す開始時刻。その日に既にある予定を避ける (freeSlots)。埋まっていれば翌営業日へ回す。
   from は希望の時刻 (「明日 11 時に」)。その時刻が空いていればそのまま、埋まっていればその後ろの
   空き枠へ回る。カードに日時を出すので、ずれたことは押す前に見える */
export function firstFreeStart(db: Db, dateKey: string, duration = 60, from = '9:00') {
	for (let d = parse(dateKey), i = 0; i < 10; d = bizDay(1, d), i++) {
		// 翌営業日へ回った分は希望の時刻を引きずらない (その日の朝から探す)
		const slot = freeSlots(db, key(d), i === 0 ? from : '9:00').find(
			(s) => minutes(s.end) - minutes(s.start) >= duration
		);
		if (slot) return { date: key(d), start: slot.start, end: toHm(minutes(slot.start) + duration) };
	}
	throw new Error(`空いている枠がありません: ${dateKey}`);
}

// 保存された進行状況ではなく、今の状態だけから案内の段階を決める
export function guideSection(db: Db): 0 | 1 | 2 | 3 | 4 | 5 {
	if (pendingApprovals(db).length > 0 && !db.scheduling.length) return 1;
	const s = db.scheduling[0];
	if (!s || s.status === 'draft') return 2;
	if (s.status === 'sent') return 3;
	if (db.tasks.filter((t) => t.origin === 'meeting').length < 2) return 4;
	return todayCount(db) === 0 ? 0 : 5;
}

/* actor を渡した呼び出しだけその実行主体に絞る。DoneScreen は「KUROKO は今日」と主語を
   名乗るので絞り、/activity は「本日は」と全体を指すので絞らない */
export function todaySummary(db: Db, actor?: ActivityLog['actor']) {
	const k = T(db);
	const L = db.logs.filter((l) => l.at.startsWith(k) && !l.undone && (!actor || l.actor === actor));
	const c = (kind: string) => L.filter((l) => l.kind === kind).length;
	return { drafts: c('draft'), holds: c('hold'), sends: c('send'), registers: c('register') };
}

/* Task 18 修正ラウンド 1 (review-task-18.md I2) — 会議の URL は表示用に scheme を持たない
   (`meet.google.com/abc-defg-hij`、integrations/mock/conference.ts)。そのまま href に入れると
   相対パスとして解決され、同じサイトの中へ飛んでしまう。表示は短いまま、リンク先だけ補う */
export const linkUrl = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);
