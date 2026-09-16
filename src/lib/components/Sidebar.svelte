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

<!-- bleed: 0 — サイドナビだけは overflow-y: auto を持つ。ガラスの canvas は既定で
	 要素の箱の外へ 49px はみ出し、絶対配置の子はスクロール範囲に足されるので、
	 中身が収まっていてもスクロールできる箱になってしまう。どのみち overflow が
	 外側のはみ出しを切り落とすので、0 にしても見た目は変わらない -->
<!-- Task 10f 追記 — 塗りだけ CLEAR の 0.06 から上げる。サイドナビは壁紙の青い光彩の上に
	 固定で載るので、その上の「その他」の見出し (--ink-3)の実測が 4.5:1 を割った。
	 0.55 で 4.53:1 に戻る。macOS のサイドナビも、いちばん透明な材質ではなく
	 一段濃い材質を使う。値を動かすときは報告書 5 節の方法で測り直すこと -->
<nav class="sidebar" aria-label="画面の切り替え" {@attach glass({ ...CLEAR, tint: 0.55, bleed: 0 })}>
	{#each PRIMARY as nav (nav.href)}{@render item(nav)}{/each}
	<hr class="nav-sep" />
	<div class="nav-head">その他</div>
	{#each SECONDARY as nav (nav.href)}{@render item(nav)}{/each}
</nav>
