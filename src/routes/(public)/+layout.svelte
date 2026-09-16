<script lang="ts">
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import Orb from '$lib/components/Orb.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { children } = $props();

	/* Welcome はオーブが主役。接続画面は Task 10f 追記で見直した。
	   小さいアイコンにすると接続一覧のガラスの下に何も来ず、縁が一律の面取りにしか見えない
	   (ユーザー判定)。箱を一覧の上端に食い込ませ、下半分の破片と光彩が一覧の下を通るようにする。
	   同じ <Orb> のまま size だけ変える (再マウントすると WebGL の文脈を作り直す) */
	const narrow = new MediaQuery('(max-width: 640px)');
	const connect = $derived(page.url.pathname !== '/');
	const size = $derived(
		connect ? (narrow.current ? 260 : 380) : narrow.current ? 300 : 480
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
	<div class="public-col" class:overlap={connect}>
		<Orb {size} />
		{@render children()}
	</div>
</div>
