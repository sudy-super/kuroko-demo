<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { connectAll, markStarted } from '$lib/actions';
	import { nextStep } from '$lib/connect';

	/* 裁定 2 — 導入画面に一覧は置かない。4 つを一度に見せない (ユーザー判定) */
	function open(all: boolean) {
		if (all) connectAll();
		markStarted();
		goto('/today');
	}

	// 接続済みの画面は飛ばすので、入口は「残っている最初の 1 つ」になる
	function one() {
		const next = nextStep(db.settings.connections);
		if (next) goto(`/connect/${next}`);
		else open(false);
	}
</script>

<svelte:head><title>接続 — KUROKO AI</title></svelte:head>

<div class="public-main">
	<h1 class="in" style="--delay: 80ms">使うツールをつなぎます</h1>
	<p class="muted in" style="--delay: 130ms">各 1 クリック、合計 10 秒。あとから設定で変更できます。</p>
</div>

<div class="public-foot">
	<button class="btn pri public-cta in" style="--delay: 200ms" onclick={() => open(true)}>
		4 つすべて接続して開く
	</button>
	<button class="btn text in" style="--delay: 250ms" onclick={one}>1 つずつ接続する</button>
	<button class="btn text in" style="--delay: 300ms" onclick={() => open(false)}>
		スキップして開く
	</button>
</div>
