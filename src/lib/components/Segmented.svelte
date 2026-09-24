<script lang="ts" generics="K extends string">
	import type { Snippet } from 'svelte';
	import { pressGlass } from '$lib/glass';

	/* 表示の切り替え。選んだ項目の下の白いつまみが滑って動く (iOS 26)。つまみは普段ガラスにしない
	   (ガラスになるのは操作の間だけ、segmented-liquid-glass.md)。選択は色だけでなくつまみの形でも示す (WCAG 1.4.1) */
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

	/* 押している間だけ、つまみを少し膨らませてガラスにする (iOS 26 の segmented picker、glass.ts) */
	let thumbEl: HTMLSpanElement | undefined = $state();
	let pressed = $state(false);
	const glassy = pressGlass((p) => (pressed = p));
	$effect(() => glassy.release);

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

<svelte:window onpointerup={glassy.lift} onpointercancel={glassy.lift} onblur={glassy.lift} />
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
			onpointerdown={() => thumbEl && glassy.press(thumbEl)}
			onclick={() => {
				onchange(it.key);
				// キーボードで選んだときは pointerdown が来ないので、選んだ時点でもガラスにして
				// つまみが滑る間だけ残す
				if (thumbEl) glassy.press(thumbEl);
				glassy.lift();
			}}
		>
			{it.label}{@render extra?.(it.key)}
		</button>
	{/each}
</div>
