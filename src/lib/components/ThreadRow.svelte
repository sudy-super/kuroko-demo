<script lang="ts">
	import type { MessageThread } from '$lib/types';
	import { REASON_ORDER } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { threadSenderMeta } from '$lib/derived';
	import { parse, rel } from '$lib/dates';
	import SourceIcon from './SourceIcon.svelte';
	import ReasonIcon from './ReasonIcon.svelte';

	let {
		thread,
		on,
		onselect
	}: { thread: MessageThread; on: boolean; onselect: () => void } = $props();

	/* 行に出す理由は重い順に 2 個まで (indicators.md 2 節「1 画面のインジケーターは 5〜6 個まで」)。
	   残りはスレッドを開いたときの 1 行に出る */
	const reasons = $derived(REASON_ORDER.filter((r) => thread.reasons.includes(r)).slice(0, 2));
	const day = $derived(rel(parse(thread.lastAt.slice(0, 10)), parse(db.seededOn)));
	// 時刻は画面の他の場所と同じく 1 桁時をそのまま出す (8:05 と 08:05 を混ぜない)
	const when = $derived(day === '今日' ? thread.lastAt.slice(11, 16).replace(/^0/, '') : day);
	// Task 10p (参考の良い点 6) — 差出人 / 会社 / 返信数 / 時刻を 1 行にまとめる。
	// 組み立ては threadSenderMeta に集約 (10p 修正ラウンド 1、Critical 参照)
	const meta = $derived(threadSenderMeta(db, thread));
	// 10p 修正ラウンド 1 (Minor 1) — 実際は返信数ではなくスレッドのやり取りの総数。
	// 変数名も表示も「返信」に寄っていたので、読み上げに「のやり取り」を足して数の意味を補う
	const replies = $derived(db.messages.filter((m) => m.threadId === thread.id).length);
</script>

<a
	class="list-row inbox"
	class:on
	href="/inbox?t={thread.id}"
	data-sveltekit-replacestate
	data-sveltekit-noscroll
	aria-current={on ? 'true' : undefined}
	onclick={onselect}
>
	<span class="inbox-lines">
		<span class="line">
			<SourceIcon source={thread.source} />
			<span class="sender">{meta}</span>
			<span class="num replies">{replies}件<span class="sr-only">のやり取り</span></span>
			<span class="num when">{when}</span>
		</span>
		<span class="line">
			<span class="subject">{thread.subject}</span>
			{#each reasons as r (r)}<ReasonIcon reason={r} />{/each}
		</span>
	</span>
</a>

<style>
	.inbox-lines {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: center;
		gap: var(--sp-1);
		min-width: 0;
	}
	.line {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-width: 0;
	}
	.sender,
	.subject {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sender {
		flex: 1;
		color: var(--ink-2);
		font-size: 14px;
	}
	.replies,
	.when {
		flex: none;
		color: var(--ink-3);
		font-size: 12px;
	}
	/* この一覧に出るのは要対応キューの行だけなので、件名は常に太字 (仕様 5.3) */
	.subject {
		flex: 1;
		font-size: 16px;
		font-weight: 700;
	}
</style>
