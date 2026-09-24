<script lang="ts">
	import { pressGlass } from '$lib/glass';

	/* スイッチ。形と動きは予定の入力の .cal-switch と同じで、押している間だけつまみが少し
	   膨らんでガラスになる (表示の切り替えのつまみと同じ。glass.ts の pressGlass)。
	   つまみはガラスの描画面を載せるので疑似要素ではなく要素にする。
	   中身は <input type="checkbox" role="switch"> なので、キーボードと読み上げはそのまま効く */
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
		onchange={() => onchange()}
		onpointerdown={() => knob && glassy.press(knob)}
	/>
	<span class="switch-knob" class:pressed bind:this={knob}></span>
</span>
