<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { companyOf, personOf, queue } from '$lib/derived';
	import { markDone } from '$lib/actions';
	import { ui, toast } from '$lib/ui.svelte';
	import { media } from '$lib/media.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import ThreadRow from '$lib/components/ThreadRow.svelte';
	import ThreadView from '$lib/components/ThreadView.svelte';
	import PersonPanel from '$lib/components/PersonPanel.svelte';

	const q = $derived(queue(db));
	// ?t= が指すスレッド。無ければキューの先頭 (対応済みにした直後もここに落ちる)
	const thread = $derived(db.threads.find((t) => t.id === page.url.searchParams.get('t')) ?? q[0]);
	const total = $derived(db.threads.length);
	const allMail = $derived([...db.threads].sort((a, b) => b.lastAt.localeCompare(a.lastAt)));

	let allOpen = $state(false);
	let showRight = $state(false);
	let sheet = $state(false);
	// 960px 以下は一覧 → 本文の 2 段階にする (仕様 5.3)
	let showThread = $state(false);

	/** 依頼バーにこのスレッドの文脈を載せる。画面を離れたら外す (仕様 5.5) */
	$effect(() => {
		const t = thread;
		if (!t) return;
		const [senderName, senderCompany] = t.sender.split(' / ');
		const name = personOf(db, t.personId)?.name ?? senderName;
		const company = companyOf(db, t.companyId)?.name ?? senderCompany ?? '';
		ui.context = {
			label: `${company} ${name}様のメールについて`.trim(),
			threadId: t.id,
			personId: t.personId
		};
		return () => {
			ui.context = null;
		};
	});

	function done() {
		if (!thread) return;
		// 対応済みにするとこのスレッドはキューから消えるので、消える前に次を決める
		const i = q.findIndex((t) => t.id === thread.id);
		const next = q[i + 1] ?? q.find((t) => t.id !== thread.id);
		markDone(thread.id);
		toast('対応済みにしました');
		goto(next ? `/inbox?t=${next.id}` : '/inbox', {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function select() {
		showThread = true;
		showRight = false;
	}

	// 960px 以下に縮んだら畳みの状態を捨てる。app.css の .show-right は一覧を隠すので、
	// シートを使うモバイルに持ち越すと一覧が出なくなる
	$effect(() => {
		if (media.mobile) showRight = false;
	});

	function togglePerson() {
		if (media.mobile) sheet = true;
		else showRight = !showRight;
	}
	import { glass, CARD } from '$lib/glass';
</script>

<svelte:head><title>Inbox — KUROKO AI</title></svelte:head>

<div class="inbox" class:show-right={showRight} class:show-thread={showThread}>
	<header class="inbox-head">
		<div class="inbox-title">
			<h1>Inbox</h1>
			<p class="summary">
				<span class="num">{total}</span> 件のうち <span class="num">{q.length}</span> 件が要対応です。残り
				<span class="num">{total - q.length}</span> 件は確認不要と判断しました
			</p>
		</div>
		<button class="btn text sm" onclick={() => (allOpen = true)}>
			すべての受信メールを見る ({total} 件)
		</button>
	</header>

	<div class="panes" {@attach glass({ ...CARD, targets: '.card' })}>
		<section class="card pane pane-list" aria-label="要対応のメール">
			{#if q.length === 0}
				<p class="empty">要対応のメールはありません</p>
			{:else}
				{#each q as t (t.id)}
					<ThreadRow thread={t} on={t.id === thread?.id} onselect={select} />
				{/each}
			{/if}
		</section>

		<section class="pane pane-thread">
			{#if thread}
				<div class="row pane-bar">
					<button class="btn text sm back" onclick={() => (showThread = false)}>
						<Icon name="ic-left" size={18} />一覧に戻る
					</button>
					<button class="btn sec sm person" onclick={togglePerson}>
						<Icon name="ic-user" size={18} />{showRight ? 'メール一覧に戻る' : '人物を見る'}
					</button>
				</div>
				{#key thread.id}
					<ThreadView {thread} ondone={done} />
				{/key}
			{:else}
				<p class="empty">表示するメールがありません</p>
			{/if}
		</section>

		<div class="pane pane-right">
			{#if thread}<PersonPanel identityId={thread.identityId} />{/if}
		</div>
	</div>
</div>

<Modal
	open={allOpen}
	title="すべての受信メール ({total} 件)"
	description="件名だけの一覧です。要対応と判断しなかったメールもここに含まれます。"
	onclose={() => (allOpen = false)}
>
	<ul class="all-mail">
		{#each allMail as t (t.id)}
			<li>{t.subject}</li>
		{/each}
	</ul>
	{#snippet actions()}
		<button class="btn pri" onclick={() => (allOpen = false)}>閉じる</button>
	{/snippet}
</Modal>

<Drawer open={sheet} title="差出人" onclose={() => (sheet = false)}>
	{#if thread}<PersonPanel identityId={thread.identityId} />{/if}
</Drawer>

<style>
	.inbox-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sp-4);
		padding: 0 var(--sp-5) var(--sp-5);
	}
	.inbox-head h1 {
		margin: 0;
	}
	.summary {
		margin: var(--sp-2) 0 0;
		color: var(--ink-2);
		font-size: 14px;
	}
	/* ガラスの canvas は bleed の分だけ外へ出るので、位置の基準になる親を置く */
	.panes {
		position: relative;
		isolation: isolate;
		display: grid;
		grid-template-columns: 360px minmax(0, 1fr) 320px;
		align-items: start;
		gap: var(--sp-4);
	}
	.pane {
		min-width: 0;
	}
	.pane-list {
		padding-inline: 0;
		padding-block: var(--sp-2);
	}
	.pane-thread {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.pane-bar {
		justify-content: space-between;
	}
	.empty {
		padding: var(--sp-5);
		color: var(--ink-2);
	}
	.all-mail {
		max-height: 50vh;
		margin: var(--sp-4) 0 0;
		padding-inline-start: var(--sp-5);
		overflow: auto;
		color: var(--ink);
	}
	.all-mail li {
		padding-block: var(--sp-1);
	}
	/* 1280px 以上は 3 列。畳む操作は要らない */
	.back,
	.person {
		display: none;
	}
	@media (max-width: 1280px) {
		.panes {
			grid-template-columns: 360px minmax(0, 1fr);
		}
		.inbox.show-right .panes {
			grid-template-columns: minmax(0, 1fr) 320px;
		}
		.person {
			display: inline-flex;
		}
	}
	/* components 2.2 — 960px 以下は 1 列。人物はボトムシートで開く */
	@media (max-width: 960px) {
		.panes,
		.inbox.show-right .panes {
			grid-template-columns: minmax(0, 1fr);
		}
		.inbox.show-thread .pane-list {
			display: none;
		}
		.pane-thread {
			display: none;
		}
		.inbox.show-thread .pane-thread {
			display: flex;
		}
		.back {
			display: inline-flex;
		}
	}
	@media (max-width: 600px) {
		.inbox-head {
			padding-inline: var(--sp-4);
		}
	}
</style>
