import type { Approval, Origin, Document } from '../types';
import { db } from '../store.svelte';
import { companyOf, documentOf, projectOf, personMailTargetOf } from '../derived';
import { integrations } from '../integrations';
import { log, must, unshifted } from './core';
import { addApproval } from './approvals';

/** 資料を 1 件作って db に積む。1200ms の待ちは呼び出し側 (/documents) が見せる */
export function generateDocument(
	kind: Document['kind'],
	projectId: string | undefined,
	origin: Origin
): Document {
	const project = projectOf(db, projectId);
	const d = integrations.document.generate(kind, {
		companyName: companyOf(db, project?.companyId)?.name,
		theme: project?.name,
		projectId: project?.id,
		personId: project?.personIds[0]
	});
	const out = unshifted(db.documents, d);
	// 案件の資料一覧 (/projects/[id]) と Brief の関連資料から辿れるようにする
	if (project) project.documentIds.unshift(d.id);
	log(`${d.title}を作成しました`, 'draft', { origin });
	return out;
}

export function sendDocument(docId: string, personId: string, origin: Origin = 'documents'): Approval {
	const d = must(documentOf(db, docId), `資料がありません: ${docId}`);
	const { person, to } = personMailTargetOf(db, personId);
	return addApproval({
		title: `${person.name.split(' ')[0]}様への${d.kind}の送付`,
		risk: 'external_send',
		kind: 'mail',
		to,
		subject: d.title,
		body: `添付: ${d.title}.pdf`,
		payload: { type: 'document', documentId: d.id, personId },
		origin
	});
}
