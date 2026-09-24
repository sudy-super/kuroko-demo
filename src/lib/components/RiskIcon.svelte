<script lang="ts">
	import { RISK_LABEL, type RiskLevel } from '$lib/types';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	/* ApprovalIcon / ProjectStatusIcon と同じ作り。ApprovalIcon は「何で送るか」(サービスのロゴ)、
	   こちらは「どこまで届くか」の区分なので、形を変えて隣に並んでも混ざらないようにする
	   (外部送信 = 地球儀、社内 = 盾、低リスク = 鍵)。
	   外部送信は以前は警告の三角だったが、承認待ちの行のたびに出す状態の記号としては強すぎる
	   (Carbon は赤い警告を重大な失敗のために取っておく)。Google ドライブの共有の範囲
	   (鍵 = 限定、建物 = 組織内、地球儀 = 外まで届く) に倣い、組織の外に届くことを地球儀で示す。
	   箱から出る矢印 (Apple の square.and.arrow.up) は HIG が共有シート専用と定めるので使わない
	   (docs/research/external-send-icon.md、ユーザー裁定 2026-09-24)。注意を引く働きは赤の色で残す */
	let { risk, size = 16 }: { risk: RiskLevel; size?: 16 | 20 } = $props();

	const MARK: Record<RiskLevel, string> = {
		external_send: 'ic-globe',
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
