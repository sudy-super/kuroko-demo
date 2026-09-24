import { afterEach, describe, expect, it, vi } from 'vitest';
import { orbLifecycle, type OrbHost } from './mount';
import type { Orb } from './renderer';

/* document の無い node 環境なので、canvas も箱も「外されたか」を持つだけの代役にする */
type FakeCanvas = HTMLCanvasElement & { removed: boolean };
const fakeCanvas = () => {
	const c = { removed: false, remove() { c.removed = true; } };
	return c as unknown as FakeCanvas;
};

function host(
	createOrb: OrbHost['createOrb']
): OrbHost & { canvases: FakeCanvas[]; handed: (HTMLCanvasElement | null)[]; inBox: HTMLCanvasElement[] } {
	const canvases: FakeCanvas[] = [];
	const handed: (HTMLCanvasElement | null)[] = [];
	const inBox: HTMLCanvasElement[] = [];
	return {
		canvases,
		handed,
		inBox,
		box: { prepend: (c: HTMLCanvasElement) => void inBox.push(c) },
		createCanvas: () => {
			const c = fakeCanvas();
			canvases.push(c);
			return c;
		},
		createOrb,
		onCanvas: (c) => void handed.push(c)
	};
}

const fakeOrb = () => {
	const orb = { started: 0, destroyed: 0 };
	return {
		orb,
		api: {
			start: () => void orb.started++,
			destroy: () => void orb.destroyed++
		} as Orb
	};
};

afterEach(() => vi.restoreAllMocks());

describe('オーブの出し入れ', () => {
	it('握ると canvas を箱に入れて呼び元に渡し、手放すと壊して外す', () => {
		const { orb, api } = fakeOrb();
		const h = host(() => api);
		const { acquire, release } = orbLifecycle(h);
		acquire();
		expect(h.inBox).toEqual([h.canvases[0]]);
		expect(orb.started).toBe(1);
		expect(h.handed).toEqual([h.canvases[0]]);
		release();
		expect(orb.destroyed).toBe(1);
		expect(h.canvases[0].removed).toBe(true);
		expect(h.handed[1]).toBeNull();
	});

	it('握り直すたびに canvas も作り直す (一度失った描画面は同じ canvas では取り直せない)', () => {
		const h = host(() => fakeOrb().api);
		const { acquire, release } = orbLifecycle(h);
		acquire();
		release();
		acquire();
		expect(h.canvases).toHaveLength(2);
		expect(h.canvases[0]).not.toBe(h.canvases[1]);
	});

	it('描画面が取れなければ (null) canvas を残さない', () => {
		const h = host(() => null);
		orbLifecycle(h).acquire();
		expect(h.canvases[0].removed).toBe(true);
		expect(h.handed).toEqual([null]);
	});

	it('作る途中で投げても canvas を残さない', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const h = host(() => {
			throw new Error('シェーダーのリンクに失敗');
		});
		orbLifecycle(h).acquire();
		expect(h.canvases[0].removed).toBe(true);
		expect(h.handed).toEqual([null]);
	});

	it('start() の中で失敗したら canvas を外し、死んだ canvas を呼び元に渡さない', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const h = host((_canvas, onFail) => ({
			// renderer.ts の fail() と同じく、resize() の失敗は onFail で同期に返ってくる
			start: () => onFail(new Error('framebuffer が不完全')),
			destroy: () => {}
		}));
		orbLifecycle(h).acquire();
		expect(h.canvases[0].removed).toBe(true);
		expect(h.handed).toEqual([null]);
	});

	it('動き出したあとに失敗しても canvas を外し、呼び元の参照を切る', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		let fail: (e: unknown) => void = () => {};
		const h = host((_canvas, onFail) => {
			fail = onFail;
			return fakeOrb().api;
		});
		orbLifecycle(h).acquire();
		expect(h.handed).toEqual([h.canvases[0]]);
		fail(new Error('コンテキスト復帰に失敗'));
		expect(h.canvases[0].removed).toBe(true);
		expect(h.handed[1]).toBeNull();
	});
});
