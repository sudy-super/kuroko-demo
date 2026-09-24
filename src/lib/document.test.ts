import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, resetDb } from './store.svelte';
import { generateDocument, sendDocument, approve, SEND_DELAY_MS } from './actions';

beforeEach(() => {
	(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
	resetDb();
	vi.useFakeTimers();
});

describe('generateDocument', () => {
	it('案件から会社と担当者を引いて資料を作り、案件の資料一覧に足す', () => {
		const pj = db.projects[0];
		const before = db.documents.length;
		const d = generateDocument('提案書', pj.id, 'documents');

		expect(db.documents.length).toBe(before + 1);
		expect(db.documents[0].id).toBe(d.id);
		expect(d.kind).toBe('提案書');
		expect(d.title).toContain(pj.name);
		expect(d.projectId).toBe(pj.id);
		expect(d.personId).toBe(pj.personIds[0]);
		expect(d.createdBy).toBe('KUROKO');
		// テンプレートは会社名を本文に差し込む (kuroko/samples.ts DOC_TEMPLATES)
		expect(d.sections.length).toBeGreaterThan(1);
		expect(d.sections[0].body).toContain('ABC 株式会社');
		expect(pj.documentIds[0]).toBe(d.id);
		expect(db.logs[0].text).toContain(d.title);
	});

	it('案件を指定しなければ案件に紐づかない資料になる', () => {
		const d = generateDocument('報告書', undefined, 'chat');
		expect(d.projectId).toBeUndefined();
		expect(d.personId).toBeUndefined();
	});
});

describe('sendDocument', () => {
	it('外部送信の承認を立て、承認の 5 秒後に送信済みとして履歴に載る', () => {
		const d = generateDocument('見積書', db.projects[0].id, 'documents');
		const a = sendDocument(d.id, d.personId!);

		expect(a.risk).toBe('external_send');
		expect(a.kind).toBe('mail');
		expect(a.status).toBe('pending');
		expect(a.to).toContain('tanaka@abc.co.jp');
		expect(a.subject).toBe(d.title);
		expect(a.body).toBe(`添付: ${d.title}.pdf`);
		expect(a.payload).toEqual({ type: 'document', documentId: d.id, personId: d.personId });

		approve(a.id);
		vi.advanceTimersByTime(SEND_DELAY_MS);
		expect(db.approvals.find((x) => x.id === a.id)!.status).toBe('executed');
		expect(db.logs[0].text).toContain('送信しました');
		expect(db.logs[0].approved).toBe(true);
	});

	it('資料が無ければ落ちる', () => {
		expect(() => sendDocument('doc-none', 'p-tanaka')).toThrow();
	});

	it('メールアドレスの無い相手には送れない', () => {
		const d = generateDocument('提案書', db.projects[0].id, 'documents');
		expect(() => sendDocument(d.id, 'p-yamada')).toThrow();
	});
});
