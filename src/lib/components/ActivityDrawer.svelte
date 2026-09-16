<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { ui } from '$lib/ui.svelte';
	import Drawer from './Drawer.svelte';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	const logs = $derived(db.logs.slice(0, 5));

	/* indicators.md「メール一覧の出所」— 誰の手で行われたかも出所と同じ扱いにし、
	   文言のタグではなく記号 1 個で示す */
	const actorLabel = (actor: string) => (actor === 'KUROKO' ? 'KUROKO の作業' : '自分の作業');
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
					<Tip text={actorLabel(l.actor)}>
						<Icon
							name={l.actor === 'KUROKO' ? 'ic-spark' : 'ic-user'}
							size={16}
							label={actorLabel(l.actor)}
							class="log-actor"
						/>
					</Tip>
				</div>
				<div style="font-size: 14px">{l.text}</div>
			</div>
		{/each}
	{/if}
	{#snippet footer()}
		<!-- ドロワーが積んだ履歴を遷移先で置き換える。戻ると元の画面に返る -->
		<a class="btn text" href="/activity" data-sveltekit-replacestate onclick={() => (ui.activityDrawer = false)}>
			すべて見る
		</a>
	{/snippet}
</Drawer>

<style>
	:global(.log-actor) {
		color: var(--ink-2);
	}
</style>
