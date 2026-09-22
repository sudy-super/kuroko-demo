<script lang="ts">
	import { RISK_LABEL, type RiskLevel } from '$lib/types';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	/* ApprovalIcon / ProjectStatusIcon と同じ作り。ApprovalIcon は「何を送るか」の種類、
	   こちらは「どれだけ注意が要るか」の区分なので、形を変えて隣に並んでも混ざらないようにする
	   (外部送信=警告の三角、社内=盾、低リスク=鍵) */
	let { risk, size = 16 }: { risk: RiskLevel; size?: 16 | 20 } = $props();

	const MARK: Record<RiskLevel, string> = {
		external_send: 'ic-alert',
		internal: 'ic-shield',
		internal_low: 'ic-lock'
	};
</script>

<Tip text={RISK_LABEL[risk]}>
	<Icon name={MARK[risk]} {size} label={RISK_LABEL[risk]} class="rk-icon {risk}" />
</Tip>

<style>
	:global(.rk-icon.external_send) {
		color: var(--warn);
	}
	:global(.rk-icon.internal) {
		color: var(--ink-2);
	}
	:global(.rk-icon.internal_low) {
		color: var(--ink-3);
	}
</style>
