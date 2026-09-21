<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { ui } from '$lib/ui.svelte';
	import Drawer from './Drawer.svelte';
	import ApprovalCard from './ApprovalCard.svelte';
	import { Collapsible } from 'bits-ui';
	import Icon from './Icon.svelte';

	// pending + sending (取り消せる間) を出す。executed / rejected はここに出さない
	const active = $derived(db.approvals.filter((a) => a.status === 'pending' || a.status === 'sending'));
	const external = $derived(active.filter((a) => a.risk === 'external_send'));
	const internal = $derived(active.filter((a) => a.risk !== 'external_send'));
	/* 上部バーと Today の件数は derived.ts の pendingApprovals = pending のみなので、
	   送信中の 5 秒間はカードの枚数と合わない。枚数の内訳を出して食い違いを説明する。
	   カードを別の一覧へ移すと再生成されて編集中の状態が黙って消えるので、一覧は分けない */
	const sendingCount = $derived(active.filter((a) => a.status === 'sending').length);
	const pendingCount = $derived(active.length - sendingCount);
	const recentExecuted = $derived(
		db.approvals
			.filter((a) => a.status === 'executed')
			.toSorted((x, y) => (y.executedAt ?? '').localeCompare(x.executedAt ?? ''))
			.slice(0, 3)
	);

	let internalOpen = $state(false);
</script>

<Drawer open={ui.approvalDrawer} title="承認待ち" onclose={() => (ui.approvalDrawer = false)}>
	{#if sendingCount}
		<p class="ap-count" aria-live="polite">承認待ち {pendingCount} 件 ・ 送信中 {sendingCount} 件</p>
	{/if}
	{#if active.length === 0}
		<p class="muted">承認待ちはありません。</p>
		{#if recentExecuted.length}
			<p class="ap-recent-head">実行済み</p>
			{#each recentExecuted as a (a.id)}
				<div class="list-row" style="cursor: default">
					<span class="tc-text">{a.title}</span>
				</div>
			{/each}
		{/if}
	{:else}
		<div class="ap-list">
			{#each external as a (a.id)}
				<ApprovalCard approval={a} origin="approval" />
			{/each}
		</div>
		{#if internal.length}
			<Collapsible.Root bind:open={internalOpen} class="ap-internal">
				<Collapsible.Trigger class="list-row ap-internal-trigger">
					<Icon name="ic-chev" size={18} class={internalOpen ? 'ap-chev open' : 'ap-chev'} />
					社内 {internal.length} 件
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="ap-list">
						{#each internal as a (a.id)}
							<ApprovalCard approval={a} origin="approval" />
						{/each}
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		{/if}
	{/if}
	{#snippet footer()}
		<p class="ap-footnote muted">メール送信・日程確定・外部共有は、承認するまで実行されません。</p>
	{/snippet}
</Drawer>

<style>
	.ap-list {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	:global(.ap-internal) {
		margin-top: var(--sp-4);
	}
	:global(.ap-internal-trigger) {
		gap: var(--sp-2);
		font-size: 14px;
		color: var(--ink-2);
	}
	:global(.ap-chev) {
		transition: rotate var(--d-fast) var(--ease-out);
	}
	:global(.ap-chev.open) {
		rotate: 90deg;
	}
	:global(.ap-internal .ap-list) {
		margin-top: var(--sp-2);
	}
	.ap-recent-head {
		margin: var(--sp-4) 0 var(--sp-1);
		color: var(--ink-3);
		font-size: 12px;
	}
	.ap-count {
		margin: 0 0 var(--sp-3);
		color: var(--ink-2);
		font-size: 13px;
	}
	.ap-footnote {
		font-size: 12px;
	}
</style>
