<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { Dialog } from 'bits-ui';
	import { pushState } from '$app/navigation';
	import { media } from '$lib/media.svelte';
	import { markOverlay, ui, keepOpenOnFrame } from '$lib/ui.svelte';
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
	// レビュー M11 — matchMedia(...).matches を直接読むと変化を購読しないので、開いている間に
	// 設定が変わっても morph が追随しない。MediaQuery (today/+page.svelte の narrow と同じ書き方)
	// なら変化に反応する
	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	// 起点があり、中央のパネルで、動きを減らす設定でないときだけ広げる
	const morph = $derived(variant === 'center' && !media.mobile && !!ui.approvalFrom && !reducedMotion.current);
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
			// レビュー I1 — 縮む動きは fill: 'forwards' で終わったあとも最後の矩形 (カードの位置)
			// を保ち続け、誰も cancel() しない。450ms 以内に開き直すと、広がる動きの終点を測る
			// 前にこれが残っていて「カード → カード」の動きに固まる。開く前に必ず消す
			panel?.getAnimations().forEach((a) => a.cancel());
			// 閉じる途中の後始末は上の clearTimeout で消える。カードから開き直したのでなければ
			// (起点が無ければ)、隠していたカードをここで見せ直す
			if (!ui.approvalFrom) ui.approvalCardHidden = false;
			render = true;
			leaving = false;
			pushState('', { drawer: true });
			pushed = true;
			return;
		}
		// レビュー C2/I1 — approvalFrom は「今回の Drawer が起点として使う値」。閉じる分岐に
		// 入った時点で即座に使い切って null に戻す。wasMorph でない経路 (動きを減らす設定・
		// 961px 未満など) でも戻さないと、カードは二度と expanded が外れず
		// visibility: hidden のまま固定される。縮む先の矩形はローカル変数 from で持つ
		const wasMorph = morph;
		const from = ui.approvalFrom;
		ui.approvalFrom = null;
		if (wasMorph && panel && from) {
			panel.animate([box(panel.getBoundingClientRect()), box(from)], {
				duration: MORPH_MS,
				easing: SHRINK,
				fill: 'forwards'
			});
		}
		leaving = true;
		// レビュー M1 — 外から open が false にされた (× / Esc / popstate 以外、例えば
		// ページ遷移での一斉クローズ) 経路では pushState で積んだ履歴がそのまま残る。
		// ×/Esc は onOpenChange 側で history.back() ごと戻すので、ここでは history は
		// 動かさず pushed だけ下ろす (二重に戻ると遷移先の履歴まで巻き戻ってしまう)
		pushed = false;
		timer = setTimeout(
			() => {
				render = false;
				leaving = false;
				// カードを隠すのは縮み終わりまで (today/+page.svelte の expanded={ui.approvalCardHidden})
				ui.approvalCardHidden = false;
				if (wasMorph && from) {
					// カードは縮み終わるまで visibility: hidden なので、bits-ui の戻し
					// (onCloseAutoFocus で止めてある) では焦点が乗らない。見えるようにしてから戻す。
					// レビュー S2 — その間に利用者が別の場所へ Tab で移っていたら奪わない
					tick().then(() => {
						if (document.activeElement && document.activeElement !== document.body) return;
						document.querySelector<HTMLElement>('.card[data-card="approvals"]')?.focus();
					});
				}
			},
			wasMorph ? MORPH_MS : EXIT_MS
		);
	});

	// 開いた直後: 今の (CSS の) 位置を終点にして、カードの矩形から広げる
	$effect(() => {
		if (!panel || !morph || leaving) return;
		// レビュー I1 — 終点を測る前に、残っている動き (直前の縮みなど) を消してから測る
		panel.getAnimations().forEach((a) => a.cancel());
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
			onInteractOutside={keepOpenOnFrame}
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
