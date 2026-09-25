<script lang="ts">
	import { onMount } from 'svelte';
	import type { MessageThread } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { addressOf, identityOf, threadSenderMeta } from '$lib/derived';
	import { replyDraft } from '$lib/kuroko/generate';
	import { dropSlotsDraft, insertSlots, sendReply } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';

	let { thread }: { thread: MessageThread } = $props();

	// 社外宛は連絡先を省略しない (仕様 5.3)。メール以外の内部の ID は出さない (derived.ts の addressOf)
	const identity = $derived(identityOf(db, thread.identityId));
	const to = $derived(
		identity ? `${threadSenderMeta(db, thread)} ${addressOf(identity)}` : thread.sender
	);

	const CHIPS = [
		{ tone: 'short', label: '短く' },
		{ tone: 'polite', label: '丁寧に' },
		{ tone: 'casual', label: 'カジュアルに' },
		{ tone: 'decline', label: '断る' },
		{ tone: 'slots', label: '日程候補を入れる' }
	] as const;
	// 人物が未登録のスレッドでは日程調整のチップを出さない (insertSlots() が throw する)
	const chips = $derived(CHIPS.filter((c) => c.tone !== 'slots' || thread.personId));

	let body = $state('');
	// スレッドを開き直すとこの欄は空から始まる ({#key thread.id} で作り直される — inbox の +page.svelte)。
	// 前に採用した候補の本文はもう無いので、その下書きは送る当てを失っている
	onMount(() => dropSlotsDraft(thread.id));
	let proposal = $state<{ body: string; reason: string; tone: (typeof CHIPS)[number]['tone'] } | null>(
		null
	);
	let busy = $state(false);
	// 待機中 → 提案完了を読み上げに伝える常設の live region (要素ごと出し入れすると読まれない)
	let liveText = $state('');
	// 下書きの置き場は Db に無いので、押しても未実装の案内だけ出す
	let draftNotice = $state(false);
	const id = $props.id();
	let bodyEl: HTMLTextAreaElement | undefined = $state();
	let chipsEl: HTMLDivElement | undefined = $state();
	let sendEl: HTMLDivElement | undefined = $state();

	async function pick(tone: (typeof CHIPS)[number]['tone']) {
		if (busy) return;
		busy = true;
		liveText = 'KUROKO が返信案を作成しています…';
		await new Promise((r) => setTimeout(r, 800));
		const draft = replyDraft(db, thread, tone);
		proposal = { ...draft, tone };
		busy = false;
		liveText = '返信案ができました';
	}

	function accept() {
		if (!proposal) return;
		// 本文を差し替えるこの一点で下書きの有無を本文に合わせる (候補の無い本文に日程調整の効果文が付かない)
		if (proposal.tone === 'slots') insertSlots(thread.id);
		else dropSlotsDraft(thread.id);
		body = proposal.body;
		proposal = null;
		// 採用すると提案カードが消え、その行の scrollIntoView は効かない。送信ボタンは本文の下で画面外に残るので、
		// 次に押す送信の行まで運ぶ
		bodyEl?.focus({ preventScroll: true });
		sendEl?.scrollIntoView({ block: 'nearest' });
	}

	function discard() {
		proposal = null;
		chipsEl?.querySelector('button')?.focus();
	}

	// 低い窓では提案カードが依頼バーとボトムナビの下から始まるので、押させたい操作の行を視界へ運ぶ。
	// behavior は既定の auto (即時) なので動きを減らす設定と食い違わない
	function scrollIntoView(node: HTMLElement) {
		node.scrollIntoView({ block: 'nearest' });
	}

	function send() {
		if (!body.trim()) return;
		sendReply(thread.id, body, 'inbox');
		ui.approvalDrawer = true;
		// 承認を作り終えたので返信欄を空にする (連打で同じ本文の承認が積まれない)
		body = '';
	}
</script>

<section class="card reply" aria-label="返信">
	<p class="to">宛先 {to}</p>

	<div class="row chips" role="group" aria-label="返信案の作成" bind:this={chipsEl}>
		<!-- 押している間に disabled にすると焦点が body へ落ちてキーボードの位置を見失う
		     (ConnectStep.svelte と同じ理由で aria-disabled にする)。押下は pick() 側で弾く -->
		{#each chips as c (c.tone)}
			<button class="chip" aria-disabled={busy} onclick={() => pick(c.tone)}>{c.label}</button>
		{/each}
	</div>
	<!-- 読み上げ用は要素を常設し中身だけ入れ替える (出し入れすると aria-live は読まれない)。
	     目で見る手がかりは別の行で出し入れする -->
	<p class="sr-only" aria-live="polite">{liveText}</p>
	{#if busy}<p class="busy">KUROKO が返信案を作成しています…</p>{/if}

	<!-- 提案カードが出ている間、主ボタンは「採用」に譲る (1 画面 1 主ボタン)。採用するまで本文は変わらないので -->
	{#if proposal}
		<div
			class="proposal"
			role="group"
			aria-labelledby="{id}-proposal-head"
			aria-describedby="{id}-note"
		>
			<div class="tc-head">
				<Icon name="ic-spark" size={20} />
				<h3 id="{id}-proposal-head">KUROKO の返信案</h3>
			</div>
			<p class="reason">{proposal.reason}</p>
			<p class="preview">{proposal.body}</p>
			<!-- 押せる 2 つを先に並べて説明だけを次の行に落とす (間に挟むと「破棄」が「採用」の真下に来て押し間違う) -->
			<div class="row proposal-foot" use:scrollIntoView>
				<button class="btn pri sm" onclick={accept}>採用</button>
				<button class="btn text sm" onclick={discard}>破棄</button>
				<p class="note" id="{id}-note">本文に入ります。送信はしません</p>
			</div>
		</div>
	{/if}

	<textarea {id} bind:this={bodyEl} class="textarea" rows="5" aria-label="返信の本文" bind:value={body}
	></textarea>

	<!-- 外部へ出る直前に宛先をもう一度見せる。ボタンと同じ行だと幅を奪い合って省略されるので行を分ける -->
	<p class="to-again">→ {to}</p>

	<div class="row send-row" bind:this={sendEl}>
		<button class="btn {proposal ? 'sec' : 'pri'}" disabled={!body.trim()} onclick={send}>
			<Icon name="ic-send" size={18} />送信
		</button>
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
		color: var(--ink-2);
		font-size: 14px;
	}
	.chips {
		flex-wrap: wrap;
	}
	.busy {
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
		font-size: 16px;
		color: var(--ink);
	}
	.reason {
		color: var(--ink-2);
		font-size: 13px;
	}
	.preview {
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--r-s);
		background: #fff;
		white-space: pre-wrap;
		font-size: 14px;
		line-height: 1.6;
	}
	.proposal-foot {
		flex-wrap: wrap;
		/* 提案が出た直後にこの行を視界へ運ぶ (script の scrollIntoView)。下端には依頼バーと
		   ボトムナビが重なるので、その分だけ手前で止める (app.css の --content-bottom-clear) */
		scroll-margin-bottom: var(--content-bottom-clear);
	}
	.proposal-foot .note {
		color: var(--ink-3);
		font-size: 12px;
	}
	.send-row {
		flex-wrap: wrap;
		gap: var(--sp-4);
		/* 採用の直後にこの行へ運ぶ (script の accept)。.proposal-foot と同じ理由で、
		   下端に重なる依頼バーとボトムナビの分だけ手前で止める */
		scroll-margin-bottom: var(--content-bottom-clear);
	}
	.to-again {
		/* メールアドレスは単語として切れないので、折り返せる位置を明示しないと列からはみ出す */
		overflow-wrap: anywhere;
	}
	/* 携帯の横向きでは返信案が画面の外に出るので本文欄を詰める (app.css と同じ条件)。resize で伸ばせる */
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
		/* 日程候補 3 件までをスクロールなしで出す。入れ子のスクロールなので overscroll-behavior が要る */
		.preview {
			max-height: 180px;
			overflow-y: auto;
			overscroll-behavior: contain;
		}
	}
</style>
