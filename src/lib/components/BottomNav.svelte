<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { badgeCount, queue } from '$lib/derived';
	import { BOTTOM, isActive, guideTarget } from '$lib/nav';
	import Icon from './Icon.svelte';

	const inbox = $derived(queue(db).length);
	const target = $derived(db.demo.guide.on ? guideTarget(db) : null);
</script>

<nav class="bottomnav" aria-label="画面の切り替え">
	{#each BOTTOM as nav (nav.href)}
		{@const on = isActive(page.url.pathname, nav.href)}
		<a
			class="bottomnav-item"
			class:on
			class:pulse={target === nav.href}
			href={nav.href}
			data-guide-target={nav.href}
			aria-current={on ? 'page' : undefined}
		>
			<span style="position: relative; display: block">
				<Icon name={nav.icon} size={24} />
				{#if nav.href === '/inbox' && inbox > 0}
					<span class="badge count num" style="position: absolute; top: -6px; left: 14px">
						{badgeCount(inbox)}<span class="sr-only">件の要対応</span>
					</span>
				{/if}
			</span>
			<span>{nav.short ?? nav.label}</span>
		</a>
	{/each}
</nav>
