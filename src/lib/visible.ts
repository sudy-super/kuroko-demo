/* Task 10i — WebGL の描画面 (context) を「見えている間だけ握る」ための土台。
   ブラウザが 1 ページに許す描画面はおよそ 16 で、ガラスとオーブはその 16 を食い合う。
   タブを何枚も開くと足りなくなり、ガラスは data-liquid-glass="fallback" に落ち、オーブは
   出なくなる (2026-09-16 のユーザー報告。Task 10x でオーブの CSS の代替表示は廃止した)。
   隠れているタブが握ったままなのが原因なので、隠れたまま delay が過ぎたら手放し、
   戻ったら作り直す。
   すぐに手放さないのは、タブを行き来しただけで毎回作り直すと復帰のたびに
   シェーダーの作り直しが走るため。5 秒あれば「隣のタブを見に行って戻る」は素通しになる。

   source を差し替えられるようにしてあるのは試験のため (試験は node 環境で document が無い)。 */
export type VisibilitySource = {
	hidden: boolean;
	addEventListener(type: 'visibilitychange', listener: () => void): void;
	removeEventListener(type: 'visibilitychange', listener: () => void): void;
};

export const HIDDEN_RELEASE_MS = 5000;

/** 画面が見えている間だけ acquire した資源を保つ。戻り値を呼ぶと後片付けまで済ませる */
export function whileVisible(
	acquire: () => void,
	release: () => void,
	options: { delay?: number; source?: VisibilitySource } = {}
): () => void {
	const { delay = HIDDEN_RELEASE_MS, source = document } = options;
	let held = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const drop = () => {
		timer = undefined;
		if (!held) return;
		held = false;
		release();
	};
	const sync = () => {
		if (source.hidden) {
			if (held && timer === undefined) timer = setTimeout(drop, delay);
			return;
		}
		clearTimeout(timer);
		timer = undefined;
		if (held) return;
		held = true;
		acquire();
	};
	source.addEventListener('visibilitychange', sync);
	sync();
	return () => {
		source.removeEventListener('visibilitychange', sync);
		clearTimeout(timer);
		drop();
	};
}
