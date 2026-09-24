<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { deleteEvent, undo } from '$lib/actions';
	import { toast } from '$lib/ui.svelte';
	import { parse, key, addDays, fmtMD, fmtYMDW } from '$lib/dates';
	import { weekOf } from '$lib/calendar';
	import { linkUrl } from '$lib/derived';
	import { personOf, projectOf } from '$lib/derived';
	import Icon from '$lib/components/Icon.svelte';
	import Tip from '$lib/components/Tip.svelte';
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
		// 空振り (すでに消えている予定) ではログが積まれないので、返り値で判定する
		const l = deleteEvent(detail.id);
		if (l) toast(`予定「${detail.title}」を削除しました`, { undo: () => undo(l.id) });
		detail = null;
	}
</script>

<svelte:head><title>カレンダー — KUROKO AI</title></svelte:head>

<div class="cal">
	<header class="cal-head page-head">
		<div class="page-title">
			<h1>カレンダー</h1>
			<p class="page-desc">月表示と週表示で、予定を確認・登録します。</p>
		</div>
	</header>

	<div class="row cal-bar">
		<!-- Task 10p (参考の良い点 9、調査: Apple HIG Segmented controls「all segments are usually
		     equal in width」、M3 Segmented buttons「Segment width = Container width / total
		     segments」) — 月/週は排他の表示切り替えなので絞り込みチップの .chip ではなく
		     等幅・隣接・単一外枠の segmented control (.seg) にする。選択は塗りだけで示し、
		     チェック印は出さない (どちらを選んでも幅が変わらない) -->
		<div class="seg" role="group" aria-label="表示の切り替え">
			<button class="seg-btn" class:on={view === 'month'} aria-pressed={view === 'month'} onclick={() => (view = 'month')}>月</button>
			<button class="seg-btn" class:on={view === 'week'} aria-pressed={view === 'week'} onclick={() => (view = 'week')}>週</button>
		</div>
		<!-- Mac のカレンダーと同じく「今日」は前後の矢印の間に枠なしで置き、日付を動かす操作を
		     1 つの塊にする (ユーザー指摘 2026-09-24: 枠付きで単独に並ぶと浮いて見えた) -->
		<div class="row cal-nav">
			<button class="iconbtn" aria-label={view === 'month' ? '前の月' : '前の週'} onclick={() => shift(-1)}>
				<Icon name="ic-left" size={20} />
			</button>
			<button class="btn text sm" onclick={() => (cursor = parse(db.seededOn))}>今日</button>
			<!-- ic-arrow (軸+矢じり) は ic-left (山形) と絵柄の系統が違うとの指摘。対になる山形の
			     ic-chev に揃える -->
			<button class="iconbtn" aria-label={view === 'month' ? '次の月' : '次の週'} onclick={() => shift(1)}>
				<Icon name="ic-chev" size={20} />
			</button>
		</div>
		<h2 class="cal-title" aria-live="polite">{title}</h2>
		<!-- 追加は Apple のカレンダーと同じく「+」だけのボタンにして、日付の操作と同じ列の
		     右端に置く (青い塗りの大きなボタンが上部バーの下に単独で浮いていた) -->
		<a class="iconbtn cal-add" href="/calendar?new=1" title="予定を追加" aria-label="予定を追加">
			<Icon name="ic-plus" size={20} />
		</a>
	</div>

	<!-- Task 10w — HIG 上ガラスを持たないコンテンツ層なので、Task 12 のガラス (glass()) を外して
	     普通のカードの面 (.card) に戻した (glass-scope.md 6 節) -->
	<section class="card cal-panel" aria-label="{title}の予定">
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
			<Tip text="場所"><Icon name="ic-pin" size={16} label="場所" /></Tip>
			<span class="tc-text">{detail.place ?? (detail.online ? 'オンライン' : '指定なし')}</span>
		</div>
		{#if people.length}
			<div class="list-row">
				<Tip text="参加者"><Icon name="ic-people" size={16} label="参加者" /></Tip>
				<span class="tc-text">{people.join('、')}</span>
			</div>
		{/if}
		{#if detail.projectId}
			<div class="list-row">
				<Tip text="案件"><Icon name="ic-target" size={16} label="案件" /></Tip>
				<span class="tc-text">{projectOf(db, detail.projectId)?.name}</span>
			</div>
		{/if}
		{#if detail.url}
			<div class="list-row">
				<Tip text={detail.online === 'zoom' ? 'Zoom' : 'Meet'}><Icon name="ic-video" size={16} label={detail.online === 'zoom' ? 'Zoom' : 'Meet'} /></Tip>
				<a class="tc-text" href={linkUrl(detail.url)} target="_blank" rel="noreferrer">{detail.url}</a>
			</div>
		{/if}
		{#if detail.meetingId}
			<div class="list-row">
				<Tip text="会議"><Icon name="ic-bell" size={16} label="会議" /></Tip>
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
	.cal-add {
		margin-left: auto;
		color: var(--accent);
	}
	.cal-panel {
		padding: var(--sp-4);
		overflow: hidden;
	}
</style>
