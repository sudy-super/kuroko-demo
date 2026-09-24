<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	/* 会社・人物・案件の詳細のカード。仕様 5 — カードの中の一覧は上位 3 件まで。
	   「残り N 件」を押すとその場で全部出す */
	let {
		title,
		items,
		key,
		empty,
		head,
		row
	}: {
		title: string;
		items: T[];
		key: (item: T) => string;
		empty: string;
		/** 見出しと一覧の間に置く行 */
		head?: Snippet;
		row: Snippet<[T]>;
	} = $props();

	const LIMIT = 3;
	let open = $state(false);
</script>

<section class="card people-sec">
	<h2>{title}</h2>
	{@render head?.()}
	{#each open ? items : items.slice(0, LIMIT) as item (key(item))}
		{@render row(item)}
	{/each}
	{#if !items.length}<p class="muted">{empty}</p>{/if}
	{#if !open && items.length > LIMIT}
		<button class="btn text sm" onclick={() => (open = true)}>残り {items.length - LIMIT} 件</button>
	{/if}
</section>
