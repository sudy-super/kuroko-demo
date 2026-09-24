<script lang="ts">
	import { RISK_LABEL, type RiskLevel } from '$lib/types';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	/* ApprovalIcon / ProjectStatusIcon と同じ作り。ApprovalIcon は「何で送るか」(サービスのロゴ)、
	   こちらは「どこまで届くか」なので、形を変えて隣に並んでも混ざらないようにする。
	   Google ドライブの共有の範囲 (建物 = 組織内、地球儀 = 外まで届く) に倣う。
	   外部送信は以前は警告の三角だったが、行のたびに出す記号としては強すぎる。箱から出る矢印
	   (square.and.arrow.up) は HIG が共有シート専用と定めるので使わない (external-send-icon.md)。
	   注意を引く働きは赤の色で残す。
	   社内と低リスクは以前は盾と鍵で分けていたが、どちらも「安全」「限定」と読めて区分を表さず、
	   動きも同じ (actions.ts の autoExecutes は外部送信かどうかしか見ない) なので同じ記号にする
	   (ユーザー裁定 2026-09-24) */
	let { risk, size = 16 }: { risk: RiskLevel; size?: 16 | 20 } = $props();

	const MARK: Record<RiskLevel, string> = {
		external_send: 'ic-globe',
		internal: 'ic-building',
		internal_low: 'ic-building'
	};
</script>

<Tip text={RISK_LABEL[risk]}>
	<Icon name={MARK[risk]} {size} label={RISK_LABEL[risk]} class="rk-icon {risk}" />
</Tip>

<style>
	:global(.rk-icon.external_send) {
		color: var(--warn);
	}
	:global(.rk-icon.internal),
	:global(.rk-icon.internal_low) {
		color: var(--ink-2);
	}
</style>
