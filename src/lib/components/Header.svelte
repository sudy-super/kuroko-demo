<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { pendingApprovals } from '$lib/derived';
	import { fmtYMDW, fmtMDW, hm } from '$lib/dates';
	import { resetDemo } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import { media } from '$lib/media.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';
	import { glass, BAR } from '$lib/glass';

	let now = $state(new Date());
	let confirming = $state(false);

	const pending = $derived(pendingApprovals(db).length);

	// 1 分ごとに時計を進める
	$effect(() => {
		const t = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(t);
	});

	function reset() {
		confirming = false;
		resetDemo();
		goto('/');
	}
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
	<button class="iconbtn" title="デモをリセット" aria-label="デモをリセット" onclick={() => (confirming = true)}>
		<Icon name="ic-undo" size={20} />
	</button>
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
	<header class="header glass" {@attach glass(BAR)}>
		<span class="num">{fmtYMDW(now)}</span>
		<span class="num muted">{hm(now)}</span>
		<div class="row" style="margin-left: auto; gap: var(--sp-3)">
			<span class="muted">{db.user.name}</span>
			{@render tools()}
		</div>
	</header>
{/if}

<Modal
	open={confirming}
	title="デモをリセット"
	description="初期状態に戻しますか? 承認や返信など、ここまでの操作はすべて消えます。"
	size="sm"
	onclose={() => (confirming = false)}
>
	{#snippet actions()}
		<button class="btn pri" onclick={reset}>初期状態に戻す</button>
		<button class="btn text" onclick={() => (confirming = false)}>やめる</button>
	{/snippet}
</Modal>
