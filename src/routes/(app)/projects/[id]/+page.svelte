<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { companyOf, documentOf, personOf, projectOf, eventDateOf, meetingsOf } from '$lib/derived';
	import { parse, rel, fmtMDW } from '$lib/dates';
	import Icon from '$lib/components/Icon.svelte';
	import ListSection from '$lib/components/ListSection.svelte';
	import SourceIcon from '$lib/components/SourceIcon.svelte';
	import ProjectStatusIcon from '$lib/components/ProjectStatusIcon.svelte';
	import DocKindIcon from '$lib/components/DocKindIcon.svelte';

	const id = $derived(page.params.id!);
	const project = $derived(projectOf(db, id));
	const company = $derived(companyOf(db, project?.companyId));
	const people = $derived(
		project ? project.personIds.map((x) => personOf(db, x)).filter((x) => !!x) : []
	);
	const threads = $derived(
		db.threads.filter((t) => t.projectId === id).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
	);
	const meetings = $derived(meetingsOf(db, (m) => m.projectId === id));
	const documents = $derived(
		project
			? project.documentIds.map((d) => documentOf(db, d)).filter((x) => !!x)
			: []
	);
</script>

<svelte:head><title>{project?.name ?? '案件'} — KUROKO AI</title></svelte:head>

<div class="people">
	<header class="people-head">
		<a class="btn text sm people-back" href="/people">
			<Icon name="ic-left" size={18} />会社・人物・案件
		</a>
		<div class="people-title">
			<h1>{project?.name ?? '見つかりません'}</h1>
			{#if company}<p class="muted">{company.name}</p>{/if}
		</div>
	</header>

	{#if !project}
		<p class="people-missing">この案件は登録されていません。</p>
	{:else}
		<!-- コンテンツ層なのでガラスは使わない (HIG Materials) -->
		<div class="people-cards">
			<section class="card people-sec">
				<h2>基本情報</h2>
				<dl class="kv">
					<dt>会社</dt>
					<dd>
						{#if company}<a href="/companies/{company.id}">{company.name}</a>{:else}登録なし{/if}
					</dd>
					<dt>ステータス</dt>
					<dd><ProjectStatusIcon status={project.status} /></dd>
					<dt>金額</dt>
					<dd class="num">{project.amount}</dd>
					<dt>次回予定</dt>
					<dd>{project.nextDate ? fmtMDW(parse(project.nextDate)) : '未定'}</dd>
				</dl>
			</section>

			<ListSection title="関連人物" items={people} key={(p) => p.id} empty="紐づく人物はいません">
				{#snippet row(p)}
					<a class="list-row" href="/people/{p.id}">
						<span class="people-ident">{p.name}</span>
						<span class="muted">{p.title}</span>
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

			<ListSection title="資料" items={documents} key={(d) => d.id} empty="資料はありません">
				{#snippet row(d)}
					<a class="list-row" href="/documents?d={d.id}">
						<DocKindIcon kind={d.kind} />
						<span class="people-ident">{d.title}</span>
					</a>
				{/snippet}
			</ListSection>
		</div>
	{/if}
</div>
