<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import Icon from './Icon.svelte';

	/* indicators.md「アイコンだけで意味を伝える条件」— 行内はアイコンだけにするかわりに、
	   文言はホバーで読めるようにする。キーボードと読み上げには、同じ文言をアイコンの aria-label で渡す */
	let {
		text,
		name,
		size,
		class: cls
	}: { text: string; name: string; size?: number; class?: string } = $props();
</script>

<Tooltip.Provider delayDuration={300}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<!-- 行そのものが a や label なので、引き金は焦点に入れない。tabindex="-1" を置くと
				     a / button の内容モデルに反する属性が残るので、属性ごと捨てる。
				     bits-ui は button 向けの type を必ず渡してくるので span からは外し、
				     aria-describedby も外す (中のアイコンが同じ文言を名前として持つため) -->
				{@const { type: _t, tabindex: _i, 'aria-describedby': _d, ...rest } = props}
				<span {...rest} class="tip-at"><Icon {name} {size} label={text} class={cls} /></span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<!-- 読み上げには中のアイコンの aria-label が同じ文言で届くので、本体は読ませない -->
			<Tooltip.Content sideOffset={6} class="tip" aria-hidden="true">{text}</Tooltip.Content>
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
