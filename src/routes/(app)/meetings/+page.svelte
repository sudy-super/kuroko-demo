<script lang="ts">
	import { db } from '$lib/store.svelte';
	import { eventDateOf, meetingsOf, personOf } from '$lib/derived';
	import { parse, fmtMDW } from '$lib/dates';
	import Icon from '$lib/components/Icon.svelte';
	import Avatars from '$lib/components/Avatars.svelte';

	/* 会議は自前の日付を持たないので、ひも付く予定の日付で並べる (derived.ts meetingsOf は降順)。
	   「今後」は基準日 (db.seededOn) 当日を含み、近い順に見せたいので反転する */
	const all = $derived(meetingsOf(db, () => true));
	const upcoming = $derived(all.filter((m) => (eventDateOf(db, m) ?? '') >= db.seededOn).reverse());
	const past = $derived(all.filter((m) => (eventDateOf(db, m) ?? '') < db.seededOn));
</script>

<svelte:head><title>会議・議事録 — KUROKO AI</title></svelte:head>

<div class="people">
	<header class="people-head page-head">
		<div class="page-title">
			<h1>会議・議事録</h1>
			<p class="page-desc">Brief とアジェンダ、終わった会議の議事録を確認します。</p>
		</div>
	</header>

	<!-- 内容の層なのでガラスは当てず、普通のカードの面に置く (glass-scope.md 6 節) -->
	<div class="people-cards">
		{#snippet group(title: string, icon: string, items: typeof all, headId: string)}
			<section class="card people-list" aria-labelledby={headId}>
				<h2 class="list-head" id={headId}>
					<Icon name={icon} size={16} />{title}<span class="num">{items.length}</span>
				</h2>
				{#each items as m (m.id)}
					{@const ev = db.events.find((e) => e.id === m.eventId)}
					<a class="list-row xl" href="/meetings/{m.id}">
						<span class="people-col">
							<!-- 日時と状態は上の行にまとめ、題名に行の幅を丸ごと渡す。390px でも題名が切れない -->
							<span class="row">
								<span class="num sub"
									>{ev ? `${fmtMDW(parse(ev.date))} ${ev.start}〜${ev.end}` : '日時未定'}</span
								>
								{#if m.agendaShared}<span class="badge ok">共有済み</span>{/if}
								<Avatars people={m.personIds.map((x) => personOf(db, x)).filter((x) => !!x)} />
							</span>
							<span class="people-name">{m.title}</span>
						</span>
					</a>
				{/each}
				{#if !items.length}<p class="muted">会議はありません</p>{/if}
			</section>
		{/snippet}

		{@render group('今後の会議', 'ic-cal', upcoming, 'mt-up')}
		{@render group('過去の会議', 'ic-history', past, 'mt-past')}
	</div>
</div>

<style>
	/* 日時は縮めない。縮むのは題名の側 (.people-name が省略記号を出す) */
	.row .sub {
		flex: none;
	}
</style>
