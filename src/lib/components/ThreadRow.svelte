<script lang="ts">
	import type { MessageThread } from '$lib/types';
	import { REASON_ORDER } from '$lib/types';
	import { db } from '$lib/store.svelte';
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
	<span class="line">
		<SourceIcon source={thread.source} />
		<span class="sender">{thread.sender}</span>
		<span class="num when">{when}</span>
	</span>
	<span class="line">
		<span class="subject">{thread.subject}</span>
		{#each reasons as r (r)}<ReasonIcon reason={r} />{/each}
	</span>
</a>

<style>
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
