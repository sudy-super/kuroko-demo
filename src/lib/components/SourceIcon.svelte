<script lang="ts">
	import type { Source } from '$lib/types';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	/* indicators.md「メール一覧の出所」— 出所は文言のタグではなくブランドの記号 1 個。
	   KUROKO だけは外部サービスではないので、アプリ内の記号 (ic-spark) を当てる */
	let { source, size = 16 }: { source: Source; size?: 16 | 20 } = $props();

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

<Tip text={LABEL[source]}>
	<Icon name={MARK[source]} {size} label={LABEL[source]} class="src-icon" />
</Tip>

<style>
	:global(.src-icon) {
		color: var(--ink-2);
	}
</style>
