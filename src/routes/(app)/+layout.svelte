<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Portal } from 'bits-ui';
	import { page } from '$app/state';
	import { db, installStorageSync } from '$lib/store.svelte';
	import { restoreStaleSending, noteRecent } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Header from '$lib/components/Header.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import MobileMenu from '$lib/components/MobileMenu.svelte';
	import KurokoBar from '$lib/components/KurokoBar.svelte';
	import ApprovalDrawer from '$lib/components/ApprovalDrawer.svelte';
	import ActivityDrawer from '$lib/components/ActivityDrawer.svelte';
	import Palette from '$lib/components/Palette.svelte';
	import { chromeGlass, overlayGlass } from '$lib/glass';
	import { CONNECT_NAME } from '$lib/connect';

	let { children } = $props();

	const connected = $derived(db.settings.connections.filter((c) => c.connected));
	/* LINE / Slack はその画面の入力欄そのものが依頼の口なので、固定の依頼バーを重ねない
	   (重なると入力欄が押せない)。バーが無い分、本文の下に空ける高さも詰める
	   (app.css の --chatbar-h と --content-bottom-clear) */
	const hasBar = $derived(page.url.pathname !== '/integrations');


	onMount(() => {
		restoreStaleSending();
		const off = installStorageSync();
		const key = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				ui.palette = true;
			}
		};
		window.addEventListener('keydown', key);
		return () => {
			off();
			window.removeEventListener('keydown', key);
		};
	});

	// noteRecent は db.demo.recent を読んでから書くので、追跡したままだと更新が止まらなくなる。
	// 焦点を閉じ込めない覆い (枠が押せるよう trapFocus を外した) はページ遷移そのものでは
	// 閉じないので、ここで明示的に閉じる (ユーザー指示 2026-09-23)
	$effect(() => {
		const path = page.url.pathname;
		untrack(() => {
			noteRecent(path);
			ui.approvalDrawer = false;
			ui.activityDrawer = false;
			ui.palette = false;
		});
	});
</script>

<div class="app" class:has-rail={connected.length > 0} class:no-bar={!hasBar}>
	<!-- 枠のガラスのうち 5 面 (サイドナビ、上部バー、連携の列、携帯のボトムナビ・上部バー)は、
	     この空の層に 1 枚の canvas でまとめて描く。面ごとに描画面 (WebGL context)を取ると、
	     タブを 3 枚開いただけでブラウザの上限に届き、全面が backdrop-filter の経路に落ちる。
	     層は本文より後・覆いより前に敷くので、本文はガラスの背後の絵に入り、5 面自身は
	     入らない。依頼バーだけは自分の描画面を持つ (src/lib/glass.ts の chromeGlass / barGlass) -->
	<div class="chrome" {@attach chromeGlass}></div>
	<!-- Task 10w (glass-scope.md 1〜3 節) — ドロワー・シート・モーダル・ポップオーバー・
	     メニューは bits-ui の Portal で <body> 直下に出る。この層も Portal で <body> の
	     直接の子として足すことで、どの覆いの面も同じ深さから見つけられる (src/lib/glass.ts の
	     overlayGlass)。トーストはこの層の受け持ちではない (Portal を使わずルートの
	     +layout.svelte 直下に出るうえ、濃い塗りで canvas が隠れる。
	     app.css の .toast を見よ)。.chrome と違い、覆いは開閉のたびに DOM へ出入りするので、
	     この層自身は開閉に関わらず常駐する (中身は空、canvas は overlayGlass が足す) -->
	<Portal>
		<div class="overlay-chrome" {@attach overlayGlass}>
			<!-- src/lib/glass.ts の OVERLAY_TIERS 冒頭のコメントを見よ。覆いが 1 つも開いていない
			     ときに targets が空配列にならないための、常駐する幅 0 の印 -->
			<div class="overlay-chrome-anchor" aria-hidden="true"></div>
		</div>
	</Portal>
	<Sidebar />
	<Header />
	<main class="main">{@render children()}</main>
	{#if connected.length > 0}
		<aside class="rail" aria-label="連携中のサービス">
			{#each connected as c (c.id)}
				<a
					class="iconbtn"
					href="/settings"
					aria-label="{CONNECT_NAME[c.id]}の連携設定"
					title={CONNECT_NAME[c.id]}
				>
					<Icon name="b-{c.id}" size={24} />
				</a>
			{/each}
		</aside>
	{/if}
	{#if hasBar}<KurokoBar context={ui.context} />{/if}
	<BottomNav />
	<MobileMenu />
	<ApprovalDrawer />
	<ActivityDrawer />
	<Palette />
</div>
