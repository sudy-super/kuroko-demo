<script lang="ts">
	import type { CalendarEvent } from '$lib/types';
	import { db } from '$lib/store.svelte';
	import { key, minutes, hm } from '$lib/dates';
	import { layoutColumns, eventsOn, weekOf } from '$lib/calendar';
	import Icon from './Icon.svelte';
	import Tip from './Tip.svelte';

	let { cursor, onopen }: { cursor: Date; onopen: (e: CalendarEvent) => void } = $props();

	/* Task 11r 修正ラウンド 1 (Important 1、監査 9) — components 3.12 の既定は 1 時間 48px
	   (30 分の予定が 24px)だったが、当たり判定が Apple HIG / WCAG 2.5.8 の下限 44px に届かない
	   (実測 24px のまま)。疑似要素での継ぎ足しは親の overflow: hidden に切られて効かなかったため、
	   目盛りそのものを 1 時間 88px に上げ、30 分の予定の実寸を直接 44px にした。上下・左右の
	   隣接予定の間隔も同じ倍率で広がるので重なりは生まれない。components.md の「48px/時」からは
	   外れるが、44px の当たり判定を確保するための意図的な変更 (app.css .week-body 側にも
	   同じ倍率でコメント)。
	   0:00〜24:00 の全部を持ち、見える高さ (12 時間分) は CSS の .week-body で切って縦に送る。
	   8:00〜20:00 だけを持つと、20:00 より後に作った予定がどこにも出なくなる */
	const PX = 88 / 60;
	const HOURS = Array.from({ length: 24 }, (_, i) => i);
	const OPEN = 8 * 60 * PX; // 開いた直後に見せる位置 (8:00)
	const WD = ['月', '火', '水', '木', '金', '土', '日'];

	const days = $derived(weekOf(cursor));
	const todayKey = $derived(db.seededOn);

	/* 現在時刻線は実時刻で引く。1 分ごとに引き直す */
	let now = $state(minutes(hm()));
	$effect(() => {
		const t = setInterval(() => (now = minutes(hm())), 60000);
		return () => clearInterval(t);
	});

	// 開いた直後だけ 8:00 が上端に来るよう送る。以降は利用者の位置を動かさない
	let body: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (body) body.scrollTop = OPEN;
	});

	const top = (m: number) => m * PX;
	/* Task 11r 修正ラウンド 2 (再レビュー 新規 1) — 1 時間を 88px に上げた後も、この下限だけ
	   48px/時 時代の 24px (WCAG 2.2 SC 2.5.8 の最小)のまま残っていて、16.4 分未満の予定は
	   44px を割ったまま描かれていた (予定を追加する画面から 2 手で再現できる)。
	   responsive-policy.md の条件 4 (タップ領域 44px 以上、buttons.md 資料 14 の Baymard の
	   強化基準)に合わせ、下限も 44px にする。上下に隣り合う予定の塗りを離すのは CSS 側の
	   透明な下線 (.week-ev の border-bottom + background-clip) に任せ、どの長さでも同じ
	   1px の隙間にする */
	const MIN_HEIGHT = 44;
	const height = (e: CalendarEvent) => Math.max(MIN_HEIGHT, (minutes(e.end) - minutes(e.start)) * PX);
	/* 上の下限で描画が実時間より下へ伸びるぶん、layoutColumns の重なり判定にも同じ分だけ
	   描画上の終了位置を渡す。実時間のままだと、続けて入った予定 (例: 11:00〜11:15 と
	   11:15〜12:00) の描画が重なり、文字も当たり判定も潰れる。
	   分単位に戻すのは MIN_HEIGHT / PX だが、PX = 88 / 60 の浮動小数点の丸めで
	   30.000000000000004 になり、ちょうど 30 分の予定 (0:00〜0:30 と 0:30〜1:00 など) まで
	   重なり判定に誤って引っかかる。60 を先に掛けてから 88 で割れば 30 ちょうどになる */
	const MIN_DURATION_MIN = (MIN_HEIGHT * 60) / 88;

	/* 重なりの横位置。左右の余白を 4px でそろえたいので、幅から 1px 引いて右にずらす手は
	   使わず、先に列の間の隙間 (cols - 1)px を引いてから均等に割る */
	const place = (col: number, cols: number) => {
		const w = `(100% - ${8 + cols - 1}px) / ${cols}`;
		return `left: calc(4px + ${col} * (${w} + 1px)); width: calc(${w});`;
	};

	/* calendar-block.md「時刻の位置」— 1 行目に題名、2 行目に時刻。2 行の高さは
	   上下の余白 4px x 2 + 題名 14px x 1.25 + 時刻 12px x 1.25 = 40.5px なので、
	   42px に届かない予定 (45 分以下) は題名だけに落とす */
	const TWO_LINES = 42;

	/* calendar-block.md「仮・バッファ・オンライン・準備の示し方」— 属性は塗りやバーの色を
	   変えず、題名の前のアイコンで示す。2 個までに切り、幅 120px 未満のブロックでは
	   CSS 側 (@container weekev) でアイコンごと落として題名に幅を譲る。
	   文言は下の title と aria-label に残る */
	const attrs = (e: CalendarEvent) =>
		[
			e.online ? { name: 'ic-video', label: 'オンライン会議' } : null,
			e.meetingId && db.meetings.some((m) => m.id === e.meetingId && m.brief)
				? { name: 'ic-doc', label: '会議準備あり' }
				: null,
			e.bufferBefore || e.bufferAfter ? { name: 'ic-car', label: '移動時間あり' } : null
		]
			.filter((x) => x !== null)
			.slice(0, 2);

	/* アイコンと点線は読み上げに届かないので、名前を文言で組み立てて button に付ける
	   (WCAG 1.4.1: 色や形だけに頼らない) */
	const label = (e: CalendarEvent, a: { label: string }[]) =>
		[`${e.title} ${e.start}〜${e.end}`, ...a.map((x) => x.label), e.tentative ? '仮押さえ' : '']
			.filter(Boolean)
			.join(' ');
</script>

<!-- Task 11r 修正ラウンド 3 (再レビュー 2 所見 6) — 横 (格子の最小幅) と縦 (24 時間分) の
     送りをこの箱 1 つに一本化した (app.css .week 参照)。曜日の行 (.week-head) はこの箱の
     中で position: sticky にできるので、送っても見えたままになる。
     予定が 1 つもない週では中に押せるものが無く、キーボードだけではここへ来られないので、
     領域そのものを焦点に入れる (WCAG 2.1.1)。規則は「押せない要素に tabindex を置くな」だが、
     送れる領域はその例外に当たる -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="week" bind:this={body} tabindex="0" role="group" aria-label="週の時間割">
	<div class="week-cols week-head">
		<div></div>
		{#each days as d, i (i)}
			{@const k = key(d)}
			<div class="week-day" class:on={k === todayKey}>
				{WD[i]}<span class="num">{d.getDate()}</span>
			</div>
		{/each}
	</div>
	<div class="week-cols week-body">
		<div class="week-axis">
			{#each HOURS as h (h)}<div class="week-hour"><span>{h}:00</span></div>{/each}
		</div>
		{#each days as d, i (i)}
			{@const k = key(d)}
			<div class="week-col" class:on={k === todayKey}>
				{#each layoutColumns(eventsOn(db, k), MIN_DURATION_MIN) as { event, col, cols } (event.id)}
					{@const h = height(event)}
					{@const a = attrs(event)}
					<!-- 重なりは塊の幅から列の間の隙間を引いて均等に割る -->
					<button
						class="week-ev"
						class:tentative={event.tentative}
						style="top: {top(minutes(event.start))}px; height: {h}px; {place(col, cols)}"
						aria-label={label(event, a)}
						onclick={() => onopen(event)}
					>
						<span class="week-ev-bar"></span>
						<span class="week-ev-t">
							{#each a as x (x.name)}
								<Tip text={x.label}>
									<Icon name={x.name} size={16} label={x.label} />
								</Tip>
							{/each}
							<!-- 題名は列の幅で切れるので、全文と属性をホバーでも読めるようにする。
							     アイコンのツールチップと重ならないよう、button ではなく題名に付ける -->
							<span class="week-ev-n" title={label(event, a)}>{event.title}</span>
						</span>
						{#if h >= TWO_LINES}
							<!-- ブロックが狭いと入らないので、終わりの時刻から順に CSS で落とす -->
							<span class="week-ev-time num"
								>{event.start}<span class="week-ev-end">〜{event.end}</span></span
							>
						{/if}
					</button>
				{/each}
				{#if k === todayKey}
					<!-- 現在時刻の線。時刻は左の目盛りで読めるので、読み上げには出さない -->
					<div class="week-now" style="top: {top(now)}px"></div>
				{/if}
			</div>
		{/each}
	</div>
</div>
