<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { deleteEvent, undo } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import { parse, key, addDays, fmtMD, fmtYMDW } from '$lib/dates';
	import { weekOf } from '$lib/calendar';
	import { personOf, projectOf } from '$lib/derived';
	import Icon from '$lib/components/Icon.svelte';
	import { glass, CARD } from '$lib/glass';
	import Modal from '$lib/components/Modal.svelte';
	import WeekView from '$lib/components/WeekView.svelte';
	import MonthView from '$lib/components/MonthView.svelte';
	import EventForm from '$lib/components/EventForm.svelte';

	let view = $state<'week' | 'month'>('week');
	// 「今日」はシードの基準日。実時刻ではなく db.seededOn を使う (derived と同じ規則)
	let cursor = $state(parse(db.seededOn));
	let detail = $state<CalendarEvent | null>(null);

	const days = $derived(weekOf(cursor));
	const title = $derived(
		view === 'month'
			? `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`
			: `${fmtMD(days[0])} 〜 ${fmtMD(days[6])}`
	);

	const params = $derived(page.url.searchParams);
	const formOpen = $derived(params.get('new') === '1');
	const initial = $derived({
		date: params.get('date') ?? undefined,
		start: params.get('start') ?? undefined,
		place: params.get('place') ?? undefined
	});
	const closeForm = () => goto('/calendar', { replaceState: true, noScroll: true, keepFocus: true });

	function shift(n: number) {
		cursor =
			view === 'month'
				? new Date(cursor.getFullYear(), cursor.getMonth() + n, 1)
				: addDays(7 * n, cursor);
	}

	function pick(d: Date) {
		cursor = d;
		view = 'week';
	}

	function remove() {
		if (!detail) return;
		deleteEvent(detail.id);
		// deleteEvent が今積んだログを取り消す (登録のときと同じ作法)
		const l = db.logs[0];
		toast(`予定「${detail.title}」を削除しました`, { undo: () => undo(l.id) });
		detail = null;
	}
</script>

<svelte:head><title>カレンダー — KUROKO AI</title></svelte:head>

<div class="cal">
	<header class="cal-head">
		<h1>カレンダー</h1>
		<a class="btn pri" href="/calendar?new=1"><Icon name="ic-plus" size={20} />予定を追加</a>
	</header>

	<div class="row cal-bar">
		<div class="row" role="group" aria-label="表示の切り替え">
			<button class="chip" class:on={view === 'month'} aria-pressed={view === 'month'} onclick={() => (view = 'month')}>
				{#if view === 'month'}<Icon name="ic-check" size={18} />{/if}月
			</button>
			<button class="chip" class:on={view === 'week'} aria-pressed={view === 'week'} onclick={() => (view = 'week')}>
				{#if view === 'week'}<Icon name="ic-check" size={18} />{/if}週
			</button>
		</div>
		<button class="btn sec" onclick={() => (cursor = parse(db.seededOn))}>今日</button>
		<div class="row cal-nav">
			<button class="iconbtn" aria-label={view === 'month' ? '前の月' : '前の週'} onclick={() => shift(-1)}>
				<Icon name="ic-left" size={20} />
			</button>
			<button class="iconbtn" aria-label={view === 'month' ? '次の月' : '次の週'} onclick={() => shift(1)}>
				<Icon name="ic-arrow" size={20} />
			</button>
		</div>
		<h2 class="cal-title" aria-live="polite">{title}</h2>
	</div>

	<!-- 面が幅いっぱい x 約 660px と広く、毎フレーム描き直すと本番ビルドでも 30 フレーム/秒台に
		 落ちる。この面の下に来るのは壁紙の階調だけで、120 ミリ秒ごとに描き直しても見た目は
		 変わらない (Task 12 の repaintMs を復活させた) -->
	<section class="card cal-panel" aria-label="{title}の予定" {@attach glass(CARD, 120)}>
		{#if view === 'month'}
			<MonthView {cursor} onopen={(e) => (detail = e)} onpick={pick} />
		{:else}
			<WeekView {cursor} onopen={(e) => (detail = e)} />
		{/if}
	</section>
</div>

<EventForm open={formOpen} {initial} onclose={closeForm} />

<Modal
	open={!!detail}
	size="sm"
	title={detail?.title ?? ''}
	description={detail ? `${fmtYMDW(parse(detail.date))} ${detail.start}〜${detail.end}` : undefined}
	onclose={() => (detail = null)}
>
	{#if detail}
		{@const people = detail.personIds.map((id) => personOf(db, id)?.name).filter(Boolean)}
		<div class="list-row">
			<span class="badge src">場所</span>
			<span class="tc-text">{detail.place ?? (detail.online ? 'オンライン' : '指定なし')}</span>
		</div>
		{#if people.length}
			<div class="list-row">
				<span class="badge src">参加者</span>
				<span class="tc-text">{people.join('、')}</span>
			</div>
		{/if}
		{#if detail.projectId}
			<div class="list-row">
				<span class="badge src">案件</span>
				<span class="tc-text">{projectOf(db, detail.projectId)?.name}</span>
			</div>
		{/if}
		{#if detail.url}
			<div class="list-row">
				<span class="badge src">{detail.online === 'zoom' ? 'Zoom' : 'Meet'}</span>
				<a class="tc-text" href={detail.url} target="_blank" rel="noreferrer">{detail.url}</a>
			</div>
		{/if}
		{#if detail.meetingId}
			<div class="list-row">
				<span class="badge src">会議</span>
				<a class="tc-text" href="/meetings/{detail.meetingId}">会議の準備を見る</a>
			</div>
		{/if}
	{/if}
	{#snippet actions()}
		<button class="btn danger" onclick={remove}>削除</button>
		<button class="btn text" onclick={() => (detail = null)}>閉じる</button>
	{/snippet}
</Modal>

<style>
	.cal {
		max-width: 1080px;
	}
	.cal-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-5);
		padding: 0 var(--sp-5) var(--sp-5);
	}
	.cal-bar {
		flex-wrap: wrap;
		gap: var(--sp-3);
		padding: 0 var(--sp-5) var(--sp-5);
	}
	.cal-nav {
		gap: var(--sp-1);
	}
	/* 表示している範囲。見出しの階層は h2 のまま、大きさは本文の 1 段上に落とす */
	.cal-title {
		font-size: 18px;
	}
	.cal-panel {
		padding: var(--sp-4);
		overflow: hidden;
	}
</style>
