<script lang="ts">
	import type { Reason } from '$lib/types';
	import { REASON_LABEL } from '$lib/types';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	/* indicators.md「メール一覧の要対応の理由」と 5 節 — 理由ごとに形の違うアイコンを当て、
	   色は最も重い「返信期限超過」だけ赤にする。形が 5 つとも違うので、色だけに頼っていない
	   (WCAG 1.4.1、Carbon の「色・形・記号のうち 2 要素」) */
	let { reason, size = 18 }: { reason: Reason; size?: number } = $props();

	const SHAPE: Record<Reason, string> = {
		overdue: 'ic-alert',
		unanswered_3d: 'ic-clock',
		question: 'ic-question',
		project: 'ic-briefcase',
		known_contact: 'ic-user'
	};
</script>

<Tip text={REASON_LABEL[reason]}>
	<Icon
		name={SHAPE[reason]}
		{size}
		label={REASON_LABEL[reason]}
		class="reason-icon {reason === 'overdue' ? 'sev' : ''}"
	/>
</Tip>

<style>
	:global(.reason-icon) {
		color: var(--ink-2);
	}
	:global(.reason-icon.sev) {
		color: var(--warn);
	}
</style>
