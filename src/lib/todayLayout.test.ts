import { describe, it, expect } from 'vitest';
import { orbPush, rubber, settle, shift, shove } from './todayLayout.svelte';

const orb = { x: 440, y: 235 };
const r = 107.5;
const box = { x: 0, y: 0, w: 880, h: 470 };
const card = { x: 35, y: 207, w: 280, h: 117 };
/** 矩形と円の距離 */
const dist = (b: typeof card) =>
	Math.hypot(
		Math.max(b.x - orb.x, 0, orb.x - (b.x + b.w)),
		Math.max(b.y - orb.y, 0, orb.y - (b.y + b.h))
	);

describe('Today のカードの配置', () => {
	it('離れていれば押し戻さない', () => {
		expect(orbPush(card, orb, r)).toEqual({ x: 0, y: 0 });
	});
	it('ドラッグ中の入り込みは 24px で頭打ち', () => {
		const deep = shift(card, { x: 200, y: 0 });
		const p = rubber(deep, orb, r);
		expect(r + 8 - dist(shift(deep, p))).toBeCloseTo(24, 5);
	});
	it('球の真上に落とすと、半径 + 8px の外に置く', () => {
		const to = settle(card, { x: 255, y: 0 }, { orb, r, box, others: [] })!;
		expect(dist(shift(card, to))).toBeGreaterThanOrEqual(r + 8 - 0.01);
	});
	it('他のカードと重なるなら近い空きへずらす', () => {
		const other = { x: 45, y: 0, w: 280, h: 177 };
		const to = settle(card, { x: 0, y: -150 }, { orb, r, box, others: [other] })!;
		const b = shift(card, to);
		expect(b.y >= other.y + other.h || b.y + b.h <= other.y || b.x >= other.x + other.w).toBe(true);
	});
	/** 2 つの矩形の間の空き (重なっていれば負) */
	const gap = (a: typeof card, b: typeof card) =>
		Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
	const wide = { x: -100, y: -100, w: 1080, h: 670 };
	it('重ねたカードを押し出して、8px 空ける', () => {
		const mover = { x: 35, y: 0, w: 280, h: 117 };
		const other = { x: 60, y: 60, w: 280, h: 117 };
		const d = shove(mover, { other }, { orb, r, box: wide, others: [] });
		expect(gap(mover, shift(other, d.other))).toBeGreaterThanOrEqual(8 - 0.01);
		expect(dist(shift(other, d.other))).toBeGreaterThanOrEqual(r + 8 - 0.01);
	});
	it('連鎖は 2 段で止まる', () => {
		// 左の壁に沿って 8px ずつ空けて積んだ 3 枚を上から押す。横へ逃げられない幅なので
		// a が b を押す 2 段目までで止まり、3 段目の c は動かさない (a は重なったまま残る)
		const col = (y: number) => ({ x: 0, y, w: 150, h: 100 });
		const cards = { a: col(0), b: col(108), c: col(216) };
		const d = shove(col(-60), cards, { orb, r, box: { x: 0, y: -100, w: 150, h: 432 }, others: [] });
		expect(d.c).toBeUndefined();
		expect(Object.keys(d).length).toBeLessThanOrEqual(2);
	});
	it('押し出した先は範囲の外へ出ない', () => {
		const mover = { x: 0, y: 0, w: 280, h: 117 };
		const other = { x: 0, y: 30, w: 280, h: 117 };
		const d = shove(mover, { other }, { orb, r, box, others: [] });
		const b = shift(other, d.other);
		expect(b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h).toBe(true);
		expect(gap(mover, b)).toBeGreaterThanOrEqual(8 - 0.01);
	});
});
