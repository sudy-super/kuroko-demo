<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Portal } from 'bits-ui';
	import { page } from '$app/state';
	import { db, installStorageSync } from '$lib/store.svelte';
	import { restoreStaleSending, noteRecent } from '$lib/actions';
	import { ui, closeOverlays } from '$lib/ui.svelte';
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
			// side-collapse.md — ⌘\ / Ctrl+\ はサイドナビの格納の近道。\ は文字入力と
			// 衝突しないので、入力欄に焦点があっても効かせる
			if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
				e.preventDefault();
				ui.sideHidden = !ui.sideHidden;
			}
		};
		window.addEventListener('keydown', key);
		return () => {
			off();
			window.removeEventListener('keydown', key);
		};
	});

	// noteRecent は db.demo.recent を読んでから書くので、追跡したままだと更新が止まらなくなる。
	// 焦点を閉じ込めない覆いはページ遷移では閉じないので、ここで明示的に閉じる (一覧は closeOverlays())
	$effect(() => {
		const path = page.url.pathname;
		untrack(() => {
			noteRecent(path);
			closeOverlays();
		});
	});

	// side-collapse.md — 格納の状態を localStorage へ ($effect はブラウザでしか走らない)
	$effect(() => {
		localStorage.setItem('kuroko-side-hidden', ui.sideHidden ? '1' : '0');
	});
</script>

<div class="app" class:no-bar={!hasBar} class:side-hidden={ui.sideHidden}>
	<!-- 枠の 5 面のガラスはこの空の層に 1 枚の canvas でまとめて描く (面ごとだとタブ 3 枚で描画面の上限に届く)。
	     依頼バーだけは自分の描画面を持つ (src/lib/glass.ts の chromeGlass / barGlass) -->
	<div class="chrome" {@attach chromeGlass}></div>
	<!-- ドロワー・シート・モーダル・ポップオーバー・メニューは Portal で <body> 直下に出るので、この層も Portal で
	     <body> の子にして同じ深さから見つける (glass.ts の overlayGlass)。覆いは出入りするが、この層は常駐する -->
	<Portal>
		<div class="overlay-chrome" {@attach overlayGlass}>
			<!-- src/lib/glass.ts の OVERLAY_TIERS 冒頭のコメントを見よ。覆いが 1 つも開いていない
			     ときに targets が空配列にならないための、常駐する幅 0 の印 -->
			<div class="overlay-chrome-anchor" aria-hidden="true"></div>
		</div>
	</Portal>
	<!-- 格納中もこのボタンだけは残るのでサイドナビの外に置く。.chrome の層の見張りと ~ の兄弟結合子が効くよう
	     .app の直接の子のまま置く (Tip.svelte で包むと span が挟まる。title だけを付ける) -->
	<button
		type="button"
		class="side-toggle"
		aria-expanded={!ui.sideHidden}
		aria-controls="side-nav"
		aria-label={ui.sideHidden ? 'サイドナビを出す' : 'サイドナビを隠す'}
		title={ui.sideHidden ? 'サイドナビを出す (⌘\\)' : 'サイドナビを隠す (⌘\\)'}
		onclick={() => (ui.sideHidden = !ui.sideHidden)}
	>
		<Icon name="ic-sidebar" size={20} />
	</button>
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
