// TODO(real): LLM による生成に差し替える
import type { Brief, Db } from '../../types';
import type { DocumentProvider } from '../types';
import { fmtMD, nowIso, parse } from '../../dates';
import { meetingsOf } from '../../derived';

export const document: DocumentProvider = {
	generate() {
		throw new Error('not implemented: 資料の生成は Task 19 と 24 で実装する');
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
			documentIds: db.projects.find((p) => p.id === projectId)?.documentIds ?? []
		};
	}
};
