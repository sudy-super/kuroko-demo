<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { badgeCount, queue } from '$lib/derived';
	import { PRIMARY, UTILITY, isActive, guideTarget, type NavItem } from '$lib/nav';
	import Icon from './Icon.svelte';
	import Orb from './Orb.svelte';

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

<nav class="sidebar" id="side-nav" aria-label="画面の切り替え">
	<!-- ユーザー指示 2026-09-24 — 格納ボタン (.app 直下の .side-toggle) の右に並ぶロゴ行。
	     サイドナビの子として一緒に格納される。Today への近道を兼ねる -->
	<a class="nav-logo" href="/today" aria-label="KUROKO AI (Today へ)">
		<span class="nav-logo-orb" aria-hidden="true"><Orb size={58} sparks={false} /></span>
		<span>KUROKO AI</span>
	</a>
	<hr class="nav-sep" />
	<!-- ユーザー指示 2026-09-24 — 見出し「その他」・区切り線・隙間を廃止し、主要と補助を
	     分けず 1 本の列にする (旧: Task 10p の見出し区分、要件定義 p.9 の主要 6 + 補助 5)。
	     PRIMARY は nav.ts で統合済み。設定 (UTILITY) だけ下端に固定する -->
	{#each PRIMARY as nav (nav.href)}{@render item(nav)}{/each}
	<div class="nav-bottom">
		{#each UTILITY as nav (nav.href)}{@render item(nav)}{/each}
	</div>
</nav>
