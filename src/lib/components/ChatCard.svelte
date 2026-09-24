<script lang="ts">
	import type { ChatCard } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { chatAct } from '$lib/actions';
	import Icon from './Icon.svelte';

	let { card }: { card: ChatCard } = $props();

	const titleId = $props.id();

	/* 押すたびに db が増える操作 (予定と ToDo の登録) は、その候補 (Suggestion) の状態を見る。
	   /tasks の SuggestionCard も同じ候補を扱うので、どちらで登録しても両方の表示が揃う */
	const consuming = $derived(
		card.actions.find((a) => a.act === 'create-event' || a.act === 'add-task')
	);
	const suggestion = $derived(db.suggestions.find((s) => s.id === consuming?.arg));
	const settled = $derived(suggestion && suggestion.status !== 'pending' ? suggestion : undefined);
</script>

<!-- 仕様 5 — 提案には必ず「なぜこれを出したか」の 1 行を付ける。
     chat.md 観点 2.1 — カードは「1 つの主題に関する内容と操作」の単位 (M3 Cards、資料 5)。
     文だけで足りる返答にはこの部品を使わない (使う側が card を持たせない) -->
<section class="card chat-card" aria-labelledby={titleId}>
	<div class="tc-head">
		<Icon name={card.icon} size={20} />
		<h3 id={titleId}>{card.title}</h3>
	</div>
	<div class="tc-body chat-lines">
		{#each card.lines as line (line)}<p>{line}</p>{/each}
	</div>
	{#if card.reason}<p class="chat-reason">{card.reason}</p>{/if}
	<!-- 押すたびに予定や ToDo が増える操作は一度で終わらせ、済んだことを出す (HIG "provide a clear signal ...")。
	     後から押せるままにするのは「開く」のような何度押しても同じ操作だけ (chat.md 観点 5.2) -->
	{#if settled}
		<p class="chat-done">
			<Icon name={settled.status === 'accepted' ? 'ic-check' : 'ic-x'} size={20} />
			{settled.status === 'accepted'
				? settled.kind === 'event'
					? '予定を登録しました'
					: 'ToDo を登録しました'
				: '破棄しました'}
		</p>
	{:else}
		<!-- 確定の操作はボタン (M3「チップで作業を確定させるな」)。発言が積み上がる画面なので塗りは使わず、
		     枠と文字だけで段を付ける (Carbon の繰り返しのカードは tertiary / ghost) -->
		<div class="row chat-actions">
			{#each card.actions as a, i (a.act)}
				<button class="btn {i === 0 ? 'sec' : 'text'} sm" onclick={() => chatAct(a.act, a.arg ?? '')}>
					{a.label}
				</button>
			{/each}
		</div>
		<!-- chat.md 観点 2.2 — 「押すまで確定しない」性質は伝えないと「もう作られたのか」と誤解される -->
		{#if consuming}
			<p class="chat-note">押すまで保存されません</p>
		{/if}
	{/if}
</section>

<style>
	.chat-card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-4);
	}
	.chat-card h3 {
		margin: 0;
		font-size: 16px;
		color: var(--ink);
	}
	.chat-lines {
		gap: var(--sp-1);
		font-size: 14px;
		/* 長い題名や宛先は単語として切れないので、折り返せる位置を明示しないと列からはみ出す */
		overflow-wrap: anywhere;
	}
	.chat-reason,
	.chat-note {
		color: var(--ink-3);
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.chat-actions {
		flex-wrap: wrap;
		gap: var(--sp-2);
		margin-top: var(--sp-1);
	}
	.chat-done {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin-top: var(--sp-1);
		color: var(--ink-2);
		font-size: 14px;
	}
</style>
