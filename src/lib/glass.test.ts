import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ライブラリ本体は WebGL2 を要るので、描画面の作成と破棄だけを数える代役に差し替える。
   見るのは glass.ts の配線 (見えている間だけ握る、手放すときに間隔と観測子も畳む、
   面の出入りで targets を渡し直す) であって、ガラスの絵ではない */
const created: FakeGlass[] = [];
class FakeGlass {
	destroyed = false;
	updates: unknown[] = [];
	refreshed = 0;
	constructor(
		public node: unknown,
		public options: Record<string, unknown>
	) {
		created.push(this);
	}
	destroy() {
		this.destroyed = true;
	}
	update(o: unknown) {
		this.updates.push(o);
	}
	refresh = () => {
		this.refreshed++;
	};
}
vi.mock('apple-liquid-glass-webgl', () => ({ LiquidGlass: FakeGlass }));

/* node 環境には document も MutationObserver も無い。visible.ts が既定で見るのは
   document.hidden なので、そこだけを持つ代役を置く */
const observers: FakeObserver[] = [];
class FakeObserver {
	connected = false;
	constructor(public fn: () => void) {
		observers.push(this);
	}
	observe() {
		this.connected = true;
	}
	disconnect() {
		this.connected = false;
	}
}
const doc = {
	hidden: false,
	/* 覆いが開いている間 (data-overlay="on") は glass() の面を止める (glass.ts の mount) */
	body: { dataset: {} as Record<string, string> },
	listeners: new Set<() => void>(),
	addEventListener(_: string, fn: () => void) {
		this.listeners.add(fn);
	},
	removeEventListener(_: string, fn: () => void) {
		this.listeners.delete(fn);
	},
	set(hidden: boolean) {
		this.hidden = hidden;
		for (const fn of this.listeners) fn();
	}
};

/** .chrome の層と、その中で探される面を持つ最小の DOM もどき */
function fakeLayer(surfaces: Record<string, object[]>) {
	const node = {
		parentElement: {
			querySelectorAll: (selector: string) => surfaces[selector] ?? []
		}
	};
	return node as unknown as Element;
}

const { glass, chromeGlass, barGlass } = await import('./glass');

describe('ガラスの配線', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		created.length = 0;
		observers.length = 0;
		doc.hidden = false;
		doc.body.dataset = {};
		doc.listeners.clear();
		vi.stubGlobal('document', doc);
		vi.stubGlobal('MutationObserver', FakeObserver);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('覆いが開いている間は glass() の面を描き直しの輪から外し、閉じたら戻して描き直させる', () => {
		glass({})(fakeLayer({}));
		const surface = created[0] as unknown as { visible?: boolean; refreshed: number };
		expect(surface.visible).toBe(true);
		// 覆いの印を見張るのは observers の最後 (glass() は層ではないので面の見張りは無い)
		const watch = observers[observers.length - 1];
		doc.body.dataset.overlay = 'on';
		watch.fn();
		expect(surface.visible).toBe(false);
		const before = surface.refreshed;
		delete doc.body.dataset.overlay;
		watch.fn();
		expect(surface.visible).toBe(true);
		expect(surface.refreshed).toBe(before + 1);
	});

	it('取り付けで描画面を 1 つ取り、片付けで手放す', () => {
		const stop = glass({})(fakeLayer({}));
		expect(created).toHaveLength(1);
		stop();
		expect(created[0].destroyed).toBe(true);
	});

	it('隠れたまま 5 秒で手放し、戻ると取り直す (タブが描画面を握りっぱなしにしない)', () => {
		glass({})(fakeLayer({}));
		doc.set(true);
		vi.advanceTimersByTime(5000);
		expect(created[0].destroyed).toBe(true);
		doc.set(false);
		expect(created).toHaveLength(2);
		expect(created[1].destroyed).toBe(false);
	});

	it('面の塗りは tiers のとおりに渡り、面の出入りで渡し直す', () => {
		const sidebar = {};
		const header = {};
		chromeGlass(
			fakeLayer({
				'.sidebar, .rail, .side-toggle': [sidebar],
				'.header.glass, .header.solid, .bottomnav': [header]
			})
		);
		const targets = created[0].options.targets as { element: object; tint: number }[];
		expect(targets.map((t) => t.element)).toEqual([sidebar, header]);
		// サイドナビ (下を通るのは地の階調だけ) と上部バー (下を本文が通る) で塗りが違う
		expect(targets[0].tint).not.toBe(targets[1].tint);
		// 面の出入りを見張るのは層の直下だけ (glass.ts の mount 冒頭の前提)
		expect(observers[0].connected).toBe(true);
		observers[0].fn();
		expect(created[0].updates).toHaveLength(1);
	});

	it('まとめて描く層は間隔で描き直し、隠れている間は描かない', () => {
		const stop = chromeGlass(fakeLayer({}));
		vi.advanceTimersByTime(150);
		expect(created[0].refreshed).toBe(3);
		doc.hidden = true;
		vi.advanceTimersByTime(150);
		expect(created[0].refreshed).toBe(3);
		// 手放したら間隔も観測子も畳む (残ると死んだ描画面を叩き続ける)
		doc.hidden = false;
		stop();
		vi.advanceTimersByTime(150);
		expect(created[0].refreshed).toBe(3);
		expect(observers[0].connected).toBe(false);
	});

	it('依頼バーは層に乗らず自分の描画面を持つ (枠の面と同じ層に乗せると互いを映せないため)', () => {
		barGlass(fakeLayer({}));
		// tiers を持たない = 自分自身が面。層に乗せると層の段で切られた絵しか映せない
		expect(created[0].options.targets).toBeUndefined();
		expect(observers).toHaveLength(0);
	});

	it('描画面を失ったら属性を fallback に倒し、戻ったら webgl に戻す', () => {
		const attrs: Record<string, string> = {};
		const node = fakeLayer({}) as unknown as { setAttribute(k: string, v: string): void };
		node.setAttribute = (k, v) => (attrs[k] = v);
		glass({})(node as unknown as Element);
		const o = created[0].options as {
			onContextLost: () => void;
			onContextRestored: () => void;
		};
		o.onContextLost();
		expect(attrs['data-liquid-glass']).toBe('fallback');
		o.onContextRestored();
		expect(attrs['data-liquid-glass']).toBe('webgl');
	});
});
