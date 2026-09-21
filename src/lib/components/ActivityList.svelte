<script lang="ts">
	import type { ActivityLog } from '$lib/types';
	import { ORIGIN_LABEL, ORIGIN_ICON } from '$lib/types';
	import { undo } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	let { logs, compact = false }: { logs: ActivityLog[]; compact?: boolean } = $props();

	/* indicators.md「ToDo 一覧の登録経路」の考え方を実行主体にも当てる。行内は記号 1 個、
	   文言は名前とツールチップに回す (ActivityDrawer の現行実装と同じ考え方) */
	const actorLabel = (actor: ActivityLog['actor']) => (actor === 'KUROKO' ? 'KUROKO の作業' : '自分の作業');

	function onUndo(l: ActivityLog) {
		undo(l.id);
		toast('元に戻しました');
	}
</script>

{#each logs as l (l.id)}
	<div class="list-row lg activity-row" class:compact style="cursor: default">
		<span class="num sub activity-at">{l.at.slice(11, 16)}</span>
		<Tip text={actorLabel(l.actor)}>
			<Icon name={l.actor === 'KUROKO' ? 'ic-spark' : 'ic-user'} size={16} label={actorLabel(l.actor)} class="activity-actor" />
		</Tip>
		<span class="activity-text" class:undone={l.undone}>{l.text}</span>
		{#if !compact}
			<Tip text={`${ORIGIN_LABEL[l.origin]}から`}>
				<Icon name={ORIGIN_ICON[l.origin]} size={16} label={`${ORIGIN_LABEL[l.origin]}から`} class="activity-origin" />
			</Tip>
		{/if}
		{#if l.approved}
			<!-- indicators.md「承認センターの区分」— 判断に直結する重要な属性は文言の Lozenge のまま出す -->
			<span class="badge ok">承認あり</span>
		{/if}
		{#if l.undo && !l.undone}
			<button class="btn text sm activity-undo" onclick={() => onUndo(l)}>
				<Icon name="ic-undo" size={18} />元に戻す
			</button>
		{/if}
	</div>
{/each}

<style>
	.activity-row {
		gap: var(--sp-3);
		flex-wrap: wrap;
	}
	.activity-at {
		flex: none;
		width: 40px;
	}
	:global(.activity-actor) {
		flex: none;
		color: var(--ink-2);
	}
	.activity-text {
		flex: 1;
		min-width: 0;
	}
	.activity-text.undone {
		color: var(--ink-3);
		text-decoration: line-through;
	}
	:global(.activity-origin) {
		flex: none;
		color: var(--ink-2);
	}
	.activity-undo {
		flex: none;
	}
	/* ドロワーの直近 5 件は場所が狭いので、実行元バッジを落として 1 行に収める */
	.activity-row.compact {
		flex-wrap: nowrap;
		height: auto;
		min-height: 56px;
	}
	.activity-row.compact .activity-text {
		white-space: normal;
	}
</style>
