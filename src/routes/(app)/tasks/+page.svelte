<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import type { TaskFilter } from '$lib/derived';
	import { filterTasks, openTaskCount } from '$lib/derived';
	import { acceptTaskSuggestions, rejectSuggestions } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import SuggestionCard from '$lib/components/SuggestionCard.svelte';

	const FILTERS: { key: TaskFilter; label: string; empty: string }[] = [
		{ key: 'overdue', label: '期限超過', empty: '期限超過はありません' },
		{ key: 'today', label: '今日', empty: '今日の ToDo はありません' },
		{ key: 'week', label: '今週', empty: '今週の ToDo はありません' },
		{ key: 'all', label: 'すべて', empty: 'ToDo はありません' }
	];

	let filter = $state<TaskFilter>('today');
	const current = $derived(FILTERS.find((f) => f.key === filter)!);
	const tasks = $derived(filterTasks(db, filter));
	// 残りが 0 件なら、完了の行が残っていても「ありません」を出す。チップの件数と食い違わせない
	const left = $derived(openTaskCount(db, filter));

	// 会議やチャットが出した ToDo 候補。KUROKO が勝手に登録することはない (仕様 5.4)
	const suggestions = $derived(
		db.suggestions.filter((s) => s.kind === 'task' && s.status === 'pending')
	);

	const formOpen = $derived(page.url.searchParams.get('new') === '1');
	const closeForm = () => goto('/tasks', { replaceState: true, noScroll: true, keepFocus: true });

	function accept(ids: string[]) {
		toast(`ToDo を ${acceptTaskSuggestions(ids).length} 件登録しました`);
	}

	function rejectAll() {
		rejectSuggestions(suggestions.map((s) => s.id));
		toast('候補を破棄しました');
	}
</script>

<svelte:head><title>ToDo — KUROKO AI</title></svelte:head>

<div class="tasks">
	<header class="tasks-head">
		<h1>ToDo</h1>
		<a class="btn pri" href="/tasks?new=1"><Icon name="ic-plus" size={20} />新しい ToDo を追加</a>
	</header>

	<div class="row tasks-filters" role="group" aria-label="絞り込み">
		{#each FILTERS as f (f.key)}
			{@const n = openTaskCount(db, f.key)}
			<button
				class="chip"
				class:on={filter === f.key}
				aria-pressed={filter === f.key}
				onclick={() => (filter = f.key)}
			>
				{#if filter === f.key}<Icon name="ic-check" size={18} />{/if}
				{f.label}
				<span class="badge count" class:warn={f.key === 'overdue' && n > 0}>{n}</span>
			</button>
		{/each}
	</div>

	{#if suggestions.length}
		<SuggestionCard
			{suggestions}
			title="ToDo の候補 {suggestions.length} 件"
			onaccept={accept}
			onreject={rejectAll}
		/>
	{/if}

	<section class="card tasks-list" aria-label="{current.label}の ToDo">
		{#if left === 0}
			<p class="muted tasks-empty">{current.empty}</p>
		{/if}
		{#each tasks as t (t.id)}
			<TaskRow task={t} />
		{/each}
	</section>
</div>

<TaskForm open={formOpen} onclose={closeForm} />

<style>
	.tasks {
		max-width: 880px;
	}
	.tasks-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-5);
		padding: 0 var(--sp-5) var(--sp-5);
	}
	.tasks-filters {
		flex-wrap: wrap;
		gap: var(--sp-3);
		padding: 0 var(--sp-5) var(--sp-5);
	}
	/* 選択中のチップは下地が accent なので、件数は白地に反転させる */
	.tasks-filters .chip.on .badge.count {
		background: #fff;
		color: var(--accent);
	}
	.tasks-list {
		padding-inline: 0;
		padding-block: var(--sp-2);
	}
	.tasks-empty {
		padding: var(--sp-5);
	}
</style>
