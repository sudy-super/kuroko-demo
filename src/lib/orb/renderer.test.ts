import { describe, expect, it } from 'vitest';
import { fibonacciSphere, plexus, randoms, shardGeometry } from './renderer';

describe('orb helpers', () => {
	it('randoms は [0, 1) を決定的に返す', () => {
		const a = randoms(100);
		expect(Array.from(a).every((v) => v >= 0 && v < 1)).toBe(true);
		expect(randoms(100)).toEqual(a);
		expect(randoms(100, 2)).not.toEqual(a);
	});
	it('shardGeometry は 1 個につき 6 頂点', () => {
		const g = shardGeometry(50);
		expect(g.seeds.length).toBe(50 * 6 * 4);
		expect(g.corners.length).toBe(50 * 6 * 2);
	});
	it('fibonacciSphere は単位ベクトル', () => {
		const d = fibonacciSphere(30);
		for (let i = 0; i < 30; i++) expect(Math.hypot(d[i * 3], d[i * 3 + 1], d[i * 3 + 2])).toBeCloseTo(1, 5);
	});
	it('plexus は近い組だけを結び、裏側の点は alpha 0', () => {
		const p = plexus(fibonacciSphere(60), 3, 0.48, 0.2);
		expect(p.lineCount).toBeGreaterThan(0);
		expect(p.lineCount).toBeLessThanOrEqual(60 * 4);
		const alphas = Array.from({ length: 60 }, (_, i) => p.nodes[i * 3 + 2]);
		expect(alphas.some((a) => a === 0)).toBe(true);
		expect(alphas.every((a) => a >= 0 && a <= 1)).toBe(true);
	});
});
