<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { pushState } from '$app/navigation';
	import { media } from '$lib/media.svelte';
	import { markOverlay, ui } from '$lib/ui.svelte';
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

	/* カードから広がる/縮む動き (docs/research/card-expand.md、view-transition.md)。
	   実要素の top/left/width/height を WAAPI で動かす。scale() を使わないのは、
	   ガラス (src/lib/glass.ts) が実要素の矩形を毎フレーム読んで描くため */
	const GROW = 'cubic-bezier(0.05, 0.7, 0.1, 1)'; // M3 Emphasized decelerate
	const SHRINK = 'cubic-bezier(0.3, 0, 0.8, 0.15)'; // M3 Emphasized accelerate
	const MORPH_MS = 450;

	let panel: HTMLElement | undefined = $state();
	// 起点があり、中央のパネルで、動きを減らす設定でないときだけ広げる
	const morph = $derived(
		variant === 'center' &&
			!media.mobile &&
			!!ui.approvalFrom &&
			!matchMedia('(prefers-reduced-motion: reduce)').matches
	);
	const box = (r: DOMRect) => ({
		top: `${r.top}px`,
		left: `${r.left}px`,
		width: `${r.width}px`,
		height: `${r.height}px`,
		transform: 'none'
	});

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
		const wasMorph = morph;
		const from = ui.approvalFrom;
		if (wasMorph && panel && from) {
			panel.animate([box(panel.getBoundingClientRect()), box(from)], {
				duration: MORPH_MS,
				easing: SHRINK,
				fill: 'forwards'
			});
		}
		leaving = true;
		timer = setTimeout(
			() => {
				render = false;
				leaving = false;
				if (wasMorph && from) {
					ui.approvalFrom = null;
					// カードは縮み終わるまで visibility: hidden なので、bits-ui の戻し
					// (onCloseAutoFocus で止めてある) では焦点が乗らない。見えるようにしてから戻す
					tick().then(() => document.querySelector<HTMLElement>('.card[data-card="approvals"]')?.focus());
				}
			},
			wasMorph ? MORPH_MS : EXIT_MS
		);
	});

	// 開いた直後: 今の (CSS の) 位置を終点にして、カードの矩形から広げる
	$effect(() => {
		if (!panel || !morph || leaving) return;
		const to = panel.getBoundingClientRect();
		panel.animate([box(ui.approvalFrom!), box(to)], { duration: MORPH_MS, easing: GROW });
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
		<Dialog.Content
			forceMount
			trapFocus={false}
			onCloseAutoFocus={(e) => morph && e.preventDefault()}
			onInteractOutside={(e) => {
				// 枠 (上部バー・サイドナビ・連携の列) と枠から開く板を押しても覆いを閉じない
				// (ユーザー指示 2026-09-23: 枠はどの覆いが開いていても触れる)。
				// サイドナビのリンクは遷移するので、覆いは遷移で閉じる
				if ((e.target as Element | null)?.closest('.header.glass, .sidebar, .rail, .pill-panel, .demo-menu'))
					e.preventDefault();
			}}
		>
			{#snippet child({ props })}
				{#if render}
					<div
						{...props}
						aria-modal="false"
						bind:this={panel}
						class={media.mobile ? 'sheet' : variant === 'center' ? 'panel-center' : 'drawer'}
						class:leave={leaving}
						class:morph
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
