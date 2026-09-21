<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { ui } from '$lib/ui.svelte';
	import Drawer from './Drawer.svelte';
	import ActivityList from './ActivityList.svelte';

	// flow.md (8) — ドロワーは直近 5 件だけ。遡って読む場所は独立ページ (/activity) を本体にする
	const logs = $derived(db.logs.slice(0, 5));
</script>

<Drawer open={ui.activityDrawer} title="作業履歴" onclose={() => (ui.activityDrawer = false)}>
	{#if logs.length === 0}
		<p class="muted">まだ記録はありません。</p>
	{:else}
		<ActivityList {logs} compact />
	{/if}
	{#snippet footer()}
		<!-- ドロワーが積んだ履歴を遷移先で置き換える。戻ると元の画面に返る -->
		<a class="btn text" href="/activity" data-sveltekit-replacestate onclick={() => (ui.activityDrawer = false)}>
			すべて見る
		</a>
	{/snippet}
</Drawer>
