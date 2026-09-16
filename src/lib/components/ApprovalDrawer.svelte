<script lang="ts">
	import { RISK_LABEL } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { pendingApprovals } from '$lib/derived';
	import { approve, reject } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import Drawer from './Drawer.svelte';
	import ApprovalIcon from './ApprovalIcon.svelte';

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
					<span class="row" style="gap: var(--sp-2)">
						<ApprovalIcon kind={a.kind} size={20} />
						<!-- 仕様 5.11 の種別バッジ。区分は判断に直結する属性なので Lozenge の文言で出す
						     (indicators.md「承認センターの区分」)。外部送信だけ accent、社内と低リスクは
						     灰色に落として、目を引く先を 1 つにする -->
						<span class="badge" class:src={a.risk !== 'external_send'}>{RISK_LABEL[a.risk]}</span>
					</span>
					<span class="row" style="gap: var(--sp-6)">
						<button class="btn pri sm" onclick={() => approve(a.id, 'approval')}>承認して送信</button>
						<button class="btn text sm" onclick={() => reject(a.id, 'approval')}>却下</button>
					</span>
				</div>
			</div>
		{/each}
	{/if}
</Drawer>
