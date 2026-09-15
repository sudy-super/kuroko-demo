<script lang="ts">
	import type { Task, Origin } from '$lib/types';
	import { ORIGIN_LABEL } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { doneLogOf } from '$lib/derived';
	import { toggleTask, undo } from '$lib/actions';
	import { parse, rel } from '$lib/dates';
	import Icon from './Icon.svelte';

	let { task, origin = 'tasks' }: { task: Task; origin?: Origin } = $props();

	const done = $derived(task.status === 'done');
	const overdue = $derived(!!task.due && task.due < db.seededOn && !done);
	// 完了を取り消せるのは、この完了で積まれたログが残っている間だけ
	const doneLog = $derived(done ? doneLogOf(db, task.id) : undefined);
</script>

<!-- チェックの当たり判定を広く取りたいが、「元に戻す」を label の中に入れると
     押した時に完了が外れる。label は題名までにし、右端の操作は外に出す -->
<div class="list-row lg task-row" class:done>
	<label class="task-main">
		<input type="checkbox" checked={done} onchange={() => toggleTask(task.id, origin)} />
		{#if task.priority === 'high' && !done}
			<Icon name="ic-flag" size={18} class="task-flag" />
			<span class="sr-only">優先度 高</span>
		{/if}
		<span class="task-title">{task.title}</span>
	</label>
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
</div>

<style>
	.task-row {
		gap: var(--sp-3);
	}
	/* 題名までを 1 つの押し先にする。残りの幅はここが持つ */
	.task-main {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--sp-3);
		min-width: 0;
		cursor: pointer;
	}
	.task-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.task-row.done .task-title {
		color: var(--ink-3);
		text-decoration: line-through;
	}
	.task-due {
		font-size: 14px;
	}
	.task-main :global(.task-flag) {
		color: var(--warn);
	}
	@media (max-width: 700px) {
		/* 幅が足りないと題名が潰れる。経路のバッジは畳む */
		.task-row .badge.src {
			display: none;
		}
	}
</style>
