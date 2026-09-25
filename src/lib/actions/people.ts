import type { Origin, Person, CardFields, Project, Approval, Document } from '../types';
import { db } from '../store.svelte';
import { personOf, identityOf, companyOf, documentOf, projectOf, personMailTargetOf } from '../derived';
import { uid } from '../kuroko/generate';
import { integrations } from '../integrations';
import { log, must, pushed, unshifted } from './core';
import { askToSend } from './approvals';

/** People のメモ。中身が変わったときだけ作業履歴に残す */
export function updatePersonMemo(personId: string, memo: string): Person | undefined {
	const p = personOf(db, personId);
	if (!p || p.memo === memo) return p;
	p.memo = memo;
	log(`${p.name}様のメモを更新しました`, 'other', { actor: 'user', origin: 'people' });
	return p;
}

/** 名刺の読み取り結果から人物を登録する。会社は名前で引き、無ければ作る。
    メールアドレスの ChannelIdentity が既にあれば personId を付けない (関連付けは
    利用者が linkIdentity で選ぶ。過去のスレッドが黙って別人に結び付くのを避ける) */
export function addPerson(fields: CardFields, origin: Origin): Person {
	let company = db.companies.find((c) => c.name === fields.company);
	if (!company && fields.company) {
		company = pushed(db.companies, {
			id: uid('c'),
			name: fields.company,
			domain: fields.email.split('@')[1] ?? '',
			industry: '',
			size: ''
		});
	}
	const p = pushed(db.people, {
		id: uid('p'),
		name: fields.name,
		kana: fields.kana,
		companyId: company?.id,
		title: fields.title,
		phone: fields.phone || undefined,
		memo: '',
		tags: [],
		projectIds: []
	});
	if (!db.identities.some((i) => i.kind === 'email' && i.value === fields.email))
		db.identities.push({ id: uid('id'), personId: p.id, kind: 'email', value: fields.email, label: 'Gmail' });
	log(`人物「${p.name}」を登録しました`, 'register', { actor: 'user', origin });
	return p;
}

/** ChannelIdentity と、そこから来た全スレッドを人物に結び付ける */
export function linkIdentity(identityId: string, personId: string) {
	const i = must(identityOf(db, identityId), `ChannelIdentity がありません: ${identityId}`);
	i.personId = personId;
	const company = personOf(db, personId)?.companyId;
	for (const t of db.threads)
		if (t.identityId === identityId) {
			t.personId = personId;
			t.companyId ??= company;
		}
	log(`${db.threads.filter((t) => t.identityId === identityId).length} 件のメールを人物に関連付けました`, 'register', {
		actor: 'user',
		origin: 'people',
		undo: { kind: 'link_identity', identityId }
	});
}

/** 人物の会社の案件を作り、人物に紐付ける。商談はこれから始まるので状態は「商談前」 */
export function createProjectFor(personId: string, name: string): Project {
	const p = personOf(db, personId);
	const companyId = must(p?.companyId, `会社が引けません: ${personId}`);
	const pj = pushed(db.projects, {
		id: uid('pj'),
		name,
		companyId,
		status: '商談前',
		amount: '未定',
		personIds: [personId],
		documentIds: []
	});
	p!.projectIds.push(pj.id);
	log(`案件「${pj.name}」を作成しました`, 'register', { actor: 'user', origin: 'people' });
	return pj;
}

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
	return askToSend({
		title: `${person.name.split(' ')[0]}様への${d.kind}の送付`,
		to,
		subject: d.title,
		body: `添付: ${d.title}.pdf`,
		payload: { type: 'document', documentId: d.id, personId },
		origin
	});
}
