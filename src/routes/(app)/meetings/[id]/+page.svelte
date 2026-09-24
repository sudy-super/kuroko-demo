<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { eventDateOf, eventOf, meetingMailTargetFor, meetingOf, personOf } from '$lib/derived';
	import { parse, fmtMDW, relAt } from '$lib/dates';
	import { generateAgenda, markBriefRead, shareAgenda, updateAgenda } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import DetailPage from '$lib/components/DetailPage.svelte';
	import BriefView from '$lib/components/BriefView.svelte';
	import TranscriptModal from '$lib/components/TranscriptModal.svelte';
	import MinutesView from '$lib/components/MinutesView.svelte';

	const id = $derived(page.params.id!);
	const meeting = $derived(meetingOf(db, id));
	const event = $derived(eventOf(db, meeting?.eventId));
	const person = $derived(personOf(db, meeting?.personIds[0]));
	/* メールを送れる相手かどうか。社内の人物はメールの識別子を持たないので送れない
	   (seed.ts の identities)。送れない相手にはメールを作る操作を出さない */
	const mailTo = $derived(meeting ? meetingMailTargetFor(db, meeting.id) : undefined);
	/* meeting-detail.md — 会議の前は準備とアジェンダ、後は議事録・ToDo 候補・フォローメールだけを出す。
	   終わった会議にアジェンダを作る操作を出さない。議事録がまだ無い終わった会議は、記録を
	   追加する操作を出す */
	const done = $derived(!!meeting && (eventDateOf(db, meeting) ?? '') < db.seededOn);
	// 共有は承認を通ってから送られる。承認待ちの間は共有の操作を出さず、そのことを書く
	const sharePending = $derived(
		db.approvals.some(
			(a) => a.payload.type === 'agenda' && a.payload.meetingId === meeting?.id && (a.status === 'pending' || a.status === 'sending')
		)
	);

	/* 「Brief を読んだ」の印。Today の「次の会議の準備」はこの印で消える (derived.ts todayItems)。
	   会議が無い id では立てない */
	$effect(() => {
		if (meeting?.brief && !meeting.briefRead) markBriefRead(meeting.id);
	});

	const GEN_MS = 1000;
	let generating = $state(false);
	let transcriptOpen = $state(false);
	let editing = $state(false);
	let draft = $state<string[]>([]);

	function create() {
		if (!meeting) return;
		generating = true;
		const target = meeting.id;
		setTimeout(() => {
			generateAgenda(target);
			generating = false;
		}, GEN_MS);
	}

	function startEdit() {
		draft = [...(meeting?.agenda ?? [])];
		editing = true;
	}

	function saveEdit() {
		if (!meeting) return;
		updateAgenda(meeting.id, draft.map((t) => t.trim()).filter(Boolean));
		editing = false;
	}

	function share() {
		if (!meeting) return;
		shareAgenda(meeting.id, 'meeting');
		ui.approvalDrawer = true;
	}
</script>

<svelte:head><title>{meeting?.title ?? '会議'} — KUROKO AI</title></svelte:head>

<!-- 内容の層なのでガラスは当てず、普通のカードの面に置く (glass-scope.md 6 節) -->
<!-- 上から下へ、会議の流れの順 (準備 → アジェンダ、議事録 → ToDo の候補 → フォローメール) に
     1 列で読む (meeting-detail.md 6 — Meet / Zoom / Teams の要約も同じ順) -->
<DetailPage
	back={{ href: '/meetings', label: '会議・議事録' }}
	item={meeting}
	title={(m) => m.title}
	missing="この会議は登録されていません。"
	cardsClass="mt-cards"
>
	{#snippet sub(meeting)}
		{#if event}
			<p class="muted num">
				{fmtMDW(parse(event.date))}
				{event.start}〜{event.end}{event.place ? ` / ${event.place}` : ''}
			</p>
		{/if}
		{#if meeting.brief && !done}
			<!-- 作成した時刻は Brief が持っているので、文言もそこから組む (types.ts Brief.createdAt) -->
			<p class="muted mt-note">
				{meeting.brief.note ??
					`${relAt(meeting.brief.createdAt, db.seededOn)} に KUROKO が作成しました`}
			</p>
		{/if}
	{/snippet}
	{#snippet children(meeting)}
		{#if !done}
			<section class="card people-sec" aria-labelledby="mt-brief">
				<h2 class="meet-head" id="mt-brief"><Icon name="ic-spark" size={16} />会議の準備</h2>
				{#if meeting.brief}
					<BriefView {meeting} />
				{:else}
					<p class="muted">まだ届いていません</p>
				{/if}
			</section>

			<section class="card people-sec" aria-labelledby="mt-agenda">
				<h2 class="meet-head" id="mt-agenda">
					{#if meeting.agenda.length}<Icon name="ic-spark" size={16} />{/if}アジェンダ
				</h2>
				{#if generating}
					<p class="muted" aria-live="polite">作成しています…</p>
				{:else if !meeting.agenda.length}
					<!-- HIG Writing — 空の画面には次の一手をボタンで示す。ボタンと同じことを言う
					     説明文は置かない ("If you can use fewer words, do so") -->
					<button class="btn pri" onclick={create}>
						<Icon name="ic-spark" size={20} />アジェンダを作成
					</button>
				{:else if editing}
					<ol>
						{#each draft as _, i (i)}
							<li><input class="input" aria-label="アジェンダ {i + 1} 行目" bind:value={draft[i]} /></li>
						{/each}
					</ol>
					<div class="row">
						<button class="btn pri sm" onclick={saveEdit}>保存</button>
						<button class="btn tint sm" onclick={() => (editing = false)}>やめる</button>
					</div>
				{:else}
					<ol>
						{#each meeting.agenda as t, i (i)}<li>{t}</li>{/each}
					</ol>
					<!-- 共有済みは記号ではなく文で示す (箱から出る矢印は「共有する」操作の記号で、
					     状態を表さない。meeting-list.md 4) -->
					{#if meeting.agendaShared}
						<p class="mt-shared">
							<Icon name="ic-check-c" size={16} />{mailTo?.person.name ?? person?.name ?? '参加者'}さんに共有済み
						</p>
					{:else if sharePending}
						<p class="mt-shared pending"><Icon name="ic-clock" size={16} />共有の承認待ち</p>
					{/if}
					<!-- HIG Generative AI — 作ったものは、その近くで直せるようにする。
					     主は共有、編集は薄い塗り (承認カードと同じ組み合わせ) -->
					<div class="row">
						{#if !meeting.agendaShared && !sharePending && mailTo}
							<button class="btn pri sm" onclick={share}>{mailTo.person.name}さんに共有</button>
						{/if}
						<button class="btn tint sm" onclick={startEdit}>編集</button>
					</div>
					{#if !meeting.agendaShared && !mailTo}
						<!-- 出せない操作は黙って消さず、理由を書く (chat.md 観点 4.1) -->
						<p class="muted">
							{person?.name ?? 'この相手'}さんにはメールアドレスが登録されていないため、共有できません
						</p>
					{/if}
				{/if}
			</section>
		{:else if meeting.minutes}
			<MinutesView {meeting} />
		{:else}
			<section class="card people-sec" aria-labelledby="mt-record">
				<h2 class="meet-head" id="mt-record">議事録</h2>
				<!-- 文字起こしから議事録と ToDo の候補を作る。録音は準備中なので出さない -->
				<button class="btn pri" onclick={() => (transcriptOpen = true)}>
					<Icon name="ic-transcript" size={20} />文字起こしを追加
				</button>
			</section>
		{/if}
	{/snippet}
</DetailPage>
{#if meeting}
	<TranscriptModal
		open={transcriptOpen}
		meetingId={meeting.id}
		onclose={() => (transcriptOpen = false)}
	/>
{/if}

<style>
	.mt-shared.pending {
		color: var(--ink-2);
	}
	:global(.people-cards.mt-cards) {
		grid-template-columns: minmax(0, 1fr);
		max-width: 880px;
	}
	.mt-shared {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
		margin: 0 0 var(--sp-3) !important;
		color: var(--ok);
		font-size: 14px;
	}
	/* 作成した時刻の 1 行は、日時の行より 1 段落とす */
	.mt-note {
		font-size: 14px;
	}
	/* 箇条書きと、その下のボタンの行を離す */
	ol {
		margin: 0 0 var(--sp-4);
		padding-left: 1.6em;
		line-height: 1.7;
	}
	li + li {
		margin-top: var(--sp-2);
	}
	.people-sec .row {
		flex-wrap: wrap;
		gap: var(--sp-2);
	}
</style>
