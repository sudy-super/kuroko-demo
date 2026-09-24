<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { db } from '$lib/store.svelte';
	import { documentOf, personOf, projectOf } from '$lib/derived';
	import { generateDocument, sendDocument } from '$lib/actions';
	import { ui, focusChatbar, toast } from '$lib/ui.svelte';
	import { parse, rel } from '$lib/dates';
	import type { Document } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import DocPreview from '$lib/components/DocPreview.svelte';
	import DocKindIcon from '$lib/components/DocKindIcon.svelte';

	// 一覧は新しい順。シードは作成の古い順に並んでいる
	const docs = $derived([...db.documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
	// ?d= が指す資料。無ければ一覧の先頭 (People / 案件ページの資料リンクがこの形)
	const doc = $derived(documentOf(db, page.url.searchParams.get('d') ?? undefined) ?? docs[0]);

	// 送り先は資料の相手。持たない資料 (案件に紐づかない報告書) は案件の担当者から引く
	const to = $derived(personOf(db, doc?.personId ?? projectOf(db, doc?.projectId)?.personIds[0]));

	// 考えている間に何をしているかを書く (chat.md 観点 3.1)。空文字の間は待っていない
	let busy = $state('');
	// 960px 以下は一覧 → プレビューの 2 段階 (/inbox と同じ)。?d= で入ってきたらプレビューから
	let showDoc = $state(page.url.searchParams.has('d'));

	const when = (at: string) => `${rel(parse(at.slice(0, 10)), parse(db.seededOn))} ${at.slice(11, 16)}`;
	const select = (id: string) => {
		showDoc = true;
		goto(`/documents?d=${id}`, { noScroll: true, keepFocus: true });
	};

	const WAIT_MS = 1200;
	// 種別は Document['kind'] そのもの (src/lib/types.ts)。?kind= の値を突き合わせる
	const KINDS: Document['kind'][] = ['提案書', '見積書', '報告書'];

	async function generate(kind: Document['kind']) {
		if (busy) return;
		// 相手を選ばせる画面はこのデモに無いので、作成先は先頭の案件に固定する
		// (チャットの下書き依頼 kuroko/route.ts も案件が引けないときは同じ案件へ落ちる)
		const project = db.projects[0];
		busy = `${project.name}の${kind}を組み立てています`;
		await new Promise((r) => setTimeout(r, WAIT_MS));
		const d = generateDocument(kind, project.id, 'documents');
		busy = '';
		select(d.id);
		toast(`${kind}の下書きができました`);
	}

	// チャットの「下書きを作る」はここへ ?kind= 付きで飛ばしてくる (actions.ts chatAct の gen-doc)。
	// 作り終えたら ?kind= を落とす (戻るたびに作り直さないよう、履歴には積まずに差し替える)
	$effect(() => {
		const kind = page.url.searchParams.get('kind');
		if (!kind || !KINDS.includes(kind as Document['kind'])) return;
		untrack(() => {
			goto('/documents', { replaceState: true, noScroll: true, keepFocus: true });
			generate(kind as Document['kind']);
		});
	});

	/** 依頼バーにこの資料の文脈を載せる。画面を離れたら外す (仕様 5.5) */
	function ask() {
		ui.context = { label: 'ドキュメント作成' };
		focusChatbar();
	}

	function send() {
		if (!doc || !to) return;
		sendDocument(doc.id, to.id);
		ui.approvalDrawer = true;
	}
</script>

<svelte:head><title>ドキュメント生成 — KUROKO AI</title></svelte:head>

<div class="docs" class:show-doc={showDoc}>
	<h1 class="sr-only">ドキュメント生成</h1>
	<!-- 内容の層なのでガラスは当てず、普通のカードの面に置く (glass-scope.md 6 節) -->
	<div class="panes">
		<section class="card pane-list list-card" aria-labelledby="docs-list-head">
			<!-- 見出しの行が無くなったので、作成の依頼は一覧の見出しの右端に記号だけで置く -->
			<div class="row docs-list-top">
				<h2 class="list-head" id="docs-list-head">
					<Icon name="ic-doc" size={16} />資料<span class="num">{docs.length}</span>
				</h2>
				<button class="iconbtn docs-ask" title="作成を KUROKO に頼む" aria-label="作成を KUROKO に頼む" onclick={ask}>
					<Icon name="ic-spark" size={20} />
				</button>
			</div>
			{#each docs as d (d.id)}
				{@const pj = projectOf(db, d.projectId)}
				<button class="list-row xl" class:on={d.id === doc?.id} onclick={() => select(d.id)}>
					<span class="people-col">
						<span class="row docs-line">
							<DocKindIcon kind={d.kind} />
							{#if pj}<span class="badge tag">{pj.name}</span>{/if}
						</span>
						<span class="tc-text">{d.title}</span>
						<span class="sub"
							>{d.createdBy === 'KUROKO' ? 'KUROKO' : '自分'} / {when(d.createdAt)}</span
						>
					</span>
				</button>
			{/each}
			{#if !docs.length}<p class="empty">資料はありません</p>{/if}
		</section>

		<section class="pane-doc">
			<!-- chat.md 観点 3.3 — 待ちの表示は role="status" で伝える (WCAG 2.2 の 4.1.3、レベル AA)。
			     入れ物は常設し中身の文字だけ入れ替える (同 6.2) -->
			<p class="docs-busy" role="status">{busy}</p>
			<div class="row pane-bar">
				<button class="btn text sm back" onclick={() => (showDoc = false)}>
					<Icon name="ic-left" size={18} />一覧に戻る
				</button>
			</div>
			{#if doc}
				<div class="card docs-paper-card">
					<DocPreview {doc} />
				</div>
				<div class="row docs-actions">
					{#if to}
						<button class="btn pri" onclick={send}>
							<Icon name="ic-send" size={20} />{to.name.split(' ')[0]}様に送る (承認が必要)
						</button>
					{/if}
					<button class="btn sec" onclick={() => window.print()}>
						<Icon name="ic-download" size={20} />PDF で書き出す
					</button>
				</div>
			{:else}
				<p class="empty">表示する資料がありません</p>
			{/if}
		</section>
	</div>
</div>

<style>
	.docs-list-top {
		justify-content: space-between;
		padding-right: var(--sp-2);
	}
	.docs-ask {
		color: var(--accent);
	}
	.panes {
		padding: 0 var(--sp-5);
	}
	.pane-list {
		min-width: 0;
	}
	.pane-doc {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: var(--sp-4);
	}
	/* 種別と案件の札。行を詰めると札が折り返すので、あふれる側は案件名にする */
	.docs-line {
		min-width: 0;
	}
	.docs-line .badge.tag {
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}
	/* 3 段 (札 / 題名 / 作成者) なので .list-row.xl (72px) では足りない */
	.pane-list .list-row {
		height: auto;
		padding-block: var(--sp-3);
	}
	.pane-list .people-col {
		gap: var(--sp-1);
	}
	.docs-busy {
		color: var(--ink-2);
		font-size: 13px;
	}
	.docs-busy:empty {
		display: none;
	}
	.docs-actions {
		flex-wrap: wrap;
		gap: var(--sp-3);
	}
	/* 2 列に並ぶ間は一覧が常に見えているので、戻る操作の行ごと出さない */
	.pane-bar {
		display: none;
	}
	/* components 2.2 — 960px 以下は 1 列にして、一覧 → プレビューの 2 段階にする */
	@media (max-width: 960px) {
		.docs.show-doc .pane-list {
			display: none;
		}
		.pane-doc {
			display: none;
		}
		.docs.show-doc .pane-doc {
			display: flex;
		}
		.pane-bar {
			display: flex;
		}
	}
	@media (max-width: 600px) {
		.panes {
			padding-inline: var(--sp-4);
		}
	}
	/* 印刷はプレビューの紙だけ残す。器の外 (サイドナビ、依頼バー) は app.css の @media print が落とす */
	@media print {
		.pane-list,
		.pane-bar,
		.docs-busy,
		.docs-actions {
			display: none;
		}
		.panes {
			display: block;
			padding: 0;
		}
		.pane-doc,
		.docs.show-doc .pane-doc {
			display: block;
		}
		.docs-paper-card {
			padding: 0;
		}
	}
</style>
