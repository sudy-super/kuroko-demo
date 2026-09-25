/* WebGL の描画面 (context) を見えている間だけ握るための土台。1 ページの描画面はおよそ 16 で、
   隠れたタブが握ったままだと手前のタブのガラスとオーブが描けない。隠れたまま delay が過ぎたら手放し、
   戻ったら作り直す。すぐ手放さないのは、タブを行き来するたびにシェーダーを作り直さないため。
   source を差し替えられるのは試験のため (node 環境に document が無い) */
export type VisibilitySource = {
	hidden: boolean;
	addEventListener(type: 'visibilitychange', listener: () => void): void;
	removeEventListener(type: 'visibilitychange', listener: () => void): void;
};

const HIDDEN_RELEASE_MS = 5000;

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
