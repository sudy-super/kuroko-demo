<script lang="ts">
	import type { MessageThread } from '$lib/types';
	import { REASON_ORDER, REASON_SENTENCE } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { threadSenderMeta } from '$lib/derived';
	import { parse, rel } from '$lib/dates';
	import Icon from './Icon.svelte';
	import SourceIcon from './SourceIcon.svelte';
	import ReplyBox from './ReplyBox.svelte';

	let { thread, ondone }: { thread: MessageThread; ondone: () => void } = $props();

	const messages = $derived(
		db.messages.filter((m) => m.threadId === thread.id).sort((a, b) => a.at.localeCompare(b.at))
	);
	// 時刻の 1 桁時はそのまま出す (一覧の行と同じ見せ方)
	const stamp = (at: string) =>
		`${rel(parse(at.slice(0, 10)), parse(db.seededOn))} ${at.slice(11, 16).replace(/^0/, '')}`;

	/* indicators.md 3 節 — 一覧の行はアイコンだけにするかわりに、詳細側では理由を文言で常時出す
	   (NN/g「アイコンには可視のラベル」をここで満たす)。ただし単語をスラッシュで並べると
	   行から外したタグと同じ見え方になるので、読点でつないだ 1 文にする (audit 6) */
	const why = $derived.by(() => {
		const rs = REASON_ORDER.filter((r) => thread.reasons.includes(r));
		if (!rs.length) return '';
		const heads = rs.slice(0, -1).map((r) => REASON_SENTENCE[r][0]);
		return [...heads, REASON_SENTENCE[rs[rs.length - 1]][1]].join('、') + '。';
	});

	// 組み立ては threadSenderMeta に集約 (ThreadRow と同じ。rereview-task-10p.md 新規 2 —
	// 生の thread.sender のままだと一覧の行と開いたスレッドの頭で表記が食い違う)
	const senderMeta = $derived(threadSenderMeta(db, thread));
</script>

<article class="card thread" aria-label="メールの本文">
	<header class="thread-head">
		<h2>{thread.subject}</h2>
		<p class="sender"><SourceIcon source={thread.source} />{senderMeta}</p>
		{#if why}<p class="why">{why}</p>{/if}
	</header>

	{#each messages as m (m.id)}
		<div class="msg" class:mine={m.from === 'me'}>
			<p class="stamp">
				{m.from === 'me' ? '送信済み' : senderMeta} {stamp(m.at)}
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
	.thread-head h2 {
		margin: 0;
		font-size: 24px;
	}
	.sender {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin: var(--sp-1) 0 0;
		color: var(--ink-2);
		font-size: 14px;
	}
	.why {
		margin: var(--sp-1) 0 0;
		color: var(--ink-3);
		font-size: 14px;
	}
	/* 中央ペインは 1440px でも 370px ほどしかない。割合を混ぜないと塊が親いっぱいに広がり、
	   下の margin-left: auto が効かなくなる */
	.msg {
		max-width: min(640px, 85%);
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
		background: var(--accent-soft);
		box-shadow: none;
	}
	.thread-actions {
		margin-top: var(--sp-2);
	}
</style>
