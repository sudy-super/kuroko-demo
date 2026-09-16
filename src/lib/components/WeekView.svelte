<script lang="ts">
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { key, minutes, hm } from '$lib/dates';
	import { layoutColumns, eventsOn, weekOf } from '$lib/calendar';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

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
	/* 最小の高さは 24px (WCAG 2.2 SC 2.5.8)。
	   calendar-block.md「左線の可否」— 上下に隣り合う予定の塗りが触れないよう 1px 引く */
	const height = (e: CalendarEvent) =>
		Math.max(24, (minutes(e.end) - minutes(e.start)) * PX - 1);

	/* calendar-block.md「時刻の位置」— 1 行目に題名、2 行目に時刻。2 行の高さは
	   上下の余白 4px x 2 + 題名 14px x 1.25 + 時刻 12px x 1.25 = 40.5px なので、
	   42px に届かない予定 (45 分以下) は題名だけに落とす */
	const TWO_LINES = 42;

	/* calendar-block.md「仮・バッファ・オンライン・準備の示し方」— 属性は塗りやバーの色を
	   変えず、題名の前のアイコンで示す。狭い列で題名が消えないよう 2 個までに切る */
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
				{#each layoutColumns(eventsOn(db, k)) as { event, col, cols } (event.id)}
					{@const h = height(event)}
					{@const a = attrs(event)}
					<!-- 重なりは塊の幅を列数で均等に割り、右端に 1px 残して隣と塗りを離す -->
					<button
						class="week-ev"
						class:tentative={event.tentative}
						class:kuroko={event.source === 'kuroko'}
						class:split={cols > 1}
						style="top: {top(minutes(event.start))}px; height: {h}px; left: calc(4px + (100% - 8px) * {col /
							cols}); width: calc((100% - 8px) * {1 / cols} - 1px)"
						aria-label={label(event, a)}
						onclick={() => onopen(event)}
					>
						<span class="week-ev-bar"></span>
						<span class="week-ev-t">
							{#each a as x (x.name)}
								<Tip text={x.label}>
									<Icon name={x.name} size={16} label={x.label} />
								</Tip>
							{/each}
							<span class="week-ev-n">{event.title}</span>
						</span>
						{#if h >= TWO_LINES}
							<!-- 列が狭いと終わりの時刻まで入らないので、CSS で終わりだけを落とす -->
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
