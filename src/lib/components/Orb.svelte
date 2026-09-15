<script lang="ts">
	import { onMount } from 'svelte';
	import { createOrb } from '$lib/orb/renderer';

	let { size = 580, sparks = true }: { size?: number; sparks?: boolean } = $props();
	let canvas: HTMLCanvasElement | undefined = $state();
	let fallback = $state(false);

	onMount(() => {
		const orb = createOrb(canvas!, {
			reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
			/* 低性能の判定はブリーフどおり「モバイル幅 かつ コア数 4 以下」の AND */
			mobile: matchMedia('(max-width: 960px)').matches && navigator.hardwareConcurrency <= 4,
			particles: sparks
		});
		if (!orb) {
			fallback = true;
			return;
		}
		orb.start();
		return () => orb.destroy();
	});
</script>

<div class="orb" style="width:{size}px;height:{size}px" aria-hidden="true">
	{#if fallback}
		<div class="orb-fallback"></div>
	{:else}
		<canvas bind:this={canvas}></canvas>
	{/if}
</div>
