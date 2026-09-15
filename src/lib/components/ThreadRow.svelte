<script lang="ts">
	import type { MessageThread } from '$lib/types';
	import { REASON_LABEL } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { severestReason } from '$lib/derived';
	import { parse, rel } from '$lib/dates';

	let {
		thread,
		on,
		onselect
	}: { thread: MessageThread; on: boolean; onselect: () => void } = $props();

	const SOURCE: Record<MessageThread['source'], string> = {
		gmail: 'Gmail',
		slack: 'Slack',
		line: 'LINE',
		gcal: 'カレンダー',
		kuroko: 'KUROKO'
	};

	// バッジは 2 個まで (仕様 5.3)。出所 1 個と、最も深刻な選別理由 1 個だけを出す
	const reason = $derived(severestReason(thread));
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
		<span class="sender">{thread.sender}</span>
		<span class="num when">{when}</span>
	</span>
	<span class="subject" class:need={thread.needsReply}>{thread.subject}</span>
	<span class="line">
		<span class="badge src">{SOURCE[thread.source]}</span>
		{#if reason}<span class="badge">{REASON_LABEL[reason]}</span>{/if}
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
	}
	.sender {
		color: var(--ink-2);
		font-size: 14px;
	}
	.when {
		flex: none;
		color: var(--ink-3);
		font-size: 12px;
	}
	.subject {
		font-size: 16px;
	}
	/* 返信が要る行だけ件名を太くする (仕様 5.3 の「選択中の行は常時強調」とは別の合図) */
	.subject.need {
		font-weight: 700;
	}
	.badge {
		flex: none;
	}
</style>
