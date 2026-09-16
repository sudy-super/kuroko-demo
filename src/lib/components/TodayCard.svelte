<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		card,
		title,
		icon,
		href,
		onclick,
		children
	}: {
		/* Task 10t 修正ラウンド 2 — カードの種類。app.css の環状配置がこれで位置を選ぶ
		   (:nth-child だと枚数が変わったときに割り当てがずれるため。review task-10t-fix I1) */
		card: string;
		title: string;
		icon: string;
		href?: string;
		onclick?: () => void;
		children: Snippet;
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
	<a class="card tc" data-card={card} {href} {onclick} aria-labelledby={titleId}
		>{@render inner()}</a
	>
{:else if onclick}
	<!-- ボタンは中身から名前を作る。aria-label を足すと中の行が読み上げから落ちる -->
	<button type="button" class="card tc" data-card={card} {onclick}>{@render inner()}</button>
{:else}
	<section class="card tc" data-card={card} aria-label={title}>{@render inner()}</section>
{/if}
