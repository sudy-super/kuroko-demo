<script lang="ts">
	import type { Task } from '$lib/types';
	import { ORIGIN_LABEL, ORIGIN_ICON } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { doneLogOf, inTaskFilter } from '$lib/derived';
	import { toggleTask, toggleStar, undo } from '$lib/actions';
	import { DropdownMenu } from 'bits-ui';
	import { parse, rel } from '$lib/dates';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	let {
		task,
		index,
		count,
		onmove,
		ongrab
	}: {
		task: Task;
		/** 一覧の中の位置と件数。並べ替えのメニューの「上へ」「下へ」を出し分ける */
		index: number;
		count: number;
		onmove: (to: number) => void;
		/** 行を押し始めた。押しただけか動かしたかの見分けとドラッグは一覧 (tasks/+page.svelte) が受け持つ */
		ongrab: (e: PointerEvent) => void;
	} = $props();

	const titleId = $props.id();

	const done = $derived(task.status === 'done');
	const overdue = $derived(!done && inTaskFilter(db, task, 'overdue'));
	// 完了を取り消せるのは、この完了で積まれたログが残っている間だけ
	const doneLog = $derived(done ? doneLogOf(db, task.id) : undefined);

	/* 優先度は Google ToDo リストと同じ星 1 つで示す (ユーザー裁定 2026-09-25)。星を付けると高、
	   外すと既定の中。低と中は見た目では分けない (actions.ts の toggleStar) */
	const starred = $derived(task.priority === 'high');

	const originLabel = $derived(`${ORIGIN_LABEL[task.origin]}から登録`);
</script>

<!-- 行の中に押せるものが 4 つ (取っ手・チェック・星・メニュー) あるので、行全体を label にはしない。
     チェックと題名だけを label で包み、題名を押しても完了にできるようにする -->
<!-- 行のどこをつかんでも並べ替えられる (ユーザー指示 2026-09-25)。押して離しただけなら
     今までどおり完了になり、動かしたときだけ並べ替えになる (見分けは tasks/+page.svelte の grab)。
     キーボードと 1 回押しの代わりはメニューの「上へ」「下へ」(WCAG 2.2 2.5.7) -->
<div class="list-row lg task-row" class:done={done} role="listitem" onpointerdown={ongrab}>
	<label class="task-main">
		<input type="checkbox" checked={done} aria-labelledby={titleId} onchange={() => toggleTask(task.id)} />
		<span class="task-text">
			<span class="task-title" id={titleId}>{task.title}</span>
			{#if task.due}
				<!-- 狭い画面だけ、期限を題名の下に出す (下の @media)。広い画面は右の列に出す -->
				<span class="num task-due task-due-sub" class:overdue aria-hidden="true"
					>{rel(parse(task.due), parse(db.seededOn))}{task.time ? ` ${task.time}` : ''}</span
				>
			{/if}
		</span>
	</label>
	<span class="task-meta">
		{#if task.due}
			<span class="num task-due" class:overdue>
				{#if overdue}<Icon name="ic-alert" size={16} label="期限超過" class="task-od" />{/if}
				{rel(parse(task.due), parse(db.seededOn))}{task.time ? ` ${task.time}` : ''}
			</span>
		{/if}
		<Tip text={originLabel} name={ORIGIN_ICON[task.origin]} size={16} class="task-origin" />
		{#if doneLog}
			<button class="btn text sm" onclick={() => undo(doneLog.id)}>
				<Icon name="ic-undo" size={18} />元に戻す
			</button>
		{/if}
		{#if !done}
			<button
				class="iconbtn task-star"
				class:on={starred}
				aria-pressed={starred}
				aria-label="「{task.title}」に星を付ける"
				title={starred ? '星を外す' : '星を付ける'}
				onclick={() => toggleStar(task.id)}
			>
				<Icon name="ic-star" size={20} />
			</button>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button {...props} class="iconbtn task-more" aria-label="「{task.title}」の操作" title="その他の操作">
							<Icon name="ic-dots" size={20} />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content class="demo-menu" align="end" sideOffset={6} preventScroll={false}>
						<DropdownMenu.Item class="demo-item" disabled={index === 0} onSelect={() => onmove(0)}>
							一番上へ
						</DropdownMenu.Item>
						<DropdownMenu.Item class="demo-item" disabled={index === 0} onSelect={() => onmove(index - 1)}>
							上へ
						</DropdownMenu.Item>
						<DropdownMenu.Item class="demo-item" disabled={index === count - 1} onSelect={() => onmove(index + 1)}>
							下へ
						</DropdownMenu.Item>
						<DropdownMenu.Item class="demo-item" disabled={index === count - 1} onSelect={() => onmove(count - 1)}>
							一番下へ
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		{/if}
	</span>
</div>

<style>
	/* 文字を選ぶ動きとドラッグがぶつからないよう、行の文字は選べなくする。長押しで出る
	   iOS の吹き出しも止める (指の長押しは並べ替えの始まりに使う) */
	.task-row {
		gap: var(--sp-3);
		cursor: default;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.task-row:hover {
		background: none;
	}
	.task-main {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--sp-3);
		min-width: 0;
		align-self: stretch;
		cursor: pointer;
	}
	.task-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}
	.task-due-sub {
		display: none;
	}
	.task-star {
		color: var(--ink-3);
	}
	.task-star.on {
		color: var(--accent);
	}
	.task-star.on :global(svg) {
		fill: currentColor;
	}
	.task-more {
		color: var(--ink-3);
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
	/* 完了した行は文字を薄くし、取り消し線を引く (ユーザー指示 2026-09-25。Google ToDo リストと同じ) */
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
	.task-row :global(.task-origin) {
		color: var(--ink-2);
	}
	/* 狭い画面では期限とアイコンを 2 行目に落とし、題名の幅を守る */
	/* 狭い画面では、期限を題名の下に小さく出して題名に幅を譲り、登録経路の記号は外す
	   (Google ToDo リストの行と同じ 2 段)。経路は広い画面で見られる */
	@media (max-width: 700px) {
		.task-row {
			height: auto;
			min-height: 56px;
			padding-block: var(--sp-2);
		}
		.task-meta {
			gap: 0;
		}
		.task-meta .task-due,
		.task-meta :global(.tip-at) {
			display: none;
		}
		.task-due-sub {
			display: inline-flex;
			font-size: 13px;
		}
	}
</style>
