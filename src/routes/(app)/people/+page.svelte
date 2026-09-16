<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { companyOf, projectStatusClass } from '$lib/derived';
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';

	type Tab = 'people' | 'companies' | 'projects';
	const TABS: { key: Tab; label: string }[] = [
		{ key: 'people', label: '人物' },
		{ key: 'companies', label: '会社' },
		{ key: 'projects', label: '案件' }
	];

	let tab = $state<Tab>('people');
	let cardOpen = $state(false);

	const count = $derived({
		people: db.people.length,
		companies: db.companies.length,
		projects: db.projects.length
	});

	const staff = (companyId: string) => db.people.filter((p) => p.companyId === companyId).length;
	import { glass, CARD } from '$lib/glass';
</script>

<svelte:head><title>会社・人物・案件 — KUROKO AI</title></svelte:head>

<div class="people">
	<header class="people-head">
		<h1>会社・人物・案件</h1>
		{#if tab === 'people'}
			<button class="btn pri" onclick={() => (cardOpen = true)}>
				<Icon name="ic-cam" size={20} />名刺から追加
			</button>
		{/if}
	</header>

	<div class="row people-tabs" role="group" aria-label="表示の切り替え">
		{#each TABS as t (t.key)}
			<button
				class="chip"
				class:on={tab === t.key}
				aria-pressed={tab === t.key}
				onclick={() => (tab = t.key)}
			>
				{#if tab === t.key}<Icon name="ic-check" size={18} />{/if}
				{t.label}
				<span class="badge count">{count[t.key]}</span>
			</button>
		{/each}
	</div>

	<div class="people-cards" {@attach glass({ ...CARD, targets: '.card' })}>
		<section class="card people-list" aria-label={TABS.find((t) => t.key === tab)!.label}>
			{#if tab === 'people'}
				{#each db.people as p (p.id)}
					<a class="list-row lg" href="/people/{p.id}">
						<span class="people-col">
							<span class="people-name">{p.name}</span>
							<span class="sub">{companyOf(db, p.companyId)?.name ?? '会社の登録なし'} {p.title}</span>
						</span>
						<!-- 人物のタグは分類 (Atlassian の Tag) なので、状態の Lozenge とは見た目を分ける (audit 4) -->
						{#each p.tags.slice(0, 2) as t (t)}<span class="badge tag">{t}</span>{/each}
					</a>
				{/each}
			{:else if tab === 'companies'}
				{#each db.companies as c (c.id)}
					<a class="list-row lg" href="/companies/{c.id}">
						<span class="people-col">
							<span class="people-name">{c.name}</span>
							<span class="sub">{c.industry} / {c.size}</span>
						</span>
						<span class="badge src">担当 {staff(c.id)} 名</span>
					</a>
				{/each}
			{:else}
				{#each db.projects as pj (pj.id)}
					<a class="list-row lg" href="/projects/{pj.id}">
						<span class="people-col">
							<span class="people-name">{pj.name}</span>
							<span class="sub">{companyOf(db, pj.companyId)?.name ?? ''}</span>
						</span>
						<span class="badge {projectStatusClass(pj.status)}">{pj.status}</span>
						<span class="num muted people-amount">{pj.amount}</span>
					</a>
				{/each}
			{/if}
		</section>
	</div>
</div>

<!-- Task 25 で名刺の読み取りと確認画面を入れる。ここは先に置いた入り口 -->
<Modal
	open={cardOpen}
	title="名刺から追加"
	description="名刺の画像から人物を登録する機能は、後の手順で使えるようになります。"
	size="sm"
	onclose={() => (cardOpen = false)}
>
	{#snippet actions()}
		<button class="btn pri" onclick={() => (cardOpen = false)}>閉じる</button>
	{/snippet}
</Modal>
