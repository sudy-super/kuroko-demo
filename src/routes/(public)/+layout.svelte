<script lang="ts">
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import Orb from '$lib/components/Orb.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { children } = $props();

	/* Welcome はオーブが主役。導入画面 (/connect) は一段小さく、サービスの画面
	   (/connect/<id>) はブランドアイコンが主役なのでさらに小さくする。
	   同じ <Orb> のまま size だけ変える (再マウントすると WebGL の文脈を作り直す) */
	const narrow = new MediaQuery('(max-width: 640px)');
	const step = $derived(page.url.pathname.startsWith('/connect/'));
	const intro = $derived(page.url.pathname === '/connect');
	/* Task 18 — 相手側の日程選択 (/schedule/<token>) は取引先が開く画面で、KUROKO の
	   世界観を見せる場ではない。オーブは出さず、日時を選ぶことだけに集中させる */
	const schedule = $derived(page.url.pathname.startsWith('/schedule/'));
	const size = $derived(
		step ? (narrow.current ? 170 : 220) : intro ? (narrow.current ? 260 : 380) : narrow.current ? 300 : 480
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
