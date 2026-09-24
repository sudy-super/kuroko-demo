<script lang="ts">
	import { LiquidGlassSwitch } from 'apple-liquid-glass-webgl';

	/* iOS 26 のスイッチ。つまみは押している間だけ膨らんで Liquid Glass になる
	   (WWDC25「Build a SwiftUI app with the new design」— toggles は操作の間 liquid glass に変わる)。
	   描くのは apple-liquid-glass-webgl の LiquidGlassSwitch。role="switch" と aria-checked、
	   Space キーでの切り替えもライブラリが持つ。描画面は 1 つずつ使うので、1 画面に並べるのは
	   数個まで (上限は 1 ページ約 16。visible.ts の注記) */
	let {
		checked,
		label,
		onchange
	}: { checked: boolean; label: string; onchange: (checked: boolean) => void } = $props();

	let sw: LiquidGlassSwitch | undefined;

	function mount(node: HTMLElement) {
		sw = new LiquidGlassSwitch(node, {
			checked,
			ariaLabel: label,
			color: getComputedStyle(node).getPropertyValue('--accent').trim(),
			onChange: (v) => onchange(v)
		});
		return () => {
			sw?.destroy();
			sw = undefined;
		};
	}

	// 外から状態が変わったとき (デモのリセットなど) はつまみを合わせる。onChange は呼ばない
	$effect(() => {
		if (sw && sw.checked !== checked) sw.setChecked(checked);
	});
</script>

<span class="glass-switch" {@attach mount}></span>
