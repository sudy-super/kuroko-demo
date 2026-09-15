<script lang="ts">
	import type { MessageThread } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { parse, rel } from '$lib/dates';
	import Icon from './Icon.svelte';
	import ReplyBox from './ReplyBox.svelte';

	let { thread, ondone }: { thread: MessageThread; ondone: () => void } = $props();

	const messages = $derived(
		db.messages.filter((m) => m.threadId === thread.id).sort((a, b) => a.at.localeCompare(b.at))
	);
	// 時刻の 1 桁時はそのまま出す (一覧の行と同じ見せ方)
	const stamp = (at: string) =>
		`${rel(parse(at.slice(0, 10)), parse(db.seededOn))} ${at.slice(11, 16).replace(/^0/, '')}`;
</script>

<article class="card thread" aria-label="メールの本文">
	<header class="thread-head">
		<h1>{thread.subject}</h1>
		<p class="sender">{thread.sender}</p>
	</header>

	{#each messages as m (m.id)}
		<div class="msg" class:mine={m.from === 'me'}>
			<p class="stamp">
				{m.from === 'me' ? '送信済み' : thread.sender} {stamp(m.at)}
			</p>
			<p class="body">{m.body}</p>
		</div>
	{/each}

	<div class="row thread-actions">
		<button class="btn sec" onclick={ondone}>
			<Icon name="ic-check" size={18} />対応済みにする
		</button>
	</div>
</article>

<ReplyBox {thread} />

<style>
	.thread {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.thread-head h1 {
		margin: 0;
		font-size: 24px;
	}
	.sender {
		margin: var(--sp-1) 0 0;
		color: var(--ink-2);
		font-size: 14px;
	}
	.msg {
		max-width: 640px;
	}
	/* 自分が出した分は右に寄せる (仕様 5.3)。文章の行頭はそろえたいので、寄せるのは塊だけ */
	.msg.mine {
		margin-left: auto;
	}
	.stamp {
		margin: 0 0 var(--sp-2);
		color: var(--ink-3);
		font-size: 12px;
	}
	.msg.mine .stamp {
		text-align: right;
	}
	.body {
		margin: 0;
		padding: var(--sp-4);
		border-radius: var(--r-m);
		background: #fff;
		box-shadow: inset 0 0 0 1px var(--line);
		white-space: pre-wrap;
	}
	.msg.mine .body {
		background: var(--accent-soft-2);
		box-shadow: none;
	}
	.thread-actions {
		margin-top: var(--sp-2);
	}
</style>
