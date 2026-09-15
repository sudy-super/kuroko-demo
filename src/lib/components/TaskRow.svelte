<script lang="ts">
	import type { Task, Origin } from '$lib/types';
	import { ORIGIN_LABEL } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { doneLogOf, inTaskFilter } from '$lib/derived';
	import { toggleTask, undo } from '$lib/actions';
	import { parse, rel } from '$lib/dates';
	import Icon from './Icon.svelte';

	let { task, origin = 'tasks' }: { task: Task; origin?: Origin } = $props();

	const done = $derived(task.status === 'done');
	const overdue = $derived(!done && inTaskFilter(db, task, 'overdue'));
	// 完了を取り消せるのは、この完了で積まれたログが残っている間だけ
	const doneLog = $derived(done ? doneLogOf(db, task.id) : undefined);
</script>

<!-- 行全体が押し先。中の「元に戻す」は button なので、押しても label は checkbox に届かない -->
<label class="list-row lg task-row" class:done>
	<input type="checkbox" checked={done} onchange={() => toggleTask(task.id, origin)} />
	{#if task.priority === 'high' && !done}
		<Icon name="ic-flag" size={18} class="task-flag" />
		<span class="sr-only">優先度 高</span>
	{/if}
	<span class="task-title">{task.title}</span>
	{#if task.due}
		<span class="num muted task-due">
			{rel(parse(task.due), parse(db.seededOn))}{task.time ? ` ${task.time}` : ''}
		</span>
	{/if}
	{#if overdue}<span class="badge warn">期限超過</span>{/if}
	<span class="badge src">{ORIGIN_LABEL[task.origin]}</span>
	{#if doneLog}
		<button class="btn text sm" onclick={() => undo(doneLog.id)}>
			<Icon name="ic-undo" size={18} />元に戻す
		</button>
	{/if}
</label>

<style>
	.task-row {
		gap: var(--sp-3);
	}
	/* 狭い画面で削るのは題名だけ。期限とバッジは幅を譲らない */
	.task-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.task-row > :not(.task-title) {
		flex: none;
	}
	.task-row.done .task-title {
		color: var(--ink-3);
		text-decoration: line-through;
	}
	.task-due {
		font-size: 14px;
	}
	.task-row :global(.task-flag) {
		color: var(--warn);
	}
</style>
