<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { chatSend } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import { GUIDE_CHIPS, route, workingText } from '$lib/kuroko/route';
	import ChatCard from '$lib/components/ChatCard.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let busy = $state(false);
	// 読み上げ利用者にも待機中 → 返答を伝える常設の live region (ReplyBox.svelte と同じ作り)。
	// 領域ごと出し入れすると aria-live は読まれない
	let liveText = $state('');
	// 待っている間の文は「処理中…」で済ませず、何をしているかを書く (route.ts の workingText)
	let working = $state('');
	let logEl: HTMLDivElement | undefined = $state();

	async function send(text: string) {
		if (busy) return;
		busy = true;
		working = workingText(route(db, text, ui.context ?? undefined));
		liveText = working;
		await chatSend(text, ui.context ?? undefined);
		busy = false;
		const last = db.chat[db.chat.length - 1];
		liveText = last?.text ?? last?.card?.title ?? '返答が届きました';
		// 積み上がった発言のいちばん下を見せる。behavior を指定しなければ即時なので
		// prefers-reduced-motion と食い違わない
		await tick();
		logEl?.lastElementChild?.scrollIntoView({ block: 'nearest' });
	}

	// 依頼バーと ⌘K パレットはここへ ?q= 付きで飛ばしてくる (KurokoBar.svelte / Palette.svelte)。
	// この画面から送ったときは行き先も /chat なので onMount は走らない。q の変化で拾う。
	// 送った後は ?q= を落とす (戻るたびに送り直さないため、履歴には積まずに差し替える)
	$effect(() => {
		const q = page.url.searchParams.get('q');
		if (!q) return;
		untrack(() => {
			goto('/chat', { replaceState: true, noScroll: true, keepFocus: true });
			send(q);
		});
	});
</script>

<svelte:head><title>KUROKO — KUROKO AI</title></svelte:head>

<div class="chat">
	<header class="page-head">
		<div class="page-title">
			<h1>KUROKO</h1>
			<p class="page-desc">
				下の依頼バーから話しかけてください。予定、ToDo、メール、会議準備、日程調整、資料の作成を引き受けます。
			</p>
		</div>
	</header>

	<div class="chat-log" bind:this={logEl}>
		{#each db.chat as m (m.id)}
			<div class="chat-turn" class:me={m.role === 'user'}>
				{#if m.role === 'kuroko'}
					<span class="chat-who"><Icon name="ic-robot" size={18} />KUROKO</span>
				{/if}
				{#if m.text}<p class="bubble" class:me={m.role === 'user'}>{m.text}</p>{/if}
				{#if m.card}<ChatCard card={m.card} />{/if}
				{#if m.chips}
					<div class="row chat-chips" role="group" aria-label="用件を選ぶ">
						{#each m.chips as c (c)}
							<button class="chip" aria-disabled={busy} onclick={() => send(c)}>{c}</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
		<p class="sr-only" aria-live="polite">{liveText}</p>
		{#if busy}<p class="chat-busy">{working}</p>{/if}
	</div>

	{#if db.chat.length === 0 && !busy}
		<div class="chat-empty">
			<p>次のどれをお手伝いしましょうか?</p>
			<div class="row chat-chips" role="group" aria-label="用件を選ぶ">
				{#each GUIDE_CHIPS as c (c)}
					<button class="chip" aria-disabled={busy} onclick={() => send(c)}>{c}</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.chat-log {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		padding: 0 var(--sp-5);
	}
	.chat-turn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-2);
		/* 発言はカードより幅を抑えて、誰の発言かを行の長さでも見分けられるようにする */
		max-width: min(640px, 100%);
	}
	.chat-turn.me {
		align-self: flex-end;
		align-items: flex-end;
	}
	.chat-who {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--ink-2);
		font-size: 13px;
	}
	.bubble {
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--r-m);
		background: #fff;
		box-shadow: inset 0 0 0 1px var(--line), var(--e1);
		font-size: 15px;
		line-height: 1.6;
		/* 高さを決め打ちしないので、折り返した分だけ吹き出しが伸びる (下の行に重ならない) */
		overflow-wrap: anywhere;
	}
	.bubble.me {
		background: var(--accent-soft);
		box-shadow: none;
	}
	.chat-chips {
		flex-wrap: wrap;
	}
	.chat-busy {
		color: var(--ink-2);
		font-size: 13px;
	}
	.chat-empty {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-5);
		color: var(--ink-2);
	}
</style>
