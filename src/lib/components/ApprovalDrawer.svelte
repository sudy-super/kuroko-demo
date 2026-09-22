<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { ui } from '$lib/ui.svelte';
	import Drawer from './Drawer.svelte';
	import ApprovalCard from './ApprovalCard.svelte';
	import ApprovalIcon from './ApprovalIcon.svelte';
	import RiskIcon from './RiskIcon.svelte';

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
</script>

<Drawer open={ui.approvalDrawer} title="承認待ち" onclose={() => (ui.approvalDrawer = false)}>
	{#if sendingCount}
		<p class="ap-count" aria-live="polite">承認待ち {pendingCount} 件 ・ 送信中 {sendingCount} 件</p>
	{/if}
	{#if active.length === 0}
		<p class="muted">承認待ちはありません。</p>
	{:else}
		<div class="ap-list">
			{#each external as a (a.id)}
				<ApprovalCard approval={a} origin="approval" />
			{/each}
		</div>
		<!-- 社内あては拡大表示の中に開閉をさらに入れない (docs/research/card-expand-content.md「承認待ち」)。
		     ただし畳むのをやめただけで、隠してよいわけではない。自動化を「常に確認」にすると
		     社内あても承認待ちのまま溜まる (actions.ts の autoExecutes は level !== 'draft' が条件)
		     ので、そのときは社外あてと同じ列に並べて承認できるようにする。
		     自動で実行される設定のとき (送信中の 5 秒間だけここに現れる) は件数の注記で足りる -->
		{#if internal.length}
			{#if db.settings.automation === 'draft'}
				<div class="ap-list" style="margin-top: var(--sp-4)">
					{#each internal as a (a.id)}
						<ApprovalCard approval={a} origin="approval" />
					{/each}
				</div>
			{:else}
				<p class="ap-internal-note">社内 {internal.length} 件 (自動実行)</p>
			{/if}
		{/if}
	{/if}
	<!-- 自動化レベルが社内を自動で実行するため (設定の既定)、社内あての連絡はここにしか出ない。
	     承認待ちが残っている間も畳まない -->
	{#if recentExecuted.length}
		<p class="ap-recent-head">実行済み</p>
		{#each recentExecuted as a (a.id)}
			<div class="list-row" style="cursor: default">
				<ApprovalIcon kind={a.kind} />
				<span class="tc-text">{a.title}</span>
				<!-- 承認待ちのカードと同じ区分の記号 -->
				<RiskIcon risk={a.risk} />
			</div>
		{/each}
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
	.ap-internal-note {
		margin: var(--sp-4) 0 0;
		color: var(--ink-2);
		font-size: 14px;
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
