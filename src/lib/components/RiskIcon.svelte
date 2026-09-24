<script lang="ts">
	import { RISK_LABEL, type RiskLevel } from '$lib/types';
	import Tip from './Tip.svelte';

	/* 承認の区分の記号。「どこまで届くか」を Google ドライブの共有の範囲 (建物 = 組織内、地球儀 = 外) に倣って示す。
	   箱から出る矢印は HIG が共有シート専用とするので使わない (external-send-icon.md)。注意は赤の色で引く。
	   社内と低リスクは動きが同じなので同じ記号 */
	let { risk, size = 16 }: { risk: RiskLevel; size?: 16 | 20 } = $props();

	const MARK: Record<RiskLevel, string> = {
		external_send: 'ic-globe',
		internal: 'ic-building',
		internal_low: 'ic-building'
	};
</script>

<Tip text={RISK_LABEL[risk]} name={MARK[risk]} {size} class="rk-icon {risk}" />

<style>
	:global(.rk-icon.external_send) {
		color: var(--warn);
	}
	:global(.rk-icon.internal),
	:global(.rk-icon.internal_low) {
		color: var(--ink-2);
	}
</style>
