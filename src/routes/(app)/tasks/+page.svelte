<script lang="ts">
	import { db } from '$lib/store.svelte';
	import type { TaskFilter } from '$lib/derived';
	import { addLogOf, badgeCount, filterTasks, openTaskCount, orderTasks } from '$lib/derived';
	import {
		acceptTaskSuggestions,
		addTaskOnTop,
		moveTask,
		rejectSuggestions,
		sortTasksByDue,
		undo
	} from '$lib/actions';
	import { key, addDays, parse } from '$lib/dates';
	import { toast, takeIntent } from '$lib/ui.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Segmented from '$lib/components/Segmented.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import SuggestionCard from '$lib/components/SuggestionCard.svelte';

	/* icon は一覧の小見出し (list-head) にも使う。フィルターの絞り込み条件を表す形なので
	   期限超過は警告の三角、今日・今週はカレンダー、すべては一覧の形にする */
	const FILTERS: { key: TaskFilter; label: string; empty: string; icon: string }[] = [
		{ key: 'overdue', label: '期限超過', empty: '期限超過はありません', icon: 'ic-alert' },
		{ key: 'today', label: '今日', empty: '今日の ToDo はありません', icon: 'ic-cal' },
		{ key: 'week', label: '今週', empty: '今週の ToDo はありません', icon: 'ic-cal' },
		{ key: 'all', label: 'すべて', empty: 'ToDo はありません', icon: 'ic-list' }
	];

	let filter = $state<TaskFilter>('today');
	const current = $derived(FILTERS.find((f) => f.key === filter)!);
	/* tasks-reminders.md 7 節 — Apple のリマインダーと同じく、完了した ToDo は既定で隠し、
	   「完了を表示」で出す ("Completed items are hidden on your list … tap Show Completed")。
	   ただしこの画面を開いている間に完了にしたものは、その場に薄く残す。すぐ消すと押した行が
	   目の前から消えて、何が起きたか分からず「元に戻す」も押せない */
	const tasks = $derived(filterTasks(db, filter));
	const doneBefore = new Set(db.tasks.filter((t) => t.status === 'done').map((t) => t.id));
	/* filterTasks は完了を末尾へ送るので、この画面で完了にした行が押した瞬間に一番下へ飛ぶ。
	   ここでは完了の前後を分けずに元の並び (期限順か自分で並べた順) のまま出し、行をその場に留める */
	const open = $derived(
		orderTasks(db, tasks.filter((t) => t.status !== 'done' || !doneBefore.has(t.id)))
	);
	const closed = $derived(tasks.filter((t) => t.status === 'done' && doneBefore.has(t.id)));
	// 見出しの件数は、まだ済んでいないものだけを数える (切り替えの件数と同じ)
	const left = $derived(open.filter((t) => t.status !== 'done').length);
	let showDone = $state(false);

	// 会議やチャットが出した ToDo 候補。KUROKO が勝手に登録することはない (仕様 5.4)
	const suggestions = $derived(
		db.suggestions.filter((s) => s.kind === 'task' && s.status === 'pending')
	);

	// ⌘K の「新しい ToDo を追加」
	let formOpen = $state(false);
	$effect(() => takeIntent('new-task', () => (formOpen = true)));

	function accept(ids: string[]) {
		toast(`ToDo を ${acceptTaskSuggestions(ids).length} 件登録しました`);
	}

	/* ---- 追加 (Google ToDo リストと同じく、一覧の先頭の行でその場に書く) ----
	   期限は今の絞り込みに合わせる (足した瞬間に消えないように)。詳しく決めたいときは ⌘K から */
	let adding = $state(false);
	let draft = $state('');
	const dueFor = (f: TaskFilter) =>
		f === 'today' || f === 'week' ? db.seededOn : f === 'overdue' ? key(addDays(-1, parse(db.seededOn))) : undefined;
	function add(e: SubmitEvent) {
		e.preventDefault();
		const title = draft.trim();
		if (!title) return;
		const t = addTaskOnTop(title, dueFor(filter));
		draft = '';
		const l = addLogOf(db, t.id)!;
		toast('ToDo を登録しました', { undo: () => undo(l.id) });
	}
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}

	/* ---- 並べ替え (task-reorder.md) ----
	   行のどこからでも始められる。行は押すと完了になるので、マウスは 5px 動かした時点で並べ替えにし、
	   そのあとの click は捨てる。指は画面の送りとぶつかるので長押し (400ms)。落とす位置は行の間の線で示す */
	const movable = $derived(open.filter((t) => t.status !== 'done'));
	const ids = $derived(movable.map((t) => t.id));
	let listEl: HTMLElement | undefined = $state();
	let drag = $state<{ id: string; y: number; dy: number; to: number } | null>(null);
	let said = $state('');
	const SLOP = 5;
	const HOLD_MS = 400;

	function move(id: string, to: number) {
		const t = db.tasks.find((x) => x.id === id);
		moveTask(ids, id, to);
		// WCAG 4.1.3 — 何がどこへ動いたかを読み上げに知らせる (Atlassian の live region の作法)
		said = `「${t?.title}」を ${ids.length} 件中 ${to + 1} 番目に移しました`;
	}

	function grab(id: string, e: PointerEvent) {
		// 星・メニュー・元に戻すは押す操作のまま。完了した行は並べ替えない
		if (e.button !== 0 || !ids.includes(id) || (e.target as Element).closest('button')) return;
		const x0 = e.clientX;
		const y0 = e.clientY;
		const touch = e.pointerType !== 'mouse';
		let active = false;
		const begin = () => {
			active = true;
			drag = { id, y: y0, dy: 0, to: ids.indexOf(id) };
		};
		const hold = touch ? setTimeout(begin, HOLD_MS) : undefined;
		const onMove = (ev: PointerEvent) => {
			if (!active) {
				if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < SLOP) return;
				// 指は長押しの前に動いたら画面を送る動きなので、並べ替えにしない
				if (touch) return end();
				begin();
			}
			if (!drag || !listEl) return;
			drag.dy = ev.clientY - drag.y;
			// 行の中心より上か下かで、落とす位置 (何番目の前か) を決める
			const rows = [...listEl.querySelectorAll<HTMLElement>('[data-task]')].filter(
				(r) => r.dataset.task !== drag!.id
			);
			let to = rows.length;
			for (let i = 0; i < rows.length; i++) {
				const r = rows[i].getBoundingClientRect();
				if (ev.clientY < r.top + r.height / 2) {
					to = i;
					break;
				}
			}
			drag.to = to;
		};
		// 持ち上げている間は、指の動きで画面が送られないようにする
		const noScroll = (ev: TouchEvent) => active && ev.preventDefault();
		// 動かしたあとの click (行の完了) を 1 回だけ捨てる
		const swallow = (ev: MouseEvent) => {
			ev.preventDefault();
			ev.stopPropagation();
		};
		const end = () => {
			clearTimeout(hold);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', end);
			window.removeEventListener('touchmove', noScroll);
			drag = null;
		};
		const onUp = () => {
			if (active) {
				window.addEventListener('click', swallow, { capture: true });
				setTimeout(() => window.removeEventListener('click', swallow, { capture: true }));
				if (drag && drag.to !== ids.indexOf(drag.id)) move(drag.id, drag.to);
			}
			end();
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', end);
		window.addEventListener('touchmove', noScroll, { passive: false });
	}
	/* 線を引く位置。つかんだ行を除いた並びで to 番目の行の上端 (末尾なら最後の行の下端) */
	const lineIndex = $derived(drag ? drag.to : -1);

	function rejectAll() {
		rejectSuggestions(suggestions.map((s) => s.id));
		toast('候補を破棄しました');
	}
</script>

<svelte:head><title>ToDo — KUROKO AI</title></svelte:head>

<div class="tasks">
	<h1 class="sr-only">ToDo</h1>

	<div class="row page-bar">
		<Segmented label="絞り込み" items={FILTERS} value={filter} onchange={(k) => (filter = k)}>
			{#snippet extra(k)}
				{@const n = openTaskCount(db, k)}
				<span class="badge count" class:danger={k === 'overdue' && n > 0}>{badgeCount(n)}</span>
			{/snippet}
		</Segmented>
		<!-- 自分で並べた順になっているときだけ、期限順に戻す操作を出す (リマインダーの並び替えの
		     「手動」と「期限」の切り替えに当たる。task-reorder.md) -->
		{#if db.taskOrder}
			<button class="btn text sm tasks-sort" onclick={sortTasksByDue}>
				<Icon name="ic-clock" size={18} />期限順に戻す
			</button>
		{/if}
	</div>

	{#if suggestions.length}
		<SuggestionCard
			{suggestions}
			title="ToDo の候補 {suggestions.length} 件"
			onaccept={accept}
			onreject={rejectAll}
		/>
	{/if}

	<section class="card list-card" aria-labelledby="tasks-open-head">
		<h2 class="list-head" id="tasks-open-head">
			<Icon name={current.icon} size={16} />{current.label}<span class="num">{left}</span>
		</h2>
		{#if adding}
			<form class="list-row lg tasks-new" onsubmit={add}>
				<span class="tasks-new-mark" aria-hidden="true"></span>
				<input
					class="tasks-new-input"
					aria-label="新しい ToDo の題名"
					placeholder="ToDo を入力して Enter"
					bind:value={draft}
					use:focusOnMount
					onblur={() => !draft.trim() && (adding = false)}
					onkeydown={(e) => e.key === 'Escape' && ((draft = ''), (adding = false))}
				/>
			</form>
		{:else}
			<button class="list-row lg tasks-add" onclick={() => (adding = true)}>
				<Icon name="ic-plus" size={20} />ToDo を追加
			</button>
		{/if}
		{#if open.length === 0}
			<p class="muted empty">{current.empty}</p>
		{/if}
		<div class="tasks-rows" class:dragging={!!drag} role="list" bind:this={listEl}>
			{#each open as t (t.id)}
				{@const i = ids.indexOf(t.id)}
				{@const others = ids.filter((x) => x !== drag?.id)}
				<div
					class="tasks-slot"
					class:task-lifted={drag?.id === t.id}
					class:line-before={drag && drag.id !== t.id && others.indexOf(t.id) === lineIndex}
					class:line-after={drag && drag.id !== t.id && lineIndex === others.length && others.indexOf(t.id) === others.length - 1}
					data-task={i >= 0 ? t.id : undefined}
					style={drag?.id === t.id ? `transform: translateY(${drag.dy}px)` : undefined}
				>
					<TaskRow
						task={t}
						index={i}
						count={ids.length}
						onmove={(to) => move(t.id, to)}
						ongrab={(e) => grab(t.id, e)}
					/>
				</div>
			{/each}
		</div>
		<p class="sr-only" role="status">{said}</p>
		{#if closed.length}
			<button class="btn text sm tasks-done-toggle" aria-expanded={showDone} onclick={() => (showDone = !showDone)}>
				{showDone ? '完了を隠す' : `完了を表示 (${closed.length})`}
			</button>
			{#if showDone}
				<div role="list" aria-label="完了した ToDo">
					{#each closed as t (t.id)}
						<TaskRow task={t} index={-1} count={0} onmove={() => {}} ongrab={() => {}} />
					{/each}
				</div>
			{/if}
		{/if}
	</section>
</div>

<TaskForm open={formOpen} onclose={() => (formOpen = false)} />

<style>
	.tasks {
		max-width: 880px;
	}
	.tasks-sort {
		margin-left: auto;
	}
	/* 一覧の先頭の追加の行。丸いチェックの位置に「+」を置き、文字をアクセントの色にする */
	.tasks-add {
		gap: var(--sp-3);
		padding-left: calc(var(--sp-1) + 20px + var(--sp-2));
		color: var(--accent);
		font-weight: 500;
	}
	.tasks-new {
		gap: var(--sp-3);
		padding-left: calc(var(--sp-1) + 20px + var(--sp-2));
		cursor: default;
	}
	.tasks-new:hover {
		background: none;
	}
	.tasks-new-mark {
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1.5px var(--ink-3);
	}
	.tasks-new-input {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		outline: none;
	}
	.tasks-slot {
		position: relative;
	}
	/* つかんだ行は指に付いて浮かせる。HIG Drag and drop は持ち上げた項目を半透明にするとあるが、
	   一覧の行は下の行と文字が重なって読めなくなるので、不透明な面と影で浮きを示す */
	.tasks-slot.task-lifted {
		z-index: 2;
		border-radius: var(--r-s);
		background: #fff;
		box-shadow: 0 8px 24px rgba(30, 42, 71, 0.16);
	}
	.tasks-rows.dragging {
		cursor: grabbing;
		user-select: none;
	}
	/* 落とす位置の線 (Atlassian — 行をよけさせず、線で示す) */
	.tasks-slot.line-before::before,
	.tasks-slot.line-after::after {
		content: '';
		position: absolute;
		left: var(--sp-4);
		right: var(--sp-4);
		z-index: 3;
		height: 2px;
		border-radius: 1px;
		background: var(--accent);
	}
	.tasks-slot.line-before::before {
		top: -1px;
	}
	.tasks-slot.line-after::after {
		bottom: -1px;
	}
	.tasks-done-toggle {
		margin: var(--sp-1) var(--sp-4);
	}
</style>
