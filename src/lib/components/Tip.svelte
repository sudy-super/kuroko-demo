<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tooltip } from 'bits-ui';

	/* indicators.md「アイコンだけで意味を伝える条件」— 行内はアイコンだけにするかわりに、
	   文言はホバーとキーボードのフォーカスで必ず読めるようにする。
	   中のアイコンが aria-label を持ち、この文言は説明として付く (名前は二重にしない) */
	let { text, children }: { text: string; children: Snippet } = $props();
</script>

<Tooltip.Provider delayDuration={300}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<!-- 行そのものが a や label なので、引き金は入れ子の操作要素にできない。
				     span に tabindex を付けてキーボードでも開けるようにする。
				     bits-ui は button 向けの type を必ず渡してくるので、span からは外す -->
				{@const { type: _t, ...rest } = props}
				<span {...rest} class="tip-at">{@render children()}</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content sideOffset={6} class="tip">{text}</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>

<style>
	.tip-at {
		display: inline-flex;
		flex: none;
		border-radius: var(--r-xs);
	}
	.tip-at:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	:global(.tip) {
		z-index: 100;
		padding: var(--sp-2) var(--sp-3);
		border-radius: var(--r-xs);
		background: var(--ink);
		color: #fff;
		font-size: 12px;
		font-weight: 500;
		line-height: 1.4;
		box-shadow: var(--e2);
	}
</style>
