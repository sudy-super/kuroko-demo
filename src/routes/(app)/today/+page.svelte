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
	import { toggleTask } from '$lib/actions';
	import { ui } from '$lib/ui.svelte';
	import { parse, rel } from '$lib/dates';
	import Orb from '$lib/components/Orb.svelte';
	import TodayCard from '$lib/components/TodayCard.svelte';
	import SourceIcon from '$lib/components/SourceIcon.svelte';
	import ReasonIcon from '$lib/components/ReasonIcon.svelte';
	import ApprovalIcon from '$lib/components/ApprovalIcon.svelte';
	import DoneScreen from '$lib/components/DoneScreen.svelte';
	import { glass, CARD, orbBackdrop } from '$lib/glass';

	const count = $derived(todayCount(db));
	const items = $derived(todayItems(db));
	const ap = $derived(pendingApprovals(db));
	const rp = $derived(replyNeeded(db));
	const nm = $derived(nextMeeting(db));
	const events = $derived(todayEvents(db));
	const tasks = $derived(todayTasks(db));
	const sent = $derived(db.scheduling.filter((s) => s.status === 'sent'));

	// 700px 以下は Bento をやめて 1 枚の折りたたみカードにするので、オーブも 1 つだけ差し替える。
	// Task 11r (監査 1) — 携帯を横向きにした高さ (844x390 など)では、Bento の最初のカードが
	// 縦に収まらず依頼バー / ボトムナビの裏に沈む。ボトムナビが出る幅 (960px 以下)に限り、
	// 窓が低い (480px 以下)ときも折りたたみカードに切り替える (下は 1 行 56px の一覧なので、
	// 最初の項目は沈まずに済む。app.css 側でオーブも合わせて畳む)
	const narrow = new MediaQuery('(max-width: 700px), (max-width: 960px) and (max-height: 480px)');
	/* Task 10l — 箱の一辺。球の直径はその 48% (shader.ts の R0)なので 448 で 215px。
	   10j の 560 から 2 割小さくした。カードの列の間も同じ比で縮む (app.css の .bento の
	   max-width: 80%) ので、球の外周と光彩がカードの縁に掛かる関係は変わらず、
	   そこでカードのガラスの縁が破片を曲げる (visual 2.8 の 6) */
	const orbSize = $derived(narrow.current ? 300 : 448);

	/* Task 10r — .hole のオーブが今握っている canvas。CARD のガラスの backdrop に渡し、
	   .bento の子孫であるために除外されていた背後の絵へ実際に足す (glass.ts の
	   orbBackdrop、CARD の訂正コメントを見よ) */
	let holeOrbCanvas: HTMLCanvasElement | null = $state(null);

	const meetingHead = (m: NonNullable<typeof nm>) =>
		`次の会議 ${rel(parse(m.event.date))} ${m.event.start} ${m.meeting.title}`;
</script>

<svelte:head><title>Today — KUROKO AI</title></svelte:head>

<div class="today">
	<!-- Task 10m — この画面にボタンは 1 つも置かない。「予定」「ToDo」の追加は ⌘K パレットと
	     各画面の追加ボタンへ、「KUROKO に頼む」は下端の依頼バーそのもの、デモの操作
	     (開始 / 他のシナリオ / リセット) は上部バー右端のメニューと ⌘K へ移した (仕様 5.1 の裁定) -->
	<header class="today-head">
		<h1 class="today-count">
			<a href="#items">今日やること <span class="num">{count}</span> 件</a>
		</h1>
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
			     Task 10l — カードごとに上の余白を変えて縦位置をずらし、列に整列して見えない
			     ようにした。重みは 2 枚目の上の余白をいちばん広く取ることで付ける
			     (app.css の .today .bento > .card[data-card]、Task 10t 修正ラウンド 2 で
			     :nth-child から data-card に変えた) -->
			<div
				class="bento"
				{@attach glass({
					...CARD,
					targets: '.card',
					backdrop: ['auto', orbBackdrop(() => holeOrbCanvas)]
				})}
			>
				{#if ap.length}
					<TodayCard
						card="approvals"
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
					card="reply"
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
					<TodayCard card="meeting" title={meetingHead(nm)} icon="ic-bell" href="/meetings/{nm.meeting.id}">
						<p>{nm.meeting.briefRead ? 'Brief 確認済み' : 'Brief が届いています'}</p>
					</TodayCard>
				{/if}

				<TodayCard card="events" title="今日の予定 {events.length} 件" icon="ic-cal" href="/calendar">
					{#each events.slice(0, 3) as e (e.id)}
						<div class="list-row">
							<span class="num">{e.start}</span>
							<span class="tc-text">{e.title}</span>
						</div>
					{/each}
					{#if events.length > 3}<p class="muted">残り {events.length - 3} 件</p>{/if}
					{#if !events.length}<p class="muted">今日の予定はありません</p>{/if}
				</TodayCard>

				<TodayCard card="tasks" title="今日の ToDo {tasks.length} 件" icon="ic-todo">
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
					<TodayCard card="sent" title="日程調整の返信待ち {sent.length} 件" icon="ic-clock">
						<!-- Task 10t 修正ラウンド 4 (review task-10t-fix3 I1) — アイコンだけのボタンは
						     文言を「送信済み」の手前で切り、ic-share は承認待ちカードの「外部への共有」
						     (ApprovalIcon)と同じ図柄で意味が重複していた。行そのものをリンクにして
						     文言のまま押せるようにする (today-mobile の <a class="list-row"> と同じ形。
						     .list-row の色/下線リセットが効くので文言のリンクにも見えない)。高さは
						     1 行のまま (round 3 の削減を保つ)。2 件目以降は入れ物の高さの想定 (1 件分)
						     を超え ToDo の行と重なるので (M1)、1 件だけ見せて残りは件数表示にする -->
						{#each sent.slice(0, 1) as s (s.id)}
							<a
								class="list-row"
								target="_blank"
								rel="noreferrer"
								href="/schedule/{s.token}"
								aria-label="{personOf(db, s.personId)
									?.name}様 候補 3 件を送信済み。相手の画面を開く (デモ用)"
							>
								<span class="tc-text">{personOf(db, s.personId)?.name}様 候補 3 件を送信済み</span>
							</a>
						{/each}
						{#if sent.length > 1}<p class="muted">残り {sent.length - 1} 件</p>{/if}
					</TodayCard>
				{/if}

				<!-- オーブは左右の列の間に置く。カードより後ろの層 (z-index -2)なので、
				     カードのガラスの縁が破片を曲げる。先頭のカードを選ぶ規則
				     (app.css の .card:first-child) を狂わせないよう末尾に置く -->
				{#if !narrow.current}
					<div class="hole" aria-hidden="true">
						<Orb size={orbSize} onCanvas={(c) => (holeOrbCanvas = c)} />
					</div>
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
