<script lang="ts">
	import type { MessageThread } from '$lib/types';
	import { REASON_ORDER, REASON_SENTENCE } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { threadSenderMeta } from '$lib/derived';
	import { parse, rel } from '$lib/dates';
	import Icon from './Icon.svelte';
	import SourceIcon from './SourceIcon.svelte';
	import ReplyBox from './ReplyBox.svelte';

	let {
		thread,
		ondone,
		onsender,
		senderHidden = false
	}: {
		thread: MessageThread;
		ondone: () => void;
		/** 差出人の行を押した。その行から差出人のパネルを広げる (inbox/+page.svelte) */
		onsender: (el: HTMLElement) => void;
		/** パネルが開いている間は行を隠す (パネルがこの行から広がって見えるように) */
		senderHidden?: boolean;
	} = $props();

	const messages = $derived(
		db.messages.filter((m) => m.threadId === thread.id).sort((a, b) => a.at.localeCompare(b.at))
	);
	// 時刻の 1 桁時はそのまま出す (一覧の行と同じ見せ方)
	const stamp = (at: string) =>
		`${rel(parse(at.slice(0, 10)), parse(db.seededOn))} ${at.slice(11, 16).replace(/^0/, '')}`;

	/* 一覧の行はアイコンだけなので、詳細では理由を文言で常時出す (NN/g「アイコンには可視のラベル」)。
	   単語をスラッシュで並べずに読点でつないだ 1 文にする */
	const why = $derived.by(() => {
		const rs = REASON_ORDER.filter((r) => thread.reasons.includes(r));
		if (!rs.length) return '';
		const heads = rs.slice(0, -1).map((r) => REASON_SENTENCE[r][0]);
		return [...heads, REASON_SENTENCE[rs[rs.length - 1]][1]].join('、') + '。';
	});

	// 組み立ては threadSenderMeta (生の thread.sender だと一覧の行と表記が食い違う)
	const senderMeta = $derived(threadSenderMeta(db, thread));
</script>

<article class="card thread" aria-label="メールの本文">
	<header class="thread-head">
		<h2>{thread.subject}</h2>
		<!-- 押すと差出人の情報がこの行から広がる (承認待ちのカードと同じ作り) -->
		<button
			class="sender"
			class:hidden={senderHidden}
			aria-haspopup="dialog"
			onclick={(e) => onsender(e.currentTarget)}
		>
			<SourceIcon source={thread.source} />{senderMeta}<Icon name="ic-chev" size={16} />
		</button>
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
		font-size: 24px;
	}
	/* 押せることが分かるよう、指を載せると地を敷き、末尾に山形を置く。
	   左の余白を詰めて、題名と文字の頭をそろえる */
	.sender {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-height: 36px;
		margin: var(--sp-1) 0 0 calc(var(--sp-2) * -1);
		padding: 0 var(--sp-2);
		border: 0;
		border-radius: var(--r-pill);
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: 14px;
		cursor: pointer;
		transition: background var(--d-fast) var(--ease-out);
	}
	.sender:hover {
		background: var(--hover);
	}
	.sender.hidden {
		visibility: hidden;
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
