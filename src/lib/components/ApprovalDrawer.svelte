<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { pendingApprovals } from '$lib/derived';
	import { approve, reject } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import type { ApprovalKind } from '$lib/types';
	import Drawer from './Drawer.svelte';

	const KIND: Record<ApprovalKind, string> = {
		mail: 'メール',
		line: 'LINE',
		slack: 'Slack',
		share: '共有',
		schedule: '日程',
		document: '書類'
	};

	const pending = $derived(pendingApprovals(db));
</script>

<Drawer open={ui.approvalDrawer} title="承認待ち" onclose={() => (ui.approvalDrawer = false)}>
	{#if pending.length === 0}
		<p class="muted">承認をお待ちいただいているものはありません。</p>
	{:else}
		{#each pending as a (a.id)}
			<div
				class="list-row"
				style="cursor: default; height: auto; flex-direction: column; align-items: stretch; gap: var(--sp-2); padding-block: var(--sp-3)"
			>
				<div>{a.title}</div>
				<div class="row" style="justify-content: space-between">
					<span class="badge src">{KIND[a.kind]}</span>
					<span class="row" style="gap: var(--sp-6)">
						<button class="btn pri sm" onclick={() => approve(a.id, 'approval')}>承認して送信</button>
						<button class="btn text sm" onclick={() => reject(a.id, 'approval')}>却下</button>
					</span>
				</div>
			</div>
		{/each}
	{/if}
</Drawer>
