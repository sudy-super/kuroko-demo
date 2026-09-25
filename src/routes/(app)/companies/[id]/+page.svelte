<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { companyOf, meetingsOf } from '$lib/derived';
	import DetailPage from '$lib/components/DetailPage.svelte';
	import ListSection from '$lib/components/ListSection.svelte';
	import { personRow, projectRow, threadRow, meetingRow } from '$lib/components/Rows.svelte';

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

<DetailPage
	back={{ href: '/people', label: '会社・人物・案件' }}
	item={company}
	title={(c) => c.name}
	missing="この会社は登録されていません。"
>
	{#snippet sub(company)}<p class="muted">{company.industry}</p>{/snippet}
	{#snippet children(company)}
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
		<ListSection title="担当者" items={people} key={(p) => p.id} empty="登録された担当者はいません" row={personRow} />
		<ListSection title="案件" items={projects} key={(pj) => pj.id} empty="案件はありません" row={projectRow} />
		<ListSection title="関連メール" items={threads} key={(t) => t.id} empty="関連するメールはありません" row={threadRow} />
		<ListSection title="関連会議" items={meetings} key={(m) => m.id} empty="関連する会議はありません" row={meetingRow} />
	{/snippet}
</DetailPage>
