<script lang="ts">
	import type { ChatCard } from '$lib/types';
	import { chatAct } from '$lib/actions';
	import Icon from './Icon.svelte';

	let { card }: { card: ChatCard } = $props();

	const titleId = $props.id();
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
	<!-- chat.md 観点 2.6 — 作業を確定させる操作はボタン (M3「チップで作業を確定・前進させるな」)。
	     buttons.md 観点 A + research-repeated-primary.md — 発言が積み上がる画面なので、カードごとに
	     塗りの主ボタンを置くと画面中に塗りが並ぶ。Carbon が繰り返しのカードを名指しで
	     tertiary / ghost としているのに倣い、塗りは使わず枠と文字だけで段を付ける -->
	<div class="row chat-actions">
		{#each card.actions as a, i (a.act)}
			<button class="btn {i === 0 ? 'sec' : 'text'} sm" onclick={() => chatAct(a.act, a.arg ?? '')}>
				{a.label}
			</button>
		{/each}
	</div>
	<!-- chat.md 観点 2.2 — 「押すまで確定しない」性質は伝えないと「もう作られたのか」と誤解される -->
	{#if card.actions.some((a) => a.act === 'create-event' || a.act === 'add-task')}
		<p class="chat-note">押すまで保存されません</p>
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
</style>
