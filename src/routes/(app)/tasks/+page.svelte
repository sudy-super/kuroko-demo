<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import type { TaskFilter } from '$lib/derived';
	import { badgeCount, filterTasks, openTaskCount } from '$lib/derived';
	import { acceptTaskSuggestions, rejectSuggestions } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import SuggestionCard from '$lib/components/SuggestionCard.svelte';

	/* icon は一覧の小見出し (list-head) にも使う。フィルターの絞り込み条件を表す形なので
	   期限超過は警告の三角、今日・今週はカレンダー、すべては一覧の形にする */
	const FILTERS: { key: TaskFilter; label: string; empty: string; icon: string }[] = [
		{ key: 'overdue', label: '期限超過', empty: '期限超過はありません', icon: 'ic-alert' },
		{ key: 'today', label: '今日', empty: '今日の ToDo はありません', icon: 'ic-cal' },
		{ key: 'week', label: '今週', empty: '今週の ToDo はありません', icon: 'ic-cal' },
		{ key: 'all', label: 'すべて', empty: 'ToDo はありません', icon: 'ic-list' }
	];

	let filter = $state<TaskFilter>('today');
	const current = $derived(FILTERS.find((f) => f.key === filter)!);
	// 完了は見出しを挙げて分ける。「…はありません」と完了の行が並んでも矛盾しない
	const tasks = $derived(filterTasks(db, filter));
	const open = $derived(tasks.filter((t) => t.status !== 'done'));
	const closed = $derived(tasks.filter((t) => t.status === 'done'));

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
	<header class="tasks-head page-head">
		<div class="page-title">
			<h1>ToDo</h1>
			<p class="page-desc">期限・今日・今週で絞り込んで ToDo を管理します。</p>
		</div>
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
				<Icon name="ic-check" size={18} class="chip-check" />
				{f.label}
				<span class="badge count" class:warn={f.key === 'overdue' && n > 0}>{badgeCount(n)}</span>
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

	<section class="card tasks-list" aria-labelledby="tasks-open-head">
		<h2 class="list-head" id="tasks-open-head">
			<Icon name={current.icon} size={16} />{current.label}<span class="num">{open.length}</span>
		</h2>
		{#if open.length === 0}
			<p class="muted tasks-empty">{current.empty}</p>
		{/if}
		{#each open as t (t.id)}
			<TaskRow task={t} />
		{/each}
		{#if closed.length}
			<h2 class="list-head tasks-sub">
				<Icon name="ic-check-c" size={16} />完了<span class="num">{closed.length}</span>
			</h2>
			{#each closed as t (t.id)}
				<TaskRow task={t} />
			{/each}
		{/if}
	</section>
</div>

<TaskForm open={formOpen} onclose={closeForm} />

<style>
	.tasks {
		max-width: 880px;
	}
	.tasks-filters {
		flex-wrap: wrap;
		gap: var(--sp-3);
		padding: 0 var(--sp-5) var(--sp-5);
	}
	.tasks-list {
		padding-inline: 0;
		padding-block: var(--sp-2);
	}
	.tasks-empty {
		padding: var(--sp-5);
	}
	/* list-head の高さ・色・文字は共通。完了の小見出しだけ、直前の行と分ける余白を足す */
	.tasks-sub {
		margin-top: var(--sp-2);
	}
</style>
