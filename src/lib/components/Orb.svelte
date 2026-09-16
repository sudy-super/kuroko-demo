<script lang="ts">
	import { onMount } from 'svelte';
	import { createOrb } from '$lib/orb/renderer';
	import { whileVisible } from '$lib/visible';

	/* onCanvas — このインスタンスが握っている <canvas> を呼び元に渡す (作成時に要素、
	   手放すときに null)。Task 10r — カードのガラス (CARD.backdrop) がこのオーブを
	   背後の絵に取り込むために、呼び元が実際の canvas 要素への参照を握っておく必要がある
	   (ライブラリは宿主の子孫を背後の絵から除外するので、id セレクタで後から探す経路は
	   使わない。詳細は today/+page.svelte のコメントと glass.ts の CARD の節) */
	let {
		size = 580,
		sparks = true,
		onCanvas
	}: { size?: number; sparks?: boolean; onCanvas?: (canvas: HTMLCanvasElement | null) => void } =
		$props();
	let box: HTMLDivElement | undefined = $state();
	let live = $state(false);

	onMount(() => {
		let orb: ReturnType<typeof createOrb> = null;
		let canvas: HTMLCanvasElement | null = null;
		/* シェーダーのコンパイル・リンク失敗や framebuffer の不完全は、初期化時もコンテキスト復帰時も
		   マウントを壊さず CSS の代替に落とす */
		const toFallback = (e: unknown) => {
			console.warn('orb: WebGL の描画に失敗したので CSS の代替を出します', e);
			orb = null;
			live = false;
		};
		/* Task 10i — 描画面 (WebGL context)は見えている間だけ握る。隠れたタブが握ったままだと、
		   手前のタブがガラスとオーブの分を作れずに代替表示へ落ちる。
		   手放すときは canvas ごと捨てる。一度 loseContext した canvas に getContext を呼んでも、
		   失ったままの同じ context が返るだけで新しい描画面は取れない (実測: 手放して戻ると
		   isContextLost() が true のまま何も描かれない)。作り直すたびに canvas も作り直す */
		const acquire = () => {
			canvas = document.createElement('canvas');
			box!.prepend(canvas);
			try {
				orb = createOrb(canvas, {
					reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
					/* 低性能の判定はブリーフどおり「モバイル幅 かつ コア数 4 以下」の AND */
					mobile: matchMedia('(max-width: 960px)').matches && navigator.hardwareConcurrency <= 4,
					particles: sparks,
					onFail: toFallback,
					/* 描画面を失っている間は代替を出す。canvas は復帰に備えて残す */
					onLive: (v) => {
						live = v;
						canvas?.classList.toggle('off', !v);
					}
				});
			} catch (e) {
				toFallback(e);
			}
			if (!orb) {
				/* WebGL が無い、描画面を使い切っている、初期化に失敗した */
				canvas.remove();
				canvas = null;
				live = false;
				return;
			}
			orb.start();
			live = true;
			onCanvas?.(canvas);
		};
		const release = () => {
			orb?.destroy();
			orb = null;
			canvas?.remove();
			canvas = null;
			live = false;
			onCanvas?.(null);
		};
		return whileVisible(acquire, release);
	});
</script>

<div class="orb" bind:this={box} style="width:{size}px;height:{size}px" aria-hidden="true">
	{#if !live}<div class="orb-fallback"></div>{/if}
</div>
