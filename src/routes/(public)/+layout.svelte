<script lang="ts">
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import Orb from '$lib/components/Orb.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { children } = $props();

	/* Welcome はオーブが主役、接続画面では見出しの上のアイコンまで縮める。
	   同じ <Orb> のまま size だけ変える (再マウントすると WebGL の文脈を作り直す) */
	const narrow = new MediaQuery('(max-width: 640px)');
	const size = $derived(
		page.url.pathname === '/' ? (narrow.current ? 300 : 480) : narrow.current ? 160 : 200
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
		<Orb {size} />
		{@render children()}
	</div>
</div>
