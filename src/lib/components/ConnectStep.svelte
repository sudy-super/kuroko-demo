<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { connect, markStarted } from '$lib/actions';
	import { CONNECT_NAME, CONNECT_BENEFIT, nextStep } from '$lib/connect';
	import type { Connection } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';

	/* 裁定 1・3 — 1 画面 1 サービス。id ごとに [id] ルート側で作り直す (key) ので、
	   ここでは id が途中で変わることを考えない */
	let { id }: { id: Connection['id'] } = $props();

	const conns = $derived(db.settings.connections);
	const step = $derived(conns.findIndex((c) => c.id === id) + 1);
	const name = $derived(CONNECT_NAME[id]);
	/* 戻るボタンで接続済みの画面に戻ってきた場合はここが true で始まる。
	   飛ばして次へ送り返すと戻るが効かなくなるので、済んだ姿のまま見せる */
	const done = $derived(conns.find((c) => c.id === id)?.connected ?? false);

	let busy = $state(false);
	let status = $state('');
	const timers: ReturnType<typeof setTimeout>[] = [];
	onDestroy(() => timers.forEach(clearTimeout));

	function advance() {
		const next = nextStep(conns, id);
		if (next) {
			goto(`/connect/${next}`);
		} else {
			markStarted();
			goto('/today');
		}
	}

	/* 裁定 4 — ラベル自体を「接続する」→「接続中…」→「接続済み」と変える
	   (NN/g State-Switch Controls)。実際の認証は行わないが、即座に終わると
	   押した実感がないので 600ms 待ち、完了を 800ms 見せてから次の画面へ送る */
	function link() {
		if (busy || done) return;
		busy = true;
		status = `${name} 接続中…`;
		timers.push(
			setTimeout(() => {
				connect(id);
				busy = false;
				status = `${name} 接続済み`;
				timers.push(setTimeout(advance, 800));
			}, 600)
		);
	}
</script>

<svelte:head><title>{name} をつなぐ — KUROKO AI</title></svelte:head>

<!-- HIG Onboarding の page control 相当。点は飾りなので、まとめて 1 つの図形として読ませる -->
<div class="connect-steps in" role="img" aria-label="4 段階中 {step} 段階目">
	{#each conns as c, i (c.id)}
		<span class:on={i === step - 1}></span>
	{/each}
</div>

<div class="public-main">
	<!-- connect-row.md 結論 1 — ブランドは公式アイコンをそのまま、操作要素は KUROKO の意匠 -->
	<Icon class="connect-mark in" name="b-{id}" size={64} />
	<h1 class="in" style="--delay: 130ms">{name} をつなぎます</h1>
	<p class="muted in" style="--delay: 180ms">{CONNECT_BENEFIT[id]}</p>
</div>

<div class="public-foot">
	<!-- 押せない間も焦点を失わせないため disabled ではなく aria-disabled にする -->
	<button
		class="btn pri public-cta connect-cta in"
		style="--delay: 240ms"
		aria-disabled={busy || done}
		onclick={link}
	>
		{#if done}<Icon name="ic-check" size={18} />{/if}
		{busy ? '接続中…' : done ? '接続済み' : '接続する'}
	</button>
	<button class="btn text in" style="--delay: 290ms" onclick={advance}>あとで</button>
</div>
<p class="sr-only" aria-live="polite">{status}</p>
