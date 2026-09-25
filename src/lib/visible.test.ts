import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { whileVisible, type VisibilitySource } from './visible';

/* document が無い node 環境で動かすための最小の代役 */
function fakeSource() {
	const listeners = new Set<() => void>();
	return {
		hidden: false as boolean,
		addEventListener: (_: 'visibilitychange', fn: () => void) => void listeners.add(fn),
		removeEventListener: (_: 'visibilitychange', fn: () => void) => void listeners.delete(fn),
		set(hidden: boolean) {
			this.hidden = hidden;
			for (const fn of listeners) fn();
		},
		get listenerCount() {
			return listeners.size;
		}
	} satisfies VisibilitySource & { set(hidden: boolean): void; listenerCount: number };
}

describe('whileVisible', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('見えていれば即座に握り、隠れても delay の間は手放さない', () => {
		const source = fakeSource();
		const acquire = vi.fn();
		const release = vi.fn();
		whileVisible(acquire, release, { delay: 5000, source });
		expect(acquire).toHaveBeenCalledTimes(1);
		source.set(true);
		vi.advanceTimersByTime(4999);
		expect(release).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(release).toHaveBeenCalledTimes(1);
	});

	it('delay の前に戻れば握ったまま (作り直さない)', () => {
		const source = fakeSource();
		const acquire = vi.fn();
		const release = vi.fn();
		whileVisible(acquire, release, { delay: 5000, source });
		source.set(true);
		vi.advanceTimersByTime(3000);
		source.set(false);
		vi.advanceTimersByTime(10_000);
		expect(release).not.toHaveBeenCalled();
		expect(acquire).toHaveBeenCalledTimes(1);
	});

	it('手放したあと戻ったら作り直す', () => {
		const source = fakeSource();
		const acquire = vi.fn();
		const release = vi.fn();
		whileVisible(acquire, release, { delay: 5000, source });
		source.set(true);
		vi.advanceTimersByTime(5000);
		source.set(false);
		expect(acquire).toHaveBeenCalledTimes(2);
		expect(release).toHaveBeenCalledTimes(1);
	});

	it('隠れた状態で始まったら握らない', () => {
		const source = fakeSource();
		source.hidden = true;
		const acquire = vi.fn();
		const release = vi.fn();
		whileVisible(acquire, release, { delay: 5000, source });
		expect(acquire).not.toHaveBeenCalled();
		vi.advanceTimersByTime(10_000);
		expect(release).not.toHaveBeenCalled();
	});

	it('片付けで手放し、聞き手も外す', () => {
		const source = fakeSource();
		const acquire = vi.fn();
		const release = vi.fn();
		const stop = whileVisible(acquire, release, { delay: 5000, source });
		stop();
		expect(release).toHaveBeenCalledTimes(1);
		expect(source.listenerCount).toBe(0);
		source.set(false);
		expect(acquire).toHaveBeenCalledTimes(1);
	});
});
