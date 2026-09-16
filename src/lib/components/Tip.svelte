<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tooltip } from 'bits-ui';

	/* indicators.md「アイコンだけで意味を伝える条件」— 行内はアイコンだけにするかわりに、
	   文言はホバーで読めるようにする。キーボードと読み上げには中のアイコンの aria-label が届く */
	let { text, children }: { text: string; children: Snippet } = $props();
</script>

<Tooltip.Provider delayDuration={300}>
	<Tooltip.Root>
		<Tooltip.Trigger tabindex={-1}>
			{#snippet child({ props })}
				<!-- 行そのものが a や label なので、引き金を焦点に入れるとリンクやラベルの中に
				     タブ移動先が増え、HTML としても不正になる。tabindex={-1} で焦点から外す。
				     bits-ui は button 向けの type を必ず渡してくるので span からは外し、
				     aria-describedby も外す (中のアイコンが同じ文言を名前として持つため) -->
				{@const { type: _t, 'aria-describedby': _d, ...rest } = props}
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
