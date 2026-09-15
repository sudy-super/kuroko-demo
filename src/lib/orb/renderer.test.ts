import { describe, expect, it } from 'vitest';
import { particleSeeds } from './renderer';

describe('particleSeeds', () => {
	it('count x 4 個の [0, 1) の値を決定的に返す', () => {
		const a = particleSeeds(320);
		expect(a.length).toBe(1280);
		expect(Array.from(a).every((v) => v >= 0 && v < 1)).toBe(true);
		expect(particleSeeds(320)).toEqual(a);
		expect(particleSeeds(320, 2)).not.toEqual(a);
	});
});
