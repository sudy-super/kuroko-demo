<script lang="ts">
	import type { Meeting } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { companyOf, personOf, projectOf } from '$lib/derived';

	let { meeting }: { meeting: Meeting } = $props();

	const brief = $derived(meeting.brief);
	const people = $derived(meeting.personIds.map((x) => personOf(db, x)).filter((x) => !!x));
	const company = $derived(companyOf(db, meeting.companyId));
	const project = $derived(projectOf(db, meeting.projectId));
	const documents = $derived(
		(brief?.documentIds ?? []).map((d) => db.documents.find((x) => x.id === d)).filter((x) => !!x)
	);
</script>

{#snippet lines(items: string[])}
	{#if items.length}
		<ul>
			{#each items as t (t)}<li>{t}</li>{/each}
		</ul>
	{:else}
		<span class="muted">なし</span>
	{/if}
{/snippet}

<!-- 8 項目は「見出し + 値」の並びなので、/projects/[id] と同じ .kv に全部載せる -->
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
			<span class="badge">{project.status}</span>{:else}紐づく案件はありません{/if}
	</dd>
	<dt>目的</dt>
	<dd>{meeting.purpose}</dd>
	<dt>これまでの経緯</dt>
	<dd>{@render lines(brief?.history ?? [])}</dd>
	<dt>前回のポイント</dt>
	<dd>{@render lines(brief?.lastPoints ?? [])}</dd>
	<dt>前回の宿題</dt>
	<dd>{@render lines(brief?.homework ?? [])}</dd>
	<dt>最近の連絡</dt>
	<dd>{@render lines(brief?.recentContacts ?? [])}</dd>
	<dt>関連資料</dt>
	<dd>
		{#each documents as d (d.id)}
			<span class="row"><span class="badge">{d.kind}</span>
				<a href="/documents?d={d.id}">{d.title}</a></span>
		{/each}
		{#if !documents.length}<span class="muted">なし</span>{/if}
	</dd>
</dl>

<style>
	ul {
		margin: 0;
		padding-left: 1.2em;
	}
</style>
