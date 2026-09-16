<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { db } from '$lib/store.svelte';
	import { REASON_ORDER } from '$lib/types';
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
	import { ui, focusChatbar } from '$lib/ui.svelte';
	import { parse, rel } from '$lib/dates';
	import Orb from '$lib/components/Orb.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import TodayCard from '$lib/components/TodayCard.svelte';
	import SourceIcon from '$lib/components/SourceIcon.svelte';
	import ReasonIcon from '$lib/components/ReasonIcon.svelte';
	import ApprovalIcon from '$lib/components/ApprovalIcon.svelte';
	import DoneScreen from '$lib/components/DoneScreen.svelte';
	import ScenarioMenu from '$lib/components/ScenarioMenu.svelte';
	import { glass, CLEAR, CARD } from '$lib/glass';

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
	/* Task 10f — 560 にすると箱の上端が見出しのボタン列を越えて掛かる。ボタンをガラスにした
	   今はそれが狙いで、ボタンの縁がオーブの破片を曲げる。箱は穴 (4 列 = 約 340px)より広いので
	   光彩は左右の hero のカードにも掛かる */
	const orbSize = $derived(narrow.current ? 300 : 560);


	const meetingHead = (m: NonNullable<typeof nm>) =>
		`次の会議 ${rel(parse(m.event.date))} ${m.event.start} ${m.meeting.title}`;

	function askKuroko() {
		ui.context = null;
		focusChatbar();
	}
</script>

<svelte:head><title>Today — KUROKO AI</title></svelte:head>

<div class="today">
	<header class="today-head">
		<h1 class="today-count">
			<a href="#items">今日やること <span class="num">{count}</span> 件</a>
		</h1>
		<!-- Task 10f — 副ボタンはナビ層なのでガラスにする。列はオーブの破片がいちばん濃いところに
		     重なっていて、ボタンの縁が破片を曲げるところが屈折の見せ場になる。
		     WebGL の文脈は 1 ページ約 16 個までなので、列全体で 1 つにまとめて各ボタンを targets で描く。
		     主ボタン (.btn.pri) は塗りつぶしの面なので対象から外す。
		     塗りだけ CLEAR の 0.06 から上げる。ここは背後が破片で最も暗くなり、0.06 のままだと
		     文字 (--accent) の実測が 3.84:1 と 4.5:1 を割った。0.34 まで上げる。
		     段を増やすのではなく、この 1 か所の上書きにとどめる -->
		<div class="row today-actions" {@attach glass({ ...CLEAR, tint: 0.34, targets: '.btn.sec' })}>
			<a class="btn sec" href="/calendar?new=1"><Icon name="ic-plus" size={18} />予定</a>
			<a class="btn sec" href="/tasks?new=1"><Icon name="ic-plus" size={18} />ToDo</a>
			<button class="btn sec" onclick={askKuroko}>
				<Icon name="ic-spark" size={18} />KUROKO に頼む
			</button>
			{#if !db.demo.guide.on}
				<button class="btn pri" onclick={startGuide}>デモを開始する</button>
			{/if}
			<ScenarioMenu />
		</div>
	</header>

	<div class="today-items" id="items">
		{#if count === 0}
			<div class="today-done" style="--orb: {orbSize}px">
				<div class="orb-slot" aria-hidden="true"><Orb size={orbSize} /></div>
				<DoneScreen />
			</div>
		{:else}
			<div class="bento" {@attach glass({ ...CARD, targets: '.card' })}>
				{#if ap.length}
					<TodayCard
						size="hero"
						title="承認待ち {ap.length} 件"
						icon="ic-check-c"
						onclick={() => (ui.approvalDrawer = true)}
					>
						{#each ap.slice(0, 3) as a (a.id)}
							<div class="list-row">
								<ApprovalIcon kind={a.kind} />
								<span class="tc-text">{a.title}</span>
							</div>
						{/each}
						{#if ap.length > 3}<p class="muted">残り {ap.length - 3} 件</p>{/if}
						<!-- カード全体が承認ドロワーを開くので、中は入れ子のボタンにしない -->
						<div class="row tc-foot"><span class="btn pri sm">確認する</span></div>
					</TodayCard>
				{:else if nm}
					<TodayCard
						size="hero"
						title={meetingHead(nm)}
						icon="ic-bell"
						href="/meetings/{nm.meeting.id}"
					>
						<p>{nm.meeting.briefRead ? 'Brief 確認済み' : 'Brief が届いています'}</p>
					</TodayCard>
				{/if}

				{#if !narrow.current}
					<!-- visual 2.8 — 中央 4 列 x 2 行を空けてオーブを見せ、左右の hero のガラスに光彩を重ねる -->
					<div class="hole" aria-hidden="true"><Orb size={orbSize} /></div>
				{/if}

				<TodayCard
					size="hero"
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

				{#if ap.length && nm}
					<TodayCard
						size="wide"
						title={meetingHead(nm)}
						icon="ic-bell"
						href="/meetings/{nm.meeting.id}"
					>
						<p>{nm.meeting.briefRead ? 'Brief 確認済み' : 'Brief が届いています'}</p>
					</TodayCard>
				{/if}

				<TodayCard size="wide" title="今日の予定 {events.length} 件" icon="ic-cal" href="/calendar">
					{#each events.slice(0, 3) as e (e.id)}
						<div class="list-row">
							<span class="num">{e.start}</span>
							<span class="tc-text">{e.title}</span>
						</div>
					{/each}
					{#if events.length > 3}<p class="muted">残り {events.length - 3} 件</p>{/if}
					{#if !events.length}<p class="muted">今日の予定はありません</p>{/if}
				</TodayCard>

				<TodayCard size="wide" title="今日の ToDo {tasks.length} 件" icon="ic-todo">
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
					<TodayCard size="wide" title="日程調整の返信待ち {sent.length} 件" icon="ic-clock">
						{#each sent as s (s.id)}
							<div class="list-row">
								<span class="tc-text">{personOf(db, s.personId)?.name} 様 候補 3 件を送信済み</span>
								<a class="btn text sm" target="_blank" rel="noreferrer" href="/schedule/{s.token}">
									相手の画面を開く (デモ用)
								</a>
							</div>
						{/each}
					</TodayCard>
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
</div>
