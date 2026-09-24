<script lang="ts">
	import type { Origin } from '$lib/types';
	import { ORIGIN_LABEL } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { todaySummary } from '$lib/derived';
	import Icon from '$lib/components/Icon.svelte';
	import ActivityList from '$lib/components/ActivityList.svelte';

	const summary = $derived(todaySummary(db));

	let actor = $state<'user' | 'KUROKO' | null>(null);
	let origin = $state<Origin | null>(null);
	let approvedOnly = $state(false);

	// 実行元チップは実際にログへ登場した出所だけを出す (存在しない出所のチップを並べない)
	const origins = $derived(
		[...new Set(db.logs.map((l) => l.origin))].sort((a, b) => ORIGIN_LABEL[a].localeCompare(ORIGIN_LABEL[b], 'ja'))
	);

	const logs = $derived(
		db.logs.filter(
			(l) => (actor === null || l.actor === actor) && (origin === null || l.origin === origin) && (!approvedOnly || l.approved)
		)
	);
</script>

<svelte:head><title>作業履歴 — KUROKO AI</title></svelte:head>

<div class="activity">
	<h1 class="sr-only">作業履歴</h1>

	<!-- ux.md 原則 14「今日の実績を数値で」— DoneScreen と同じ文面を独立ページの先頭にも置く -->
	<p class="muted activity-summary">
		本日は下書き {summary.drafts} 件作成 / 予定 {summary.holds} 件を仮押さえ / 送信 {summary.sends} 件 / 登録 {summary.registers}
		件を行いました。
	</p>

	<div class="row page-bar" role="group" aria-label="絞り込み">
		<button class="chip" class:on={actor === 'KUROKO'} aria-pressed={actor === 'KUROKO'} onclick={() => (actor = actor === 'KUROKO' ? null : 'KUROKO')}>
			<Icon name="ic-check" size={18} class="chip-check" />KUROKO
		</button>
		<button class="chip" class:on={actor === 'user'} aria-pressed={actor === 'user'} onclick={() => (actor = actor === 'user' ? null : 'user')}>
			<Icon name="ic-check" size={18} class="chip-check" />自分
		</button>
		{#each origins as o (o)}
			<button class="chip" class:on={origin === o} aria-pressed={origin === o} onclick={() => (origin = origin === o ? null : o)}>
				<Icon name="ic-check" size={18} class="chip-check" />{ORIGIN_LABEL[o]}
			</button>
		{/each}
		<button class="chip" class:on={approvedOnly} aria-pressed={approvedOnly} onclick={() => (approvedOnly = !approvedOnly)}>
			<Icon name="ic-check" size={18} class="chip-check" />承認ありのみ
		</button>
	</div>

	<section class="card list-card" aria-label="作業履歴の一覧">
		{#if db.logs.length === 0}
			<p class="muted empty">まだ記録はありません。</p>
		{:else if logs.length === 0}
			<p class="muted empty">条件に一致する記録はありません。</p>
		{:else}
			<ActivityList {logs} />
		{/if}
	</section>
</div>

<style>
	.activity {
		max-width: 880px;
	}
	.activity-summary {
		margin: 0 var(--sp-5) var(--sp-4);
	}
</style>
