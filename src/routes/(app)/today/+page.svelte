<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { db } from '$lib/store.svelte';
	import { REASON_ORDER, RISK_LABEL } from '$lib/types';
	import {
		personOf,
		pendingApprovals,
		replyNeeded,
		nextMeeting,
		todayEvents,
		todayTasks,
		todayItems,
		todayCount
	} from '$lib/derived';
	import { startGuide, toggleTask } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import { parse, rel } from '$lib/dates';
	import Orb from '$lib/components/Orb.svelte';
	import TodayCard from '$lib/components/TodayCard.svelte';
	import SourceIcon from '$lib/components/SourceIcon.svelte';
	import ReasonIcon from '$lib/components/ReasonIcon.svelte';
	import ApprovalIcon from '$lib/components/ApprovalIcon.svelte';
	import DoneScreen from '$lib/components/DoneScreen.svelte';
	import ScenarioMenu from '$lib/components/ScenarioMenu.svelte';
	import { glass, CARD } from '$lib/glass';

	const count = $derived(todayCount(db));
	const items = $derived(todayItems(db));
	const ap = $derived(pendingApprovals(db));
	const rp = $derived(replyNeeded(db));
	const nm = $derived(nextMeeting(db));
	const events = $derived(todayEvents(db));
	const tasks = $derived(todayTasks(db));
	const sent = $derived(db.scheduling.filter((s) => s.status === 'sent'));

	// 700px 以下は Bento をやめて 1 枚の折りたたみカードにするので、オーブも 1 つだけ差し替える
	const narrow = new MediaQuery('(max-width: 700px)');
	/* Task 10j — 箱の一辺。球の直径はその 48% (shader.ts の R0)なので 560 で 269px。
	   左右のカードの列の間 (12 列のうち中央の 4 列)より球は小さく、光彩だけがカードに掛かる。
	   そこでカードのガラスの縁が破片を曲げる (visual 2.8 の 6) */
	const orbSize = $derived(narrow.current ? 300 : 560);

	const meetingHead = (m: NonNullable<typeof nm>) =>
		`次の会議 ${rel(parse(m.event.date))} ${m.event.start} ${m.meeting.title}`;
</script>

<svelte:head><title>Today — KUROKO AI</title></svelte:head>

<div class="today">
	<!-- Task 10j — モックの構図: 件数は上部中央のピル、主ボタンは下端中央に 1 つだけ。
	     「予定」「ToDo」は ⌘K パレットと各画面の追加ボタンへ、「KUROKO に頼む」は下端の
	     依頼バーそのものなので消した。シナリオの切り替えは右上の控えめな文字リンクにする -->
	<header class="today-head">
		<h1 class="today-count">
			<a href="#items">今日やること <span class="num">{count}</span> 件</a>
		</h1>
		<ScenarioMenu />
	</header>

	<div class="today-items" id="items">
		{#if count === 0}
			<div class="today-done" style="--orb: {orbSize}px">
				<div class="orb-slot" aria-hidden="true"><Orb size={orbSize} /></div>
				<DoneScreen />
			</div>
		{:else}
			<!-- 並びは要件定義 p.11 の重み順。左上が最初に見られるので承認待ちを先頭に置く
			     (eye.md 3.2 の (3)。モックは承認待ちを右下に置いていた)。
			     先頭のカードだけ 1 列ぶん広い (visual 2.7「すべてのタイルを同じ大きさにしない」) -->
			<div class="bento" {@attach glass({ ...CARD, targets: '.card' })}>
				{#if ap.length}
					<TodayCard
						title="承認待ち {ap.length} 件"
						icon="ic-check-c"
						onclick={() => (ui.approvalDrawer = true)}
					>
						{#each ap.slice(0, 3) as a (a.id)}
							<div class="list-row">
								<ApprovalIcon kind={a.kind} />
								<span class="tc-text">{a.title}</span>
								<!-- ドロワーと同じ区分の Lozenge。文言の出所は types.ts の RISK_LABEL -->
								<span class="badge" class:neutral={a.risk !== 'external_send'}>{RISK_LABEL[a.risk]}</span>
							</div>
						{/each}
						{#if ap.length > 3}<p class="muted">残り {ap.length - 3} 件</p>{/if}
						<!-- カード全体が承認ドロワーを開くので、中は入れ子のボタンにしない -->
						<div class="row tc-foot"><span class="btn pri sm">確認する</span></div>
					</TodayCard>
				{/if}

				<TodayCard
					title="返信が必要な連絡 {rp.length} 件"
					icon="ic-mail"
					href={rp[0] ? `/inbox?t=${rp[0].id}` : '/inbox'}
				>
					{#each rp.slice(0, 3) as t (t.id)}
						<div class="list-row xl">
							<SourceIcon source={t.source} />
							<span class="tc-col">
								<span class="tc-text">{t.sender}</span>
								<span class="tc-text sub">{t.subject}</span>
							</span>
							<!-- 一覧の行と同じ形・同じ順で理由を 2 個まで出す (indicators.md 3 節) -->
							{#each REASON_ORDER.filter((r) => t.reasons.includes(r)).slice(0, 2) as r (r)}
								<ReasonIcon reason={r} />
							{/each}
						</div>
					{/each}
					{#if rp.length > 3}<p class="muted">残り {rp.length - 3} 件</p>{/if}
					{#if !rp.length}<p class="muted">返信が必要な連絡はありません</p>{/if}
				</TodayCard>

				{#if nm}
					<TodayCard title={meetingHead(nm)} icon="ic-bell" href="/meetings/{nm.meeting.id}">
						<p>{nm.meeting.briefRead ? 'Brief 確認済み' : 'Brief が届いています'}</p>
					</TodayCard>
				{/if}

				<TodayCard title="今日の予定 {events.length} 件" icon="ic-cal" href="/calendar">
					{#each events.slice(0, 3) as e (e.id)}
						<div class="list-row">
							<span class="num">{e.start}</span>
							<span class="tc-text">{e.title}</span>
						</div>
					{/each}
					{#if events.length > 3}<p class="muted">残り {events.length - 3} 件</p>{/if}
					{#if !events.length}<p class="muted">今日の予定はありません</p>{/if}
				</TodayCard>

				<TodayCard title="今日の ToDo {tasks.length} 件" icon="ic-todo">
					{#each tasks.slice(0, 3) as t (t.id)}
						<label class="list-row">
							<!-- todayTasks は未完了だけを返すので checked は常に false。式にしない -->
							<input type="checkbox" onchange={() => toggleTask(t.id, 'today')} />
							<span class="tc-text">{t.title}</span>
							{#if t.time}<span class="num muted">{t.time}</span>{/if}
						</label>
					{/each}
					{#if tasks.length > 3}<p class="muted">残り {tasks.length - 3} 件</p>{/if}
					<div class="row tc-foot"><a class="btn text sm" href="/tasks">ToDo をすべて見る</a></div>
				</TodayCard>

				{#if sent.length}
					<TodayCard title="日程調整の返信待ち {sent.length} 件" icon="ic-clock">
						<!-- リンクを行に並べると 1 列ぶんの幅では題名が「田中 太郎…」まで縮む。
						     リンクは行の下に落とす -->
						{#each sent as s (s.id)}
							<div class="list-row">
								<span class="tc-text">{personOf(db, s.personId)?.name}様 候補 3 件を送信済み</span>
							</div>
							<div class="row tc-foot">
								<a class="btn text sm" target="_blank" rel="noreferrer" href="/schedule/{s.token}">
									相手の画面を開く (デモ用)
								</a>
							</div>
						{/each}
					</TodayCard>
				{/if}

				<!-- オーブは左右の列の間に置く。カードより後ろの層 (z-index -2)なので、
				     カードのガラスの縁が破片を曲げる。カードの数え方 (:nth-child) を狂わせない
				     よう末尾に置く -->
				{#if !narrow.current}
					<div class="hole" aria-hidden="true"><Orb size={orbSize} /></div>
				{/if}
			</div>

			{#if narrow.current}
				<div class="orb-slot today-orb" aria-hidden="true"><Orb size={orbSize} /></div>
				<!-- 仕様 5.1 — モバイルは 1 枚のカードに畳み、開いた親見出しを上端に固定する -->
				<details class="card today-mobile" open>
					<summary>今日やること <span class="num">{count}</span> 件</summary>
					{#each items as it (it.kind)}
						{#if it.kind === 'approval'}
							<button class="list-row lg" type="button" onclick={() => (ui.approvalDrawer = true)}>
								<span class="badge count">{it.n}</span>
								<span class="tc-col">
									<span class="tc-text">{it.label}</span>
									<span class="tc-text sub">{it.detail}</span>
								</span>
							</button>
						{:else}
							<a class="list-row lg" href={it.href}>
								<span class="badge count">{it.n}</span>
								<span class="tc-col">
									<span class="tc-text">{it.label}</span>
									<span class="tc-text sub">{it.detail}</span>
								</span>
							</a>
						{/if}
					{/each}
				</details>
			{/if}
		{/if}
	</div>

	<!-- 塗りのボタンは画面にこの 1 つだけ。主ボタンと副ボタンを見た目で区別しないと
	     利用者が止まる (eye.md 2.5、Baymard) -->
	{#if !db.demo.guide.on}
		<div class="today-start">
			<button class="btn pri lg today-demo" onclick={startGuide}>デモを開始する</button>
		</div>
	{/if}
</div>
