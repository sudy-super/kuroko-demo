<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		title,
		icon,
		href,
		onclick,
		children
	}: {
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
	<a class="card tc" {href} {onclick} aria-labelledby={titleId}>{@render inner()}</a>
{:else if onclick}
	<!-- ボタンは中身から名前を作る。aria-label を足すと中の行が読み上げから落ちる -->
	<button type="button" class="card tc" {onclick}>{@render inner()}</button>
{:else}
	<section class="card tc" aria-label={title}>{@render inner()}</section>
{/if}
