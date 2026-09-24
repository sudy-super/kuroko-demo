<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import type { TaskFilter } from '$lib/derived';
	import type { Task } from '$lib/types';
	import { badgeCount, filterTasks, openTaskCount } from '$lib/derived';
	import { acceptTaskSuggestions, rejectSuggestions } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
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
	/* tasks-reminders.md 7 節 — Apple のリマインダーと同じく、完了した ToDo は既定で隠し、
	   「完了を表示」で出す ("Completed items are hidden on your list … tap Show Completed")。
	   ただしこの画面を開いている間に完了にしたものは、その場に薄く残す。すぐ消すと押した行が
	   目の前から消えて、何が起きたか分からず「元に戻す」も押せない */
	const tasks = $derived(filterTasks(db, filter));
	const doneBefore = new Set(db.tasks.filter((t) => t.status === 'done').map((t) => t.id));
	/* 一覧の並びは期限順のまま。filterTasks は完了を末尾へ送るので、この画面で完了にした行が
	   押した瞬間に一番下へ飛ぶ。ここでは期限と時刻だけで並べ直して、行をその場に留める */
	const byDue = (a: Task, b: Task) =>
		(a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
	const open = $derived(tasks.filter((t) => t.status !== 'done' || !doneBefore.has(t.id)).sort(byDue));
	const closed = $derived(tasks.filter((t) => t.status === 'done' && doneBefore.has(t.id)));
	// 見出しの件数は、まだ済んでいないものだけを数える (切り替えの件数と同じ)
	const left = $derived(open.filter((t) => t.status !== 'done').length);
	let showDone = $state(false);

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
	<h1 class="sr-only">ToDo</h1>

	<div class="row tasks-bar">
		<Segmented label="絞り込み" items={FILTERS} value={filter} onchange={(k) => (filter = k)}>
			{#snippet extra(k)}
				{@const n = openTaskCount(db, k)}
				<span class="badge count" class:danger={k === 'overdue' && n > 0}>{badgeCount(n)}</span>
			{/snippet}
		</Segmented>
		<!-- カレンダーの「予定を追加」と同じ形 (「+」だけのボタンを操作の列の右端に) -->
		<a class="iconbtn tasks-add" href="/tasks?new=1" title="新しい ToDo を追加" aria-label="新しい ToDo を追加">
			<Icon name="ic-plus" size={20} />
		</a>
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
			<Icon name={current.icon} size={16} />{current.label}<span class="num">{left}</span>
		</h2>
		{#if open.length === 0}
			<p class="muted tasks-empty">{current.empty}</p>
		{/if}
		{#each open as t (t.id)}
			<TaskRow task={t} />
		{/each}
		{#if closed.length}
			<button class="btn text sm tasks-done-toggle" aria-expanded={showDone} onclick={() => (showDone = !showDone)}>
				{showDone ? '完了を隠す' : `完了を表示 (${closed.length})`}
			</button>
			{#if showDone}
				{#each closed as t (t.id)}
					<TaskRow task={t} />
				{/each}
			{/if}
		{/if}
	</section>
</div>

<TaskForm open={formOpen} onclose={closeForm} />

<style>
	.tasks {
		max-width: 880px;
	}
	.tasks-bar {
		flex-wrap: wrap;
		gap: var(--sp-3);
		padding: 0 var(--sp-5) var(--sp-5);
	}
	.tasks-add {
		margin-left: auto;
		color: var(--accent);
	}
	.tasks-list {
		padding-inline: 0;
		padding-block: var(--sp-2);
	}
	.tasks-empty {
		padding: var(--sp-5);
	}
	.tasks-done-toggle {
		margin: var(--sp-1) var(--sp-4);
	}
</style>
