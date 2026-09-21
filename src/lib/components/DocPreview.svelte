<script lang="ts">
	import type { Document } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { companyOf, projectOf } from '$lib/derived';
	import { parse, rel } from '$lib/dates';

	let { doc }: { doc: Document } = $props();

	const project = $derived(projectOf(db, doc.projectId));
	const company = $derived(companyOf(db, project?.companyId));
	const when = $derived(`${rel(parse(doc.createdAt.slice(0, 10)), parse(db.seededOn))} ${doc.createdAt.slice(11, 16)}`);
</script>

<!-- 印刷ではこの節だけが残る (app.css の @media print)。紙に出る内容をここに閉じる -->
<article class="doc-paper">
	<header class="doc-paper-head">
		<span class="badge">{doc.kind}</span>
		<h2>{doc.title}</h2>
		<p class="doc-meta">
			{company ? `${company.name} 御中 / ` : ''}{doc.createdBy === 'KUROKO'
				? 'KUROKO が作成'
				: '自分で作成'} / {when}
		</p>
	</header>

	<!-- 節が 1 つしかない資料 (シードの「〜.pdf」) に目次を出すと、見出しがそのまま 2 度出る -->
	{#if doc.sections.length > 1}
		<nav class="doc-toc" aria-label="目次">
			<h3>目次</h3>
			<ol>
				{#each doc.sections as s (s.heading)}
					<li><a href="#doc-{doc.id}-{s.heading}">{s.heading}</a></li>
				{/each}
			</ol>
		</nav>
	{/if}

	{#each doc.sections as s (s.heading)}
		<section class="doc-sec">
			<h3 id="doc-{doc.id}-{s.heading}">{s.heading}</h3>
			<p>{s.body}</p>
		</section>
	{/each}
</article>

<style>
	/* 紙の見た目。カード (.card) の上に置くので、自分では影も枠も持たない */
	.doc-paper {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.doc-paper-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-2);
	}
	h2 {
		margin: 0;
		font-size: 22px;
		line-height: 1.4;
		/* 高さを決め打ちしないので、折り返した分だけ伸びる (下に重ならない) */
		overflow-wrap: anywhere;
	}
	.doc-meta {
		color: var(--ink-3);
		font-size: 13px;
	}
	.doc-toc {
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--r-s);
		background: #fff;
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.doc-toc h3,
	.doc-sec h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
		color: var(--ink-3);
	}
	.doc-toc ol {
		margin: var(--sp-2) 0 0;
		padding-left: 1.4em;
		line-height: 1.9;
	}
	.doc-sec h3 {
		color: var(--ink);
		font-size: 16px;
		font-weight: 700;
	}
	.doc-sec p {
		margin-top: var(--sp-2);
		line-height: 1.8;
		overflow-wrap: anywhere;
	}
</style>
