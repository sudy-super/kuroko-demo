<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { companyOf, personOf, eventDateOf, meetingsOf, projectStatusClass } from '$lib/derived';
	import { parse, rel, fmtMDW } from '$lib/dates';
	import Icon from '$lib/components/Icon.svelte';
	import SourceIcon from '$lib/components/SourceIcon.svelte';

	const id = $derived(page.params.id!);
	const project = $derived(db.projects.find((p) => p.id === id));
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
			? project.documentIds.map((d) => db.documents.find((x) => x.id === d)).filter((x) => !!x)
			: []
	);

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
		<!-- Task 10w — HIG 上ガラスを持たないコンテンツ層なので、Task 10c のガラス (glass()) を外して
		     普通のカードの面 (.card) に戻した (glass-scope.md 6 節) -->
		<div class="people-cards">
			<section class="card people-sec">
				<h2>基本情報</h2>
				<dl class="kv">
					<dt>会社</dt>
					<dd>
						{#if company}<a href="/companies/{company.id}">{company.name}</a>{:else}登録なし{/if}
					</dd>
					<dt>ステータス</dt>
					<dd><span class="badge {projectStatusClass(project.status)}">{project.status}</span></dd>
					<dt>金額</dt>
					<dd class="num">{project.amount}</dd>
					<dt>次回予定</dt>
					<dd>{project.nextDate ? fmtMDW(parse(project.nextDate)) : '未定'}</dd>
				</dl>
			</section>

			<section class="card people-sec">
				<h2>関連人物</h2>
				{#each shown(people, 'people') as p (p.id)}
					<a class="list-row" href="/people/{p.id}">
						<span class="people-ident">{p.name}</span>
						<span class="muted">{p.title}</span>
					</a>
				{/each}
				{#if !people.length}<p class="muted">紐づく人物はいません</p>{/if}
				{@render more('people', people.length)}
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

			<section class="card people-sec">
				<h2>資料</h2>
				{#each shown(documents, 'documents') as d (d.id)}
					<a class="list-row" href="/documents?d={d.id}">
						<span class="badge src">{d.kind}</span>
						<span class="people-ident">{d.title}</span>
					</a>
				{/each}
				{#if !documents.length}<p class="muted">資料はありません</p>{/if}
				{@render more('documents', documents.length)}
			</section>
		</div>
	{/if}
</div>
