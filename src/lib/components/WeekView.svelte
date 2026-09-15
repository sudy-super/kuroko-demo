<script lang="ts">
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { key, minutes, hm } from '$lib/dates';
	import { layoutColumns, eventsOn, weekOf } from '$lib/calendar';

	let { cursor, onopen }: { cursor: Date; onopen: (e: CalendarEvent) => void } = $props();

	/* components 3.12 — 8:00〜20:00 を 1 時間 48px。30 分の予定がちょうど 24px になる */
	const FROM = 8 * 60;
	const TO = 20 * 60;
	const PX = 48 / 60;
	const HOURS = Array.from({ length: (TO - FROM) / 60 }, (_, i) => 8 + i);
	const WD = ['月', '火', '水', '木', '金', '土', '日'];

	const days = $derived(weekOf(cursor));
	const todayKey = $derived(db.seededOn);

	/* 現在時刻線は実時刻で引く。1 分ごとに引き直す */
	let now = $state(minutes(hm()));
	$effect(() => {
		const t = setInterval(() => (now = minutes(hm())), 60000);
		return () => clearInterval(t);
	});

	const top = (m: number) => Math.max(0, (m - FROM) * PX);
	// 8:00 より前に始まる予定は上端で切り、最小の高さは 24px (WCAG 2.2 SC 2.5.8)
	const height = (e: CalendarEvent) =>
		Math.max(24, Math.min(TO, minutes(e.end)) * PX - Math.max(FROM, minutes(e.start)) * PX);
</script>

<div class="week">
	<div class="week-cols week-head">
		<div></div>
		{#each days as d, i (i)}
			{@const k = key(d)}
			<div class="week-day" class:on={k === todayKey}>
				{WD[i]}<span class="num">{d.getDate()}</span>
			</div>
		{/each}
	</div>
	<div class="week-cols week-body">
		<div class="week-axis">
			{#each HOURS as h (h)}<div class="week-hour"><span>{h}:00</span></div>{/each}
		</div>
		{#each days as d, i (i)}
			{@const k = key(d)}
			<div class="week-col" class:on={k === todayKey}>
				{#each layoutColumns(eventsOn(db, k)) as { event, offset } (event.id)}
					<button
						class="week-ev"
						class:tentative={event.tentative}
						class:kuroko={event.source === 'kuroko'}
						style="top: {top(minutes(event.start))}px; height: {height(event)}px; left: calc(4px + {offset} * 24px)"
						onclick={() => onopen(event)}
					>
						<span class="num">{event.start}</span>
						{event.title}
					</button>
				{/each}
				{#if k === todayKey && now >= FROM && now <= TO}
					<div class="week-now" style="top: {top(now)}px" aria-label="現在時刻 {hm()}"></div>
				{/if}
			</div>
		{/each}
	</div>
</div>
