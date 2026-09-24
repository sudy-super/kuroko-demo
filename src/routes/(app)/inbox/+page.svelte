<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { db } from '$lib/store.svelte';
	import { companyOf, personOf, queue, nextInQueue } from '$lib/derived';
	import { markDone } from '$lib/actions';
	import { ui, toast } from '$lib/ui.svelte';
	import { media } from '$lib/media.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import ThreadRow from '$lib/components/ThreadRow.svelte';
	import ThreadView from '$lib/components/ThreadView.svelte';
	import PersonPanel from '$lib/components/PersonPanel.svelte';

	const q = $derived(queue(db));
	// ?t= が指すスレッド。無ければキューの先頭 (対応済みにした直後もここに落ちる)
	const thread = $derived(db.threads.find((t) => t.id === page.url.searchParams.get('t')) ?? q[0]);
	const allMail = $derived([...db.threads].sort((a, b) => b.lastAt.localeCompare(a.lastAt)));
	/* 要対応とすべての受信メールは、同じ一覧の表示の切り替えにする (ユーザー指示 2026-09-25)。
	   以前は「すべて」を件名だけのモーダルで出していて、そこから本文を開けなかった */
	let list = $state<'queue' | 'all'>('queue');
	const rows = $derived(list === 'queue' ? q : allMail);
	let showRight = $state(false);
	let sheet = $state(false);
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

	/* スレッドが完了した瞬間 (「対応済みにする」、または承認された返信が 5 秒後に実行される)
	   に次の行へ移る。行き先を決める場所をここ 1 つにまとめる (review-task-15.md C3 / I2、
	   Task 15 が ReplyBox 側に持っていた $effect との競合を解消) */
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
</script>

<svelte:head><title>メール — KUROKO AI</title></svelte:head>

<div class="inbox" class:show-right={showRight} class:show-thread={showThread}>
	<h1 class="sr-only">メール</h1>
	<!-- Task 10w — HIG 上ガラスを持たないコンテンツ層なので、Task 10c のガラス (glass()) を外して
	     普通のカードの面 (.card) に戻した (glass-scope.md 6 節) -->
	<div class="panes">
		<section class="card pane pane-list" aria-label="メールの一覧">
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
					<button class="btn sec sm person" onclick={togglePerson}>
						<Icon name={showRight ? 'ic-left' : 'ic-user'} size={18} />{showRight
							? 'メール一覧に戻る'
							: '人物を見る'}
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

<Drawer open={sheet} title="差出人" onclose={() => (sheet = false)}>
	<!-- Drawer の題名 (Drawer.svelte の h3) の下なので、PersonPanel の人物名は h4 にする
	     (rereview-task-10p.md 新規 1、Modal の h4 と同じ考え方) -->
	{#if thread}<PersonPanel identityId={thread.identityId} headingLevel={4} />{/if}
</Drawer>

<style>
	/* 3 つのペインを横に並べる段の基準。Task 10w で内容の層からガラスを外したので
	   (HIG Materials「コンテンツ層に Liquid Glass を使わない」)、ここに canvas は無い */
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
	.empty {
		padding: var(--sp-5);
		color: var(--ink-2);
	}
	/* 1600px 以上は 3 列。畳む操作は要らない。1440px (会議室の投影、MacBook Pro 16) では
	   本文が 392px しかなく、全角 35〜40 字の目安 (legibility.md 76 行目) に対して
	   実測 299px と半分程度しか無かった。ここを 1280px から広げ、人物パネルは畳んで
	   一覧 + 本文の 2 列にすると、本文は 728px 前後まで広がる (実測は fix-hover-report.md) */
	.back,
	.person {
		display: none;
	}
	@media (max-width: 1600px) {
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
</style>
