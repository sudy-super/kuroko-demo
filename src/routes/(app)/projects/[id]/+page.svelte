<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { companyOf, personOf } from '$lib/derived';
	import { parse, rel, fmtMDW } from '$lib/dates';
	import Icon from '$lib/components/Icon.svelte';
	import { glass, REGULAR } from '$lib/glass';

	const id = $derived(page.params.id!);
	const project = $derived(db.projects.find((p) => p.id === id));
	const company = $derived(companyOf(db, project?.companyId));
	const people = $derived(project ? project.personIds.map((x) => personOf(db, x)) : []);
	const threads = $derived(
		db.threads.filter((t) => t.projectId === id).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
	);
	const meetings = $derived(db.meetings.filter((m) => m.projectId === id));
	const documents = $derived(
		project ? project.documentIds.map((d) => db.documents.find((x) => x.id === d)) : []
	);

	const SOURCE: Record<string, string> = { gmail: 'メール', slack: 'Slack', line: 'LINE' };
	const statusClass = (s: string) => (s === '受注' ? 'ok' : s === '失注' ? 'warn' : '');
	const dateOf = (eventId: string) => db.events.find((e) => e.id === eventId)?.date;
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
		<div class="people-cards" {@attach glass({ ...REGULAR, targets: '.card' })}>
			<section class="card people-sec">
				<h2>基本情報</h2>
				<dl class="kv">
					<dt>会社</dt>
					<dd>
						{#if company}<a href="/companies/{company.id}">{company.name}</a>{:else}登録なし{/if}
					</dd>
					<dt>ステータス</dt>
					<dd><span class="badge {statusClass(project.status)}">{project.status}</span></dd>
					<dt>金額</dt>
					<dd class="num">{project.amount}</dd>
					<dt>次回予定</dt>
					<dd>{project.nextDate ? fmtMDW(parse(project.nextDate)) : '未定'}</dd>
				</dl>
			</section>

			<section class="card people-sec">
				<h2>関連人物</h2>
				{#each people as p (p?.id)}
					{#if p}
						<a class="list-row" href="/people/{p.id}">
							<span class="people-ident">{p.name}</span>
							<span class="muted">{p.title}</span>
						</a>
					{/if}
				{/each}
				{#if !people.length}<p class="muted">紐づく人物はいません</p>{/if}
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

			<section class="card people-sec">
				<h2>資料</h2>
				{#each documents as d (d?.id)}
					{#if d}
						<a class="list-row" href="/documents/{d.id}">
							<span class="badge src">{d.kind}</span>
							<span class="people-ident">{d.title}</span>
						</a>
					{/if}
				{/each}
				{#if !documents.length}<p class="muted">資料はありません</p>{/if}
			</section>
		</div>
	{/if}
</div>
