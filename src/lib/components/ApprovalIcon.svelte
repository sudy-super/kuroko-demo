<script lang="ts">
	import type { ApprovalKind } from '$lib/types';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	/* indicators.md「メール一覧の出所」の考え方を承認の行にも当てる。記号は「何で送るか」
	   (送り先のサービスのロゴ) だけ。共有・送付のような「何をするか」は行の題に書いてあるので
	   記号にしない (ユーザー指摘 2026-09-24: 以前は共有を「外部リンクを開く」の記号で出していて、
	   隣の Gmail と違う種類の情報が同じ列に混ざり、読めなかった)。区分 (外部送信 / 社内)
	   は RiskIcon。置き場所は承認パネル、Today の承認カード、上部バーの板 */
	/* 20px は SourceIcon と同じ理由 (LINE のブランドアイコンの最小。ユーザー裁定 2026-09-24) */
	let { kind }: { kind: ApprovalKind } = $props();
	const size = 20;

	const MARK: Record<ApprovalKind, string> = {
		mail: 'b-gmail',
		line: 'b-line',
		slack: 'b-slack'
	};
	const LABEL: Record<ApprovalKind, string> = {
		mail: 'Gmail で送る',
		line: 'LINE で送る',
		slack: 'Slack で送る'
	};
</script>

<Tip text={LABEL[kind]}>
	<Icon name={MARK[kind]} {size} label={LABEL[kind]} class="ap-icon" />
</Tip>

<style>
	:global(.ap-icon) {
		color: var(--ink-2);
	}
</style>
