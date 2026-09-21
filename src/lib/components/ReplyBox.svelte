<script lang="ts">
	import { goto } from '$app/navigation';
	import type { MessageThread } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { identityOf, personOf, queue } from '$lib/derived';
	import { replyDraft } from '$lib/kuroko/generate';
	import { insertSlots, sendReply } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';

	let { thread }: { thread: MessageThread } = $props();

	// 社外宛はメールアドレスを省略しない (仕様 5.3)
	const identity = $derived(identityOf(db, thread.identityId));
	const person = $derived(personOf(db, thread.personId));
	const to = $derived(
		person && identity ? `${person.name} <${identity.value}>` : (identity?.value ?? thread.sender)
	);

	const CHIPS = [
		{ tone: 'short', label: '短く' },
		{ tone: 'polite', label: '丁寧に' },
		{ tone: 'casual', label: 'カジュアルに' },
		{ tone: 'decline', label: '断る' },
		{ tone: 'slots', label: '日程候補を入れる' }
	] as const;

	let body = $state('');
	let proposal = $state<{ body: string; reason: string } | null>(null);
	let busy = $state(false);
	// mail.createDraft は throw する (Db に下書きの置き場が無いため fail-close、task-6-report.md 気になっている点 4)。
	// この Task では置き場を新設しないので、押しても未実装の案内だけ出す
	let draftNotice = $state(false);
	const id = $props.id();

	async function pick(tone: (typeof CHIPS)[number]['tone']) {
		if (busy) return;
		busy = true;
		if (tone === 'slots') insertSlots(thread.id);
		const forThread = thread.id;
		await new Promise((r) => setTimeout(r, 800));
		// 待っている間にスレッドを離れていたら状態を書き換えない
		if (thread.id !== forThread) return;
		proposal = replyDraft(db, thread, tone);
		busy = false;
	}

	function accept() {
		if (!proposal) return;
		body = proposal.body;
		proposal = null;
	}

	function discard() {
		proposal = null;
	}

	function send() {
		if (!body.trim()) return;
		sendReply(thread.id, body, 'inbox');
		ui.approvalDrawer = true;
	}

	// 送信後、承認が実行されてこのスレッドが完了になったら次の要返信スレッドへ移る
	$effect(() => {
		if (!thread.done) return;
		const next = queue(db).find((t) => t.id !== thread.id);
		if (next) goto(`/inbox?t=${next.id}`, { replaceState: true, noScroll: true, keepFocus: true });
	});
</script>

<section class="card reply" aria-label="返信">
	<p class="to">宛先 {to}</p>

	<div class="row chips" role="group" aria-label="返信案の作成">
		<!-- 押している間に disabled にすると焦点が body へ落ちてキーボードの位置を見失う
		     (ConnectStep.svelte と同じ理由で aria-disabled にする)。押下は pick() 側で弾く -->
		{#each CHIPS as c (c.tone)}
			<button class="chip" aria-disabled={busy} onclick={() => pick(c.tone)}>{c.label}</button>
		{/each}
	</div>
	{#if busy}<p class="busy" aria-live="polite">KUROKO が返信案を作成しています…</p>{/if}

	<!-- 提案カードが出ている間、主ボタンは「採用」に譲る (1 画面 1 主ボタン)。採用するまで本文へは
	     何も反映されておらず、送信しても提案前の本文しか送れないため、まず本文を確定させる採用の
	     ほうが今できる主な操作になる。送信は提案が無いときだけ主ボタンに戻す -->
	{#if proposal}
		<div class="proposal">
			<div class="tc-head">
				<Icon name="ic-spark" size={20} />
				<h3>KUROKO の返信案</h3>
			</div>
			<p class="reason">{proposal.reason}</p>
			<p class="preview">{proposal.body}</p>
			<!-- 幅が足りないと折り返すので、押せる 2 つを先に並べて説明だけを次の行に落とす。
			     間に挟むと「破棄」が「採用」の真下に来て押し間違いやすい (1440x700 で実測)。
			     読み上げの順は aria-describedby で保つ -->
			<div class="row proposal-foot">
				<button class="btn pri sm" onclick={accept} aria-describedby="{id}-note">採用</button>
				<button class="btn text sm" onclick={discard}>破棄</button>
				<p class="note" id="{id}-note">本文に入ります。送信はしません</p>
			</div>
		</div>
	{/if}

	<textarea {id} class="textarea" rows="5" aria-label="返信の本文" bind:value={body}></textarea>

	<div class="row send-row">
		<button class="btn {proposal ? 'sec' : 'pri'}" disabled={!body.trim()} onclick={send}>
			<Icon name="ic-send" size={18} />送信
		</button>
		<p class="to-again">→ {to}</p>
		<button class="btn text" onclick={() => (draftNotice = true)}>下書き保存</button>
	</div>
</section>

<Modal
	open={draftNotice}
	title="下書き保存"
	description="下書きとして保存する機能は、後の手順で使えるようになります。"
	size="sm"
	onclose={() => (draftNotice = false)}
>
	{#snippet actions()}
		<button class="btn pri" onclick={() => (draftNotice = false)}>閉じる</button>
	{/snippet}
</Modal>

<style>
	.reply {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.to,
	.to-again {
		margin: 0;
		color: var(--ink-2);
		font-size: 14px;
	}
	.chips {
		flex-wrap: wrap;
	}
	.busy {
		margin: 0;
		color: var(--ink-2);
		font-size: 13px;
	}
	.proposal {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-4);
		border-radius: var(--r-m);
		background: var(--accent-soft);
	}
	.proposal .tc-head h3 {
		margin: 0;
		font-size: 16px;
		color: var(--ink);
	}
	.reason {
		margin: 0;
		color: var(--ink-2);
		font-size: 13px;
	}
	.preview {
		margin: 0;
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--r-s);
		background: #fff;
		white-space: pre-wrap;
		font-size: 14px;
		line-height: 1.6;
	}
	.proposal-foot {
		flex-wrap: wrap;
	}
	.proposal-foot .note {
		margin: 0;
		color: var(--ink-3);
		font-size: 12px;
	}
	.send-row {
		flex-wrap: wrap;
		gap: var(--sp-4);
	}
	.to-again {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* 携帯を横向きにした高さでは、本文欄の既定 (96px + 余白) とチップの行で画面をほぼ
	   使い切り、返信案が画面の外に出る。app.css の同じ条件 (max-width: 960px) and
	   (max-height: 480px) に揃えて詰める。resize で伸ばせるので上限ではない */
	@media (max-width: 960px) and (max-height: 480px) {
		.reply {
			gap: var(--sp-2);
		}
		/* app.css の .textarea は min-height: 96px を持つ。min-height は height より強いので
		   両方を下げる (rows 属性が決める高さもここで上書きする) */
		.reply :global(.textarea) {
			min-height: 0;
			height: 72px;
		}
		.preview {
			max-height: 120px;
			overflow-y: auto;
		}
	}
</style>
