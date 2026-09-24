<script lang="ts">
	import type { ProjectStatus } from '$lib/types';
	import { projectStatusClass } from '$lib/derived';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	/* ApprovalIcon と同じ作り。色は projectStatusClass (受注=緑/失注=赤/他=青)のまま、
	   形は進行の段階で分ける (WCAG 1.4.1: 色だけで区別しない) */
	let { status }: { status: ProjectStatus } = $props();

	const MARK: Record<ProjectStatus, string> = {
		商談前: 'ic-flag',
		提案中: 'ic-send',
		見積提出: 'ic-doc',
		検討中: 'ic-clock',
		受注: 'ic-check-c',
		失注: 'ic-x-c'
	};
</script>

<Tip text={status}>
	<Icon name={MARK[status]} size={16} label={status} class="ps-icon {projectStatusClass(status)}" />
</Tip>

<style>
	:global(.ps-icon.info) {
		color: var(--accent);
	}
	:global(.ps-icon.ok) {
		color: var(--ok);
	}
	:global(.ps-icon.danger) {
		color: var(--warn);
	}
</style>
