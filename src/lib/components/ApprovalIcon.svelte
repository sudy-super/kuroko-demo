<script lang="ts">
	import type { ApprovalKind } from '$lib/types';
	import Tip from './Tip.svelte';

	/* 記号は「何で送るか」(送り先のサービスのロゴ) だけ。「何をするか」は行の題に書いてあるので記号にしない
	   (indicators.md「メール一覧の出所」)。区分は RiskIcon。20px は LINE のブランドアイコンの最小 */
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

<Tip text={LABEL[kind]} name={MARK[kind]} {size} class="ap-icon" />

<style>
	:global(.ap-icon) {
		color: var(--ink-2);
	}
</style>
