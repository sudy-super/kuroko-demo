<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { companyOf, personOf, threadOf, queue, nextInQueue } from '$lib/derived';
	import { markDone } from '$lib/actions';
	import { ui, toast } from '$lib/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import ThreadRow from '$lib/components/ThreadRow.svelte';
	import ThreadView from '$lib/components/ThreadView.svelte';
	import PersonPanel from '$lib/components/PersonPanel.svelte';

	const q = $derived(queue(db));
	// ?t= が指すスレッド。無ければキューの先頭 (対応済みにした直後もここに落ちる)
	const thread = $derived(threadOf(db, page.url.searchParams.get('t') ?? undefined) ?? q[0]);
	const allMail = $derived([...db.threads].sort((a, b) => b.lastAt.localeCompare(a.lastAt)));
	/* 要対応とすべての受信メールは、同じ一覧の表示の切り替えにする */
	let list = $state<'queue' | 'all'>('queue');
	const rows = $derived(list === 'queue' ? q : allMail);
	/* 差出人の情報は、スレッドの頭の差出人の行を押すと広がる中央のパネルで出す (承認待ちのカードと同じ作り) */
	let personFrom = $state<DOMRect | null>(null);
	let personOpen = $state(false);
	let senderHidden = $state(false);
	/* 縮み終わったら差出人の行を見せ、焦点を戻す (行は縮み終わるまで隠れているので、
	   bits-ui の戻しでは乗らない)。その間に別の場所へ移っていたら奪わない */
	function settled() {
		senderHidden = false;
		tick().then(() => {
			if (document.activeElement && document.activeElement !== document.body) return;
			document.querySelector<HTMLElement>('.thread .sender')?.focus();
		});
	}
	function openPerson(el: HTMLElement) {
		personFrom = el.getBoundingClientRect();
		senderHidden = true;
		personOpen = true;
	}
	// 960px 以下は一覧 → 本文の 2 段階にする (仕様 5.3)。
	// ?t= を持って入ってきたときは本文から始める (Today や人物ページからの入口)
	let showThread = $state(page.url.searchParams.has('t'));

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
		markDone(thread.id);
		toast('対応済みにしました');
		// 行き先は下の $effect (thread.done を見て遷移) に任せる
	}

	/* スレッドが完了した瞬間に次の行へ移る。行き先を決める場所をここ 1 つにまとめる */
	// 開いた時点で既に完了しているスレッドは読むために開かれている (案件・会社の「関連メール」や
	// 「すべての受信メール」からの入口)。移すのは、見ている間に完了したときだけ
	let opened: string | undefined;
	$effect(() => {
		const t = thread;
		if (!t) return;
		const was = opened;
		opened = t.done ? undefined : t.id;
		if (!t.done || was !== t.id) return;
		const next = nextInQueue(db, t.id);
		// キューが空になったら一覧 (空の状態) に戻す。960px 以下では本文側に戻る手段が無くなるため
		if (!next) showThread = false;
		goto(next ? `/inbox?t=${next.id}` : '/inbox', {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	});

	function select() {
		showThread = true;
		personOpen = false;
	}
</script>

<svelte:head><title>メール — KUROKO AI</title></svelte:head>

<div class="inbox" class:show-thread={showThread}>
	<h1 class="sr-only">メール</h1>
	<!-- コンテンツ層なのでガラスは使わない (HIG Materials) -->
	<div class="panes">
		<section class="card pane pane-list list-card" aria-label="メールの一覧">
			<div class="inbox-switch">
				<Segmented
					label="一覧の切り替え"
					items={[
						{ key: 'queue', label: '要対応' },
						{ key: 'all', label: 'すべて' }
					]}
					value={list}
					onchange={(k) => (list = k)}
				>
					{#snippet extra(k)}<span class="badge count">{k === 'queue' ? q.length : allMail.length}</span>{/snippet}
				</Segmented>
			</div>
			{#if rows.length === 0}
				<p class="empty">要対応のメールはありません</p>
			{:else}
				{#each rows as t (t.id)}
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
				</div>
				{#key thread.id}
					<ThreadView {thread} ondone={done} onsender={openPerson} {senderHidden} />
				{/key}
			{:else}
				<p class="empty">表示するメールがありません</p>
			{/if}
		</section>
	</div>
</div>

<Drawer
	open={personOpen}
	title="差出人"
	variant="center"
	from={personFrom}
	onclose={() => (personOpen = false)}
	onsettled={settled}
>
	<!-- Drawer の題名 (h3) の下なので、PersonPanel の人物名は h4 にする -->
	{#if thread}<PersonPanel identityId={thread.identityId} headingLevel={4} />{/if}
</Drawer>

<style>
	.pane {
		min-width: 0;
	}
	/* 切り替えは一覧のカードの先頭。行と同じ左右の余白にそろえる */
	.inbox-switch {
		display: flex;
		padding: var(--sp-2) var(--sp-4) var(--sp-3);
	}
	.pane-thread {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.pane-bar {
		justify-content: space-between;
	}
	/* components 2.2 — 960px 以下は 1 列 */
	@media (max-width: 960px) {
		.inbox.show-thread .pane-list {
			display: none;
		}
		.pane-thread {
			display: none;
		}
		.inbox.show-thread .pane-thread {
			display: flex;
		}
	}
</style>
