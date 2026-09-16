<script lang="ts">
	import type { Task, Origin } from '$lib/types';
	import { ORIGIN_LABEL } from '$lib/types';
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

	/* indicators.md「ToDo 一覧の優先度」(Todoist の旗) — 高は塗り、中は線、低は出さない。
	   色は高だけ赤にする。塗りと線で形が違うので色だけに頼っていない */
	const PRI: Partial<Record<Task['priority'], string>> = { high: '優先度 高', normal: '優先度 中' };

	/* indicators.md「ToDo 一覧の登録経路」— 経路ごとに記号 1 個。文言は名前とツールチップに回す */
	const ORIGIN_MARK: Record<Origin, string> = {
		today: 'ic-home',
		chat: 'ic-chat',
		inbox: 'b-gmail',
		line: 'b-line',
		slack: 'b-slack',
		approval: 'ic-check-c',
		calendar: 'ic-cal',
		meeting: 'ic-bell',
		people: 'ic-people',
		tasks: 'ic-list', // 一覧の記号。'ic-plus' は画面上の「追加」ボタンと同じ形で意味が二重になる
		documents: 'ic-doc',
		schedule: 'ic-clock',
		palette: 'ic-search'
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
	<span class="task-title" id={titleId}>{task.title}</span>
	<span class="task-meta">
		{#if task.due}
			<span class="num task-due" class:overdue>
				{#if overdue}<Icon name="ic-alert" size={16} label="期限超過" class="task-od" />{/if}
				{rel(parse(task.due), parse(db.seededOn))}{task.time ? ` ${task.time}` : ''}
			</span>
		{/if}
		{#if !done && PRI[task.priority]}
			{@const t = PRI[task.priority]!}
			<Tip text={t}>
				<Icon name="ic-flag" size={18} label={t} class="task-flag p-{task.priority}" />
			</Tip>
		{/if}
		<Tip text={originLabel}>
			<Icon name={ORIGIN_MARK[task.origin]} size={16} label={originLabel} class="task-origin" />
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
	.task-row.done .task-title {
		color: var(--ink-3);
		text-decoration: line-through;
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
	.task-row :global(.task-flag) {
		color: var(--ink-3);
	}
	.task-row :global(.task-flag.p-high) {
		fill: currentColor;
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
