<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { chatSend } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import { GUIDE_CHIPS, thinking } from '$lib/kuroko/route';
	import ChatCard from '$lib/components/ChatCard.svelte';
	import Icon from '$lib/components/Icon.svelte';

	// 考えている間に何をしているかを書く (chat.md 観点 3.1)。空文字の間は待っていない
	let busy = $state('');
	let logEl: HTMLDivElement | undefined = $state();

	async function send(text: string) {
		if (busy) return;
		busy = thinking(db, text, ui.context ?? undefined);
		const before = db.chat.length;
		await chatSend(text, ui.context ?? undefined);
		busy = '';
		// 末尾まで飛ばさず、新しい発言の先頭に位置を合わせる (chat.md 観点 1.4)。
		// behavior を指定しなければ既定の auto = 即時なので prefers-reduced-motion と食い違わない
		await tick();
		logEl?.children[before]?.scrollIntoView({ block: 'nearest' });
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

	<!-- chat.md 観点 6.1 — 発言の積み上がりは role="log" で伝える (W3C ARIA23 の例 1 がチャットそのもの)。
	     暗黙で aria-live="polite" / aria-atomic="false" を持つので、足された分だけが割り込まずに読まれる。
	     入れ物は最初から DOM に置く (同 6.2) -->
	<div class="chat-log" role="log" aria-label="KUROKO とのやり取り" bind:this={logEl}>
		{#each db.chat as m (m.id)}
			<div class="chat-turn" class:mine={m.role === 'user'}>
				<!-- chat.md 観点 1.2 — 送り手は位置や色だけでなく名前でも示す。
				     Carbon for AI (資料 10) が求める「AI であることの表示」も兼ねる -->
				<p class="chat-who">
					{#if m.role === 'kuroko'}<Icon name="ic-robot" size={16} />{/if}
					{m.role === 'kuroko' ? 'KUROKO' : db.user.name}
				</p>
				{#if m.text}<p class="chat-body">{m.text}</p>{/if}
				{#if m.card}<ChatCard card={m.card} />{/if}
				{#if m.chips}
					<!-- chat.md 観点 2.6 — 話の枝分かれはチップ。必ず集合で出し、単独では置かない -->
					<div class="row chat-chips" role="group" aria-label="用件を選ぶ">
						{#each m.chips as c (c)}
							<button class="chip" aria-disabled={!!busy} onclick={() => send(c)}>{c}</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- chat.md 観点 3.3 — 待ちの表示は role="status" で伝える。WCAG 2.2 の 4.1.3 (レベル AA) の要求。
	     入れ物は常設し中身の文字だけ入れ替える (同 6.2。領域ごと出し入れすると読まれない)。
	     生成中の演出はこの 1 か所だけにする (同 3.4。Atlassian「目を引く生成中表示を重ねるな」) -->
	<p class="chat-busy" role="status">{busy}</p>

	{#if db.chat.length === 0 && !busy}
		<!-- chat.md 観点 4.5 — 扱える用件を最初に示す。「何でもどうぞ」と言わない -->
		<div class="chat-empty">
			<p>次のどれをお手伝いしましょうか?</p>
			<div class="row chat-chips" role="group" aria-label="用件を選ぶ">
				{#each GUIDE_CHIPS as c (c)}
					<button class="chip" onclick={() => send(c)}>{c}</button>
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
		/* 吹き出しの形や左右への振り分けを規定した一次資料は無い (chat.md 観点 1.1)。
		   既存の ThreadView.svelte (.msg) と同じ寄せ方にそろえる。ただし割合では詰めない:
		   カードの中のボタンは折り返さないので、幅 360px では 85% (245px) がカードの
		   最小幅 (250px) を下回り、カードが行からはみ出す。文だけの ThreadView と違い、
		   ここは中身が縮まない。送り手は名前でも示しているので割合の余白は要らない
		   (chat.md 観点 1.2) */
		max-width: min(640px, 100%);
	}
	.chat-turn.mine {
		margin-left: auto;
		align-items: flex-end;
	}
	.chat-who {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--ink-3);
		font-size: 12px;
	}
	.chat-body {
		padding: var(--sp-4);
		border-radius: var(--r-m);
		background: #fff;
		box-shadow: inset 0 0 0 1px var(--line);
		white-space: pre-wrap;
		/* 高さを決め打ちしないので、折り返した分だけ伸びる (下の行に重ならない) */
		overflow-wrap: anywhere;
	}
	.chat-turn.mine .chat-body {
		background: var(--accent-soft);
		box-shadow: none;
	}
	/* chat.md 観点 2.7 — 横一列に並べ、あふれたら折り返す。間隔は最低 8dp (--sp-2) */
	.chat-chips {
		flex-wrap: wrap;
		gap: var(--sp-2);
	}
	/* 同じ節が押せる領域を最低 48dp と規定する。app.css の .chip は 40px + ::after の
	   inset: -2px 0 で 44px (components 3.4 の値) なので、この画面の分だけ 48px まで広げる。
	   行の間隔は 8px あるので、広げた領域どうしが重なることはない */
	.chat-chips .chip::after {
		inset: -4px 0;
	}
	.chat-busy {
		padding: var(--sp-3) var(--sp-5) 0;
		color: var(--ink-2);
		font-size: 13px;
	}
	/* 待っていない間も入れ物は残す (読み上げのため)。空の行が余白を作らないようにする */
	.chat-busy:empty {
		padding: 0;
	}
	.chat-empty {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-5);
		color: var(--ink-2);
	}
</style>
