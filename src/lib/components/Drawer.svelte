<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { page } from '$app/state';
	import { pushState, replaceState } from '$app/navigation';
	import { media } from '$lib/media.svelte';
	import { markOverlay } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';

	let {
		open,
		title,
		onclose,
		children,
		footer
	}: {
		open: boolean;
		title: string;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	/** app.css の --d-exit。退場の 200 ミリ秒を見せてから中身を外す */
	const EXIT_MS = 200;

	let render = $state(false);
	let leaving = $state(false);
	let prev = false;
	let pushed = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	// open の変わり目だけを拾う。bits-ui は閉じると即座に外すので、退場の間は自前で描き続ける
	$effect(() => {
		if (open === prev) return;
		prev = open;
		clearTimeout(timer);
		if (open) {
			render = true;
			leaving = false;
			pushState('', { drawer: true });
			pushed = true;
			return;
		}
		leaving = true;
		timer = setTimeout(() => {
			render = false;
			leaving = false;
		}, EXIT_MS);
		// 自分が積んだ印を消すだけにする。history.back() はドロワー内リンクの遷移と順序を争うので使わない。
		// 戻るで閉じたときは popstate 側で pushed を下ろし、画面遷移したときは page.state が空になる
		if (pushed) {
			pushed = false;
			if (page.state.drawer) replaceState('', {});
		}
	});

	$effect(() => {
		if (!open) return;
		markOverlay(true);
		return () => markOverlay(false);
	});

	$effect(() => {
		const pop = () => {
			if (!pushed) return;
			pushed = false;
			onclose();
		};
		window.addEventListener('popstate', pop);
		return () => {
			window.removeEventListener('popstate', pop);
			clearTimeout(timer);
		};
	});
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
					<div {...props} class={media.mobile ? 'sheet' : 'drawer'} class:leave={leaving}>
						{#if media.mobile}<div class="sheet-handle"></div>{/if}
						<div class="row" style="justify-content: space-between; margin-bottom: var(--sp-4)">
							<Dialog.Title>
								{#snippet child({ props: titleProps })}<h3 {...titleProps}>{title}</h3>{/snippet}
							</Dialog.Title>
							<Dialog.Close class="iconbtn" aria-label="閉じる">
								<Icon name="ic-x" size={20} />
							</Dialog.Close>
						</div>
						{@render children()}
						{#if footer}
							<div style="margin-top: auto; padding-top: var(--sp-4)">{@render footer()}</div>
						{/if}
					</div>
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
