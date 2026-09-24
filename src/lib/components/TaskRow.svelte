<script lang="ts">
	import type { Task, Origin } from '$lib/types';
	import { ORIGIN_LABEL, ORIGIN_ICON } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { doneLogOf, inTaskFilter } from '$lib/derived';
	import { toggleTask, undo } from '$lib/actions';
	import { parse, rel } from '$lib/dates';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	let { task, origin = 'tasks' }: { task: Task; origin?: Origin } = $props();

	const titleId = $props.id();

	const done = $derived(task.status === 'done');
	const overdue = $derived(!done && inTaskFilter(db, task, 'overdue'));
	// 完了を取り消せるのは、この完了で積まれたログが残っている間だけ
	const doneLog = $derived(done ? doneLogOf(db, task.id) : undefined);

	/* tasks-reminders.md 5 節 — Apple のリマインダーと同じく、優先度は題名の前の感嘆符で示す
	   ("one for low, two for medium, and three for high")。旗は Apple では優先度とは別の目印なので
	   使わない。リマインダーの既定は「なし」で、印は優先度を付けた項目にだけ出る。KUROKO の既定は
	   normal (actions.ts の addTask) なので、normal を「なし」に当てて何も出さず、
	   low を 1 個、high を 3 個にする */
	const PRI: Partial<Record<Task['priority'], [string, string]>> = {
		low: ['!', '優先度 低'],
		high: ['!!!', '優先度 高']
	};

	const originLabel = $derived(`${ORIGIN_LABEL[task.origin]}から登録`);
</script>

<!-- 行全体が押し先。中の「元に戻す」は button なので、押しても label は checkbox に届かない -->
<label class="list-row lg task-row" class:done>
	<!-- label の中の文字を全部拾わないよう、名前は題名だけに絞る。優先度と経路は各アイコンが名前を持つ -->
	<input
		type="checkbox"
		checked={done}
		aria-labelledby={titleId}
		onchange={() => toggleTask(task.id, origin)}
	/>
	<span class="task-title" id={titleId}
		>{#if !done && PRI[task.priority]}{@const [mark, name] = PRI[task.priority]!}<span
				class="task-pri"
				class:p-high={task.priority === 'high'}
				title={name}><span aria-hidden="true">{mark}</span><span class="sr-only">{name}</span></span
			>{/if}{task.title}</span
	>
	<span class="task-meta">
		{#if task.due}
			<span class="num task-due" class:overdue>
				{#if overdue}<Icon name="ic-alert" size={16} label="期限超過" class="task-od" />{/if}
				{rel(parse(task.due), parse(db.seededOn))}{task.time ? ` ${task.time}` : ''}
			</span>
		{/if}
		<Tip text={originLabel}>
			<Icon name={ORIGIN_ICON[task.origin]} size={16} label={originLabel} class="task-origin" />
		</Tip>
		{#if doneLog}
			<button class="btn text sm" onclick={() => undo(doneLog.id)}>
				<Icon name="ic-undo" size={18} />元に戻す
			</button>
		{/if}
	</span>
</label>

<style>
	.task-row {
		gap: var(--sp-3);
	}
	/* 寸法と色は app.css の .list-row input[type='checkbox'] に持たせた。ここは並びだけ */
	.task-row input[type='checkbox'] {
		flex: none;
	}
	.task-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.task-meta {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--sp-3);
	}
	/* 完了した行は取り消し線ではなく薄くする (tasks-reminders.md 1 節、Apple の "dimmed") */
	.task-row.done .task-title {
		color: var(--ink-3);
	}
	/* 感嘆符は題名と同じ行の頭に、アクセントの色で置く。高だけ赤 (数と色の 2 つで示す) */
	.task-pri {
		margin-right: var(--sp-1);
		color: var(--accent);
		font-weight: 700;
	}
	.task-pri.p-high {
		color: var(--warn);
	}
	.task-due {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		color: var(--ink-3);
		font-size: 14px;
	}
	/* 期限超過は警告の形と赤い文字の 2 つで伝える (WCAG 1.4.1) */
	.task-due.overdue {
		color: var(--warn);
		font-weight: 700;
	}
	.task-row :global(.task-od) {
		color: var(--warn);
	}
	.task-row :global(.task-origin) {
		color: var(--ink-2);
	}
	/* 狭い画面では期限とアイコンを 2 行目に落とし、題名の幅を守る */
	@media (max-width: 700px) {
		.task-row {
			height: auto;
			min-height: 56px;
			flex-wrap: wrap;
			padding-block: var(--sp-2);
		}
		.task-meta {
			flex: 1 0 100%;
			padding-inline-start: calc(20px + var(--sp-3));
		}
	}
</style>
