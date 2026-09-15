<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import Icon from './Icon.svelte';

	let {
		open,
		title,
		description,
		size = 'md',
		onclose,
		children,
		actions
	}: {
		open: boolean;
		title: string;
		description?: string;
		size?: 'md' | 'sm';
		onclose: () => void;
		children?: Snippet;
		actions: Snippet;
	} = $props();

	/** app.css の --d-exit */
	const EXIT_MS = 200;

	let render = $state(false);
	let leaving = $state(false);
	let prev = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (open === prev) return;
		prev = open;
		clearTimeout(timer);
		if (open) {
			render = true;
			leaving = false;
			return;
		}
		leaving = true;
		timer = setTimeout(() => {
			render = false;
			leaving = false;
		}, EXIT_MS);
	});

	$effect(() => () => clearTimeout(timer));
</script>

<Dialog.Root
	{open}
	onOpenChange={(v) => {
		if (!v) onclose();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay forceMount>
			{#snippet child({ props })}
				{#if render}<div {...props} class="scrim" class:leave={leaving}></div>{/if}
			{/snippet}
		</Dialog.Overlay>
		<Dialog.Content forceMount>
			{#snippet child({ props })}
				{#if render}
					<div {...props} class="modal" class:sm={size === 'sm'} class:leave={leaving}>
						<div class="row" style="justify-content: space-between; margin-bottom: var(--sp-3)">
							<Dialog.Title>
								{#snippet child({ props: titleProps })}<h3 {...titleProps}>{title}</h3>{/snippet}
							</Dialog.Title>
							<Dialog.Close class="iconbtn" aria-label="閉じる">
								<Icon name="ic-x" size={20} />
							</Dialog.Close>
						</div>
						{#if description}
							<Dialog.Description>
								{#snippet child({ props: descProps })}
									<p {...descProps} style="color: var(--ink-2)">{description}</p>
								{/snippet}
							</Dialog.Description>
						{/if}
						{#if children}{@render children()}{/if}
						<!-- 仕様 5 / components 5.1 — 主ボタンは左。呼び出し側は主 → 副の順に置く -->
						<div class="row" style="gap: var(--sp-6); margin-top: var(--sp-6)">
							{@render actions()}
						</div>
					</div>
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
