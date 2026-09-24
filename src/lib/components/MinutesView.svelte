<script lang="ts">
	import type { Meeting } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { acceptTaskSuggestions, editFollowUp, rejectSuggestions, sendFollowUp } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import Icon from './Icon.svelte';
	import SuggestionCard from './SuggestionCard.svelte';

	let { meeting }: { meeting: Meeting } = $props();

	const minutes = $derived(meeting.minutes);
	// この会議から出た候補。登録・破棄の後も数を出したいので status で絞らず全部取る
	const mine = $derived(
		db.suggestions.filter(
			(s) => s.source === 'transcript' && s.payload.type === 'task' && s.payload.meetingId === meeting.id
		)
	);
	const suggestions = $derived(mine.filter((s) => s.status === 'pending'));
	const registered = $derived(mine.filter((s) => s.status === 'accepted').length);
	// 承認待ちか送信済みの案があるか。却下されたら「承認して送信」に戻す
	const sent = $derived(
		db.approvals.some(
			(a) =>
				a.payload.type === 'followup' &&
				a.payload.meetingId === meeting.id &&
				a.status !== 'rejected'
		)
	);

	function send() {
		sendFollowUp(meeting.id);
		toast('フォローメールを承認待ちに送りました');
	}

	/* 案はその場で直す (HIG Generative AI "Make it easy for people to refine … generated results") */
	let editing = $state(false);
	let draft = $state('');
	function startEdit() {
		draft = minutes?.followUpMail?.body ?? '';
		editing = true;
	}
	function saveEdit() {
		editFollowUp(meeting.id, draft);
		editing = false;
	}
	function focusOnMount(node: HTMLTextAreaElement) {
		node.focus();
	}
</script>

{#if minutes}
	<section class="card mv" aria-labelledby="mv-minutes">
		<h2 class="meet-head" id="mv-minutes"><Icon name="ic-spark" size={16} />議事録</h2>
		<p class="mv-summary">{minutes.summary}</p>
		{#if minutes.decisions.length}
			<h3 class="mv-sub">決定事項</h3>
			<ol class="mv-decisions">
				{#each minutes.decisions as d (d)}
					<li>{d}</li>
				{/each}
			</ol>
		{/if}
	</section>

	{#if suggestions.length}
		<SuggestionCard
			{suggestions}
			title="ToDo の候補 {suggestions.length} 件"
			onaccept={acceptTaskSuggestions}
			onreject={() => rejectSuggestions(suggestions.map((s) => s.id))}
		/>
	{:else if registered > 0}
		<p class="card mv-done">
			<Icon name="ic-check" size={20} />{registered} 件を登録しました
		</p>
	{/if}

	<!-- メールを持たない相手 (社内の人物) には案自体ができない (kuroko/generate.ts の minutesFor)。
	     押しても送れないボタンを残さず、札ごと出さない -->
	{#if minutes.followUpMail}
	<section class="card mv" aria-labelledby="mv-mail">
		<h2 class="meet-head" id="mv-mail"><Icon name="ic-spark" size={16} />フォローメール</h2>
		<p class="mv-to">宛先 {minutes.followUpMail.to}</p>
		<p class="mv-to">件名 {minutes.followUpMail.subject}</p>
		{#if editing}
			<textarea class="textarea" rows="6" aria-label="本文を編集" bind:value={draft} use:focusOnMount></textarea>
			<div class="row mv-foot">
				<button class="btn pri sm" onclick={saveEdit}>保存</button>
				<button class="btn tint sm" onclick={() => (editing = false)}>やめる</button>
			</div>
		{:else}
			<p class="mailbody">{minutes.followUpMail.body}</p>
			<!-- 承認カードと同じ組み合わせ (主は塗り、編集は薄い塗り)。承認に回した後は直せない
			     (直すのは承認待ちのパネルの「編集」) ので、編集は出さない -->
			<div class="row mv-foot">
				<button class="btn pri sm" onclick={send} disabled={sent}>
					{sent ? '承認待ちに送りました' : '承認して送信'}
				</button>
				{#if !sent}<button class="btn tint sm" onclick={startEdit}>編集</button>{/if}
			</div>
		{/if}
	</section>
	{/if}
{/if}

<style>
	.mv {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin-bottom: var(--sp-6);
	}
	.mv-summary {
		margin: 0;
		line-height: 1.7;
	}
	.mv-sub {
		margin: var(--sp-3) 0 0;
		font-size: 14px;
		color: var(--ink-2);
	}
	.mv-decisions {
		margin: 0;
		padding-left: 1.4em;
		line-height: 1.8;
	}
	.mv-to {
		margin: 0;
		color: var(--ink-2);
		font-size: 13px;
	}
	.mv-foot {
		margin-top: var(--sp-3);
		gap: var(--sp-2);
	}
	.mv-done {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		margin-bottom: var(--sp-6);
		color: var(--ink-2);
	}
</style>
