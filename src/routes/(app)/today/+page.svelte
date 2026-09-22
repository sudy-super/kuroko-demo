<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { innerWidth } from 'svelte/reactivity/window';
	import { fluid } from '$lib/fluid';
	import { db } from '$lib/store.svelte';
	import { REASON_ORDER } from '$lib/types';
	import {
		badgeCount,
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
	import RiskIcon from '$lib/components/RiskIcon.svelte';
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
	/* Task 10t 修正ラウンド 6 (review task-10t-fix5 I1) — 低い窓で送信済みカードが出ると、
	   右の列は 3 枚になって ToDo の 3 行目と「ToDo をすべて見る」が入らない。CSS で伏せると
	   題名の件数と行数が食い違ったまま説明が消えるので、出す行数そのものをここで減らし、
	   差は「残り N 件」で説明する (app.css の @media (max-height: 760px) と対) */
	const shortWindow = new MediaQuery('(min-width: 1101px) and (max-height: 760px)');
	/* 2 行 + 「残り N 件」で 3 行分の高さに収まる。送信済みが無いときは右が 2 枚なので 3 行のまま */
	const squeeze = $derived(shortWindow.current && sent.length > 0);
	const taskRows = $derived(squeeze ? 2 : 3);
	/* 「ToDo をすべて見る」は送信済みカードと重なる位置に来る。全件はサイドナビの ToDo から開ける */
	const hideTaskFoot = $derived(squeeze);
	/* Task 10l — 箱の一辺。球の直径はその 48% (shader.ts の R0)なので 448 で 215px。
	   10j の 560 から 2 割小さくした。カードの列の間も同じ比で縮む (app.css の .bento の
	   max-width: 80%) ので、球の外周と光彩がカードの縁に掛かる関係は変わらず、
	   そこでカードのガラスの縁が破片を曲げる (visual 2.8 の 6)。
	   ユーザー指摘 (2026-09-23) — 窓のリサイズ中も値が飛ばず連続的に追従すること。
	   700px (narrow の境目) を下限、.bento が環状配置に切り替わる 1100px を上限にして
	   300→448 を線形に補間する。narrow (折りたたみ表示、または携帯の横向きで高さが低い)
	   のときは 700px 以下と同じ 300 で止める (この場合の "narrow" は高さ由来でも起こるため、
	   幅だけの補間だと逆に大きくなってしまう) */
	const orbSize = $derived(
		narrow.current ? 300 : fluid(innerWidth.current ?? 1440, 700, 1100, 300, 448)
	);

	/* Task 10r — .hole のオーブが今握っている canvas。CARD のガラスの backdrop に渡し、
	   .bento の子孫であるために除外されていた背後の絵へ実際に足す
	   (glass.ts の orbBackdrop を見よ) */
	let holeOrbCanvas: HTMLCanvasElement | null = $state(null);
	/* Task 10w — 完了画面 (.today-done) は .bento と別の glass() の host なので、
	   orbBackdrop に渡す canvas も別に持つ (.orb-slot のオーブは .today-done の子孫であるために
	   同じ理由で 'auto' backdrop から除外される) */
	let doneOrbCanvas: HTMLCanvasElement | null = $state(null);

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
			<!-- Task 10w (glass-scope.md 5 節) — 完了画面のカードは Today のカードと同じガラス
			     (承認済みの例外、上の .today-done の CSS 注記を見よ)。.hole と同じ理由で
			     orbBackdrop に自前の canvas を渡す (下の onCanvas) -->
			<div
				class="today-done"
				style="--orb: {orbSize}px"
				{@attach glass({
					...CARD,
					targets: '.card',
					backdrop: ['auto', orbBackdrop(() => doneOrbCanvas)]
				})}
			>
				<div class="orb-slot" aria-hidden="true">
					<Orb size={orbSize} onCanvas={(c) => (doneOrbCanvas = c)} />
				</div>
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
								<!-- ドロワーと同じ区分の記号。ApprovalIcon (種類) とは別の形にして混ざらないようにする -->
								<RiskIcon risk={a.risk} />
							</div>
						{/each}
						{#if ap.length > 3}<p class="muted">残り {ap.length - 3} 件</p>{/if}
						<!-- カード全体が承認ドロワーを開くので、中は入れ子のボタンにしない。
						     塗りの主ボタンは画面に 1 つ (buttons.md 観点 A 原則 3)。Today でそれに当たるのは
						     下端の依頼バーの送信ボタンなので、ここは副ボタンにする -->
						<div class="row tc-foot"><span class="btn sec sm">確認する</span></div>
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
					{#each tasks.slice(0, taskRows) as t (t.id)}
						<label class="list-row">
							<!-- todayTasks は未完了だけを返すので checked は常に false。式にしない -->
							<input type="checkbox" onchange={() => toggleTask(t.id, 'today')} />
							<span class="tc-text">{t.title}</span>
							{#if t.time}<span class="num muted">{t.time}</span>{/if}
						</label>
					{/each}
					{#if tasks.length > taskRows}<p class="muted">残り {tasks.length - taskRows} 件</p>{/if}
					{#if !hideTaskFoot}
						<div class="row tc-foot"><a class="btn text sm" href="/tasks">ToDo をすべて見る</a></div>
					{/if}
				</TodayCard>

				{#if sent.length}
					<!-- Task 10t 修正ラウンド 5 (review task-10t-fix4 I1) — 行をリンクにすると、
					     案内の手順 3 が指す「相手の画面を開く」という文字が画面から消え、行も
					     押せる見た目にならなかった (高さ 36px、他のタイルと同じ色・下線なし)。
					     カード全体を相手の画面へのリンクにする (承認待ち・次の会議と同じ「押せる
					     カード」の見た目。ホバー・押下沈みが付き、的も 97px 全体になる)。
					     案内の文言 (Header.svelte SECTIONS[3])もカードの題名を押す形に合わせた。
					     I2 (review task-10t-fix4) — 「残り N 件」の行は ToDo カードと 14px 重なる
					     ので削る。題名にすでに件数があるので情報は減らない -->
					<TodayCard
						card="sent"
						title="日程調整の返信待ち {sent.length} 件"
						icon="ic-clock"
						href="/schedule/{sent[0].token}"
						target="_blank"
						rel="noreferrer"
					>
						{#each sent.slice(0, 1) as s (s.id)}
							<div class="list-row">
								<!-- 1101px で「田中 太郎様に候補を送信済み」が切れる (review task-10t-fix4 M3)。
								     名前と文言を別の span に分け、名前の側だけ省略する (app.css の
								     .today .bento .list-row .sent-suffix) -->
								<span class="tc-text sent-name">{personOf(db, s.personId)?.name}様</span>
								<span class="tc-text sent-suffix">に候補を送信済み</span>
							</div>
						{/each}
					</TodayCard>
				{/if}

				<!-- オーブは左右の列の間に置く。カードより後ろの層 (z-index -2)なので、
				     カードのガラスの縁が破片を曲げる -->
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
								<span class="badge count">{badgeCount(it.n)}</span>
								<span class="tc-col">
									<span class="tc-text">{it.label}</span>
									<span class="tc-text sub">{it.detail}</span>
								</span>
							</button>
						{:else}
							<a class="list-row lg" href={it.href}>
								<span class="badge count">{badgeCount(it.n)}</span>
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
