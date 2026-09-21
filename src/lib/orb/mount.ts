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

	/* 描画・復帰・リサイズのどの失敗も (renderer.ts の fail())、マウントを壊さず canvas ごと
	   手放す (Task 10x で CSS の代替表示は廃止した)。呼び元 (今日画面の holeOrbCanvas) の参照も
	   onCanvas?.(null) で外す。ここを release() と非対称にすると、呼び元は死んだ canvas を
	   握ったままになり、preserveDrawingBuffer で保持された最後のフレームがカードの背後に
	   焼き付いたまま動かなくなる */
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

	/* Task 10i — 描画面 (WebGL context)は見えている間だけ握る。隠れたタブが握ったままだと、
	   手前のタブがガラスとオーブの分を作れずに描けなくなる。
	   手放すときは canvas ごと捨てる。一度 loseContext した canvas に getContext を呼んでも、
	   失ったままの同じ context が返るだけで新しい描画面は取れない (実測: 手放して戻ると
	   isContextLost() が true のまま何も描かれない)。作り直すたびに canvas も作り直す */
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
