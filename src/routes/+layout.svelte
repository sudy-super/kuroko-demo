<script lang="ts">
	import '../app.css';
	import Icons from '$lib/components/Icons.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();
</script>

<Icons />

<div class="bg" aria-hidden="true">
	<!-- 画面の左右の端に固定されるサイドナビと連携アイコンの列は、下を通る内容がない。
	     ガラスが一律の面取りに見えないよう、この 2 つの下にだけ青 1 色の淡い光彩を置く -->
	<div class="bg-glow left"></div>
	<div class="bg-glow right"></div>
</div>

{@render children()}

<Toast />
