<script lang="ts">
	import type { Document } from '$lib/types';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	/* ApprovalIcon / ProjectStatusIcon と同じ作り。資料の種別 (提案書 / 見積書 / 報告書) */
	let { kind, size = 16 }: { kind: Document['kind']; size?: 16 | 20 } = $props();

	const MARK: Record<Document['kind'], string> = {
		提案書: 'ic-send',
		見積書: 'ic-cart',
		報告書: 'ic-note'
	};
</script>

<Tip text={kind}>
	<Icon name={MARK[kind]} {size} label={kind} class="dk-icon" />
</Tip>

<style>
	:global(.dk-icon) {
		color: var(--ink-2);
	}
</style>
