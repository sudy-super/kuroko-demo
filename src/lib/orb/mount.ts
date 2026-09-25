/* オーブの canvas の出し入れ。Orb.svelte はここに box と作り手を渡すだけで、
   握る・手放す・失敗したときの後始末の順序はこのファイルに閉じる (Svelte の外なので試験できる) */
import type { Orb } from './renderer';

export type OrbHost = {
	/** canvas を入れる箱 */
	box: { prepend(canvas: HTMLCanvasElement): void };
	/** canvas を作る (既定は document.createElement) */
	createCanvas(): HTMLCanvasElement;
	/** WebGL のオーブを作る。描画面が取れなければ null、初期化に失敗すれば投げる */
	createOrb(canvas: HTMLCanvasElement, onFail: (e: unknown) => void): Orb | null;
	/** 今この部品が握っている canvas を呼び元に渡す (手放すときは null) */
	onCanvas?: (canvas: HTMLCanvasElement | null) => void;
};

/** whileVisible に渡す acquire / release の組 */
export function orbLifecycle(host: OrbHost): { acquire: () => void; release: () => void } {
	let orb: Orb | null = null;
	let canvas: HTMLCanvasElement | null = null;

	/* どの失敗も (renderer.ts の fail()) canvas ごと手放し、呼び元の参照も onCanvas?.(null) で外す。
	   外さないと preserveDrawingBuffer で残った最後のフレームがカードの背後に焼き付く */
	const drop = () => {
		orb = null;
		canvas?.remove();
		canvas = null;
		host.onCanvas?.(null);
	};
	const toFallback = (e: unknown) => {
		console.warn('orb: WebGL の描画に失敗したのでオーブを出しません', e);
		drop();
	};

	/* 描画面 (WebGL context) は見えている間だけ握る (隠れたタブが握ると手前のタブが描けない)。
	   一度 loseContext した canvas は getContext が失ったままの context を返すので、canvas ごと作り直す */
	const acquire = () => {
		canvas = host.createCanvas();
		host.box.prepend(canvas);
		try {
			orb = host.createOrb(canvas, toFallback);
			/* WebGL が無い、描画面を使い切っている。作り手は null を返すだけで投げない */
			if (!orb) return drop();
			orb.start();
		} catch (e) {
			return toFallback(e);
		}
		/* start() の中の resize() が同期的に失敗すると toFallback が先に走り、canvas を
		   すでに片付けている。その後始末を上書きしないよう、残っているときだけ渡す */
		if (canvas) host.onCanvas?.(canvas);
	};

	const release = () => {
		orb?.destroy();
		drop();
	};

	return { acquire, release };
}
