/* Today の環状配置で、利用者がドラッグで置いたカードの位置 (docs/research/card-drag.md)。
   持つのは既定の位置 (app.css の環状配置) からのずれ (px) だけで、既定の式は壊さない。
   座標はすべて .bento の左上を原点にした値 */

export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };
/** 置き場所の制約。orb は球の中心、r は球の半径、box は .bento の矩形、others は他のカード */
export type Field = { orb: Pt; r: number; box: Box; others: Box[] };

const KEY = 'kuroko-today-layout';
/** 球の縁とカードの間に空ける幅。既定の配置の最短 (実測 115px = 半径 107.5 + 7.5) に合わせた */
const ORB_GAP = 8;
const CARD_GAP = 8;
/* 承認待ちカードは既定で入れ物の上へ 8px はみ出す (app.css の top: -8px)。その分だけ入れ物を広げて判定する */
const BOX_SLACK = 8;
/* 浮動小数の誤差で「球にちょうど接した位置」を禁止域と判定しないための許し */
const EPS = 0.01;

const hasStorage = () => typeof localStorage !== 'undefined';

/** data-card ごとのずれ。デモのデータ (kuroko-demo) とは別の鍵に置き、リセットの確かめでも消す */
export const layout: Record<string, Pt> = $state(
	hasStorage() ? JSON.parse(localStorage.getItem(KEY) ?? '{}') : {}
);

export function saveLayout() {
	if (hasStorage()) localStorage.setItem(KEY, JSON.stringify(layout));
}

export function resetLayout() {
	for (const k of Object.keys(layout)) delete layout[k];
	if (hasStorage()) localStorage.removeItem(KEY);
}

export const shift = (b: Box, d: Pt): Box => ({ ...b, x: b.x + d.x, y: b.y + d.y });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const len = (p: Pt) => Math.hypot(p.x, p.y);

/** 矩形を球から「半径 + 8px」離すのに要る最小の移動。離れていれば 0 */
export function orbPush(b: Box, orb: Pt, r: number): Pt {
	const D = r + ORB_GAP;
	const dx = clamp(orb.x, b.x, b.x + b.w) - orb.x;
	const dy = clamp(orb.y, b.y, b.y + b.h) - orb.y;
	const d = Math.hypot(dx, dy);
	if (d >= D) return { x: 0, y: 0 };
	if (d > 0) return { x: (dx / d) * (D - d), y: (dy / d) * (D - d) };
	// 球の中心が矩形の中にある。4 方向のうち最も短く抜けられる向きへ
	return [
		{ x: orb.x + D - b.x, y: 0 },
		{ x: orb.x - D - (b.x + b.w), y: 0 },
		{ x: 0, y: orb.y + D - b.y },
		{ x: 0, y: orb.y - D - (b.y + b.h) }
	].reduce((a, c) => (len(c) < len(a) ? c : a));
}

/** ドラッグ中の押し戻し。禁止域へ入り込んだ深さ p のうち min(p x 0.3, 24) だけを見せる (ラバーバンド) */
export function rubber(b: Box, orb: Pt, r: number): Pt {
	const push = orbPush(b, orb, r);
	const p = len(push);
	if (!p) return push;
	const k = (p - Math.min(p * 0.3, 24)) / p;
	return { x: push.x * k, y: push.y * k };
}

const into = (lo: number, size: number, min: number, max: number) =>
	lo < min ? min - lo : lo + size > max ? max - (lo + size) : 0;

function boxPush(b: Box, box: Box): Pt {
	return {
		x: into(b.x, b.w, box.x - BOX_SLACK, box.x + box.w + BOX_SLACK),
		y: into(b.y, b.h, box.y - BOX_SLACK, box.y + box.h + BOX_SLACK)
	};
}

const overlaps = (a: Box, b: Box) =>
	a.x < b.x + b.w + CARD_GAP &&
	b.x < a.x + a.w + CARD_GAP &&
	a.y < b.y + b.h + CARD_GAP &&
	b.y < a.y + a.h + CARD_GAP;

function fits(b: Box, f: Field) {
	return (
		len(orbPush(b, f.orb, f.r)) < EPS &&
		len(boxPush(b, f.box)) < EPS &&
		!f.others.some((o) => overlaps(b, o))
	);
}

const STEP = 8;
const REACH = 480;

/** 離したときの置き場所。球と入れ物の外から押し戻し、他のカードと重なるなら近い空きを探す。
    空きが無ければ null (呼び元はドラッグを始めた位置へ戻す) */
export function settle(base: Box, want: Pt, f: Field): Pt | null {
	let d = want;
	// 球から押し出すと入れ物の外へ出ることがあるので、2 つの押し戻しを数回繰り返して落ち着かせる
	for (let i = 0; i < 3; i++) {
		const o = orbPush(shift(base, d), f.orb, f.r);
		const q = boxPush(shift(base, { x: d.x + o.x, y: d.y + o.y }), f.box);
		d = { x: d.x + o.x + q.x, y: d.y + o.y + q.y };
	}
	if (fits(shift(base, d), f)) return d;
	// ponytail: 8px 刻みの輪を外へ広げる総当たり。1 回の離しで 1 万回ほどの判定だが、カードが 5 枚なので間に合う
	for (let r = STEP; r <= REACH; r += STEP) {
		const n = Math.ceil((2 * Math.PI * r) / STEP);
		for (let i = 0; i < n; i++) {
			const a = (2 * Math.PI * i) / n;
			const c = { x: d.x + r * Math.cos(a), y: d.y + r * Math.sin(a) };
			if (fits(shift(base, c), f)) return c;
		}
	}
	return null;
}
