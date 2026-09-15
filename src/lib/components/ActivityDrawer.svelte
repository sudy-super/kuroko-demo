<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { ui } from '$lib/ui.svelte';
	import Drawer from './Drawer.svelte';

	const logs = $derived(db.logs.slice(0, 5));
</script>

<Drawer open={ui.activityDrawer} title="作業履歴" onclose={() => (ui.activityDrawer = false)}>
	{#if logs.length === 0}
		<p class="muted">まだ記録はありません。</p>
	{:else}
		{#each logs as l (l.id)}
			<div
				class="list-row xl"
				style="cursor: default; flex-direction: column; align-items: stretch; justify-content: center; gap: var(--sp-1)"
			>
				<div class="row">
					<span class="num sub">{l.at.slice(11, 16)}</span>
					<span class="badge src">{l.actor}</span>
				</div>
				<div style="font-size: 14px">{l.text}</div>
			</div>
		{/each}
	{/if}
	{#snippet footer()}
		<a class="btn text" href="/activity" onclick={() => (ui.activityDrawer = false)}>すべて見る</a>
	{/snippet}
</Drawer>
