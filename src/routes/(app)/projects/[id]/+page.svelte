<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { companyOf, documentOf, personOf, projectOf, meetingsOf } from '$lib/derived';
	import { parse, fmtMDW } from '$lib/dates';
	import DetailPage from '$lib/components/DetailPage.svelte';
	import ListSection from '$lib/components/ListSection.svelte';
	import ProjectStatusIcon from '$lib/components/ProjectStatusIcon.svelte';
	import { personRow, threadRow, meetingRow, docRow } from '$lib/components/Rows.svelte';

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
		project ? project.documentIds.map((d) => documentOf(db, d)).filter((x) => !!x) : []
	);
</script>

<svelte:head><title>{project?.name ?? '案件'} — KUROKO AI</title></svelte:head>

<DetailPage
	back={{ href: '/people', label: '会社・人物・案件' }}
	item={project}
	title={(p) => p.name}
	missing="この案件は登録されていません。"
>
	{#snippet sub()}{#if company}<p class="muted">{company.name}</p>{/if}{/snippet}
	{#snippet children(project)}
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
		<ListSection title="関連人物" items={people} key={(p) => p.id} empty="紐づく人物はいません" row={personRow} />
		<ListSection title="関連メール" items={threads} key={(t) => t.id} empty="関連するメールはありません" row={threadRow} />
		<ListSection title="関連会議" items={meetings} key={(m) => m.id} empty="関連する会議はありません" row={meetingRow} />
		<ListSection title="資料" items={documents} key={(d) => d.id} empty="資料はありません" row={docRow} />
	{/snippet}
</DetailPage>
