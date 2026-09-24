<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { companyOf, eventDateOf, meetingsOf } from '$lib/derived';
	import { parse, rel, fmtMDW } from '$lib/dates';
	import Icon from '$lib/components/Icon.svelte';
	import ListSection from '$lib/components/ListSection.svelte';
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

			<ListSection title="担当者" items={people} key={(p) => p.id} empty="登録された担当者はいません">
				{#snippet row(p)}
					<a class="list-row" href="/people/{p.id}">
						<span class="people-ident">{p.name}</span>
						<span class="muted">{p.title}</span>
					</a>
				{/snippet}
			</ListSection>

			<ListSection title="案件" items={projects} key={(pj) => pj.id} empty="案件はありません">
				{#snippet row(pj)}
					<a class="list-row" href="/projects/{pj.id}">
						<span class="people-ident">{pj.name}</span>
						<ProjectStatusIcon status={pj.status} />
						<span class="num muted">{pj.amount}</span>
					</a>
				{/snippet}
			</ListSection>

			<ListSection title="関連メール" items={threads} key={(t) => t.id} empty="関連するメールはありません">
				{#snippet row(t)}
					<a class="list-row" href="/inbox?t={t.id}">
						<SourceIcon source={t.source} />
						<span class="people-ident">{t.subject}</span>
						<span class="num muted">{rel(parse(t.lastAt.slice(0, 10)), parse(db.seededOn))}</span>
					</a>
				{/snippet}
			</ListSection>

			<ListSection title="関連会議" items={meetings} key={(m) => m.id} empty="関連する会議はありません">
				{#snippet row(m)}
					{@const d = eventDateOf(db, m)}
					<a class="list-row" href="/meetings/{m.id}">
						<span class="people-ident">{m.title}</span>
						<span class="num muted">{d ? fmtMDW(parse(d)) : ''}</span>
					</a>
				{/snippet}
			</ListSection>
		</div>
	{/if}
</div>
