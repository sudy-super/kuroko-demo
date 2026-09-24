<script lang="ts">
	import type { Meeting } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { companyOf, documentOf, personOf, projectOf } from '$lib/derived';
	import ProjectStatusIcon from './ProjectStatusIcon.svelte';
	import DocKindIcon from './DocKindIcon.svelte';

	let { meeting }: { meeting: Meeting } = $props();

	const brief = $derived(meeting.brief);
	const people = $derived(meeting.personIds.map((x) => personOf(db, x)).filter((x) => !!x));
	const company = $derived(companyOf(db, meeting.companyId));
	const project = $derived(projectOf(db, meeting.projectId));
	const documents = $derived(
		(brief?.documentIds ?? []).map((d) => documentOf(db, d)).filter((x) => !!x)
	);
</script>

<!-- 短い 3 項目は /projects/[id] と同じ 2 列の .kv。
     残る 5 項目は値が箇条書きや行なので、見出しの下に全幅で置く -->
<dl class="kv">
	<dt>相手</dt>
	<dd>
		{#each people as p, i (p.id)}{#if i}、{/if}<a href="/people/{p.id}">{p.name}</a> ({p.title}){/each}
		{#if !people.length}登録なし{/if}
		{#if company}<span class="muted"> / <a href="/companies/{company.id}">{company.name}</a></span>{/if}
	</dd>
	<dt>案件</dt>
	<dd>
		{#if project}<a href="/projects/{project.id}">{project.name}</a>
			<ProjectStatusIcon status={project.status} />{:else}紐づく案件はありません{/if}
	</dd>
	<dt>目的</dt>
	<dd>{meeting.purpose}</dd>
</dl>

{#snippet sec(title: string, items: string[])}
	<h3>{title}</h3>
	{#if items.length}
		<ul>
			{#each items as t (t)}<li>{t}</li>{/each}
		</ul>
	{:else}
		<p class="muted">なし</p>
	{/if}
{/snippet}

{@render sec('これまでの経緯', brief?.history ?? [])}
{@render sec('前回のポイント', brief?.lastPoints ?? [])}
{@render sec('前回の宿題', brief?.homework ?? [])}
{@render sec('最近の連絡', brief?.recentContacts ?? [])}

<h3>関連資料</h3>
{#each documents as d (d.id)}
	<a class="list-row" href="/documents?d={d.id}">
		<DocKindIcon kind={d.kind} />
		<span class="people-ident">{d.title}</span>
	</a>
{/each}
{#if !documents.length}<p class="muted">なし</p>{/if}

<style>
	/* 値の見出し。.kv dt と同じ色と大きさにそろえる */
	h3 {
		margin: var(--sp-4) 0 var(--sp-2);
		color: var(--ink-3);
		font-size: 14px;
		font-weight: 500;
	}
	ul {
		margin: 0;
		padding-left: 1.2em;
		line-height: 1.7;
	}
</style>
