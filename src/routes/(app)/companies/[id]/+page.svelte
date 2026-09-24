<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { companyOf, eventDateOf, meetingsOf } from '$lib/derived';
	import { parse, rel, fmtMDW } from '$lib/dates';
	import Icon from '$lib/components/Icon.svelte';
	import SourceIcon from '$lib/components/SourceIcon.svelte';
	import ProjectStatusIcon from '$lib/components/ProjectStatusIcon.svelte';

	const id = $derived(page.params.id!);
	const company = $derived(companyOf(db, id));
	const people = $derived(db.people.filter((p) => p.companyId === id));
	const projects = $derived(db.projects.filter((p) => p.companyId === id));
	const threads = $derived(
		db.threads.filter((t) => t.companyId === id).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
	);
	const meetings = $derived(meetingsOf(db, (m) => m.companyId === id));

	/* 仕様 5 — カードの中の一覧は上位 3 件まで。「残り N 件」を押すとその場で全部出す */
	const LIMIT = 3;
	let open = $state<Record<string, boolean>>({});
	const shown = <T,>(a: T[], k: string) => (open[k] ? a : a.slice(0, LIMIT));
</script>

{#snippet more(k: string, n: number)}
	{#if !open[k] && n > LIMIT}
		<button class="btn text sm" onclick={() => (open[k] = true)}>残り {n - LIMIT} 件</button>
	{/if}
{/snippet}

<svelte:head><title>{company?.name ?? '会社'} — KUROKO AI</title></svelte:head>

<div class="people">
	<header class="people-head">
		<a class="btn text sm people-back" href="/people">
			<Icon name="ic-left" size={18} />会社・人物・案件
		</a>
		<div class="people-title">
			<h1>{company?.name ?? '見つかりません'}</h1>
			{#if company}<p class="muted">{company.industry}</p>{/if}
		</div>
	</header>

	{#if !company}
		<p class="people-missing">この会社は登録されていません。</p>
	{:else}
		<!-- Task 10w — HIG 上ガラスを持たないコンテンツ層なので、Task 10c のガラス (glass()) を外して
		     普通のカードの面 (.card) に戻した (glass-scope.md 6 節) -->
		<div class="people-cards">
			<section class="card people-sec">
				<h2>基本情報</h2>
				<dl class="kv">
					<dt>ドメイン</dt>
					<dd>{company.domain}</dd>
					<dt>業種</dt>
					<dd>{company.industry}</dd>
					<dt>規模</dt>
					<dd>{company.size}</dd>
				</dl>
			</section>

			<section class="card people-sec">
				<h2>担当者</h2>
				{#each shown(people, 'people') as p (p.id)}
					<a class="list-row" href="/people/{p.id}">
						<span class="people-ident">{p.name}</span>
						<span class="muted">{p.title}</span>
					</a>
				{/each}
				{#if !people.length}<p class="muted">登録された担当者はいません</p>{/if}
				{@render more('people', people.length)}
			</section>

			<section class="card people-sec">
				<h2>案件</h2>
				{#each shown(projects, 'projects') as pj (pj.id)}
					<a class="list-row" href="/projects/{pj.id}">
						<span class="people-ident">{pj.name}</span>
						<ProjectStatusIcon status={pj.status} />
						<span class="num muted">{pj.amount}</span>
					</a>
				{/each}
				{#if !projects.length}<p class="muted">案件はありません</p>{/if}
				{@render more('projects', projects.length)}
			</section>

			<section class="card people-sec">
				<h2>関連メール</h2>
				{#each shown(threads, 'threads') as t (t.id)}
					<a class="list-row" href="/inbox?t={t.id}">
						<SourceIcon source={t.source} />
						<span class="people-ident">{t.subject}</span>
						<span class="num muted">{rel(parse(t.lastAt.slice(0, 10)), parse(db.seededOn))}</span>
					</a>
				{/each}
				{#if !threads.length}<p class="muted">関連するメールはありません</p>{/if}
				{@render more('threads', threads.length)}
			</section>

			<section class="card people-sec">
				<h2>関連会議</h2>
				{#each shown(meetings, 'meetings') as m (m.id)}
					{@const d = eventDateOf(db, m)}
					<a class="list-row" href="/meetings/{m.id}">
						<span class="people-ident">{m.title}</span>
						<span class="num muted">{d ? fmtMDW(parse(d)) : ''}</span>
					</a>
				{/each}
				{#if !meetings.length}<p class="muted">関連する会議はありません</p>{/if}
				{@render more('meetings', meetings.length)}
			</section>
		</div>
	{/if}
</div>
