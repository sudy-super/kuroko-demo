<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	/* 会社・人物・案件・会議の詳細の枠。戻るリンク、見出し、見出しの下の説明、右端の操作、
	   カードの段。item が無いときは説明と操作を出さず、missing の文を出す */
	let {
		back,
		item,
		title,
		missing,
		sub,
		action,
		cardsClass,
		children
	}: {
		back: { href: string; label: string };
		item: T | undefined;
		title: (item: T) => string;
		missing: string;
		sub?: Snippet<[T]>;
		action?: Snippet<[T]>;
		cardsClass?: string;
		children: Snippet<[T]>;
	} = $props();
</script>

<div class="people">
	<header class="people-head">
		<a class="btn text sm people-back" href={back.href}>
			<Icon name="ic-left" size={18} />{back.label}
		</a>
		<div class="people-title">
			<h1>{item ? title(item) : '見つかりません'}</h1>
			{#if item}{@render sub?.(item)}{/if}
		</div>
		{#if item}{@render action?.(item)}{/if}
	</header>

	{#if !item}
		<p class="people-missing">{missing}</p>
	{:else}
		<!-- コンテンツ層なのでガラスは使わない (HIG Materials) -->
		<div class={['people-cards', cardsClass]}>
			{@render children(item)}
		</div>
	{/if}
</div>
