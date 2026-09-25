<script lang="ts">
	import type { Source } from '$lib/types';
	import Tip from './Tip.svelte';

	/* indicators.md「メール一覧の出所」— 出所は文言のタグではなくブランドの記号 1 個。
	   KUROKO だけは外部サービスではないので、アプリ内の記号 (ic-spark) を当てる */
	/* ブランドの記号は 20px。LINE のブランドアイコンの最小が PC で 20px (line.me/ja/logo)。Gmail・Slack も揃える */
	let { source }: { source: Source } = $props();
	const size = 20;

	const MARK: Record<Source, string> = {
		gmail: 'b-gmail',
		gcal: 'b-gcal',
		slack: 'b-slack',
		line: 'b-line',
		kuroko: 'ic-spark'
	};
	const LABEL: Record<Source, string> = {
		gmail: 'Gmail から',
		gcal: 'Google カレンダーから',
		slack: 'Slack から',
		line: 'LINE から',
		kuroko: 'KUROKO から'
	};
</script>

<Tip text={LABEL[source]} name={MARK[source]} {size} class="src-icon" />

<style>
	:global(.src-icon) {
		color: var(--ink-2);
	}
</style>
