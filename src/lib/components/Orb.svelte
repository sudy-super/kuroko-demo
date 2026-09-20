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

	onMount(() => {
		let orb: ReturnType<typeof createOrb> = null;
		let canvas: HTMLCanvasElement | null = null;
		/* シェーダーのコンパイル・リンク失敗や framebuffer の不完全は、初期化時もコンテキスト復帰時も
		   マウントを壊さず canvas を手放すだけにする (Task 10x で CSS の代替は廃止、下のマークアップの
		   コメントを見よ)。resize() や onRestored() からの復帰失敗
		   (renderer.ts の fail()) はマウント後に非同期で呼ばれるため、release() と同じく
		   canvas ごと手放して onCanvas?.(null) で呼び元 (今日画面の holeOrbCanvas) の参照も
		   外す。ここを release() と非対称にすると (Task 10r レビュー Important 2)、
		   呼び元は死んだ canvas を握ったままになり、preserveDrawingBuffer で保持された
		   最後のフレームがカードの背後に焼き付いたまま動かなくなる */
		const toFallback = (e: unknown) => {
			console.warn('orb: WebGL の描画に失敗したのでオーブを出しません', e);
			orb = null;
			canvas?.remove();
			canvas = null;
			onCanvas?.(null);
		};
		/* Task 10i — 描画面 (WebGL context)は見えている間だけ握る。隠れたタブが握ったままだと、
		   手前のタブがガラスとオーブの分を作れずに描けなくなる。
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
					/* 描画面を失っている間は canvas を隠す。canvas は復帰に備えて残す */
					onLive: (v) => canvas?.classList.toggle('off', !v)
				});
			} catch (e) {
				toFallback(e);
			}
			if (!orb) {
				/* WebGL が無い、描画面を使い切っている、初期化に失敗した。toFallback がすでに
				   canvas を片付けている場合があるので ?. で二重の remove を避ける */
				canvas?.remove();
				canvas = null;
				return;
			}
			orb.start();
			/* start() の中の resize() が同期的に失敗すると toFallback が先に呼ばれ、
			   orb と canvas をすでに null に戻している。ここで onCanvas?.(canvas) を続けると
			   toFallback の後始末を上書きしてしまうので、その場合は何もしない */
			if (!orb) return;
			onCanvas?.(canvas);
		};
		const release = () => {
			orb?.destroy();
			orb = null;
			canvas?.remove();
			canvas = null;
			onCanvas?.(null);
		};
		return whileVisible(acquire, release);
	});
</script>

<!-- Task 10x (ユーザー裁定 2026-09-20) — WebGL が使えないときの CSS の代替表示は廃止した。
     オーブは「青い塊・白い核・外へ散る破片」が承認済みの見た目で、階調と小さな点の
     散らばりでは似せられず (review-task-10i の Important 1)、似ていない絵を出すくらいなら
     何も出さないほうがよいという判断。描画面を手放している間は canvas を隠すだけで、
     オーブの場所は空く (背景の階調がそのまま見える) -->
<div class="orb" bind:this={box} style="width:{size}px;height:{size}px" aria-hidden="true"></div>
