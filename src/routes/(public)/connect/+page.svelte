<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { markStarted } from '$lib/actions';
	import { nextStep } from '$lib/connect';

	/* ユーザー指摘 2026-09-23 — 「4 つまとめて繋ぐ」は要らない、1 つずつで進める。
	   一括接続の経路 (connectAll) 自体をこの画面から外す */
	function skip() {
		markStarted();
		goto('/today');
	}

	// 接続済みの画面は飛ばすので、入口は「残っている最初の 1 つ」になる
	function one() {
		const next = nextStep(db.settings.connections);
		if (next) goto(`/connect/${next}`);
		else skip();
	}
</script>

<svelte:head><title>接続 — KUROKO AI</title></svelte:head>

<div class="public-main">
	<h1 class="in" style="--delay: 80ms">使うツールをつなぎます</h1>
	<p class="muted in" style="--delay: 130ms">1 つずつ、各 1 クリック。あとから設定で変更できます。</p>
</div>

<div class="public-foot">
	<button class="btn pri public-cta in" style="--delay: 200ms" onclick={one}>接続をはじめる</button>
	<button class="btn text in" style="--delay: 250ms" onclick={skip}>スキップして開く</button>
</div>
