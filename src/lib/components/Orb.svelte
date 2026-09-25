<script lang="ts">
	import { onMount } from 'svelte';
	import { createOrb } from '$lib/orb/renderer';
	import { orbLifecycle } from '$lib/orb/mount';
	import { whileVisible } from '$lib/visible';

	/* onCanvas — 握っている <canvas> を呼び元に渡す (作成時に要素、手放すときに null)。カードのガラスが
	   このオーブを背後の絵に取り込むのに要る (ライブラリは宿主の子孫を背後の絵から除く) */
	let {
		size = 580,
		sparks = true,
		onCanvas
	}: { size?: number; sparks?: boolean; onCanvas?: (canvas: HTMLCanvasElement | null) => void } =
		$props();
	let box: HTMLDivElement | undefined = $state();

	onMount(() => {
		/* 握る・手放す・失敗したときの後始末は $lib/orb/mount に置く (Svelte の外なので試験できる) */
		const { acquire, release } = orbLifecycle({
			box: box!,
			createCanvas: () => document.createElement('canvas'),
			createOrb: (canvas, onFail) =>
				createOrb(canvas, {
					reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
					/* 低性能の判定は「モバイル幅 かつ コア数 4 以下」 */
					mobile: matchMedia('(max-width: 960px)').matches && navigator.hardwareConcurrency <= 4,
					particles: sparks,
					onFail,
					/* 描画面を失っている間は canvas を隠す。canvas は復帰に備えて残す */
					onLive: (v) => canvas.classList.toggle('off', !v)
				}),
			onCanvas
		});
		return whileVisible(acquire, release);
	});
</script>

<!-- WebGL が使えないときの代替表示は持たない。似ていない絵を出すくらいなら何も出さない。
     描画面を手放している間は canvas を隠し、オーブの場所は空く -->
<div class="orb" bind:this={box} style="width:{size}px;height:{size}px" aria-hidden="true"></div>
