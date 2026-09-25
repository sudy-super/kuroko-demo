<script lang="ts">
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { deleteEvent, undo } from '$lib/actions';
	import { toast, takeIntent, type Intent } from '$lib/ui.svelte';
	import { parse, key, addDays, fmtYMDW } from '$lib/dates';
	import { weekOf } from '$lib/calendar';
	import { linkUrl } from '$lib/derived';
	import { personOf, projectOf } from '$lib/derived';
	import Icon from '$lib/components/Icon.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
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
	/* 週表示でも見出しは年と月にする。日付は曜日の行が大きく出すので、範囲を重ねて書かない
	   (Google カレンダーと同じ。月をまたぐ週は「9月〜10月」) */
	const ym = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月`;
	const title = $derived.by(() => {
		if (view === 'month') return ym(cursor);
		const [a, b] = [days[0], days[6]];
		if (a.getMonth() === b.getMonth()) return ym(a);
		return a.getFullYear() === b.getFullYear() ? `${ym(a)}〜${b.getMonth() + 1}月` : `${ym(a)}〜${ym(b)}`;
	});

	// 開いている間の初期値。null なら閉じている。⌘K・チャット・案内の筋書きは intent で埋めて開かせる
	let form = $state<Omit<Extract<Intent, { kind: 'new-event' }>, 'kind'> | null>(null);
	$effect(() => takeIntent('new-event', ({ kind, ...initial }) => (form = initial)));

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
	<h1 class="sr-only">カレンダー</h1>

	<!-- 並びは Google カレンダーに合わせ、日付を動かす操作と見出しを左、表示の切り替えと追加を右に置く -->
	<div class="row page-bar">
		<div class="row cal-nav">
			<button class="iconbtn" aria-label={view === 'month' ? '前の月' : '前の週'} onclick={() => shift(-1)}>
				<Icon name="ic-left" size={20} />
			</button>
			<button class="btn text sm" onclick={() => (cursor = parse(db.seededOn))}>今日</button>
			<button class="iconbtn" aria-label={view === 'month' ? '次の月' : '次の週'} onclick={() => shift(1)}>
				<Icon name="ic-chev" size={20} />
			</button>
		</div>
		<h2 class="cal-title" aria-live="polite">{title}</h2>
		<div class="cal-seg">
			<Segmented
				label="表示の切り替え"
				items={[
					{ key: 'month', label: '月' },
					{ key: 'week', label: '週' }
				]}
				value={view}
				onchange={(k) => (view = k)}
			/>
		</div>
		<button class="iconbtn cal-add" title="予定を追加" aria-label="予定を追加" onclick={() => (form = {})}>
			<Icon name="ic-plus" size={20} />
		</button>
	</div>

	<!-- コンテンツ層なのでガラスは使わない (HIG Materials) -->
	<section class="card cal-panel" aria-label="{title}の予定">
		{#if view === 'month'}
			<MonthView {cursor} onopen={(e) => (detail = e)} onpick={pick} />
		{:else}
			<WeekView {cursor} onopen={(e) => (detail = e)} />
		{/if}
	</section>
</div>

<EventForm open={!!form} initial={form ?? undefined} onclose={() => (form = null)} />

<Modal
	open={!!detail}
	size="sm"
	title={detail?.title ?? ''}
	description={detail ? `${fmtYMDW(parse(detail.date))} ${detail.start}〜${detail.end}` : undefined}
	onclose={() => (detail = null)}
>
	{#if detail}
		{@const people = detail.personIds.map((id) => personOf(db, id)?.name).filter(Boolean)}
		{@const rows = [
			{ tip: '場所', icon: 'ic-pin', text: detail.place ?? (detail.online ? 'オンライン' : '指定なし') },
			people.length && { tip: '参加者', icon: 'ic-people', text: people.join('、') },
			detail.projectId && { tip: '案件', icon: 'ic-target', text: projectOf(db, detail.projectId)?.name },
			detail.url && {
				tip: detail.online === 'zoom' ? 'Zoom' : 'Meet',
				icon: 'ic-video',
				text: detail.url,
				href: linkUrl(detail.url),
				external: true
			},
			detail.meetingId && { tip: '会議', icon: 'ic-bell', text: '会議の準備を見る', href: `/meetings/${detail.meetingId}` }
		].filter((r) => !!r)}
		{#each rows as r (r.icon)}
			<div class="list-row">
				<Tip text={r.tip} name={r.icon} size={16} />
				{#if r.href}
					<a class="tc-text" href={r.href} target={r.external ? '_blank' : undefined} rel={r.external ? 'noreferrer' : undefined}
						>{r.text}</a
					>
				{:else}
					<span class="tc-text">{r.text}</span>
				{/if}
			</div>
		{/each}
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
	.cal-nav {
		gap: var(--sp-1);
	}
	/* 表示している範囲。見出しの階層は h2 のまま、大きさは本文の 1 段上に落とす */
	.cal-title {
		font-size: 18px;
	}
	.cal-seg {
		margin-left: auto;
	}
	.cal-add {
		color: var(--accent);
	}
	.cal-panel {
		padding: var(--sp-4);
		overflow: hidden;
	}
</style>
