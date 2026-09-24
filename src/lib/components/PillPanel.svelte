<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Popover } from 'bits-ui';
	import { panels } from '$lib/ui.svelte';

	/* ピルのボタンを押したときだけ、ピルの直下に開く小さな板 (island.md「広がる条件」)。bits-ui の Popover で
	   aria-expanded・Esc・範囲外の押下が既定で付く。数件を見せるだけなので履歴は積まず (「戻る」を取られない)、
	   覆いも出ないので markOverlay も呼ばない */
	let {
		name,
		trigger,
		children
	}: {
		/** 上部バーで開いている板を 1 つに保つための名前 (ui.svelte.ts の panels) */
		name: string;
		/** 押すボタンそのもの。bits-ui が渡す属性 (aria-expanded ほか)を受け取って付ける */
		trigger: Snippet<[Record<string, unknown>]>;
		children: Snippet;
	} = $props();

	const open = $derived(panels.open === name);
</script>

<Popover.Root {open} onOpenChange={(v) => (panels.open = v ? name : null)}>
	<Popover.Trigger>
		{#snippet child({ props })}{@render trigger(props)}{/snippet}
	</Popover.Trigger>
	<Popover.Portal>
		<!-- sideOffset 14 — ボタン (40px) の下 14px はピル (52px) の下端から 8px。板がピルに掛からない最小。
		     collisionPadding right 88 — レールの左端 (右端から 56 + 16 = 72px) からさらに 16px 離す -->
		<Popover.Content class="pill-panel" align="center" sideOffset={14} collisionPadding={{ right: 88 }}>
			{@render children()}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
