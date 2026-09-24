<script lang="ts">
	import type { Approval, Origin } from '$lib/types';
	import { approve, reject, undoApproval, editApproval } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import ApprovalIcon from './ApprovalIcon.svelte';
	import RiskIcon from './RiskIcon.svelte';

	let { approval: a, origin = 'approval' }: { approval: Approval; origin?: Origin } = $props();
	const id = $props.id();

	// 本文は初期状態で畳む (仕様 5.11)。宛先・件名を含めた全文はいつでも開いて確認できる
	let bodyOpen = $state(false);
	/* 3 行で収まる本文には開くものが無いので「本文を全部見る」を出さない。
	   行数は文字幅に依るので、描かれた高さ (scrollHeight) と見えている高さで判断する */
	let bodyEl: HTMLSpanElement | undefined = $state();
	let clipped = $state(false);
	$effect(() => {
		// a.body を読んで、編集で本文が変わったときも測り直す (3 行のままだと下の観測が動かない)
		a.body;
		const el = bodyEl;
		if (!el) return;
		const measure = () => {
			if (!bodyOpen) clipped = el.scrollHeight > el.clientHeight + 1;
		};
		/* 幅が変わると行数が変わるので、ResizeObserver で測り直す */
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

	/* 編集の開閉で bits-ui の Dialog が焦点をドロワーの閉じるボタンへ飛ばすので、自分で戻す (送信中はカードへ)。
	   閉じた時点で焦点が自分のカードの中にあった場合だけ戻す。利用者が別のカードへ移っていたら奪わない */
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
		<ApprovalIcon kind={a.kind} />
		<!-- ApprovalIcon (何を送るか) とは別の記号にして、隣に並んでも区分と種類が混ざらないようにする。
		     区分の形: 外部送信=地球儀/社内=建物。RiskIcon.svelte -->
		<RiskIcon risk={a.risk} size={20} />
	</div>
	<h3 class="ap-title">{a.title}</h3>
	<p class="ap-to">宛先 {a.to}</p>
	{#if a.subject}<p class="ap-subject">件名 {a.subject}</p>{/if}

	{#if editing}
		<textarea class="textarea ap-edit" rows="5" aria-label="本文を編集" bind:value={draft} bind:this={taEl}
		></textarea>
		<!-- 下の ap-foot と同じ組み合わせ (主は塗り、残りは薄い塗り) -->
		<div class="row ap-foot">
			<button class="btn pri sm" onclick={saveEdit}>保存</button>
			<button class="btn tint sm" onclick={closeEdit}>取り消す</button>
		</div>
	{:else}
		<!-- 本文は畳んでいる間も 3 行見せる (仕様 5.11)。bits-ui の Collapsible は閉じると
		     中身を DOM から外すので使えない。行数で切り、押せる部分だけ自前で書く -->
		<!-- 行数で切るのは内側の span。p で切ると内側の余白に 4 行目が覗く -->
		<p class="mailbody" id="{id}-body"><span class="ap-body" class:clamp={!bodyOpen} bind:this={bodyEl}>{a.body}</span></p>
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

	{#if a.status === 'sending'}
		<div class="row ap-foot">
			<span class="ap-sending">送信中…</span>
			<button class="btn text sm" onclick={() => undoApproval(a.id)}>取り消す</button>
		</div>
	{:else if !editing}
		<!-- 主は塗り (borderedProminent)、残りは同じ形の薄い塗り (bordered)。差は大きさではなく見た目で付ける
		     (HIG Buttons、approval-actions-apple.md)。却下はデータを消さないので destructive にせず赤にしない -->
		<div class="row ap-foot">
			<button class="btn pri sm" onclick={() => approve(a.id, origin)}>{primaryLabel}</button>
			<button class="btn tint sm" onclick={startEdit} bind:this={editBtn}>編集</button>
			<button class="btn tint sm" onclick={() => reject(a.id, origin)}>却下</button>
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
		font-size: 15px;
	}
	.ap-to,
	.ap-subject {
		color: var(--ink-2);
		font-size: 13px;
	}
	/* 初期表示は 3 行まで (仕様 5.11) */
	.ap-body.clamp {
		display: -webkit-box;
		line-clamp: 3;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.ap-toggle {
		align-self: flex-start;
		margin-top: var(--sp-1);
		padding-inline: 0;
	}
	.ap-edit {
		margin-top: var(--sp-1);
	}
	/* 塗りの塊どうしは、文字だけのボタンのように広い余白で区切らなくても分かれて見える */
	.ap-foot {
		margin-top: var(--sp-1);
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
	.ap-sending {
		color: var(--ink-2);
		font-size: 14px;
	}
</style>
