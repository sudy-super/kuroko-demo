<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		card,
		title,
		icon,
		href,
		target,
		rel,
		onclick,
		expanded,
		children,
		...rest
	}: {
		/* Task 10t 修正ラウンド 2 — カードの種類。app.css の環状配置がこれで位置を選ぶ
		   (:nth-child だと枚数が変わったときに割り当てがずれるため。review task-10t-fix I1) */
		card: string;
		title: string;
		icon: string;
		href?: string;
		/* Task 10t 修正ラウンド 5 (review task-10t-fix4 I1) — 送信済みカードを外部の
		   相手の画面 (別タブ)へ飛ばすために要る */
		target?: string;
		rel?: string;
		onclick?: (e: MouseEvent & { currentTarget: HTMLElement }) => void;
		/* 承認パネルがこのカードから広がり、縮み終わるまでの間。カード自体を隠し、
		   同じ物が 2 つ見えないようにする (docs/research/card-expand.md)。ボタンでだけ使う */
		expanded?: boolean;
		children: Snippet;
		/* Today の環状配置のドラッグと音声の退き (style の translate、inert など)。
		   today/+page.svelte が渡す */
		[attr: string]: unknown;
	} = $props();

	/* 見出しを名前にする。aria-label だと中の行が読み上げから落ちる */
	const titleId = $props.id();
</script>

{#snippet inner()}
	<div class="tc-head">
		<Icon name={icon} size={20} />
		<h2 id={titleId}>{title}</h2>
	</div>
	<div class="tc-body">{@render children()}</div>
{/snippet}

<!-- visual 2.7 — タイルには名前を付け、DOM の順序を見た目の順序に合わせる -->
{#if href}
	<!-- draggable="false" — リンクはブラウザの既定でドラッグでき、カードのドラッグが
	     pointercancel で切れる (docs/research/card-drag.md) -->
	<a
		class="card tc"
		data-card={card}
		{href}
		{target}
		{rel}
		{onclick}
		aria-labelledby={titleId}
		draggable="false"
		{...rest}>{@render inner()}</a
	>
{:else if onclick}
	<!-- ボタンは中身から名前を作る。aria-label を足すと中の行が読み上げから落ちる -->
	<button
		type="button"
		class="card tc"
		data-card={card}
		{onclick}
		aria-expanded={expanded}
		{...rest}
		style:visibility={expanded ? 'hidden' : undefined}>{@render inner()}</button
	>
{:else}
	<section class="card tc" data-card={card} aria-label={title} {...rest}>{@render inner()}</section>
{/if}
