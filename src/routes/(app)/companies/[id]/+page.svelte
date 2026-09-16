<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { parse, rel, fmtMDW } from '$lib/dates';
	import Icon from '$lib/components/Icon.svelte';

	const id = $derived(page.params.id!);
	const company = $derived(db.companies.find((c) => c.id === id));
	const people = $derived(db.people.filter((p) => p.companyId === id));
	const projects = $derived(db.projects.filter((p) => p.companyId === id));
	const threads = $derived(
		db.threads.filter((t) => t.companyId === id).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
	);
	const meetings = $derived(db.meetings.filter((m) => m.companyId === id));

	const SOURCE: Record<string, string> = { gmail: 'メール', slack: 'Slack', line: 'LINE' };
	const dateOf = (eventId: string) => db.events.find((e) => e.id === eventId)?.date;
	import { glass, CARD } from '$lib/glass';
</script>

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
		<div class="people-cards" {@attach glass({ ...CARD, targets: '.card' })}>
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
				{#each people as p (p.id)}
					<a class="list-row" href="/people/{p.id}">
						<span class="people-ident">{p.name}</span>
						<span class="muted">{p.title}</span>
					</a>
				{/each}
				{#if !people.length}<p class="muted">登録された担当者はいません</p>{/if}
			</section>

			<section class="card people-sec">
				<h2>案件</h2>
				{#each projects as pj (pj.id)}
					<a class="list-row" href="/projects/{pj.id}">
						<span class="people-ident">{pj.name}</span>
						<span class="badge">{pj.status}</span>
						<span class="num muted">{pj.amount}</span>
					</a>
				{/each}
				{#if !projects.length}<p class="muted">案件はありません</p>{/if}
			</section>

			<section class="card people-sec">
				<h2>関連メール</h2>
				{#each threads.slice(0, 5) as t (t.id)}
					<a class="list-row" href="/inbox?t={t.id}">
						<span class="badge src">{SOURCE[t.source] ?? t.source}</span>
						<span class="people-ident">{t.subject}</span>
						<span class="num muted">{rel(parse(t.lastAt.slice(0, 10)), parse(db.seededOn))}</span>
					</a>
				{/each}
				{#if !threads.length}<p class="muted">関連するメールはありません</p>{/if}
				{#if threads.length > 5}<p class="muted">残り {threads.length - 5} 件</p>{/if}
			</section>

			<section class="card people-sec">
				<h2>関連会議</h2>
				{#each meetings as m (m.id)}
					{@const d = dateOf(m.eventId)}
					<a class="list-row" href="/meetings/{m.id}">
						<span class="people-ident">{m.title}</span>
						<span class="num muted">{d ? fmtMDW(parse(d)) : ''}</span>
					</a>
				{/each}
				{#if !meetings.length}<p class="muted">関連する会議はありません</p>{/if}
			</section>
		</div>
	{/if}
</div>
