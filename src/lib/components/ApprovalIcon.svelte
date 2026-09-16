<script lang="ts">
	import type { ApprovalKind } from '$lib/types';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	/* indicators.md「メール一覧の出所」の考え方を承認の行にも当てる。
	   ここで記号にするのは「何を送るか」の種類だけ。区分 (外部送信 / 社内 / 低リスク) は
	   Atlassian の Lozenge のまま文言で出す。置き場所は ApprovalDrawer と Today の承認カード */
	let { kind, size = 16 }: { kind: ApprovalKind; size?: 16 | 20 } = $props();

	const MARK: Record<ApprovalKind, string> = {
		mail: 'b-gmail',
		line: 'b-line',
		slack: 'b-slack',
		share: 'ic-share',
		schedule: 'ic-cal',
		document: 'ic-doc'
	};
	const LABEL: Record<ApprovalKind, string> = {
		mail: 'メールの送信',
		line: 'LINE の送信',
		slack: 'Slack の送信',
		share: '外部への共有',
		schedule: '日程の調整',
		document: '書類の送付'
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
