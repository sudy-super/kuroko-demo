<script lang="ts">
	import type { ChatCard } from '$lib/types';
	import { chatAct } from '$lib/actions';
	import Icon from './Icon.svelte';

	let { card }: { card: ChatCard } = $props();

	const titleId = $props.id();
</script>

<!-- 仕様 5 — 提案には必ず「なぜこれを出したか」の 1 行を付ける -->
<section class="card chat-card" aria-labelledby={titleId}>
	<div class="tc-head">
		<Icon name={card.icon} size={20} />
		<h3 id={titleId}>{card.title}</h3>
	</div>
	<div class="tc-body chat-lines">
		{#each card.lines as line (line)}<p>{line}</p>{/each}
	</div>
	{#if card.reason}<p class="chat-reason">{card.reason}</p>{/if}
	<!-- buttons.md 観点 A + research-repeated-primary.md — 発言が積み上がる画面なので、
	     カードごとに塗りの主ボタンを置くと画面中に塗りが並ぶ。Carbon が繰り返しのカードを
	     名指しで tertiary / ghost としているのに倣い、塗りは使わず枠と文字だけで段を付ける -->
	<div class="row chat-actions">
		{#each card.actions as a, i (a.act)}
			<button class="btn {i === 0 ? 'sec' : 'text'} sm" onclick={() => chatAct(a.act, a.arg ?? '')}>
				{a.label}
			</button>
		{/each}
	</div>
</section>

<style>
	.chat-card {
		gap: var(--sp-2);
		display: flex;
		flex-direction: column;
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
	.chat-reason {
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
