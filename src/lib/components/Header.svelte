<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { pendingApprovals } from '$lib/derived';
	import { fmtYMDW, fmtMDW, hm } from '$lib/dates';
	import { ui } from '$lib/ui.svelte';
	import { media } from '$lib/media.svelte';
	import Icon from './Icon.svelte';
	import DemoMenu from './DemoMenu.svelte';

	let now = $state(new Date());

	const pending = $derived(pendingApprovals(db).length);

	// 1 分ごとに時計を進める
	$effect(() => {
		const t = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(t);
	});
</script>

{#snippet tools()}
	<button class="iconbtn" title="作業履歴" aria-label="作業履歴" onclick={() => (ui.activityDrawer = true)}>
		<Icon name="ic-history" size={20} />
	</button>
	<button
		class="iconbtn"
		style="overflow: visible"
		title="承認待ち"
		aria-label="承認待ち {pending} 件"
		onclick={() => (ui.approvalDrawer = true)}
	>
		<Icon name="ic-check-c" size={20} />
		{#if pending > 0}
			<span class="badge count num" style="position: absolute; top: -2px; right: -2px">{pending}</span>
		{/if}
	</button>
	<DemoMenu />
{/snippet}

{#if media.mobile}
	<header class="header solid">
		<button class="iconbtn" aria-label="メニューを開く" onclick={() => (ui.mobileMenu = true)}>
			<Icon name="ic-list" size={20} />
		</button>
		<span class="num">{fmtMDW(now)}</span>
		<span class="num muted">{hm(now)}</span>
		<div class="row" style="margin-left: auto">{@render tools()}</div>
	</header>
{:else}
	<header class="header glass">
		<span class="num">{fmtYMDW(now)}</span>
		<span class="num muted">{hm(now)}</span>
		<div class="row" style="margin-left: auto; gap: var(--sp-3)">
			<span class="muted">{db.user.name}</span>
			{@render tools()}
		</div>
	</header>
{/if}
