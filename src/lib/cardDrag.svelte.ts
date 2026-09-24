/* Today の環状配置のカードのドラッグ (docs/research/card-drag.md)。
   キーボードでの代わりの操作はデモでは作らない。WCAG 2.2 の 2.5.7 (AA、ドラッグしない
   1 点の操作での代わり) は満たさない判断。既定の配置で情報も機能も失われないため */
import { Spring, prefersReducedMotion } from 'svelte/motion';
import { innerWidth } from 'svelte/reactivity/window';
import { layout, saveLayout, orbPush, settle, shove, shift, type Box, type Pt } from './todayLayout.svelte';

export const ZERO: Pt = { x: 0, y: 0 };

/** 画面の状態は呼び出し側 (today/+page.svelte) が持つので、読むための関数で受け取る */
export function cardDrag(opts: {
	here: () => boolean;
	voicing: () => boolean;
	orbSize: () => number;
}) {
	let bento: HTMLDivElement | undefined = $state();
	const CARDS = ['approvals', 'reply', 'meeting', 'events', 'tasks', 'sent'];
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
		return { bases, orb: { x: b.clientWidth / 2, y: b.clientHeight / 2 }, r: (opts.orbSize() * 0.48) / 2 };
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
		if (!bento || !opts.here()) return;
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
			springs[k].set(to, { instant: !animate || prefersReducedMotion.current });
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
		if (!el || !opts.here() || opts.voicing() || e.button !== 0) return;
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
			sp.set(plus(sp.target, d), { instant: prefersReducedMotion.current });
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
		sp.set(to, { instant: prefersReducedMotion.current }).then(() => {
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

	return {
		get bento() {
			return bento;
		},
		set bento(v) {
			bento = v;
		},
		get reach() {
			return reach;
		},
		get shown() {
			return shown;
		},
		springs,
		relayout,
		watchLayout,
		onDown,
		onMove,
		onUp,
		repel,
		lifted
	};
}
