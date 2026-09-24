<script lang="ts" generics="K extends string">
	import type { Snippet } from 'svelte';
	import { pressGlass } from '$lib/glass';

	/* 複数から 1 つを選ぶ表示の切り替え。カプセルの枠の中で、選んだ項目の下に白いつまみを敷き、
	   切り替えるとつまみが滑って動く (ユーザー提示の iOS 26 のタブバー、2026-09-25)。
	   つまみはガラスにしない。WWDC25「Build a SwiftUI app with the new design」は segmented picker が
	   ガラスになるのは操作の間だけとし、HIG Materials は内容の層にガラスを置かない
	   (docs/research/segmented-liquid-glass.md)。選んだ項目の文字をアクセントの青にするのは一次資料に
	   記述が無く、ユーザー提示のタブバーに倣った。選択は色だけでなくつまみの形でも示す (WCAG 1.4.1) */
	let {
		items,
		value,
		onchange,
		label,
		extra
	}: {
		items: { key: K; label: string }[];
		value: K;
		onchange: (k: K) => void;
		label: string;
		extra?: Snippet<[K]>;
	} = $props();

	let box: HTMLDivElement | undefined = $state();
	let thumb = $state({ x: 0, w: 0 });
	/* 最初の位置合わせでは滑らせない (開いた瞬間に左端から走って見えるため) */
	let ready = $state(false);

	/* 押している間だけ、つまみを少し膨らませてガラスにする (iOS 26 の segmented picker)。
	   描画面は押すたびに取って離したら手放す。常駐させると 1 ページの上限 (約 16) を食う */
	/* 離してもすぐには戻さず、つまみが次の項目まで滑り終わるまでガラスのままにする
	   (選択は離したときの click で変わるので、すぐ戻すと滑る間はもう普通の塗りになっている) */
	const SETTLE_MS = 360;
	let thumbEl: HTMLSpanElement | undefined = $state();
	let pressed = $state(false);
	let dropGlass: (() => void) | undefined;
	let settle: ReturnType<typeof setTimeout> | undefined;
	function press() {
		clearTimeout(settle);
		if (!thumbEl) return;
		pressed = true;
		dropGlass ??= pressGlass(thumbEl);
	}
	function release() {
		pressed = false;
		dropGlass?.();
		dropGlass = undefined;
	}
	function lift() {
		if (!pressed) return;
		clearTimeout(settle);
		settle = setTimeout(release, SETTLE_MS);
	}
	$effect(() => () => {
		clearTimeout(settle);
		release();
	});

	$effect(() => {
		value;
		const el = box;
		if (!el) return;
		const measure = () => {
			const on = el.querySelector<HTMLElement>('[aria-pressed="true"]');
			if (on) thumb = { x: on.offsetLeft, w: on.offsetWidth };
		};
		measure();
		requestAnimationFrame(() => (ready = true));
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	});
</script>

<svelte:window onpointerup={lift} onpointercancel={lift} onblur={lift} />
<div class="seg" role="group" aria-label={label} bind:this={box}>
	<span
		class="seg-thumb"
		class:ready
		class:pressed
		bind:this={thumbEl}
		style="transform: translateX({thumb.x}px); width: {thumb.w}px"
	></span>
	{#each items as it (it.key)}
		<button
			class="seg-btn"
			aria-pressed={value === it.key}
			onpointerdown={press}
			onclick={() => onchange(it.key)}
		>
			{it.label}{@render extra?.(it.key)}
		</button>
	{/each}
</div>
