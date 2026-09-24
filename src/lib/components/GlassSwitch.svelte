<script lang="ts">
	import { pressGlass } from '$lib/glass';

	/* スイッチ。形と動きは .cal-switch と同じで、押している間だけつまみがガラスになる (glass.ts の pressGlass)。
	   つまみは描画面を載せるので疑似要素ではなく要素。中身は <input role="switch"> */
	let {
		checked,
		label,
		onchange
	}: { checked: boolean; label: string; onchange: () => void } = $props();

	let knob: HTMLSpanElement | undefined = $state();
	let pressed = $state(false);
	const glassy = pressGlass((p) => (pressed = p), 240);
	$effect(() => glassy.release);
</script>

<svelte:window onpointerup={glassy.lift} onpointercancel={glassy.lift} onblur={glassy.lift} />
<span class="switch" class:on={checked}>
	<input
		type="checkbox"
		role="switch"
		aria-label={label}
		{checked}
		onchange={() => {
			onchange();
			// 行の文字を押したときやキーボードでは pointerdown がこの input に来ないので、
			// 切り替わった時点でもガラスにして、つまみが動く間だけ残す
			if (knob) glassy.press(knob);
			glassy.lift();
		}}
		onpointerdown={() => knob && glassy.press(knob)}
	/>
	<span class="switch-knob" class:pressed bind:this={knob}></span>
</span>
