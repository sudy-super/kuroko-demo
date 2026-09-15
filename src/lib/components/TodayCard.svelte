<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		size,
		title,
		icon,
		href,
		onclick,
		children
	}: {
		size: 'hero' | 'wide';
		title: string;
		icon: string;
		href?: string;
		onclick?: () => void;
		children: Snippet;
	} = $props();
</script>

{#snippet inner()}
	<div class="tc-head">
		<Icon name={icon} size={20} />
		<h2>{title}</h2>
	</div>
	<div class="tc-body">{@render children()}</div>
{/snippet}

<!-- visual 2.7 — タイルには aria-label を付け、DOM の順序を見た目の順序に合わせる -->
{#if href}
	<a class="card tc t-{size}" {href} {onclick} aria-label={title}>{@render inner()}</a>
{:else if onclick}
	<!-- ボタンは中身から名前を作る。aria-label を足すと中の行が読み上げから落ちる -->
	<button type="button" class="card tc t-{size}" {onclick}>{@render inner()}</button>
{:else}
	<section class="card tc t-{size}" aria-label={title}>{@render inner()}</section>
{/if}
