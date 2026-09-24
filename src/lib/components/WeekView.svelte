<script lang="ts">
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { key, minutes, hm } from '$lib/dates';
	import {
		layoutColumns,
		eventsOn,
		weekOf,
		WEEK_HOUR_PX,
		WEEK_MIN_EVENT_PX,
		WEEK_MIN_DURATION_MIN
	} from '$lib/calendar';
	import { clock } from '$lib/clock.svelte';
	import Tip from './Tip.svelte';

	let { cursor, onopen }: { cursor: Date; onopen: (e: CalendarEvent) => void } = $props();

	/* 1 分あたりの高さ。既定の 48px/時 だと 30 分の予定が 24px で、当たり判定が下限 44px (HIG / WCAG 2.5.8) に
	   届かない。疑似要素の継ぎ足しは overflow: hidden に切られるので目盛りを上げる (calendar.ts の WEEK_HOUR_PX)。
	   格子は 0:00〜24:00 の全部を持つ (8〜20 時だけだと範囲外の予定が出ない) */
	const PX = WEEK_HOUR_PX / 60;
	const HOURS = Array.from({ length: 24 }, (_, i) => i);
	const OPEN = 8 * 60 * PX; // 開いた直後に見せる位置 (8:00)
	const WD = ['月', '火', '水', '木', '金', '土', '日'];

	const days = $derived(weekOf(cursor));
	const todayKey = $derived(db.seededOn);

	/* 現在時刻線は実時刻で引く。分の変わり目で引き直す (clock.svelte.ts) */
	const now = $derived(minutes(hm(clock.now)));

	/* 開いた直後だけ 8:00 が上端に来るよう送る。狭い幅で格子が横に送られるときは、今日の列が
	   見える位置まで横にも送る (390px では木曜以降が画面の外に出る)。以降は利用者の位置を動かさない */
	let body: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (!body) return;
		body.scrollTop = OPEN;
		const today = body.querySelector<HTMLElement>('.week-day.on');
		if (today) body.scrollLeft = Math.max(0, today.offsetLeft + today.offsetWidth - body.clientWidth);
	});

	const top = (m: number) => m * PX;
	/* 短い予定も当たり判定の下限 (WEEK_MIN_EVENT_PX) まで伸ばして描き、伸びたぶんを重なり判定にも渡す。
	   実時間のままだと続けて入った予定の描画が重なる */
	const height = (e: CalendarEvent) =>
		Math.max(WEEK_MIN_EVENT_PX, (minutes(e.end) - minutes(e.start)) * PX);

	/* 重なりの横位置。左右の余白を 4px でそろえたいので、幅から 1px 引いて右にずらす手は
	   使わず、先に列の間の隙間 (cols - 1)px を引いてから均等に割る */
	const place = (col: number, cols: number) => {
		const w = `(100% - ${8 + cols - 1}px) / ${cols}`;
		return `left: calc(4px + ${col} * (${w} + 1px)); width: calc(${w});`;
	};

	/* 1 行目に題名、2 行目に時刻。2 行は 4 x 2 + 14 x 1.25 + 12 x 1.25 = 40.5px なので、42px 未満は題名だけ */
	const TWO_LINES = 42;

	/* 属性は色を変えず題名の前のアイコンで示す (calendar-block.md)。2 個まで。狭いブロックでは CSS 側で落とす */
	const attrs = (e: CalendarEvent) =>
		[
			e.online ? { name: 'ic-video', label: 'オンライン会議' } : null,
			e.meetingId && db.meetings.some((m) => m.id === e.meetingId && m.brief)
				? { name: 'ic-doc', label: '会議準備あり' }
				: null,
			e.bufferBefore || e.bufferAfter ? { name: 'ic-car', label: '移動時間あり' } : null
		]
			.filter((x) => x !== null)
			.slice(0, 2);

	/* アイコンと点線は読み上げに届かないので、名前を文言で組み立てて button に付ける
	   (WCAG 1.4.1: 色や形だけに頼らない) */
	const label = (e: CalendarEvent, a: { label: string }[]) =>
		[`${e.title} ${e.start}〜${e.end}`, ...a.map((x) => x.label), e.tentative ? '仮押さえ' : '']
			.filter(Boolean)
			.join(' ');
</script>

<!-- 横と縦の送りはこの箱 1 つが持つ (送りを分けると曜日の行の sticky が効かない)。予定の無い週でも
     キーボードで来られるよう、送れる領域そのものを焦点に入れる (WCAG 2.1.1) -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="week" bind:this={body} tabindex="0" role="group" aria-label="週の時間割">
	<div class="week-cols week-head">
		<div></div>
		{#each days as d, i (i)}
			{@const k = key(d)}
			<!-- Google カレンダーと同じく、曜日を小さく上に、日付を大きく下に置き、今日は日付を塗りの丸で囲む -->
			<div class="week-day" class:on={k === todayKey} aria-current={k === todayKey ? 'date' : undefined}>
				<span class="week-wd">{WD[i]}</span><span class="week-date num">{d.getDate()}</span>
			</div>
		{/each}
	</div>
	<div class="week-cols week-body">
		<div class="week-axis">
			{#each HOURS as h (h)}<div class="week-hour"><span>{h}:00</span></div>{/each}
		</div>
		{#each days as d, i (i)}
			{@const k = key(d)}
			<div class="week-col">
				{#each layoutColumns(eventsOn(db, k), WEEK_MIN_DURATION_MIN) as { event, col, cols } (event.id)}
					{@const h = height(event)}
					{@const a = attrs(event)}
					<!-- 重なりは塊の幅から列の間の隙間を引いて均等に割る -->
					<button
						class="week-ev"
						class:tentative={event.tentative}
						style="top: {top(minutes(event.start))}px; height: {h}px; {place(col, cols)}"
						aria-label={label(event, a)}
						onclick={() => onopen(event)}
					>
						<span class="week-ev-bar"></span>
						<span class="week-ev-t">
							{#each a as x (x.name)}
								<Tip text={x.label} name={x.name} size={16} />
							{/each}
							<!-- 題名は列の幅で切れるので、全文と属性をホバーでも読めるようにする。
							     アイコンのツールチップと重ならないよう、button ではなく題名に付ける -->
							<span class="tc-text" title={label(event, a)}>{event.title}</span>
						</span>
						{#if h >= TWO_LINES}
							<!-- ブロックが狭いと入らないので、終わりの時刻から順に CSS で落とす -->
							<span class="week-ev-time num"
								>{event.start}<span class="week-ev-end">〜{event.end}</span></span
							>
						{/if}
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
