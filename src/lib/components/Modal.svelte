<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { markOverlay } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';

	let {
		open,
		title,
		description,
		size = 'md',
		onclose,
		openFocus,
		children,
		actions,
		box = $bindable(null)
	}: {
		open: boolean;
		title: string;
		description?: string;
		/** palette は ⌘K の形 (components 3.10)。題の行も操作の行も持たず、上端に寄る */
		size?: 'md' | 'sm' | 'palette';
		onclose: () => void;
		/** 開いた直後に焦点を置く先。渡さないと bits-ui は最初の tabbable (閉じるボタン)に置く */
		openFocus?: () => HTMLElement | null;
		children?: Snippet;
		/** palette は下の操作の行を持たない (行そのものが操作) */
		actions?: Snippet;
		/** 外枠の要素。closest('.modal') のように内部の class 名へ依存させたくない
		    呼び出し側 (Palette の ↑↓ 送りなど)向けの公開 API */
		box?: HTMLElement | null;
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

	// Drawer と同じ。退場の 200 ミリ秒が終わるまで印を外さない。open で切ると、覆いが消える前に
	// カードのガラスが不透明から戻り、ガラスが 2 枚重なった状態が見える
	$effect(() => {
		if (!render) return;
		markOverlay(true);
		return () => markOverlay(false);
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
		<Dialog.Content
			forceMount
			onOpenAutoFocus={(e) => {
				const el = openFocus?.();
				if (!el) return;
				e.preventDefault();
				el.focus();
			}}
		>
			{#snippet child({ props })}
				{#if render}
					<div
						{...props}
						bind:this={box}
						class="modal"
						class:sm={size === 'sm'}
						class:palette={size === 'palette'}
						class:leave={leaving}
					>
						{#if size === 'palette'}
							<!-- 題は読み上げにだけ出す。入力欄の placeholder が見えている題を兼ねる
							     (components 3.10 の表に題の行が無い) -->
							<Dialog.Title>
								{#snippet child({ props: titleProps })}
									<h3 {...titleProps} class="sr-only">{title}</h3>
								{/snippet}
							</Dialog.Title>
						{:else}
							<div class="row" style="justify-content: space-between; margin-bottom: var(--sp-3)">
								<Dialog.Title>
									{#snippet child({ props: titleProps })}<h3 {...titleProps}>{title}</h3>{/snippet}
								</Dialog.Title>
								<Dialog.Close class="iconbtn" aria-label="閉じる">
									<Icon name="ic-x" size={20} />
								</Dialog.Close>
							</div>
						{/if}
						<!-- 中身だけスクロールさせる。題と操作の行は箱に留めるので、行数が増えても
						     主ボタンが画面外へ出ない (仕様 5.14)。children を渡さない呼び出し
						     (確認モーダルなど)でも description は送れないと、極端に低い窓で
						     操作の行が箱の外へ出てしまうため常に描く -->
						<div class="modal-body">
							{#if description}
								<Dialog.Description>
									{#snippet child({ props: descProps })}
										<p {...descProps} style="color: var(--ink-2)">{description}</p>
									{/snippet}
								</Dialog.Description>
							{/if}
							{#if children}{@render children()}{/if}
						</div>
						<!-- 仕様 5 / components 5.1 — 主ボタンは左。呼び出し側は主 → 副の順に置く -->
						{#if actions}
							<div class="row modal-actions">
								{@render actions()}
							</div>
						{/if}
					</div>
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
