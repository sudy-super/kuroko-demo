<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
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
	import { approvalRow } from '$lib/components/Rows.svelte';
	import DoneScreen from '$lib/components/DoneScreen.svelte';
	import { glass, CARD, orbBackdrop } from '$lib/glass';
	import Icon from '$lib/components/Icon.svelte';
	import { hearing, ORB_GROW, ORB_PULSE_MIN, ORB_PULSE_MAX } from '$lib/voice.svelte';
	import { layout, resetLayout, type Pt } from '$lib/todayLayout.svelte';
	import { cardDrag, ZERO } from '$lib/cardDrag.svelte';

	const count = $derived(todayCount(db));
	const items = $derived(todayItems(db));
	const ap = $derived(pendingApprovals(db));
	const rp = $derived(replyNeeded(db));
	const nm = $derived(nextMeeting(db));
	const events = $derived(todayEvents(db));
	const tasks = $derived(todayTasks(db));
	const sent = $derived(db.scheduling.filter((s) => s.status === 'sent'));

	// 700px 以下は Bento をやめて 1 枚の折りたたみカードにするので、オーブも 1 つだけ差し替える。
	// 960px 以下で窓が低い (480px 以下) ときも同じにする (Bento の最初のカードが依頼バーの裏に沈む)
	const narrow = new MediaQuery('(max-width: 700px), (max-width: 960px) and (max-height: 480px)');
	/* 低い窓で送信済みカードが出ると右の列が 3 枚になるので、ToDo の出す行数を減らし、差は「残り N 件」で
	   説明する (CSS で伏せると題名の件数と食い違う。styles/today.css の @media (max-height: 760px) と対) */
	const shortWindow = new MediaQuery('(min-width: 1101px) and (max-height: 760px)');
	/* 2 行 + 「残り N 件」で 3 行分の高さに収まる。送信済みが無いときは右が 2 枚なので 3 行のまま */
	const squeeze = $derived(shortWindow.current && sent.length > 0);
	const taskRows = $derived(squeeze ? 2 : 3);
	/* 「ToDo をすべて見る」は送信済みカードと重なる位置に来る。全件はサイドナビの ToDo から開ける */
	const hideTaskFoot = $derived(squeeze);
	/* 箱の一辺。球の直径はその 48% (shader.ts の R0) なので 448 で 215px。窓のリサイズ中も飛ばないよう、
	   700〜1100px の間で 300→448 を線形に補間する。narrow は高さ由来でも起きるので 300 で止める */
	const orbSize = $derived(
		narrow.current ? 300 : fluid(innerWidth.current ?? 1440, 700, 1100, 300, 448)
	);

	/* .hole のオーブが握っている canvas。.bento の子孫なので背後の絵から除かれる分を、CARD の backdrop に足す
	   (glass.ts の orbBackdrop) */
	let holeOrbCanvas: HTMLCanvasElement | null = $state(null);
	/* 完了画面 (.today-done) は別の glass() の host なので、渡す canvas も別に持つ */
	let doneOrbCanvas: HTMLCanvasElement | null = $state(null);

	/* 1101px 以上は環状配置 (styles/today.css)。音声をその場で聞くのとカードのドラッグはこの幅だけ */
	const ring = new MediaQuery('(min-width: 1101px)');
	const here = $derived(ring.current && !narrow.current && count > 0);

	/* ---- 音声 (docs/research/voice-orb.md) ----
	   環状配置の Today では全画面の覆い (VoiceOverlay) を出さず、カードを画面外へ退かせ、
	   オーブを大きくしてその場で聞く。操作は依頼バーの位置に出る (KurokoBar.svelte) */
	$effect(() => {
		ui.voiceHere = here;
		// 環状配置でなくなったら (窓を狭めた、Today を離れた) その場の聞き取りは閉じる
		return () => {
			if (ui.voiceHere) ui.voice = false;
			ui.voiceHere = false;
		};
	});
	const voicing = $derived(ui.voice && here);

	/* 描く大きさは聞いている間の最大 (基準 1.3 x 声 1.08) にしておき、外側の箱の scale を
	   1 以下で使う。canvas を 1 より大きく引き伸ばすとぼやけるため (voice-orb.md の実装の注意) */
	const drawSize = $derived(orbSize * ORB_GROW * ORB_PULSE_MAX);
	const baseScale = $derived(orbSize / drawSize);
	/** 画面外へ退くときの各カードの移動量 */
	let leave: Record<string, Pt> = $state({});
	/** 状態の文言を置く横の位置 (オーブの中心) */
	let voiceX = $state(0);

	// ここは開始・終了とカードの退避だけを受け持つ (声の大きさは hearing.level)
	$effect(() => {
		if (!voicing) return;
		untrack(() => {
			hearing.start();
			leave = retreat();
		});
		return () => hearing.stop();
	});

	/* 各カードを「オーブの中心 → カードの中心」の向きに、画面の外へ出るまで動かす量 */
	function retreat() {
		const o = cards.bento!.getBoundingClientRect();
		const cx = o.left + o.width / 2;
		const cy = o.top + o.height / 2;
		voiceX = cx;
		const out: Record<string, Pt> = {};
		for (const c of cards.bento!.querySelectorAll<HTMLElement>(':scope > .card')) {
			const b = c.getBoundingClientRect();
			const d = Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) || 1;
			const dx = (b.left + b.width / 2 - cx) / d;
			const dy = (b.top + b.height / 2 - cy) / d;
			// 横か縦のどちらかで画面の外に出れば足りる。影のぶん 32px 余分に出す
			const need = (lo: number, hi: number, dir: number, max: number) =>
				dir > 0 ? (max - lo + 32) / dir : dir < 0 ? (-hi - 32) / dir : Infinity;
			const t = Math.min(
				need(b.left, b.right, dx, window.innerWidth),
				need(b.top, b.bottom, dy, window.innerHeight)
			);
			out[c.dataset.card!] = { x: dx * t, y: dy * t };
		}
		return out;
	}

	function onKey(e: KeyboardEvent) {
		if (voicing && e.key === 'Escape') ui.voice = false;
	}

	const cards = cardDrag({
		here: () => here,
		voicing: () => voicing,
		orbSize: () => orbSize
	});
	/* ドラッグのずれは translate、音声で退く分は transform に分けて持つ。transform の
	   transition だけが退き・戻りの動きになり、利用者が置いた位置はそのまま残る */
	const cardAttrs = (k: string) => {
		// 環状配置でない幅ではずれを当てない (段組みの中で置いた位置は意味を持たない)
		const o = !here ? ZERO : cards.lifted(k) && cards.shown ? cards.shown : cards.repel(k, cards.springs[k].current);
		const away = voicing && !prefersReducedMotion.current ? leave[k] : undefined;
		return {
			inert: voicing,
			// class は TodayCard 自身の "card tc" を上書きしてしまうので、状態は data 属性で渡す
			'data-lifted': cards.lifted(k) || undefined,
			'data-away': voicing || undefined,
			style: `translate: ${o.x}px ${o.y}px;${away ? ` transform: translate(${away.x}px, ${away.y}px);` : ''}`
		};
	};
	const moved = $derived(Object.keys(layout).length > 0);

	const meetingHead = (m: NonNullable<typeof nm>) =>
		`次の会議 ${rel(parse(m.event.date))} ${m.event.start} ${m.meeting.title}`;
</script>

{#snippet more(n: number, shown: number)}
	{#if n > shown}<p class="muted">残り {n - shown} 件</p>{/if}
{/snippet}

<svelte:head><title>Today — KUROKO AI</title></svelte:head>
<!-- 動かせる範囲は窓で決まるが、.bento は最大幅で止まるので窓の変化を直接見る -->
<svelte:window onkeydown={onKey} onresize={() => cards.relayout()} />

<div class="today">
	<!-- この画面にボタンは置かない。「予定」「ToDo」の追加は ⌘K と各画面、依頼は下端の依頼バー、
	     デモの操作は上部バー右端のメニューと ⌘K (仕様 5.1) -->
	<header class="today-head" inert={voicing}>
		<h1 class="today-count">
			<a href="#items">今日やること <span class="num">{count}</span> 件</a>
		</h1>
		<!-- ずれているカードが 1 枚でもあるときだけ出す (docs/research/card-drag.md)。
		     記号で表せるので文字は aria-label に置く -->
		{#if moved && here}
			<button
				type="button"
				class="btn text sm layout-reset"
				title="配置を元に戻す"
				aria-label="配置を元に戻す"
				onclick={() => {
					resetLayout();
					cards.relayout(true);
				}}
			>
				<Icon name="ic-undo" size={20} />
			</button>
		{/if}
	</header>

	<div class="today-items" id="items">
		{#if count === 0}
			<!-- 完了画面のカードも Today のカードと同じガラス。.hole と同じ理由で自前の canvas を渡す -->
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
			<!-- 並びは要件定義 p.11 の重み順。左上が最初に見られるので承認待ちを先頭に置く (eye.md 3.2)。
			     位置と余白は styles/today.css の .card[data-card] が決める -->
			<!-- ドラッグの押下はカードごとではなく入れ物でまとめて受ける (押下の役割は各カード自身が持つ) -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="bento"
				class:voicing
				style="--orb: {orbSize}px"
				bind:this={cards.bento}
				onpointerdown={cards.onDown}
				onpointermove={cards.onMove}
				onpointerup={cards.onUp}
				onpointercancel={cards.onUp}
				onlostpointercapture={cards.onUp}
				{@attach cards.watchLayout}
				{@attach glass({
					...CARD,
					// 既定の bleed (約 47px) では、.bento から離れたカードが canvas の外に出てガラスが消える
					bleed: Math.max(cards.reach, 48),
					targets: '.card',
					backdrop: ['auto', orbBackdrop(() => holeOrbCanvas)]
				})}
			>
				{#if ap.length}
					<TodayCard
						card="approvals"
						{...cardAttrs('approvals')}
						title="承認待ち {ap.length} 件"
						icon="ic-check-c"
						onclick={(e) => {
							ui.approvalFrom = e.currentTarget.getBoundingClientRect();
							ui.approvalCardHidden = true;
							ui.approvalDrawer = true;
						}}
						expanded={ui.approvalCardHidden}
					>
						{#each ap.slice(0, 3) as a (a.id)}{@render approvalRow(a)}{/each}
						{@render more(ap.length, 3)}
					</TodayCard>
				{/if}

				<TodayCard
					card="reply"
						{...cardAttrs('reply')}
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
					{@render more(rp.length, 3)}
					{#if !rp.length}<p class="muted">返信が必要な連絡はありません</p>{/if}
				</TodayCard>

				{#if nm}
					<TodayCard card="meeting"
						{...cardAttrs('meeting')} title={meetingHead(nm)} icon="ic-bell" href="/meetings/{nm.meeting.id}">
						<p>{nm.meeting.briefRead ? 'Brief 確認済み' : 'Brief が届いています'}</p>
					</TodayCard>
				{/if}

				<TodayCard card="events"
						{...cardAttrs('events')} title="今日の予定 {events.length} 件" icon="ic-cal" href="/calendar">
					{#each events.slice(0, 3) as e (e.id)}
						<div class="list-row">
							<span class="num">{e.start}</span>
							<span class="tc-text">{e.title}</span>
						</div>
					{/each}
					{@render more(events.length, 3)}
					{#if !events.length}<p class="muted">今日の予定はありません</p>{/if}
				</TodayCard>

				<TodayCard card="tasks"
						{...cardAttrs('tasks')} title="今日の ToDo {tasks.length} 件" icon="ic-todo">
					{#each tasks.slice(0, taskRows) as t (t.id)}
						<label class="list-row">
							<!-- todayTasks は未完了だけを返すので checked は常に false。式にしない -->
							<input type="checkbox" onchange={() => toggleTask(t.id, 'today')} />
							<span class="tc-text">{t.title}</span>
							{#if t.time}<span class="num muted">{t.time}</span>{/if}
						</label>
					{/each}
					{@render more(tasks.length, taskRows)}
					{#if !hideTaskFoot}
						<div class="row tc-foot"><a class="btn text sm" href="/tasks">ToDo をすべて見る</a></div>
					{/if}
				</TodayCard>

				{#if sent.length}
					<!-- カード全体を相手の画面へのリンクにする (承認待ち・次の会議と同じ押せるカード)。案内の手順 3 もこれを指す。
					     「残り N 件」の行は ToDo カードと重なるので出さない (件数は題名にある) -->
					<TodayCard
						card="sent"
						{...cardAttrs('sent')}
						title="日程調整の返信待ち {sent.length} 件"
						icon="ic-clock"
						href="/schedule/{sent[0].token}"
						target="_blank"
						rel="noreferrer"
					>
						{#each sent.slice(0, 1) as s (s.id)}
							<div class="list-row">
								<!-- 名前と文言を別の span に分け、名前の側だけ省略する (狭い幅で状態文が切れないように) -->
								<span class="tc-text sent-name">{personOf(db, s.personId)?.name}様</span>
								<span class="tc-text sent-suffix">に候補を送信済み</span>
							</div>
						{/each}
					</TodayCard>
				{/if}

				<!-- オーブは左右の列の間に置く。カードより後ろの層 (z-index -2)なので、
				     カードのガラスの縁が破片を曲げる -->
				{#if !narrow.current}
					<!-- 大きさは外側 2 段の scale で変える。.hole は基準 (普段と聞いている間)、.voice-pulse は声。
					     Orb の size を毎フレーム変えると描画面を作り直すため (voice-orb.md の実装の注意) -->
					<div
						class="hole"
						aria-hidden="true"
						style:scale={voicing && !prefersReducedMotion.current ? baseScale * ORB_GROW : baseScale}
					>
						<div
							class="voice-pulse"
							style:scale={voicing && !prefersReducedMotion.current && !hearing.thinking
								? ORB_PULSE_MIN + (ORB_PULSE_MAX - ORB_PULSE_MIN) * hearing.level
								: 1}
							style:opacity={voicing && prefersReducedMotion.current ? 0.85 + 0.15 * hearing.level : 1}
						>
							<Orb size={drawSize} onCanvas={(c) => (holeOrbCanvas = c)} />
						</div>
					</div>
				{/if}
				{#if voicing}
					<!-- 途中の聞き取り結果は読み上げに流さない。状態の文言と、聞き取りが終わった時点の
					     文字だけを role="status" で伝える (voice-orb.md の読み上げとキーボード) -->
					<div class="voice-here" style:left="{voiceX}px">
						<!-- 状態の文言は画面には出さず読み上げだけに残す -->
						<p class="voice-state sr-only" role="status">
							{hearing.thinking ? '考えています…' : hearing.live ? '聞いています…' : '聞き取りました'}
							{#if !hearing.live && !hearing.thinking}<span class="sr-only">{hearing.heard}</span>{/if}
						</p>
						<p class="voice-heard" aria-hidden="true">{hearing.heard}</p>
					</div>
				{/if}
			</div>

			{#if narrow.current}
				<div class="orb-slot today-orb" aria-hidden="true"><Orb size={orbSize} /></div>
				<!-- 仕様 5.1 — モバイルは 1 枚のカードに畳み、開いた親見出しを上端に固定する -->
				<details class="card today-mobile" open>
					<summary>今日やること <span class="num">{count}</span> 件</summary>
					{#each items as it (it.kind)}
						{#snippet line()}
							<span class="badge count">{badgeCount(it.n)}</span>
							<span class="tc-col">
								<span class="tc-text">{it.label}</span>
								<span class="tc-text sub">{it.detail}</span>
							</span>
						{/snippet}
						{#if it.kind === 'approval'}
							<button class="list-row lg" type="button" onclick={() => (ui.approvalDrawer = true)}>{@render line()}</button>
						{:else}
							<a class="list-row lg" href={it.href}>{@render line()}</a>
						{/if}
					{/each}
				</details>
			{/if}
		{/if}
	</div>
</div>
