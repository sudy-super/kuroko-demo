import type { Db } from './types';
import { personOf, companyOf, projectOf, meetingOf, threadSenderMeta } from './derived';
import { PRIMARY, UTILITY } from './nav';
import { parse, fmtMDW } from './dates';

export type Group = '人物' | '会社' | '案件' | 'メール' | '予定' | '資料' | 'ToDo';
export type HitSource = '社内データ' | 'Gmail' | 'Google カレンダー' | 'ドキュメント';
export type Hit = { group: Group; label: string; sub: string; href: string; source: HitSource };

/** 群の並び。search の返り値もこの順に積む */
export const GROUPS: Group[] = ['人物', '会社', '案件', 'メール', '予定', '資料', 'ToDo'];

/** 群ごとの上限 */
const LIMIT = 4;

/* 関連する人物の名前とよみを検索対象に混ぜる。「田中」と打ったときに、本人の行だけでなく
   その人の会社・案件・予定・資料・ToDo まで当たるようにするため */
const who = (db: Db, ids: (string | undefined)[]) =>
	ids
		.map((id) => {
			const p = personOf(db, id);
			return p ? `${p.name} ${p.kana}` : '';
		})
		.join(' ');

export function search(db: Db, q: string): Hit[] {
	const s = q.trim().toLowerCase();
	if (!s) return [];
	const hit = (...parts: (string | undefined)[]) =>
		parts.filter(Boolean).join(' ').toLowerCase().includes(s);
	const top = <T>(xs: T[]) => xs.slice(0, LIMIT);
	const out: Hit[] = [];

	for (const p of top(
		db.people.filter((p) => hit(p.name, p.kana, p.title, companyOf(db, p.companyId)?.name))
	))
		out.push({
			group: '人物',
			label: p.name,
			sub: [companyOf(db, p.companyId)?.name, p.title].filter(Boolean).join(' / '),
			href: `/people/${p.id}`,
			source: '社内データ'
		});

	for (const c of top(
		db.companies.filter((c) =>
			hit(
				c.name,
				c.domain,
				c.industry,
				who(
					db,
					db.people.filter((p) => p.companyId === c.id).map((p) => p.id)
				)
			)
		)
	))
		out.push({
			group: '会社',
			label: c.name,
			sub: `${c.industry} / ${c.size}`,
			href: `/companies/${c.id}`,
			source: '社内データ'
		});

	for (const pj of top(
		db.projects.filter((pj) =>
			hit(pj.name, pj.status, companyOf(db, pj.companyId)?.name, who(db, pj.personIds))
		)
	))
		out.push({
			group: '案件',
			label: pj.name,
			sub: `${pj.status} / ${pj.amount}`,
			href: `/projects/${pj.id}`,
			source: '社内データ'
		});

	// 出所のラベルが Gmail なので、Inbox に並ぶ Slack / LINE のスレッドはこの群に入れない
	for (const t of top(
		db.threads.filter(
			(t) => t.source === 'gmail' && hit(t.subject, t.sender, who(db, [t.personId]))
		)
	))
		out.push({
			group: 'メール',
			label: t.subject,
			sub: threadSenderMeta(db, t),
			href: `/inbox?t=${t.id}`,
			source: 'Gmail'
		});

	for (const e of top(
		db.events.filter((e) =>
			hit(e.title, e.place, companyOf(db, e.companyId)?.name, who(db, e.personIds))
		)
	))
		out.push({
			group: '予定',
			label: e.title,
			sub: `${fmtMDW(parse(e.date))} ${e.start}〜${e.end}`,
			href: '/calendar',
			source: 'Google カレンダー'
		});

	for (const d of top(
		db.documents.filter((d) =>
			hit(d.title, d.kind, projectOf(db, d.projectId)?.name, who(db, [d.personId]))
		)
	))
		out.push({
			group: '資料',
			label: d.title,
			sub: d.kind,
			href: `/documents?d=${d.id}`,
			source: 'ドキュメント'
		});

	for (const t of top(
		db.tasks.filter((t) =>
			hit(
				t.title,
				t.memo,
				projectOf(db, t.projectId)?.name,
				who(db, [t.personId, ...(projectOf(db, t.projectId)?.personIds ?? [])])
			)
		)
	))
		out.push({
			group: 'ToDo',
			label: t.title,
			sub: t.due ? `期限 ${fmtMDW(parse(t.due))}` : '期限なし',
			href: '/tasks',
			source: '社内データ'
		});

	return out;
}

const SCREENS = [...PRIMARY, ...UTILITY];

/* 画面の名前。詳細の画面は実体の名前を出す (「会社・人物・案件」より「田中 太郎」のほうが
   最近開いたものとして分かる)。名前が引けない道は出さない */
function screenName(db: Db, href: string): string {
	const [, top, id] = href.split('/');
	if (id) {
		if (top === 'people') return personOf(db, id)?.name ?? '';
		if (top === 'companies') return companyOf(db, id)?.name ?? '';
		if (top === 'projects') return projectOf(db, id)?.name ?? '';
		if (top === 'meetings') return meetingOf(db, id)?.title ?? '';
	}
	return SCREENS.find((n) => n.href === `/${top}`)?.label ?? '';
}

/** 最近開いた画面。db.demo.recent は actions.ts の noteRecent が 5 件までに切っている */
export function recent(db: Db): { label: string; href: string }[] {
	return db.demo.recent
		.map((href) => ({ href, label: screenName(db, href) }))
		.filter((r) => r.label);
}
