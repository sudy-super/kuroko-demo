<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { badgeCount, companyOf, personOf } from '$lib/derived';
	import Icon from '$lib/components/Icon.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import ProjectStatusIcon from '$lib/components/ProjectStatusIcon.svelte';
	import OcrFlow from '$lib/components/OcrFlow.svelte';
	import Avatars from '$lib/components/Avatars.svelte';

	type Tab = 'people' | 'companies' | 'projects';
	const TABS: { key: Tab; label: string; icon: string }[] = [
		{ key: 'people', label: '人物', icon: 'ic-user' },
		{ key: 'companies', label: '会社', icon: 'ic-db' },
		{ key: 'projects', label: '案件', icon: 'ic-target' }
	];

	let tab = $state<Tab>('people');
	// 案内の筋書き (scenarios.ts) が /people?ocr=1 で直接開く
	let cardOpen = $state(page.url.searchParams.get('ocr') === '1');

	const count = $derived({
		people: db.people.length,
		companies: db.companies.length,
		projects: db.projects.length
	});

	const staff = (companyId: string) => db.people.filter((p) => p.companyId === companyId).length;
</script>

<svelte:head><title>会社・人物・案件 — KUROKO AI</title></svelte:head>

<div class="people">
	<h1 class="sr-only">会社・人物・案件</h1>
	<div class="row page-bar people-bar">
		<Segmented label="表示の切り替え" items={TABS} value={tab} onchange={(k) => (tab = k)}>
			{#snippet extra(k)}<span class="badge count">{badgeCount(count[k])}</span>{/snippet}
		</Segmented>
		<!-- ToDo の「+」と同じく、切り替えの列の右端に記号だけのボタンで置く -->
		{#if tab === 'people'}
			<button class="iconbtn people-add" title="名刺から追加" aria-label="名刺から追加" onclick={() => (cardOpen = true)}>
				<Icon name="ic-cam" size={20} />
			</button>
		{/if}
	</div>

	<!-- コンテンツ層なのでガラスは使わない (HIG Materials) -->
	<div class="people-cards">
		<!-- /inbox・/tasks と同じ形の小見出し。直上のタブと重なるが、絞り込みではなく一覧そのものの見出し -->
		<section class="card people-list" aria-labelledby="people-list-head">
			<h2 class="list-head" id="people-list-head">
				<Icon name={TABS.find((t) => t.key === tab)!.icon} size={16} />{TABS.find((t) => t.key === tab)!
					.label}<span class="num">{count[tab]}</span>
			</h2>
			{#if tab === 'people'}
				{#each db.people as p (p.id)}
					<a class="list-row lg" href="/people/{p.id}">
						<span class="people-col">
							<span class="tc-text">{p.name}</span>
							<span class="sub">{companyOf(db, p.companyId)?.name ?? '会社の登録なし'} {p.title}</span>
						</span>
						<!-- 人物のタグは分類 (Atlassian の Tag) なので、状態の Lozenge とは見た目を分ける -->
						{#each p.tags.slice(0, 2) as t (t)}<span class="badge tag">{t}</span>{/each}
					</a>
				{/each}
			{:else if tab === 'companies'}
				{#each db.companies as c (c.id)}
					<a class="list-row lg" href="/companies/{c.id}">
						<span class="people-col">
							<span class="tc-text">{c.name}</span>
							<span class="sub">{c.industry} / {c.size}</span>
						</span>
						<span class="badge">担当 {staff(c.id)} 名</span>
					</a>
				{/each}
			{:else}
				{#each db.projects as pj (pj.id)}
					{@const people = pj.personIds.map((id) => personOf(db, id)).filter((p) => !!p)}
					<a class="list-row lg" href="/projects/{pj.id}">
						<span class="people-col">
							<span class="tc-text">{pj.name}</span>
							<span class="sub">{companyOf(db, pj.companyId)?.name ?? ''}</span>
						</span>
						<ProjectStatusIcon status={pj.status} />
						<span class="num muted people-amount">{pj.amount}</span>
						<Avatars {people} />
					</a>
				{/each}
			{/if}
		</section>
	</div>
</div>

<OcrFlow open={cardOpen} onclose={() => (cardOpen = false)} />
