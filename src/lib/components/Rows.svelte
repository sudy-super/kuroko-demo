<script module lang="ts">
	import type { Document, MessageThread, Meeting, Person, Project } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { eventDateOf } from '$lib/derived';
	import { parse, fmtMDW, relDay } from '$lib/dates';
	import SourceIcon from './SourceIcon.svelte';
	import ProjectStatusIcon from './ProjectStatusIcon.svelte';
	import DocKindIcon from './DocKindIcon.svelte';

	/* 詳細のカードとパネルで繰り返す、人物・案件・メール・会議・資料への 1 行のリンク */
	export { personRow, projectRow, threadRow, meetingRow, docRow };
</script>

{#snippet personRow(p: Person)}
	<a class="list-row" href="/people/{p.id}">
		<span class="people-ident">{p.name}</span>
		<span class="muted">{p.title}</span>
	</a>
{/snippet}

{#snippet projectRow(pj: Project)}
	<a class="list-row" href="/projects/{pj.id}">
		<span class="people-ident">{pj.name}</span>
		<ProjectStatusIcon status={pj.status} />
		<span class="num muted">{pj.amount}</span>
	</a>
{/snippet}

{#snippet threadRow(t: MessageThread)}
	<a class="list-row" href="/inbox?t={t.id}">
		<SourceIcon source={t.source} />
		<span class="people-ident">{t.subject}</span>
		<span class="num muted">{relDay(t.lastAt, db.seededOn)}</span>
	</a>
{/snippet}

{#snippet meetingRow(m: Meeting)}
	{@const d = eventDateOf(db, m)}
	<a class="list-row" href="/meetings/{m.id}">
		<span class="people-ident">{m.title}</span>
		<span class="num muted">{d ? fmtMDW(parse(d)) : ''}</span>
	</a>
{/snippet}

{#snippet docRow(d: Document)}
	<a class="list-row" href="/documents?d={d.id}">
		<DocKindIcon kind={d.kind} />
		<span class="people-ident">{d.title}</span>
	</a>
{/snippet}
