<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/store.svelte';
	import { meetingMailTargetFor, personOf } from '$lib/derived';
	import { parse, rel, fmtMDW } from '$lib/dates';
	import { generateAgenda, markBriefRead, shareAgenda, updateAgenda } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Tip from '$lib/components/Tip.svelte';
	import BriefView from '$lib/components/BriefView.svelte';
	import TranscriptModal from '$lib/components/TranscriptModal.svelte';
	import MinutesView from '$lib/components/MinutesView.svelte';

	const id = $derived(page.params.id!);
	const meeting = $derived(db.meetings.find((m) => m.id === id));
	const event = $derived(db.events.find((e) => e.id === meeting?.eventId));
	const person = $derived(personOf(db, meeting?.personIds[0]));
	/* メールを送れる相手かどうか。社内の人物はメールの識別子を持たないので送れない
	   (seed.ts の identities)。送れない相手にはメールを作る操作を出さない */
	const mailTo = $derived(meeting ? meetingMailTargetFor(db, meeting.id) : undefined);

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

<div class="people">
	<header class="people-head">
		<a class="btn text sm people-back" href="/meetings">
			<Icon name="ic-left" size={18} />会議・議事録
		</a>
		<div class="people-title">
			<h1>{meeting?.title ?? '見つかりません'}</h1>
			{#if event}
				<p class="muted num">
					{fmtMDW(parse(event.date))}
					{event.start}〜{event.end}{event.place ? ` / ${event.place}` : ''}
				</p>
			{/if}
			{#if meeting?.brief}
				<!-- 作成した時刻は Brief が持っているので、文言もそこから組む (types.ts Brief.createdAt) -->
				<p class="muted mt-note">
					{meeting.brief.note ??
						`${rel(parse(meeting.brief.createdAt.slice(0, 10)), parse(db.seededOn))} ${meeting.brief.createdAt.slice(11, 16)} に KUROKO が作成しました`}
				</p>
			{/if}
		</div>
	</header>

	{#if !meeting}
		<p class="people-missing">この会議は登録されていません。</p>
	{:else}
		<!-- 内容の層なのでガラスは当てず、普通のカードの面に置く (glass-scope.md 6 節) -->
		<div class="people-cards">
			<section class="card people-sec">
				<h2>Brief</h2>
				{#if meeting.brief}
					<BriefView {meeting} />
				{:else}
					<p class="muted">この会議の Brief はまだありません。</p>
				{/if}
			</section>

			<section class="card people-sec">
				<h2 class="row">
					アジェンダ
					{#if meeting.agendaShared}
						<Tip text="アジェンダ共有済み">
							<Icon name="ic-share" size={16} label="アジェンダ共有済み" class="meet-shared" />
						</Tip>
					{/if}
				</h2>

				{#if generating}
					<p class="muted" aria-live="polite">アジェンダを作成しています…</p>
				{:else if !meeting.agenda.length}
					<p class="muted">議事の下書きを KUROKO が作ります。</p>
					<!-- buttons.md 観点 A 原則 3 — 塗りの主ボタンはこの画面で 1 つだけ。議事録が
					     できていれば会議は終わっており、次にすべきなのは MinutesView の
					     「承認して送信」なので、そちらへ塗りを譲る -->
					<button class="btn {meeting.minutes ? 'sec' : 'pri'}" onclick={create}>
						<Icon name="ic-spark" size={20} />アジェンダを作成
					</button>
				{:else if editing}
					<ol>
						{#each draft as _, i (i)}
							<li><input class="input" aria-label="アジェンダ {i + 1} 行目" bind:value={draft[i]} /></li>
						{/each}
					</ol>
					<div class="row">
						<button class="btn sec" onclick={saveEdit}>保存する</button>
						<button class="btn text" onclick={() => (editing = false)}>やめる</button>
					</div>
				{:else}
					<ol>
						{#each meeting.agenda as t, i (i)}<li>{t}</li>{/each}
					</ol>
					<div class="row">
						<button class="btn text" onclick={startEdit}>
							<Icon name="ic-edit" size={18} />編集する
						</button>
						{#if !meeting.agendaShared && mailTo}
							<button class="btn sec" onclick={share}>
								<Icon name="ic-share" size={18} />参加者に共有 (承認が必要)
							</button>
						{/if}
					</div>
					{#if !meeting.agendaShared}
						<!-- 出せない操作は黙って消さず、出せない理由を書く (chat.md 観点 4.1 —
						     できないことは 1 文目で言い切る) -->
						<p class="muted">
							{mailTo
								? `共有先: ${mailTo.person.name}`
								: `${person?.name ?? 'この相手'}にはメールアドレスが登録されていないため、共有できません。`}
						</p>
					{/if}
				{/if}
			</section>

			<!-- 議事録ができたら札ごと差し替える。MinutesView は自分で .card を描くので、
			     この札の中に入れずきょうだいとして置く (glass-scope.md 3 節) -->
			{#if meeting.minutes}
				<MinutesView {meeting} />
			{:else}
				<section class="card people-sec">
					<h2>記録</h2>
					<p class="muted">会議が終わったら、文字起こしから議事録と ToDo を作ります。</p>
					<div class="row">
						<button class="btn sec" onclick={() => (transcriptOpen = true)}>
							<Icon name="ic-transcript" size={18} />文字起こしを追加
						</button>
						<button class="btn sec" disabled title="準備中">
							<Icon name="ic-mic" size={18} />スマホで録音 (準備中)
						</button>
					</div>
				</section>
			{/if}
		</div>
		<TranscriptModal
			open={transcriptOpen}
			meetingId={meeting.id}
			onclose={() => (transcriptOpen = false)}
		/>
	{/if}
</div>

<style>
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
		gap: var(--sp-3);
	}
	:global(.meet-shared) {
		color: var(--ok);
	}
</style>
