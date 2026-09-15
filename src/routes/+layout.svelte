<script lang="ts">
	import '../app.css';
	import Icons from '$lib/components/Icons.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();

	// 変位写像。R が横、G が縦のずれを表し、128 がずれなしを意味する。
	// 縁の 16% だけを 255 または 0 に振り、中央は 128 のまま置く。これでガラスの縁だけが
	// 背景を引き寄せて曲がって見え、中央は素通しになる (記事 5)。
	const map = (dir: 'x' | 'y') => {
		const [x2, y2] = dir === 'x' ? [1, 0] : [0, 1];
		const [hi, mid] = dir === 'x' ? ['ff0000', '800000'] : ['00ff00', '008000'];
		return (
			`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E` +
			`%3ClinearGradient id='g' x1='0' y1='0' x2='${x2}' y2='${y2}'%3E` +
			`%3Cstop offset='0' stop-color='%23${hi}'/%3E` +
			`%3Cstop offset='.16' stop-color='%23${mid}'/%3E` +
			`%3Cstop offset='.84' stop-color='%23${mid}'/%3E` +
			`%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E` +
			`%3Crect width='200' height='200' fill='url(%23g)'/%3E%3C/svg%3E`
		);
	};
</script>

<Icons />

<!-- 記事 5 — 屈折に使う変位写像。display: none にすると参照が切れるので寸法 0 で置く -->
<svg class="filter-defs" aria-hidden="true" focusable="false">
	<filter id="lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
		<feImage preserveAspectRatio="none" href={map('x')} result="mx" />
		<feImage preserveAspectRatio="none" href={map('y')} result="my" />
		<feBlend in="mx" in2="my" mode="screen" result="map" />
		<feDisplacementMap
			in="SourceGraphic"
			in2="map"
			scale="56"
			xChannelSelector="R"
			yChannelSelector="G"
		/>
	</filter>
</svg>

<div class="bg" aria-hidden="true">
	<div class="bg-blob a"></div>
	<div class="bg-blob b"></div>
	<div class="bg-blob c"></div>
	<div class="bg-blob d"></div>
	<div class="bg-blob e"></div>
</div>

{@render children()}

<Toast />
