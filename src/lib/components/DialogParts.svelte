<script module lang="ts">
	import { Dialog } from 'bits-ui';
	import Icon from './Icon.svelte';

	/* Modal と Drawer が共有する、覆いと「題 + 閉じる」の行 */
	export { scrim, head };
</script>

<!-- 退場の間も描き続けるので、表示は bits-ui ではなく render / leaving で決める -->
{#snippet scrim(render: boolean, leaving: boolean)}
	<Dialog.Overlay forceMount>
		{#snippet child({ props })}
			{#if render}<div {...props} class="scrim" class:leave={leaving}></div>{/if}
		{/snippet}
	</Dialog.Overlay>
{/snippet}

{#snippet head(title: string, gap: string)}
	<div class="row" style="justify-content: space-between; margin-bottom: {gap}">
		<Dialog.Title>
			{#snippet child({ props: titleProps })}<h3 {...titleProps}>{title}</h3>{/snippet}
		</Dialog.Title>
		<Dialog.Close class="iconbtn" aria-label="閉じる">
			<Icon name="ic-x" size={20} />
		</Dialog.Close>
	</div>
{/snippet}
