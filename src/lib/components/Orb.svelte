<script lang="ts">
	import { onMount } from 'svelte';
	import { createOrb } from '$lib/orb/renderer';
	import { orbLifecycle } from '$lib/orb/mount';
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

	onMount(() => {
		/* 握る・手放す・失敗したときの後始末は $lib/orb/mount に置く (Svelte の外なので試験できる) */
		const { acquire, release } = orbLifecycle({
			box: box!,
			createCanvas: () => document.createElement('canvas'),
			createOrb: (canvas, onFail) =>
				createOrb(canvas, {
					reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
					/* 低性能の判定はブリーフどおり「モバイル幅 かつ コア数 4 以下」の AND */
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

<!-- Task 10x (ユーザー裁定 2026-09-20) — WebGL が使えないときの CSS の代替表示は廃止した。
     オーブは「青い塊・白い核・外へ散る破片」が承認済みの見た目で、階調と小さな点の
     散らばりでは似せられず (review-task-10i の Important 1)、似ていない絵を出すくらいなら
     何も出さないほうがよいという判断。描画面を手放している間は canvas を隠すだけで、
     オーブの場所は空く (背景の階調がそのまま見える) -->
<div class="orb" bind:this={box} style="width:{size}px;height:{size}px" aria-hidden="true"></div>
