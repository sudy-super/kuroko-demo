<script lang="ts">
	import { RISK_LABEL, type Approval, type Origin } from '$lib/types';
	import { approve, reject, undoApproval, editApproval } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import ApprovalIcon from './ApprovalIcon.svelte';

	let { approval: a, origin = 'approval' }: { approval: Approval; origin?: Origin } = $props();
	const id = $props.id();

	// 本文は初期状態で畳む (仕様 5.11)。宛先・件名を含めた全文はいつでも開いて確認できる
	let bodyOpen = $state(false);
	/* 3 行で収まる本文には開くものが無いので「本文を全部見る」を出さない。
	   行数は文字幅に依るので、描かれた高さ (scrollHeight) と見えている高さで判断する */
	let bodyEl: HTMLParagraphElement | undefined = $state();
	let clipped = $state(false);
	$effect(() => {
		// a.body を読んで、編集で本文が変わったときも測り直す (3 行のままだと下の観測が動かない)
		a.body;
		const el = bodyEl;
		if (!el) return;
		const measure = () => {
			if (!bodyOpen) clipped = el.scrollHeight > el.clientHeight + 1;
		};
		/* 畳んだ ApprovalDrawer の Collapsible の中では高さが 0 で描かれ、開くまで測れない。
		   幅が変わったときも測り直す必要があるので、どちらも ResizeObserver で拾う */
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		measure();
		return () => ro.disconnect();
	});
	let editing = $state(false);
	let draft = $state('');
	let taEl: HTMLTextAreaElement | undefined = $state();
	let editBtn: HTMLButtonElement | undefined = $state();
	let cardEl: HTMLElement | undefined = $state();
	let wasEditing = false;
	let hadFocus = false;

	/* 編集の開閉で bits-ui の Dialog が焦点をドロワーの閉じるボタンへ飛ばすので、自分で戻す。
	   「編集」が無い状態 (送信中) に閉じたときはカードへ寄せて、ドロワーの外へ出さない。
	   戻すのは閉じた時点で焦点が自分のカードの中にあった場合だけ (hadFocus)。下の自動クローズが
	   加わって初めて「利用者が別のカードへ移った後に閉じる」経路ができた (d66ca4d には無い)ので、
	   条件なしに戻すとその焦点を奪う */
	$effect(() => {
		if (editing) taEl?.focus();
		else if (wasEditing && hadFocus) (editBtn ?? cardEl)?.focus();
		wasEditing = editing;
	});

	/* 外の画面で承認・却下されると保存が actions.ts の editApproval の条件に弾かれ、
	   書いた内容が黙って消える。承認待ちでなくなった時点で編集を閉じる */
	$effect(() => {
		if (editing && a.status !== 'pending') {
			closeEdit();
			toast('この承認は既に承認または却下されたため、編集を閉じました');
		}
	});

	function startEdit() {
		draft = a.body;
		editing = true;
	}
	/* 焦点の位置は textarea が外れた瞬間に変わるので、閉じるより前にここで控える */
	function closeEdit() {
		hadFocus = !!cardEl && cardEl.contains(document.activeElement);
		editing = false;
	}
	function saveEdit() {
		editApproval(a.id, draft);
		closeEdit();
	}

	// internal / internal_low は「実行」、external_send だけ「送信」(仕様 5.11)
	const primaryLabel = $derived(a.risk === 'external_send' ? '承認して送信' : '承認して実行');
</script>

<!-- tabindex は編集を閉じたときの焦点の受け皿 (上の $effect)。tab では止まらない -->
<article class="card ap-card" aria-label={a.title} tabindex="-1" bind:this={cardEl}>
	<div class="row ap-head">
		<ApprovalIcon kind={a.kind} size={20} />
		<!-- indicators.md「承認センターの区分」— 判断に直結する属性なので、Lozenge のまま
		     文言で出す (アイコン化は却下)。文言の出所は types.ts の RISK_LABEL。
		     外部送信だけ橙 (app.css の .badge.warn)、残る 2 つは既定の灰。Today の
		     承認待ちカードも同じ組み方 -->
		<span class="badge" class:warn={a.risk === 'external_send'}>{RISK_LABEL[a.risk]}</span>
	</div>
	<h3 class="ap-title">{a.title}</h3>
	<p class="ap-to">宛先 {a.to}</p>
	{#if a.subject}<p class="ap-subject">件名 {a.subject}</p>{/if}

	{#if editing}
		<textarea class="textarea ap-edit" rows="5" aria-label="本文を編集" bind:value={draft} bind:this={taEl}
		></textarea>
		<!-- 編集はカードの中で開くだけで、Carbon の例外 (別フローが被さる temporary flow) に当たらない。
		     複数のカードを同時に編集できるので保存も塗りにしない (上の ap-foot と同じ根拠) -->
		<div class="row ap-edit-foot">
			<button class="btn sec sm" onclick={saveEdit}>保存</button>
			<button class="btn text sm" onclick={closeEdit}>取り消す</button>
		</div>
	{:else}
		<!-- 本文は畳んでいる間も 3 行見せる (仕様 5.11)。bits-ui の Collapsible は閉じると
		     中身を DOM から外すので使えない。行数で切り、押せる部分だけ自前で書く -->
		<p class="ap-body" class:clamp={!bodyOpen} id="{id}-body" bind:this={bodyEl}>{a.body}</p>
		{#if clipped}
			<!-- buttons.md 観点B — 文字だけの操作 (最下位の重要度) -->
			<button
				class="btn text sm ap-toggle"
				aria-expanded={bodyOpen}
				aria-controls="{id}-body"
				onclick={() => (bodyOpen = !bodyOpen)}
			>
				{bodyOpen ? '閉じる' : '本文を全部見る'}
			</button>
		{/if}
	{/if}

	<p class="ap-effect muted">{a.effectLine}</p>

	{#if a.status === 'sending'}
		<div class="row ap-foot">
			<span class="ap-sending">送信中…</span>
			<button class="btn text sm" onclick={() => undoApproval(a.id)}>取り消す</button>
		</div>
	{:else if !editing}
		<!-- buttons.md 観点A 原則 3 — カードが縦に並ぶ画面では塗りの主ボタンを使わない
		     (research-repeated-primary.md の Carbon「Ghost buttons in productive cards」)。
		     序列は枠の有無で付ける。24px 間隔で 枠付き → 文字 → 文字 の順 -->
		<div class="row ap-foot">
			<button class="btn sec sm" onclick={() => approve(a.id, origin)}>{primaryLabel}</button>
			<button class="btn text sm" onclick={startEdit} bind:this={editBtn}>編集</button>
			<button class="btn text sm" onclick={() => reject(a.id, origin)}>却下</button>
		</div>
	{/if}
</article>

<style>
	.ap-card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.ap-head {
		justify-content: space-between;
	}
	.ap-title {
		margin: 0;
		font-size: 15px;
	}
	.ap-to,
	.ap-subject {
		margin: 0;
		color: var(--ink-2);
		font-size: 13px;
	}
	.ap-body {
		margin: var(--sp-1) 0 0;
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--r-s);
		background: #fff;
		box-shadow: inset 0 0 0 1px var(--line);
		white-space: pre-wrap;
		font-size: 14px;
		line-height: 1.6;
	}
	/* 初期表示は 3 行まで (仕様 5.11)。overflow: hidden が切るのは内側の余白の外側なので、
	   下の余白を残すと 4 行目の上端がそこに覗いて中途半端に切れて見える (1440x700 で実測)。
	   畳んでいる間だけ下の余白を 0 にし、間隔は下の「本文を全部見る」の上の余白が持つ */
	.ap-body.clamp {
		display: -webkit-box;
		line-clamp: 3;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		padding-bottom: 0;
	}
	.ap-toggle {
		align-self: flex-start;
		margin-top: var(--sp-1);
		padding-inline: 0;
	}
	.ap-effect {
		margin: 0;
		font-size: 12px;
	}
	.ap-edit {
		margin-top: var(--sp-1);
	}
	.ap-edit-foot,
	.ap-foot {
		margin-top: var(--sp-1);
		gap: var(--sp-6);
		flex-wrap: wrap;
	}
	.ap-sending {
		color: var(--ink-2);
		font-size: 14px;
	}
</style>
