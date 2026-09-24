import type { Origin, Person, CardFields, Project } from '../types';
import { db, save } from '../store.svelte';
import { personOf, identityOf } from '../derived';
import { uid } from '../kuroko/generate';
import { log, must, pushed } from './core';

/** People のメモ。中身が変わったときだけ作業履歴に残す */
export function updatePersonMemo(personId: string, memo: string): Person | undefined {
	const p = personOf(db, personId);
	if (!p || p.memo === memo) return p;
	p.memo = memo;
	log(`${p.name}様のメモを更新しました`, 'other', { actor: 'user', origin: 'people' });
	save();
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
	save();
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
	save();
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
	save();
	return pj;
}
