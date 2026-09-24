<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { eventDateOf, eventOf, meetingsOf, personOf } from '$lib/derived';
	import { parse, fmtMDW } from '$lib/dates';
	import Icon from '$lib/components/Icon.svelte';

	/* 会議は自前の日付を持たないので、ひも付く予定の日付で並べる (derived.ts meetingsOf は降順)。
	   「今後」は基準日 (db.seededOn) 当日を含み、近い順に見せたいので反転する */
	const all = $derived(meetingsOf(db, () => true));
	const upcoming = $derived(all.filter((m) => (eventDateOf(db, m) ?? '') >= db.seededOn).reverse());
	const past = $derived(all.filter((m) => (eventDateOf(db, m) ?? '') < db.seededOn));

	/* 行の 2 行目。日時・場所・出る人を 1 行の文字で並べる (meeting-list.md — HIG Lists and tables
	   「行は簡潔に」。以前は頭文字の丸と共有の記号を並べていたが、誰が出るのか・何の記号かが
	   読めなかった。ユーザー指摘 2026-09-25) */
	const names = (ids: string[]) =>
		ids.map((x) => personOf(db, x)?.name).filter((x) => !!x).join('、');
</script>

<svelte:head><title>会議・議事録 — KUROKO AI</title></svelte:head>

<div class="people">
	<h1 class="sr-only">会議・議事録</h1>

	<!-- 内容の層なのでガラスは当てず、普通のカードの面に置く (glass-scope.md 6 節) -->
	<div class="people-cards meet-cards">
		{#snippet group(title: string, icon: string, items: typeof all, headId: string, pastList: boolean)}
			<section class="card people-list" aria-labelledby={headId}>
				<h2 class="list-head" id={headId}>
					<Icon name={icon} size={16} />{title}<span class="num">{items.length}</span>
				</h2>
				{#each items as m (m.id)}
					{@const ev = eventOf(db, m.eventId)}
					{@const who = names(m.personIds)}
					<!-- 右端の状態は、会議の前は準備 (Brief) が届いているか、後は議事録ができているかの
					     1 つだけを、記号と文字の両方で出す。共有の記号は「共有する」操作の記号なので
					     状態には使わない (meeting-list.md 4) -->
					{@const state = pastList ? (m.minutes ? '議事録あり' : '') : m.brief ? '準備あり' : ''}
					<a class="list-row xl meet-row" href="/meetings/{m.id}">
						<span class="people-col">
							<span class="people-name">{m.title}</span>
							<span class="meet-sub">
								<span class="num">{ev ? `${fmtMDW(parse(ev.date))} ${ev.start}〜${ev.end}` : '日時未定'}</span>
								{#if ev?.online || ev?.place}
									<span class="meet-where">
										<Icon name={ev.online ? 'ic-video' : 'ic-pin'} size={14} />{ev.online
											? 'オンライン'
											: ev.place}
									</span>
								{/if}
								{#if who}<span class="meet-who">{who}</span>{/if}
							</span>
						</span>
						{#if state}
							<span class="meet-state"
								><Icon name={pastList ? 'ic-note' : 'ic-doc'} size={16} /><span class="meet-state-text">{state}</span></span
							>
						{/if}
						<Icon name="ic-chev" size={18} class="meet-chev" />
					</a>
				{/each}
				{#if !items.length}<p class="muted">会議はありません</p>{/if}
			</section>
		{/snippet}

		{@render group('今後の会議', 'ic-cal', upcoming, 'mt-up', false)}
		{@render group('過去の会議', 'ic-history', past, 'mt-past', true)}
	</div>
</div>

<style>
	/* 今後と過去は上から下へ時間順に読むので、横に並べず 1 列に積む。横に並べると 1 枚が
	   狭くなり、場所と出る人が切れていた */
	.meet-cards {
		grid-template-columns: minmax(0, 1fr);
		max-width: 880px;
	}
	.meet-row {
		gap: var(--sp-3);
	}
	/* 2 行目は小さく灰色で、項目の間を「・」の代わりに間隔で区切る。狭い幅では末尾から切る */
	.meet-sub {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		min-width: 0;
		overflow: hidden;
		color: var(--ink-2);
		font-size: 13px;
		white-space: nowrap;
	}
	.meet-sub > * {
		flex: none;
	}
	.meet-where {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.meet-who {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.meet-state {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: var(--sp-1);
		color: var(--accent);
		font-size: 13px;
		font-weight: 500;
	}
	:global(.meet-chev) {
		flex: none;
		color: var(--ink-3);
	}
	/* 携帯の幅では状態を記号だけにして、題名に幅を回す (文字は読み上げに残す) */
	@media (max-width: 600px) {
		/* 2 行目は切らずに折り返す (場所や名前が語の途中で切れていた) */
		.meet-row {
			height: auto;
			min-height: 72px;
			padding-block: var(--sp-2);
		}
		.meet-sub {
			flex-wrap: wrap;
			row-gap: 0;
			white-space: normal;
		}
		.meet-state-text {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}
</style>
