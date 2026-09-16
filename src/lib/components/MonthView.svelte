<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { key } from '$lib/dates';
	import { monthGrid, eventsOn } from '$lib/calendar';

	let {
		cursor,
		onopen,
		onpick
	}: { cursor: Date; onopen: (e: CalendarEvent) => void; onpick: (d: Date) => void } = $props();

	const WD = ['月', '火', '水', '木', '金', '土', '日'];
	const SHOWN = 3; // 1 日に出す件数。超えた分は「他 N 件」に畳む (仕様 5 の共通の作法)

	/* 幅 390px では 1 日あたり約 46px しかなく、題名は 1 文字も読めない。
	   その幅では日ごと 1 つの押す先にまとめ、予定は点の数で示す */
	const narrow = new MediaQuery('(max-width: 600px)');

	const grid = $derived(monthGrid(cursor));
	const month = $derived(cursor.getMonth());
	const todayKey = $derived(db.seededOn);
</script>

<div class="month">
	<div class="month-head">
		{#each WD as w (w)}<div>{w}</div>{/each}
	</div>
	<div class="month-grid">
		{#each grid as d (key(d))}
			{@const k = key(d)}
			{@const evs = eventsOn(db, k)}
			{@const out = d.getMonth() !== month}
			{#if narrow.current}
				<button
					class="month-cell month-tap"
					class:out
					class:on={k === todayKey}
					onclick={() => onpick(d)}
				>
					<span class="month-day num">{d.getDate()}</span>
					<span class="month-dots">
						{#each evs.slice(0, SHOWN) as e (e.id)}
							<span class="month-dot" class:kuroko={e.source === 'kuroko'}></span>
						{/each}
					</span>
					<span class="sr-only">{d.getMonth() + 1}月{d.getDate()}日 予定 {evs.length} 件</span>
				</button>
			{:else}
				<div class="month-cell" class:out class:on={k === todayKey}>
					<button class="month-day num" onclick={() => onpick(d)}>
						{d.getDate()}<span class="sr-only">日の週を開く</span>
					</button>
					<!-- calendar-block.md「月表示」— 週の面のブロックを縮めるのではなく、
					     細いバー 1 本と題名 1 行まで情報量を落とす。時刻は読み上げにだけ残す -->
					{#each evs.slice(0, SHOWN) as e (e.id)}
						<button
							class="month-ev"
							class:tentative={e.tentative}
							class:kuroko={e.source === 'kuroko'}
							aria-label="{e.start} {e.title}{e.tentative ? ' 仮押さえ' : ''}"
							onclick={() => onopen(e)}
						>
							<span class="month-ev-bar"></span><span class="month-ev-t">{e.title}</span>
						</button>
					{/each}
					{#if evs.length > SHOWN}
						<button class="month-more" onclick={() => onpick(d)}>他 {evs.length - SHOWN} 件</button>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
</div>
