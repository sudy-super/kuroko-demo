<script lang="ts">
	import type { ActivityLog } from '$lib/types';
	import { ORIGIN_LABEL, ORIGIN_ICON } from '$lib/types';
	import { key, parse, rel, today } from '$lib/dates';
	import { undo } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	let { logs, compact = false }: { logs: ActivityLog[]; compact?: boolean } = $props();

	/* indicators.md「ToDo 一覧の登録経路」の考え方を実行主体にも当てる。行内は記号 1 個、
	   文言は名前とツールチップに回す (ActivityDrawer の現行実装と同じ考え方) */
	const actorLabel = (actor: ActivityLog['actor']) => (actor === 'KUROKO' ? 'KUROKO の作業' : '自分の作業');

	/* 昨日以前のログが時刻だけで並ぶと今日の分と見分けが付かないので、その日以外は日付を添える
	   (dates.ts の rel が「昨日」や「9/18 (金)」を返す) */
	const K = key(today());
	const when = (at: string) => (at.startsWith(K) ? at.slice(11, 16) : `${rel(parse(at.slice(0, 10)))} ${at.slice(11, 16)}`);

	function onUndo(l: ActivityLog) {
		undo(l.id);
		toast('元に戻しました');
	}
</script>

{#each logs as l (l.id)}
	{@const ku = l.actor === 'KUROKO'}
	<div class="list-row lg activity-row" class:compact style="cursor: default">
		<span class="num sub activity-at">{when(l.at)}</span>
		<Tip text={actorLabel(l.actor)}>
			<!-- indicators.md 93、99 行目 — 色だけにも形だけにも頼らないよう、記号と色の両方を変える -->
			<Icon name={ku ? 'ic-spark' : 'ic-user'} size={16} label={actorLabel(l.actor)} class="activity-actor {ku ? 'by-kuroko' : ''}" />
		</Tip>
		<span class="activity-text" class:undone={l.undone}>{l.text}</span>
		{#if l.undone}
			<!-- 取り消した記録は取り消し線を引かず (ユーザー指示 2026-09-25)、薄い文字と元に戻すの
			     記号で示す。色だけに頼らない (WCAG 1.4.1) -->
			<Tip text="取り消し済み">
				<Icon name="ic-undo" size={16} label="取り消し済み" class="activity-undone" />
			</Tip>
		{/if}
		{#if !compact}
			<!-- ドロワーの直近 5 件は場所が狭いので、実行元の記号を落として 1 行に収める -->
			<Tip text={`${ORIGIN_LABEL[l.origin]}から`}>
				<Icon name={ORIGIN_ICON[l.origin]} size={16} label={`${ORIGIN_LABEL[l.origin]}から`} class="activity-origin" />
			</Tip>
		{/if}
		{#if l.approved}
			<!-- 「承認あり」は真偽だけの印で、種類の記号と混ざる相手がここには無いので ic-check-c 1 個で足りる -->
			<Tip text="承認あり">
				<Icon name="ic-check-c" size={16} label="承認あり" class="activity-approved" />
			</Tip>
		{/if}
		{#if l.undo && !l.undone}
			<button class="btn text sm activity-undo" onclick={() => onUndo(l)}>
				<Icon name="ic-undo" size={18} />元に戻す
			</button>
		{/if}
	</div>
{/each}

<style>
	/* 折り返す行なので app.css の .list-row.lg の固定の高さ (56px) を解く。
	   解かないと折り返した本文が箱からはみ出し、下の行に重なって描かれる */
	.activity-row {
		gap: var(--sp-3);
		flex-wrap: wrap;
		height: auto;
		min-height: 56px;
		padding-block: var(--sp-2);
	}
	.activity-at {
		flex: none;
		min-width: 40px;
		white-space: nowrap;
	}
	:global(.activity-actor) {
		flex: none;
		color: var(--ink-3);
	}
	:global(.activity-actor.by-kuroko) {
		color: var(--accent);
	}
	/* flex: 1 の基準は 0 幅なので、本文だけが 1 文字ずつまで潰れる。基準を与えて、
	   それを割る狭さでは後ろのバッジとボタンを次の行へ回す
	   (min() は本文より狭い箱 — ドロワー — で行からはみ出させないための上限) */
	.activity-text {
		flex: 1 1 min(12em, 100%);
		min-width: 0;
	}
	.activity-text.undone {
		color: var(--ink-3);
	}
	:global(.activity-undone) {
		flex: none;
		color: var(--ink-3);
	}
	:global(.activity-origin) {
		flex: none;
		color: var(--ink-2);
	}
	:global(.activity-approved) {
		flex: none;
		color: var(--ok);
	}
	.activity-undo {
		flex: none;
	}
</style>
