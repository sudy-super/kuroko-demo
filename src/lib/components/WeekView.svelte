<script lang="ts">
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { key, minutes, hm } from '$lib/dates';
	import { layoutColumns, eventsOn, weekOf } from '$lib/calendar';

	let { cursor, onopen }: { cursor: Date; onopen: (e: CalendarEvent) => void } = $props();

	/* components 3.12 — 1 時間 48px。30 分の予定がちょうど 24px になる。
	   0:00〜24:00 の全部を持ち、見える高さ (12 時間分) は CSS の .week-body で切って縦に送る。
	   8:00〜20:00 だけを持つと、20:00 より後に作った予定がどこにも出なくなる */
	const PX = 48 / 60;
	const HOURS = Array.from({ length: 24 }, (_, i) => i);
	const OPEN = 8 * 60 * PX; // 開いた直後に見せる位置 (8:00)
	const WD = ['月', '火', '水', '木', '金', '土', '日'];

	const days = $derived(weekOf(cursor));
	const todayKey = $derived(db.seededOn);

	/* 現在時刻線は実時刻で引く。1 分ごとに引き直す */
	let now = $state(minutes(hm()));
	$effect(() => {
		const t = setInterval(() => (now = minutes(hm())), 60000);
		return () => clearInterval(t);
	});

	// 開いた直後だけ 8:00 が上端に来るよう送る。以降は利用者の位置を動かさない
	let body: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (body) body.scrollTop = OPEN;
	});

	const top = (m: number) => m * PX;
	// 最小の高さは 24px (WCAG 2.2 SC 2.5.8)
	const height = (e: CalendarEvent) =>
		Math.max(24, (minutes(e.end) - minutes(e.start)) * PX);
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
	<!-- 縦に送る領域。予定が 1 つもない週では中に押せるものが無く、キーボードだけでは
	     ここへ来られないので、領域そのものを焦点に入れる (WCAG 2.1.1)。
	     規則は「押せない要素に tabindex を置くな」だが、縦に送れる領域はその例外に当たる -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="week-cols week-body" bind:this={body} tabindex="0" role="group" aria-label="週の時間割">
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
				{#if k === todayKey}
					<!-- 現在時刻の線。時刻は左の目盛りで読めるので、読み上げには出さない -->
					<div class="week-now" style="top: {top(now)}px"></div>
				{/if}
			</div>
		{/each}
	</div>
</div>
