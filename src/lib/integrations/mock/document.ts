// TODO(real): LLM による生成に差し替える
import type { Brief, Db, Document } from '../../types';
import type { DocumentContext, DocumentProvider } from '../types';
import { fmtMD, nowIso, parse } from '../../dates';
import { meetingsOf, projectOf } from '../../derived';
import { DOC_TEMPLATES } from '../../kuroko/samples';
import { uid } from '../../kuroko/generate';

export const document: DocumentProvider = {
	generate(kind: Document['kind'], ctx: DocumentContext): Document {
		const company = ctx.companyName ?? '';
		const theme = ctx.theme ?? company;
		return {
			id: uid('doc'),
			kind,
			// シードの題名と同じ組み方 (src/lib/seed.ts の documents)。件名のあとに種別を続ける
			title: `${theme}${kind}`.trim(),
			projectId: ctx.projectId,
			personId: ctx.personId,
			createdBy: 'KUROKO',
			createdAt: nowIso(),
			sections: DOC_TEMPLATES[kind](company, theme)
		};
	},
	brief(db: Db, personId?: string, projectId?: string): Brief {
		const past = db.events
			.filter((e) => e.meetingId && e.date < db.seededOn && (!personId || e.personIds.includes(personId)))
			.sort((a, b) => b.date.localeCompare(a.date))
			.slice(0, 3)
			.map((e) => `${fmtMD(parse(e.date))} ${e.title}`);
		// 議事録のある会議が複数あるので、配列の並び順ではなく予定の日付が新しいものを取る
		const mins = meetingsOf(db, (m) => m.projectId === projectId && !!m.minutes)[0]?.minutes;
		const homework = db.tasks
			.filter((t) => t.status !== 'done' && (t.personId === personId || (projectId && t.projectId === projectId)))
			.map((t) => t.title);
		const recentContacts = db.threads
			.filter((t) => t.personId === personId)
			.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
			.slice(0, 2)
			.map((t) => `${t.subject} (${fmtMD(parse(t.lastAt.slice(0, 10)))})`);
		return {
			createdAt: nowIso(),
			history: past,
			lastPoints: mins ? mins.decisions : ['前回の論点は議事録を参照'],
			homework,
			recentContacts,
			documentIds: projectOf(db, projectId)?.documentIds ?? []
		};
	}
};
