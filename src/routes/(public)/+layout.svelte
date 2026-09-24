<script lang="ts">
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import Orb from '$lib/components/Orb.svelte';
	import { innerWidth } from 'svelte/reactivity/window';
	import { fluid } from '$lib/fluid';

	let { children } = $props();

	/* Welcome はオーブが主役。導入画面 (/connect) は一段小さく、サービスの画面
	   (/connect/<id>) はブランドアイコンが主役なのでさらに小さくする。
	   同じ <Orb> のまま size だけ変える (再マウントすると WebGL の文脈を作り直す) */
	const step = $derived(page.url.pathname.startsWith('/connect/'));
	const intro = $derived(page.url.pathname === '/connect');
	/* 相手側の日程選択 (/schedule/<token>) は取引先が開く画面なのでオーブは出さず、日時を選ぶことに集中させる */
	const schedule = $derived(page.url.pathname.startsWith('/schedule/'));
	/* 480〜800px の間で線形に補間し、境目をまたいでも値が飛ばないようにする */
	const w = $derived(innerWidth.current ?? 1440);
	const size = $derived(
		step ? fluid(w, 480, 800, 170, 220) : intro ? fluid(w, 480, 800, 260, 380) : fluid(w, 480, 800, 300, 480)
	);

	/* 横スライドの画面遷移。startViewTransition が無いブラウザでは何もしない */
	onNavigate((nav) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await nav.complete;
			});
		});
	});
</script>

<div class="public">
	<div class="public-col">
		{#if !schedule}<Orb {size} />{/if}
		{@render children()}
	</div>
</div>
