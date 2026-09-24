<script lang="ts">
	/* 話している間の操作。ChatGPT の音声入力 (Dictation) の形に合わせる — 横長の 1 本の並びに、
	   左端に閉じる、中央に声の大きさの波形、右に止める、右端に送る (ユーザー指示 2026-09-24)。
	   KurokoBar と VoiceOverlay の両方で使うのでここに切り出す */
	import { MediaQuery } from 'svelte/reactivity';
	import { ui, dictated } from '$lib/ui.svelte';
	import { hearing } from '$lib/voice.svelte';
	import Icon from './Icon.svelte';

	/** 点の間隔 (ms)。右端が最新、左へ流れていく */
	const STEP_MS = 80;
	/** 点の直径と間 */
	const DOT = 4;
	const GAP = 6;

	const reduced = new MediaQuery('(prefers-reduced-motion: reduce)');

	let wrap: HTMLDivElement | undefined = $state();
	let width = $state(0);
	const count = $derived(Math.max(1, Math.floor(width / (DOT + GAP))));

	/* 右が最新になるよう末尾に積む。表示に使うのは末尾 count 件だけで、それより前は捨ててよい
	   (溜め続けても意味がないため) */
	let levels: number[] = $state([]);
	$effect(() => {
		if (!hearing.live) return;
		const t = setInterval(() => {
			levels = [...levels, hearing.level].slice(-count - 1);
		}, STEP_MS);
		return () => clearInterval(t);
	});

	$effect(() => {
		if (!wrap) return;
		const ro = new ResizeObserver(([e]) => (width = e.contentRect.width));
		ro.observe(wrap);
		return () => ro.disconnect();
	});

	/* 動きではなく点ごとの明るさの変化にする (WCAG 2.3.3 の対象外)。reduced のときは全点を
	   今の声の大きさに揃え、流れる動きそのものをやめる。levels は古い→新しいの順に積んであるので、
	   末尾 count 件をそのまま左から並べれば右端が最新になる (足りない分は 0 で左を埋める) */
	const dots = $derived(
		reduced.current
			? Array(count).fill(hearing.level)
			: Array(Math.max(0, count - levels.length))
					.fill(0)
					.concat(levels.slice(-count))
	);
</script>

<div class="voice-acts">
	<button
		type="button"
		class="voice-act voice-act-close"
		onclick={() => (ui.voice = false)}
		aria-label="閉じる"
		title="閉じる"
	>
		<Icon name="ic-x" size={20} />
	</button>
	<div class="voice-wave" bind:this={wrap} aria-hidden="true">
		{#each dots as v, i (i)}
			<span class="voice-dot" style:opacity={0.25 + 0.75 * v} style:scale={1 + 0.5 * v}></span>
		{/each}
	</div>
	{#if hearing.live}
		<button
			type="button"
			class="voice-act voice-act-stop"
			onclick={() => {
				/* 止めたら聞き取りを終え、聞き取った文字を依頼バーの入力欄に移す。
				   手で直してから送れる (ChatGPT の音声入力と同じ。ユーザー指摘 2026-09-24) */
				hearing.stop();
				dictated.text = hearing.heard;
				ui.voice = false;
			}}
			aria-label="聞き取りを止めて入力欄に入れる"
			title="聞き取りを止めて入力欄に入れる"
		>
			<Icon name="ic-stop" size={20} />
		</button>
	{/if}
	<button
		type="button"
		class="voice-act voice-act-send"
		onclick={() => hearing.send(400)}
		disabled={!hearing.heard.trim() || hearing.thinking}
		aria-label="KUROKO に送る"
		title="KUROKO に送る"
	>
		<Icon name="ic-arrow-up" size={20} />
	</button>
</div>
