import { describe, it, expect } from 'vitest';
import { seed } from './seed';
import { key, bizDay } from './dates';
import { FILLER_SUBJECTS } from './kuroko/samples';

// 火曜と金曜。曜日によって bizDay の飛び方が変わるため 2 通りで回す
const BASES = [new Date(2026, 8, 15), new Date(2026, 8, 18)];

describe('seed', () => {
	it('要件どおりの件数', () => {
		const db = seed(new Date(2026, 8, 15));
		expect(db.threads.filter((t) => t.inQueue).length).toBe(8);
		expect(db.threads.length).toBe(8 + 39 + 2); // キュー 8 + 件名のみ 39 + サンライズ過去 2 (面談日程はキューにもある)
		expect(db.approvals.filter((a) => a.status === 'pending').length).toBe(2);
		expect(db.tasks.filter((t) => t.due === '2026-09-15' && t.status !== 'done').length).toBe(3);
		expect(db.meetings[0].eventId).toBe('ev-abc-meeting');
		expect(db.events.find((e) => e.id === 'ev-abc-meeting')!.date).toBe(
			key(bizDay(1, new Date(2026, 8, 15)))
		);
	});
	it('件名のみのスレッドの元になる件名は 39 件', () => {
		expect(FILLER_SUBJECTS.length).toBe(39);
	});
	it('すべてのスレッドに表示用の差出人名がある', () => {
		const db = seed(new Date(2026, 8, 15));
		expect(db.threads.filter((t) => !t.sender.trim())).toEqual([]);
	});
	it('未登録の差出人は personId を持たない', () => {
		const db = seed(new Date(2026, 8, 15));
		const sunrise = db.identities.find((i) => i.value === 'suzuki@sunrise.co.jp')!;
		expect(sunrise.personId).toBeUndefined();
	});

	it.each(BASES)('id が一意 (基準日 %s)', (base) => {
		const db = seed(base);
		const dup = (name: string, rows: { id: string }[]) =>
			rows.length === new Set(rows.map((r) => r.id)).size ? null : name;
		expect(
			[
				dup('threads', db.threads),
				dup('messages', db.messages),
				dup('people', db.people),
				dup('identities', db.identities),
				dup('companies', db.companies),
				dup('projects', db.projects),
				dup('events', db.events),
				dup('meetings', db.meetings),
				dup('tasks', db.tasks),
				dup('documents', db.documents),
				dup('approvals', db.approvals),
				dup('logs', db.logs)
			].filter(Boolean)
		).toEqual([]);
	});

	it.each(BASES)('参照先の id がすべて実在する (基準日 %s)', (base) => {
		const db = seed(base);
		const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
		const P = ids(db.people),
			C = ids(db.companies),
			PJ = ids(db.projects),
			I = ids(db.identities),
			D = ids(db.documents),
			M = ids(db.meetings),
			E = ids(db.events),
			TH = ids(db.threads);
		const missing: string[] = [];
		const ref = (where: string, set: Set<string>, id?: string) => {
			if (id !== undefined && !set.has(id)) missing.push(`${where} -> ${id}`);
		};

		db.identities.forEach((x) => ref(`identity ${x.id}.personId`, P, x.personId));
		db.threads.forEach((t) => {
			ref(`thread ${t.id}.identityId`, I, t.identityId);
			ref(`thread ${t.id}.personId`, P, t.personId);
			ref(`thread ${t.id}.companyId`, C, t.companyId);
			ref(`thread ${t.id}.projectId`, PJ, t.projectId);
		});
		db.events.forEach((e) => {
			ref(`event ${e.id}.meetingId`, M, e.meetingId);
			ref(`event ${e.id}.projectId`, PJ, e.projectId);
			e.personIds.forEach((x) => ref(`event ${e.id}.personIds`, P, x));
		});
		db.meetings.forEach((m) => {
			ref(`meeting ${m.id}.eventId`, E, m.eventId);
			m.personIds.forEach((x) => ref(`meeting ${m.id}.personIds`, P, x));
			m.brief?.documentIds.forEach((x) => ref(`meeting ${m.id}.brief.documentIds`, D, x));
		});
		db.projects.forEach((p) => {
			ref(`project ${p.id}.companyId`, C, p.companyId);
			p.personIds.forEach((x) => ref(`project ${p.id}.personIds`, P, x));
			p.documentIds.forEach((x) => ref(`project ${p.id}.documentIds`, D, x));
		});
		db.tasks.forEach((t) => {
			ref(`task ${t.id}.personId`, P, t.personId);
			ref(`task ${t.id}.projectId`, PJ, t.projectId);
		});
		db.approvals.forEach((a) => {
			if (a.payload.type === 'reply') ref(`approval ${a.id}.payload.threadId`, TH, a.payload.threadId);
			if (a.payload.type === 'share') ref(`approval ${a.id}.payload.personId`, P, a.payload.personId);
		});

		expect(missing).toEqual([]);
	});
});
