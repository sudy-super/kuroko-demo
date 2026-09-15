<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { companyOf, identityOf, personOfIdentity, projectOf } from '$lib/derived';
	import { identitiesOf, personStats } from '$lib/people';
	import { parse, fmtMDW } from '$lib/dates';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';

	/** compact は狭い場所 (メールのスレッドの頭) 向け。メモと実績を落として身元だけ出す */
	let { identityId, compact = false }: { identityId: string; compact?: boolean } = $props();

	let addOpen = $state(false);

	const identity = $derived(identityOf(db, identityId));
	const person = $derived(personOfIdentity(db, identityId));
	const company = $derived(companyOf(db, person?.companyId));
	const mail = $derived(
		person
			? (identitiesOf(db, person.id).find((i) => i.kind === 'email')?.value ?? identity?.value)
			: identity?.value
	);
	const projects = $derived(person ? person.projectIds.map((x) => projectOf(db, x)) : []);
	const stats = $derived(person ? personStats(db, person.id) : undefined);
</script>

<aside class="card person-panel" aria-label="差出人の情報">
	{#if person}
		<h2 class="pp-name">{person.name}</h2>
		<p class="muted">{company?.name ?? '会社の登録なし'} {person.title}</p>
		<p class="pp-mail">{mail}</p>

		{#each projects as pj (pj?.id)}
			{#if pj}
				<a class="list-row" href="/projects/{pj.id}">
					<span class="people-ident">{pj.name}</span>
					<span class="badge">{pj.status}</span>
					<span class="num muted">{pj.amount}</span>
				</a>
			{/if}
		{/each}

		{#if !compact}
			<dl class="kv pp-stats">
				<dt>最終商談</dt>
				<dd>{stats?.lastMeeting ? fmtMDW(parse(stats.lastMeeting)) : '記録なし'}</dd>
				<dt>メール</dt>
				<dd class="num">{stats?.mails} 通</dd>
				<dt>会議</dt>
				<dd class="num">{stats?.meetings} 件</dd>
			</dl>
			{#if person.memo}<p class="pp-memo">{person.memo}</p>{/if}
		{/if}

		<a class="btn sec sm" href="/people/{person.id}">プロフィールを開く</a>
	{:else}
		<h2 class="pp-name">{identity?.value ?? '不明な差出人'}</h2>
		<p class="muted">この方はまだ登録されていません</p>
		<button class="btn pri sm" onclick={() => (addOpen = true)}>
			<Icon name="ic-plus" size={18} />People に追加
		</button>
	{/if}
</aside>

<!-- Task 25 で名刺と同じ確認画面を差出人の情報で開く。ここは先に置いた入り口 -->
<Modal
	open={addOpen}
	title="People に追加"
	description="差出人の情報から人物を登録する機能は、後の手順で使えるようになります。"
	size="sm"
	onclose={() => (addOpen = false)}
>
	{#snippet actions()}
		<button class="btn pri" onclick={() => (addOpen = false)}>閉じる</button>
	{/snippet}
</Modal>
