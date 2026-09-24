<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { untrack } from 'svelte';
	import { Spring } from 'svelte/motion';
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
	import Icon from '$lib/components/Icon.svelte';
	import { hearing, ORB_GROW, ORB_PULSE_MIN, ORB_PULSE_MAX } from '$lib/voice.svelte';
	import {
		layout,
		saveLayout,
		resetLayout,
		orbPush,
		settle,
		shove,
		shift,
		type Box,
		type Pt
	} from '$lib/todayLayout.svelte';

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

	/* 1101px 以上は環状配置 (app.css)。音声をその場で聞くのとカードのドラッグはこの幅だけ */
	const ring = new MediaQuery('(min-width: 1101px)');
	const reduced = new MediaQuery('(prefers-reduced-motion: reduce)');
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

	// 声の大きさを求める処理は hearing.level に移した (VoiceActions の波形とここで共有するため。
	// ユーザー指示 2026-09-24)。ここは開始・終了とカードの退避だけ受け持つ
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
		const o = bento!.getBoundingClientRect();
		const cx = o.left + o.width / 2;
		const cy = o.top + o.height / 2;
		voiceX = cx;
		const out: Record<string, Pt> = {};
		for (const c of bento!.querySelectorAll<HTMLElement>(':scope > .card')) {
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

	/* ---- カードのドラッグ (docs/research/card-drag.md) ----
	   キーボードでの代わりの操作はデモでは作らない。WCAG 2.2 の 2.5.7 (AA、ドラッグしない
	   1 点の操作での代わり) は満たさない判断。既定の配置で情報も機能も失われないため */
	let bento: HTMLDivElement | undefined = $state();
	const CARDS = ['approvals', 'reply', 'meeting', 'events', 'tasks', 'sent'];
	const ZERO: Pt = { x: 0, y: 0 };
	/* SwiftUI の spring() の既定 (response 0.5 秒、減衰比 0.825) を Svelte の Spring に換算した値 */
	const SPRING = { stiffness: 0.044, damping: 0.35 };
	/* 押しのけられたカード用。SwiftUI の .snappy (response 0.3 秒、減衰比 1.0) の換算で、
	   速く滑ってはね返らない */
	const SNAPPY = { stiffness: 0.122, damping: 0.7 };
	const springs = Object.fromEntries(CARDS.map((k) => [k, new Spring<Pt>(ZERO, SPRING)]));
	/** 8px 動くまでは記録だけ (started: false)。押した扱いと区別する */
	let drag: {
		card: string;
		el: HTMLElement;
		id: number;
		sx: number;
		sy: number;
		from: Pt;
		raw: Pt;
		started: boolean;
		/** このドラッグで押しのけたカード */
		pushed: Set<string>;
	} | null = $state(null);
	/** ドラッグ中に見せる位置 (ラバーバンド込み) */
	let shown: Pt | null = $state(null);
	/** カードのガラスを描く canvas を .bento の外へ広げる幅。範囲の端まで運んだカードも描けるように */
	let reach = $state(0);

	/* 座標の原点は .bento の左上。既定の矩形と球。offset* は整数に丸められて 8px の間が
	   1px 近く狂うので、画面上の矩形からずれ (translate と音声で退く transform) を引く */
	function measure() {
		const b = bento!;
		const o = b.getBoundingClientRect();
		const bases: Record<string, Box> = {};
		for (const c of b.querySelectorAll<HTMLElement>(':scope > .card')) {
			const r = c.getBoundingClientRect();
			const s = getComputedStyle(c);
			const [tx = 0, ty = 0] = s.translate === 'none' ? [] : s.translate.split(' ').map(parseFloat);
			const m = new DOMMatrix(s.transform);
			bases[c.dataset.card!] = { x: r.left - o.left - tx - m.e, y: r.top - o.top - ty - m.f, w: r.width, h: r.height };
		}
		// 球の直径は箱の 48% (shader.ts の R0)
		return { bases, orb: { x: b.clientWidth / 2, y: b.clientHeight / 2 }, r: (orbSize * 0.48) / 2 };
	}
	/* 動かせる範囲は本文として見えている画面の領域 (サイドナビ・連携の列・上部バー・依頼バーの内側
	   16px)。見出しと「配置を元に戻す」は動かない障害物 */
	function bounds() {
		const o = bento!.getBoundingClientRect();
		const at = (r: DOMRect): Box => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
		const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
		const rail = document.querySelector('.rail');
		const left = rect('.sidebar').right + 16;
		const right = (rail ? rail.getBoundingClientRect().left : innerWidth.current!) - 16;
		const top = rect('.header.glass').bottom + 16;
		const bottom = rect('.chatbar').top - 16;
		return {
			box: { x: left - o.left, y: top - o.top, w: right - left, h: bottom - top },
			fixed: [...document.querySelectorAll('.today-head > *')].map((e) => at(e.getBoundingClientRect()))
		};
	}
	/* card 以外のカードの今の置き場所 (ばねの目標) */
	function field(card: string) {
		const { bases, orb, r } = measure();
		const { box, fixed } = bounds();
		const cards = Object.fromEntries(
			Object.entries(bases)
				.filter(([k]) => k !== card)
				.map(([k, b]) => [k, shift(b, springs[k].target)])
		);
		return { base: bases[card], cards, f: { orb, r, box, others: fixed } };
	}
	const plus = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });

	/* 保存したずれは書き換えず、表示のたびに制約をかけ直す (窓の大きさが変わったときも)。
	   動かしていないカードを先に固定し、動かしたカードを CARDS の順に 1 枚ずつ、
	   前に置いたカードを避けて置く */
	function relayout(animate = false) {
		if (!bento || !here) return;
		const { bases, orb, r } = measure();
		const { box, fixed } = bounds();
		// 32px 刻みにして、窓の大きさを少し変えるたびにガラスを作り直さないようにする
		const out = Math.max(-box.x, -box.y, box.x + box.w - bento.clientWidth, box.y + box.h - bento.clientHeight);
		reach = Math.ceil(out / 32) * 32;
		const placed = CARDS.filter((k) => bases[k] && !layout[k]).map((k) => bases[k]);
		for (const k of CARDS) {
			if (!bases[k]) continue;
			const want = layout[k];
			const to = want ? (settle(bases[k], want, { orb, r, box, others: [...fixed, ...placed] }) ?? ZERO) : ZERO;
			if (want) placed.push(shift(bases[k], to));
			springs[k].stiffness = SPRING.stiffness;
			springs[k].damping = SPRING.damping;
			springs[k].set(to, { instant: !animate || reduced.current });
		}
	}
	/* 窓の大きさ、カードの出入りと高さの変化で既定の位置が変わる */
	function watchLayout(node: HTMLElement) {
		const ro = new ResizeObserver(() => relayout());
		ro.observe(node);
		const mo = new MutationObserver(() => {
			for (const c of node.querySelectorAll(':scope > .card')) ro.observe(c);
		});
		mo.observe(node, { childList: true });
		for (const c of node.querySelectorAll(':scope > .card')) ro.observe(c);
		return () => {
			ro.disconnect();
			mo.disconnect();
		};
	}

	function onDown(e: PointerEvent) {
		const el = (e.target as Element).closest<HTMLElement>('.bento > .card');
		if (!el || !here || voicing || e.button !== 0) return;
		/* 前のドラッグの離しが届かなかった (窓の外で離した、アプリを切り替えた) ときは、
		   その押下を残したままにしない。残ると onMove が新しい押下を前の押下の続きと
		   取り違え (pointerId も違うので無視し)、カードが二度と動かなくなる (ユーザー指摘 2026-09-24) */
		if (drag) finish(drag, false);
		const from = springs[el.dataset.card!].target;
		drag = {
			card: el.dataset.card!,
			el,
			id: e.pointerId,
			sx: e.clientX,
			sy: e.clientY,
			from,
			raw: from,
			started: false,
			pushed: new Set()
		};
	}
	function onMove(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		const dx = e.clientX - drag.sx;
		const dy = e.clientY - drag.sy;
		if (!drag.started) {
			if (Math.hypot(dx, dy) < 8) return;
			drag.started = true;
			drag.el.setPointerCapture(drag.id);
		}
		/* つかんだ点を保ったままポインタに 1 対 1 で付ける。球の上も抵抗なく通り抜けられるが、
		   置くことはできない: 離したときに球の上なら finish の settle が球の外の近い空きへ運ぶ
		   (ユーザー指示 2026-09-25。以前はドラッグ中から球の縁で押し戻していた) */
		drag.raw = { x: drag.from.x + dx, y: drag.from.y + dy };
		const { base, cards, f } = field(drag.card);
		shown = drag.raw;
		/* 重ねられたカードはつるんと退く。調査 (card-drag.md) の結論は「他のカードは動かさない」
		   だったが、ユーザー指示 2026-09-24 で調査の結論を覆した */
		for (const [k, d] of Object.entries(shove(shift(base, shown), cards, f))) {
			const sp = springs[k];
			sp.stiffness = SNAPPY.stiffness;
			sp.damping = SNAPPY.damping;
			sp.set(plus(sp.target, d), { instant: reduced.current });
			drag.pushed.add(k);
		}
	}
	/* 既定の位置からのずれを保存する。ほぼ 0 なら既定に戻ったものとして消す */
	function keep(k: string, to: Pt) {
		if (Math.hypot(to.x, to.y) < 0.5) delete layout[k];
		else layout[k] = to;
	}
	function onUp(e: PointerEvent) {
		if (!drag || e.pointerId !== drag.id) return;
		finish(drag, e.type === 'pointerup');
	}
	/** ドラッグを閉じて、置いた位置を確定する。clicked は、直後に click が来るので止める必要があるとき */
	function finish(d: NonNullable<typeof drag>, clicked: boolean) {
		drag = null;
		if (!d.started) return;
		if (clicked) {
			// ドラッグの直後の click (承認パネルを開く、リンクへ移る、ToDo を切り替える) を 1 回だけ止める
			const stop = (ev: Event) => {
				ev.preventDefault();
				ev.stopPropagation();
			};
			d.el.addEventListener('click', stop, { capture: true, once: true });
			// click が来ないまま (カードの外で離した) 残ると、次の本物の押下を食べてしまう
			setTimeout(() => d.el.removeEventListener('click', stop, { capture: true }));
		}
		// 他のカードは押しのけたあとの位置で避ける。押しのけたカードは戻さず、その位置を保存する
		const { base, cards, f } = field(d.card);
		const to = settle(base, d.raw, { ...f, others: [...f.others, ...Object.values(cards)] }) ?? d.from;
		keep(d.card, to);
		for (const k of d.pushed) keep(k, springs[k].target);
		saveLayout();
		const sp = springs[d.card];
		sp.set(shown ?? d.from, { instant: true });
		shown = null;
		/* 球の上で離したときは、球の中から置き場所まで、ばねでつるんと滑り出させる。
		   repel を当てると、最初の 1 コマで球の縁まで押し出されて瞬間移動に見える
		   (ユーザー指摘 2026-09-25)。滑り出しの間だけ repel を外し、ほかのカードと同じ
		   SNAPPY のばねで運ぶ */
		escaping = d.card;
		sp.stiffness = SNAPPY.stiffness;
		sp.damping = SNAPPY.damping;
		// 動きを減らす設定では、押し戻しだけ即座に置く (追従は利用者自身の操作の表示なので残す)
		sp.set(to, { instant: reduced.current }).then(() => {
			if (escaping === d.card) escaping = null;
			sp.stiffness = SPRING.stiffness;
			sp.damping = SPRING.damping;
		});
	}
	/* ばねで戻る途中も球を避ける。置き場所が球の向こう側だと、まっすぐ戻る道が球の上を
	   横切るため、途中の位置も球の縁の外へ押し出す (止まった位置では押し出す量は 0) */
	let escaping = $state<string | null>(null);
	function repel(k: string, o: Pt): Pt {
		if (!bento || (o.x === 0 && o.y === 0) || escaping === k) return o;
		const { bases, orb, r } = measure();
		if (!bases[k]) return o;
		return plus(o, orbPush(shift(bases[k], o), orb, r));
	}
	const lifted = (k: string) => !!drag?.started && drag.card === k;
	/* ドラッグのずれは translate、音声で退く分は transform に分けて持つ。transform の
	   transition だけが退き・戻りの動きになり、利用者が置いた位置はそのまま残る */
	const cardAttrs = (k: string) => {
		// 環状配置でない幅ではずれを当てない (段組みの中で置いた位置は意味を持たない)
		const o = !here ? ZERO : lifted(k) && shown ? shown : repel(k, springs[k].current);
		const away = voicing && !reduced.current ? leave[k] : undefined;
		return {
			inert: voicing,
			// class は TodayCard 自身の "card tc" を上書きしてしまうので、状態は data 属性で渡す
			'data-lifted': lifted(k) || undefined,
			'data-away': voicing || undefined,
			style: `translate: ${o.x}px ${o.y}px;${away ? ` transform: translate(${away.x}px, ${away.y}px);` : ''}`
		};
	};
	const moved = $derived(Object.keys(layout).length > 0);

	const meetingHead = (m: NonNullable<typeof nm>) =>
		`次の会議 ${rel(parse(m.event.date))} ${m.event.start} ${m.meeting.title}`;
</script>

<svelte:head><title>Today — KUROKO AI</title></svelte:head>
<!-- 動かせる範囲は窓で決まるが、.bento は最大幅で止まるので窓の変化を直接見る -->
<svelte:window onkeydown={onKey} onresize={() => relayout()} />

<div class="today">
	<!-- Task 10m — この画面にボタンは 1 つも置かない。「予定」「ToDo」の追加は ⌘K パレットと
	     各画面の追加ボタンへ、「KUROKO に頼む」は下端の依頼バーそのもの、デモの操作
	     (開始 / 他のシナリオ / リセット) は上部バー右端のメニューと ⌘K へ移した (仕様 5.1 の裁定) -->
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
					relayout(true);
				}}
			>
				<Icon name="ic-undo" size={20} />
			</button>
		{/if}
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
			<!-- ドラッグの押下はカードごとではなく入れ物でまとめて受ける (押下の役割は各カード自身が持つ) -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="bento"
				class:voicing
				style="--orb: {orbSize}px"
				bind:this={bento}
				onpointerdown={onDown}
				onpointermove={onMove}
				onpointerup={onUp}
				onpointercancel={onUp}
				onlostpointercapture={onUp}
				{@attach watchLayout}
				{@attach glass({
					...CARD,
					// 既定の bleed (約 47px) では、.bento から離れたカードが canvas の外に出てガラスが消える
					bleed: Math.max(reach, 48),
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
						{#each ap.slice(0, 3) as a (a.id)}
							<div class="list-row">
								<ApprovalIcon kind={a.kind} />
								<span class="tc-text">{a.title}</span>
								<!-- ドロワーと同じ区分の記号。ApprovalIcon (種類) とは別の形にして混ざらないようにする -->
								<RiskIcon risk={a.risk} />
							</div>
						{/each}
						{#if ap.length > 3}<p class="muted">残り {ap.length - 3} 件</p>{/if}
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
					{#if rp.length > 3}<p class="muted">残り {rp.length - 3} 件</p>{/if}
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
					{#if events.length > 3}<p class="muted">残り {events.length - 3} 件</p>{/if}
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
						{...cardAttrs('sent')}
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
					<!-- 大きさは外側 2 段の scale で変える。.hole は基準 (普段と聞いている間)、.voice-pulse は声。
					     Orb の size を毎フレーム変えると描画面を作り直すため (voice-orb.md の実装の注意) -->
					<div
						class="hole"
						aria-hidden="true"
						style:scale={voicing && !reduced.current ? baseScale * ORB_GROW : baseScale}
					>
						<div
							class="voice-pulse"
							style:scale={voicing && !reduced.current && !hearing.thinking
								? ORB_PULSE_MIN + (ORB_PULSE_MAX - ORB_PULSE_MIN) * hearing.level
								: 1}
							style:opacity={voicing && reduced.current ? 0.85 + 0.15 * hearing.level : 1}
						>
							<Orb size={drawSize} onCanvas={(c) => (holeOrbCanvas = c)} />
						</div>
					</div>
				{/if}
				{#if voicing}
					<!-- 途中の聞き取り結果は読み上げに流さない。状態の文言と、聞き取りが終わった時点の
					     文字だけを role="status" で伝える (voice-orb.md の読み上げとキーボード) -->
					<div class="voice-here" style:left="{voiceX}px">
						<!-- ユーザー指示 2026-09-24 — 状態の文言は画面には出さず読み上げだけに残す -->
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
