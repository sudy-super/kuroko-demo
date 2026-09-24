<script lang="ts">
	import { page } from '$app/state';
	import { PRIMARY, UTILITY, isActive } from '$lib/nav';
	import { ui } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import Drawer from './Drawer.svelte';

	// Task 10p — サイドナビの下端固定 (UTILITY) はこのメニューにも出す。省くと設定に辿り着けなくなる
	const items = [...PRIMARY, ...UTILITY];
</script>

<Drawer open={ui.mobileMenu} title="画面を選ぶ" onclose={() => (ui.mobileMenu = false)}>
	{#each items as nav (nav.href)}
		{@const on = isActive(page.url.pathname, nav.href)}
		<a
			class="list-row lg"
			class:on
			href={nav.href}
			data-sveltekit-replacestate
			aria-current={on ? 'page' : undefined}
			onclick={() => (ui.mobileMenu = false)}
		>
			<Icon name={nav.icon} size={20} />
			<span>{nav.label}</span>
		</a>
	{/each}
</Drawer>
