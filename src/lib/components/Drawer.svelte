<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { pushState } from '$app/navigation';
	import { media } from '$lib/media.svelte';
	import { markOverlay } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';

	let {
		open,
		title,
		onclose,
		children,
		footer,
		variant = 'side'
	}: {
		open: boolean;
		title: string;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
		/** 'side' は右からのドロワー (既定、ActivityDrawer が使う)。'center' は画面中央寄りの
		    固定パネル (ApprovalDrawer だけが使う。docs/research/card-expand.md「拡大後の大きさ」) */
		variant?: 'side' | 'center';
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
	});

	// 退場の 200 ミリ秒が終わるまでカードの塗りを戻さない。open で切ると覆いが消える前に
	// ガラスが 2 枚重なった状態が見える
	$effect(() => {
		if (!render) return;
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
		if (v) return;
		onclose();
		/* ×・Esc・覆いで閉じたときは、開くときに積んだ履歴を自分で 1 つ戻す。こうしないと
		   閉じたあとの「戻る」が同じ URL の履歴を 1 つ消すだけで空振りする。
		   戻るで閉じたときは popstate 側で pushed を下ろすのでここには来ない。
		   ドロワーの中のリンクは onOpenChange を通らず (呼び出し側が open を false にする)、
		   遷移が data-sveltekit-replacestate で履歴を置き換えるので、巻き戻しは起きない */
		if (pushed) {
			pushed = false;
			history.back();
		}
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
					<div
						{...props}
						class={media.mobile ? 'sheet' : variant === 'center' ? 'panel-center' : 'drawer'}
						class:leave={leaving}
					>
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
