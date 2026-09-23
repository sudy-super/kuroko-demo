import { describe, it, expect } from 'vitest';
import { orbPush, rubber, settle, shift } from './todayLayout.svelte';

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
});
