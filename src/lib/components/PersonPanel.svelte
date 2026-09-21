<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { companyOf, identityOf, personOfIdentity, projectOf, projectStatusClass } from '$lib/derived';
	import { identitiesOf, personStats } from '$lib/people';
	import { parse, fmtMDW } from '$lib/dates';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';

	/** compact は狭い場所 (メールのスレッドの頭) 向け。メモと実績を落として身元だけ出す。
	    headingLevel — 人物名の見出しレベルは置かれる場所によって正しい階層が変わるので
	    呼び出し側から渡す (rereview-task-10p.md 新規 1)。デスクトップの右欄は <h1>Inbox</h1>
	    の下なので既定の 2、Drawer のシートは題名の <h3> の下なので 4 を渡す */
	let {
		identityId,
		compact = false,
		headingLevel = 2
	}: { identityId: string; compact?: boolean; headingLevel?: 2 | 4 } = $props();

	let addOpen = $state(false);

	const identity = $derived(identityOf(db, identityId));
	const person = $derived(personOfIdentity(db, identityId));
	const company = $derived(companyOf(db, person?.companyId));
	const mail = $derived(
		person
			? (identitiesOf(db, person.id).find((i) => i.kind === 'email')?.value ?? identity?.value)
			: identity?.value
	);
	const projects = $derived(
		person ? person.projectIds.map((x) => projectOf(db, x)).filter((x) => !!x) : []
	);
	const stats = $derived(person ? personStats(db, person.id) : undefined);
</script>

<aside class="card person-panel" aria-label="差出人の情報">
	{#if person}
		<svelte:element this={`h${headingLevel}`} class="pp-name">{person.name}</svelte:element>
		<p class="muted">{company?.name ?? '会社の登録なし'} {person.title}</p>
		<p class="pp-mail">{mail}</p>

		{#each projects as pj (pj.id)}
			<a class="list-row" href="/projects/{pj.id}">
				<span class="people-ident">{pj.name}</span>
				<span class="badge {projectStatusClass(pj.status)}">{pj.status}</span>
				<span class="num muted">{pj.amount}</span>
			</a>
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
		<svelte:element this={`h${headingLevel}`} class="pp-name"
			>{identity?.value ?? '不明な差出人'}</svelte:element
		>
		<p class="muted">この方はまだ登録されていません</p>
		<!-- 同じ画面に出る ReplyBox の「採用」が塗りの主ボタンなので、こちらは副ボタン
		     (buttons.md 観点 A 原則 3) -->
		<button class="btn sec sm" onclick={() => (addOpen = true)}>
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
