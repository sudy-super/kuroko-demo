<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { badgeCount, queue } from '$lib/derived';
	import { PRIMARY, SECONDARY, UTILITY, isActive, guideTarget, type NavItem } from '$lib/nav';
	import Icon from './Icon.svelte';

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
			<span class="badge count num">{badgeCount(inbox)}<span class="sr-only">件の要対応</span></span>
		{/if}
	</a>
{/snippet}

<nav class="sidebar" aria-label="画面の切り替え">
	{#each PRIMARY as nav (nav.href)}{@render item(nav)}{/each}
	<hr class="nav-sep" />
	<div class="nav-head">その他</div>
	{#each SECONDARY as nav (nav.href)}{@render item(nav)}{/each}
	<div class="nav-spacer"></div>
	<hr class="nav-sep" />
	{#each UTILITY as nav (nav.href)}{@render item(nav)}{/each}
</nav>
