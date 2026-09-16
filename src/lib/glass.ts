/* Liquid Glass — apple-liquid-glass-webgl (WebGL2) を要素に載せる Svelte の attachment。
   ライブラリは要素の背後にあるページの内容 (背景、文字、<canvas>) を自前で描き直し、
   角丸長方形の符号付き距離場を使って塗り・下ぼかし・縁の光沢を描く。角丸は CSS の
   border-radius を読む。WebGL2 が無い環境では backdrop-filter に落ち、要素に
   data-liquid-glass="fallback" が付く */
import {
	LiquidGlass,
	type LiquidGlassElementOptions,
	type LiquidGlassBackdropPainter
} from 'apple-liquid-glass-webgl';
import { whileVisible } from './visible';

/* Task 10u — ユーザーが示した参考画像 (iOS のタブバー、写真の上に浮く) に合わせて作り直した。
   裁定: 縁の屈折 (境目の像が曲がる見え方)はやめる。等倍で見えず、屈折があってもなくても
   画素が変わらないことは Task 10r 修正ラウンド1・10s の 2 回の対照実験で確定済み
   (見えない効果は値を上げ続けず画像で裁定を仰ぐ、というやり方を踏襲)。
   refraction / edgeReach / dispersion を 0 にし、面の中も縁も像を曲げない。
   rim / reflection / highlight / echo / hairline も 0 にした。これらは背景を反射で薄く
   映し込む効果で、参考画像の「太く明るい縁」はそういう反射ではなく不透明に近い白い縁取りな
   ので (下の CSS 疑似要素の帯で描く)、ライブラリ側で足しても混ざって効きが読めなくなるだけ。
   lightAngle は上のどれも 0 のときは一切使われない (uRim/uHighlight の係数がすべて 0 になる
   ため) ので、死んだ値として消した。
   backdropBlur と tint は BAR / CARD 側で個別に持つ (下を見よ) */
const LENS = {
	refraction: 0,
	edgeReach: 0,
	edgeWidth: 0,
	dispersion: 0,
	rim: 0,
	reflection: 0,
	highlight: 0,
	echo: 0,
	hairline: 0
} as const;

/* ナビ層のうち、下を通るのが色や形だけのもの (サイドナビ、連携アイコンの列、接続一覧)。
   塗り (tint)だけが面ごとに違うので、ここは CHROME_TIERS に渡す tint の置き場でしかない
   (ぼかしは描画面ごとの値なので BAR の backdropBlur が当たる。下の CHROME_TIERS の注記を見よ)。
   Task 10u — 参考画像は面が白っぽい (白の塗りがかなり乗る)。visual 3.1「大きい要素ほど
   不透明にする」とも向きが合うので、他のナビ層と同じ重さの白まで上げた。
   tint はライブラリの 0〜1.5 の目盛りで、CSS の不透明度とは一致しない */
export const CLEAR = { tint: 1.0 } as const;

/* 上部バーと依頼バーの段、およびナビ層 (サイドナビ・連携アイコンの列・接続一覧)。
   Task 10u — 参考画像 (iOS のタブバー) に合わせ、backdropBlur を大きく上げた。下を通る
   文字や形が読めず色だけ透けるのが目標で、ライブラリの目盛り上限 (64)の半分ほどの 32 で
   3 倍拡大でも文字の骨格が残らないことを確認した (compare-ref.png)。この backdropBlur は
   chromeGlass の共有 canvas 経由でナビ層 (サイドナビ・連携アイコンの列)にも当たる
   (下の CHROME_TIERS の注記を見よ)。tint も参考画像の白さに合わせて上げた */
export const BAR: LiquidGlassElementOptions = {
	tint: 1.3,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 32 }
};

/* 内容カード (Today のカード、Inbox/People/Projects/Companies の一覧カード)。
   Task 10u — BAR と同じ考え方で作り直した。背後に来るオーブは動く絵なので、静止画の
   バーより下 24px に抑えた (fps 実測は task-10u-report.md)。tint は 1.1 で、色は完全には
   消さず「色だけ透ける」参考画像の見え方を保つ (1.5 の上限まで寄せると色がほぼ消える) */
export const CARD: LiquidGlassElementOptions = {
	tint: 1.1,
	tintTone: 'light',
	material: { ...LENS, backdropBlur: 24 }
};

/* Task 10r — カードのガラスの背後にオーブを届ける描き手。
   ライブラリの itemsBelow (dom-content.js) は、宿主 (`.bento`) より DOM の描画順で
   後にあるものを一律に除外する。オーブ (`.hole > .orb`) は `.bento` の子孫なので、
   `backdrop: 'auto'` だけでは一度もカードの背後の絵に入らない (上の CARD の訂正を見よ)。
   README の「A <video> or <canvas> below the glass … To refract only that source,
   point at it」に沿い、`backdrop: ['auto', orbBackdrop(...)]` として 'auto' の上に
   専用の描き手を重ねる。オーブを `.bento` の外へ動かす案 (b) は、Today の環状配置が
   カードとオーブの重なりに依存している (visual 2.8 の 6、app.css の .hole) ため取らない。
   getCanvas() は今握っている <canvas> を返す関数を呼び元 (today/+page.svelte) から渡す。
   id セレクタで探さないのは、オーブが onMount の後で非同期に canvas を作る
   (Orb.svelte の onCanvas) ため、解決のタイミングを合わせる必要が生まれるから。
   毎フレーム呼ばれる描き手の中で最新の canvas を読むだけなら、そのタイミング合わせが要らない。
   getBoundingClientRect() だけで足りるのは `.orb canvas` が border/padding を持たない
   (app.css) ため。'off' クラス (描画面を手放して代替表示中、Task 10i) の間は
   実際のページ表示にも何も見えないので、同じく描かない */
export function orbBackdrop(getCanvas: () => HTMLCanvasElement | null): LiquidGlassBackdropPainter {
	return (ctx) => {
		const canvas = getCanvas();
		if (!canvas || canvas.classList.contains('off')) return;
		const box = canvas.getBoundingClientRect();
		ctx.drawImage(canvas, box.left, box.top, box.width, box.height);
	};
}

/* live: true で毎フレーム描き直す。オーブは <canvas> の中で毎フレーム描き変わり、
   ライブラリには変化の通知が来ないので、静止させるとガラスの中だけ背景が止まって見える。
   maxDpr は指定しない (ライブラリの既定 2)。一度 1 に落としていたが、画素の密度が高い
   ディスプレイでガラスの中だけ解像度が半分になる。
   respectReducedTransparency: false — OS 設定には応答しない (裁定済み) */
/* repaintMs — 背後を描き直す間隔 (ミリ秒)。省くと毎フレーム (live: true)。
   使うのはカレンダーの面 1 か所だけ。幅いっぱい x 約 660px と広く、毎フレーム描き直すと
   本番ビルドでも 30 フレーム/秒台に落ちる。この面の下に来るのは壁紙の階調だけなので、
   一定の間隔で描き直しても見た目は変わらない。
   refresh() は「次のフレームで背後を描き直す」印を立てるだけで、その間ガラスの rAF の輪は
   止まる。scroll と resize ではライブラリ側が別に起こすので、送っても追従する */
export function glass(options: LiquidGlassElementOptions, repaintMs?: number) {
	return (node: Element) => mount(node as HTMLElement, options, repaintMs);
}

/* Task 10i — 画面の枠 4 面 (サイドナビ、上部バー、連携の列、依頼バー)を 1 枚の canvas にまとめる。
   面ごとに 1 つずつ描画面 (WebGL context)を取ると、タブ 3 枚でブラウザの上限 (1 ページ約 16)に
   届いてしまう。まとめ先は本文の上・覆いの下に敷いた空の層 (.chrome、z-index 50)で、
   4 面はその層の子ではなく、きょうだいのまま動かさない。ライブラリは面の位置を
   入れ物の箱を基準に測るだけなので、画面いっぱいの層からなら画面のどこの面でも指せる。
   子にしないのは、入れ物の子孫がガラスの背後の絵から外れる決まりだからで、
   子にすると上部バーと依頼バーが下の文字を溶かせなくなる。逆に 4 面は層より後に描かれる
   ので (同じ z-index 50 で DOM の順が後)、面自身の文字や塗りは背後の絵に入らない。

   面ごとに違うのは塗り (tint)だけで、塗りは面ごとに渡せる。ぼかし (backdropBlur)は
   描画面ごとの値なので 4 面すべてに BAR の 32 (Task 10u)が当たる。サイドナビと連携の列の
   背後を通るのは地の階調だけ (本文は左右の margin で避けてあり、オーブも届かない)なので、
   ぼかしの強さが変わっても見た目への影響は小さい。
   bleed: 0 — 入れ物が画面いっぱいなので、外へはみ出す分はそもそも画面の外にある。
   既定の 63px を足すと縦横 126px ぶん無駄に広い canvas を毎フレーム塗り直すことになる */
const CHROME_TIERS = {
	'.sidebar, .rail': CLEAR.tint as number,
	'.header.glass, .chatbar': BAR.tint as number
};

/* 50 — 枠の層は画面いっぱいなので、毎フレーム描き直すと本文の文字をまるごと 1 枚に
   描き起こす処理が 60 回/秒 走る。カレンダーの月表示で 25 フレーム/秒まで落ちた。
   下の内容が動いたとき (スクロール、大きさや DOM の変化)はライブラリ側が別に描き直すので、
   この間隔が要るのはオーブのように何も知らせずに描き変わる canvas のためだけ。
   20 回/秒 に落としても見た目は変わらず、Today とカレンダーの週・月がすべて 60 に戻る */
export const chromeGlass = (node: Element) =>
	mount(node as HTMLElement, { ...BAR, bleed: 0 }, 50, CHROME_TIERS);

/* 面は出入りする (連携の列は連携が 0 件だと消え、上部バーは画面幅で solid と入れ替わる)。
   targets を文字列の selector で渡せばライブラリが自分で見張ってくれるが、それだと面ごとに
   塗りを変えられないので、要素の配列を自分で組み立て、.app の直下の子の増減だけ見張る
   (subtree まで見ると上部バーの時計が進むたびに解決し直しになる) */
function mount(
	node: HTMLElement,
	options: LiquidGlassElementOptions,
	repaintMs?: number,
	tiers?: Record<string, number>
) {
	const scope = tiers ? node.parentElement! : node;
	const targets = () =>
		Object.entries(tiers ?? {}).flatMap(([selector, tint]) =>
			[...scope.querySelectorAll(selector)].map((element) => ({ element, tint }))
		);
	let instance: LiquidGlass | null = null;
	let timer: ReturnType<typeof setInterval> | undefined;
	const watcher = tiers
		? new MutationObserver(() => instance?.update({ targets: targets() }))
		: null;

	const acquire = () => {
		instance = new LiquidGlass(node, {
			live: !repaintMs,
			respectReducedTransparency: false,
			...options,
			...(tiers ? { targets: targets() } : null),
			/* 描画面を失ったら CSS の代替へ倒す。ライブラリは属性を動かさないので、
			   放っておくと data-liquid-glass="webgl" のまま塗りが消えた透明な板が残る
			   (2026-09-16 にユーザーが見た壊れ方)。GPU のプロセスごと落ちて
			   webglcontextrestored が来ない場合は、この代替のまま保つ */
			onContextLost: () => node.setAttribute('data-liquid-glass', 'fallback'),
			onContextRestored: () => node.setAttribute('data-liquid-glass', 'webgl')
		});
		watcher?.observe(scope, { childList: true });
		/* 引数なしの refresh() は targets の解決と観測子 (ResizeObserver / MutationObserver) の
		   付け直しまでやり直す。ここで要るのは背後の描き直しだけなので backdrop: false を渡す。
		   ライブラリの .d.ts はこの引数を宣言していないが、実装 (src/dom.js の refresh) は受け取る。
		   隠れているタブでは描いても見えないので飛ばす */
		const repaint = instance.refresh as (o?: { backdrop?: boolean }) => void;
		if (repaintMs)
			timer = setInterval(() => {
				if (!document.hidden) repaint.call(instance!, { backdrop: false });
			}, repaintMs);
	};

	/* destroy() は属性を外して要素の style を戻すので、これだけで CSS の代替表示に戻る。
	   同期に済むため、手放す瞬間に何も描かれていない一瞬は生まれない */
	const release = () => {
		watcher?.disconnect();
		clearInterval(timer);
		timer = undefined;
		instance?.destroy();
		instance = null;
	};

	return whileVisible(acquire, release);
}
