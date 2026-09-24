<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { connect, markStarted } from '$lib/actions';
	import { CONNECT_NAME, CONNECT_BENEFIT, nextStep } from '$lib/connect';
	import type { Connection } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';

	/* 1 画面 1 サービス。[id] ルート側が id ごとに作り直す (key) ので、id が途中で変わることは考えない */
	let { id }: { id: Connection['id'] } = $props();

	const conns = $derived(db.settings.connections);
	const step = $derived(conns.findIndex((c) => c.id === id) + 1);
	const name = $derived(CONNECT_NAME[id]);
	/* 欧文で終わる名前 (Gmail など)は「を」の前に半角空白を入れるが、片仮名で終わる
	   「Google カレンダー」では不自然なので入れない。題も同じ文でそろえる */
	const heading = $derived(`${name}${/[A-Za-z0-9]$/.test(name) ? ' ' : ''}をつなぎます`);
	/* 戻るボタンで接続済みの画面に戻ってきた場合はここが true で始まる。
	   飛ばして次へ送り返すと戻るが効かなくなるので、済んだ姿のまま見せる */
	const done = $derived(conns.find((c) => c.id === id)?.connected ?? false);

	let busy = $state(false);
	let status = $state('');
	const timers: ReturnType<typeof setTimeout>[] = [];
	onDestroy(() => timers.forEach(clearTimeout));

	function advance() {
		/* 保留中のタイマーを先に消す。「接続する」の直後に「あとで」を押すと、飛ばした
		   はずのサービスが後から接続され、遷移も 2 本になる */
		timers.splice(0).forEach(clearTimeout);
		/* step が 0 = この id が一覧に無い。次が決まらないので導入画面へ戻す (fail-close) */
		if (step === 0) {
			goto('/connect', { replaceState: true });
			return;
		}
		const next = nextStep(conns, id);
		if (next) {
			goto(`/connect/${next}`);
		} else {
			markStarted();
			goto('/today');
		}
	}

	/* ラベル自体を「接続する」→「接続中…」と変える (NN/g State-Switch Controls)。即座に終わると押した実感がないので 600ms 待つ */
	function link() {
		if (busy || done) return;
		busy = true;
		status = `${name} 接続中…`;
		timers.push(
			setTimeout(() => {
				connect(id);
				busy = false;
			}, 600)
		);
	}

	/* チェックのアイコンを一拍見せてから自動で次へ進む。戻るで既に済んだ画面に来た場合も同じ経路 */
	$effect(() => {
		if (!done) return;
		status = `${name} 接続済み`;
		const t = setTimeout(advance, 800);
		return () => clearTimeout(t);
	});
</script>

<svelte:head><title>{heading} — KUROKO AI</title></svelte:head>

<!-- HIG Onboarding の page control 相当。点は飾りなので、まとめて 1 つの図形として読ませる -->
<div class="connect-steps in" role="img" aria-label="{conns.length} 段階中 {step} 段階目">
	{#each conns as c, i (c.id)}
		<span class:on={i === step - 1}></span>
	{/each}
</div>

<div class="public-main">
	<!-- connect-row.md 結論 1 — ブランドは公式アイコンをそのまま、操作要素は KUROKO の意匠 -->
	<Icon class="connect-mark in" name="b-{id}" size={64} />
	<h1 class="in" style="--delay: 130ms">{heading}</h1>
	<p class="muted in" style="--delay: 180ms">{CONNECT_BENEFIT[id]}</p>
</div>

<div class="public-foot">
	<!-- 押せない間も焦点を失わせないため disabled ではなく aria-disabled にする。
	     完了後は自動で次へ進むので、文言でなくチェックの形だけで完了を示す -->
	<button
		class="btn pri public-cta connect-cta in"
		style="--delay: 240ms"
		aria-disabled={busy || done}
		onclick={link}
	>
		{#if done}<Icon name="ic-check" size={18} />{:else if busy}<span class="spinner" aria-hidden="true"></span>{/if}
		{done ? '' : busy ? '接続中…' : '接続する'}
	</button>
	<!-- 未接続の間だけ「あとで」を出す。完了後は自動で次へ進むので副操作は不要 -->
	{#if !done}
		<button class="btn text in" style="--delay: 290ms" onclick={advance}>あとで</button>
	{/if}
</div>
<p class="sr-only" aria-live="polite">{status}</p>
