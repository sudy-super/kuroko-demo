<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { queue } from '$lib/derived';
	import { PRIMARY, SECONDARY, isActive, guideTarget, type NavItem } from '$lib/nav';
	import Icon from './Icon.svelte';
	import { glass, CLEAR } from '$lib/glass';

	const inbox = $derived(queue(db).length);
	const target = $derived(db.demo.guide.on ? guideTarget(db) : null);
</script>

{#snippet item(nav: NavItem)}
	{@const on = isActive(page.url.pathname, nav.href)}
	<a
		class="nav-item"
		class:on
		class:pulse={target === nav.href}
		href={nav.href}
		data-guide-target={nav.href}
		aria-current={on ? 'page' : undefined}
	>
		<Icon name={nav.icon} size={20} />
		<span>{nav.label}</span>
		{#if nav.href === '/inbox' && inbox > 0}
			<span class="badge count num">{inbox}<span class="sr-only">件の要対応</span></span>
		{/if}
	</a>
{/snippet}

<nav class="sidebar" aria-label="画面の切り替え" {@attach glass(CLEAR)}>
	{#each PRIMARY as nav (nav.href)}{@render item(nav)}{/each}
	<hr class="nav-sep" />
	<div class="nav-head">その他</div>
	{#each SECONDARY as nav (nav.href)}{@render item(nav)}{/each}
</nav>
