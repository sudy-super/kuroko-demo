<script lang="ts">
	import type { Snippet } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { Dialog } from 'bits-ui';
	import { pushState } from '$app/navigation';
	import { mobile } from '$lib/media.svelte';
	import { markOverlay, keepOpenOnFrame } from '$lib/ui.svelte';
	import { scrim, head } from './DialogParts.svelte';

	let {
		open,
		title,
		onclose,
		children,
		footer,
		variant = 'side',
		from = null,
		onsettled
	}: {
		open: boolean;
		title: string;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
		/** 'side' は右からのドロワー (既定、ActivityDrawer が使う)。'center' は画面中央寄りの
		    固定パネル (承認待ちと、メールの差出人。docs/research/card-expand.md「拡大後の大きさ」) */
		variant?: 'side' | 'center';
		/** 'center' のとき、ここから広がり、閉じるとここへ縮む (押した要素の矩形)。無ければ
		    その場に開く。開いた瞬間の値だけを使う */
		from?: DOMRect | null;
		/** 閉じる動きが終わった。押した要素を隠していたら戻す、焦点を戻す、の後始末に使う */
		onsettled?: (morphed: boolean) => void;
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
	/* 起点は開いた瞬間に控える。呼び出し側が from を外しても、縮む先に使えるようにする */
	let origin: DOMRect | null = $state(null);
	const morph = $derived(variant === 'center' && !mobile.current && !!origin && !prefersReducedMotion.current);
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
			// 縮む動きは fill: 'forwards' で最後の矩形を保ち続けるので、開く前に必ず消す
			// (残ると広がる動きの終点を測り損ねる)
			panel?.getAnimations().forEach((a) => a.cancel());
			origin = from;
			render = true;
			leaving = false;
			pushState('', { drawer: true });
			pushed = true;
			return;
		}
		// 起点は閉じる分岐で使い切る。縮む先の矩形はローカル変数 to で持つ
		const wasMorph = morph;
		const to = origin;
		origin = null;
		if (wasMorph && panel && to) {
			panel.animate([box(panel.getBoundingClientRect()), box(to)], {
				duration: MORPH_MS,
				easing: SHRINK,
				fill: 'forwards'
			});
		}
		leaving = true;
		// 外から open が false にされた経路 (遷移での一斉クローズなど) では、pushState で積んだ履歴が残る。
		// ×/Esc は onOpenChange で history.back() するので、ここでは pushed だけ下ろす (二重に戻らないように)
		pushed = false;
		timer = setTimeout(
			() => {
				render = false;
				leaving = false;
				// 押した要素を隠すのは縮み終わりまで。見せ直しと焦点の戻しは呼び出し側に任せる
				// (押した要素は縮み終わるまで visibility: hidden なので、bits-ui の戻しでは焦点が乗らない)
				onsettled?.(wasMorph && !!to);
			},
			wasMorph ? MORPH_MS : EXIT_MS
		);
	});

	// 開いた直後: 今の (CSS の) 位置を終点にして、カードの矩形から広げる
	$effect(() => {
		if (!panel || !morph || leaving) return;
		// 終点を測る前に、残っている動き (直前の縮みなど) を消す
		panel.getAnimations().forEach((a) => a.cancel());
		const end = panel.getBoundingClientRect();
		panel.animate([box(origin!), box(end)], { duration: MORPH_MS, easing: GROW });
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
		/* ×・Esc・覆いで閉じたときは、開くときに積んだ履歴を自分で 1 つ戻す (でないと「戻る」が空振りする)。
		   中のリンクは data-sveltekit-replacestate で履歴を置き換えるので巻き戻しは起きない */
		if (pushed) {
			pushed = false;
			history.back();
		}
	}}
>
	<Dialog.Portal>
		{@render scrim(render, leaving)}
		<Dialog.Content
			forceMount
			trapFocus={false}
			onCloseAutoFocus={(e) => morph && e.preventDefault()}
			onInteractOutside={keepOpenOnFrame}
		>
			{#snippet child({ props })}
				{#if render}
					<div
						{...props}
						aria-modal="false"
						bind:this={panel}
						class={mobile.current ? 'sheet' : variant === 'center' ? 'panel-center' : 'drawer'}
						class:leave={leaving}
						class:morph
					>
						{#if mobile.current}<div class="sheet-handle"></div>{/if}
						{@render head(title, 'var(--sp-4)')}
						<!-- 送るのはこの箱だけ。枠 (ガラス・縁) ごと送ると、枠の高さで描かれる縁の
						     疑似要素が中身と一緒に流れて途中に線が出る (.modal-body と同じ作り) -->
						<div class="modal-body">
							{@render children()}
							{#if footer}
								<div style="margin-top: auto; padding-top: var(--sp-4)">{@render footer()}</div>
							{/if}
						</div>
					</div>
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
